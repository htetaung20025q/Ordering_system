# FLOW-SYS Architectural & Engineering Defense

This document provides a formal, comprehensive engineering defense of the FLOW-SYS Ordering System backend architecture as specified in [Agentic.md](file:///home/htetagg/Ordering_System/Agentic.md).

---

## 1. Race Conditions Defense

### 1.1 The Problems
1. **Concurrent Stock Depletion (Lost Update / Overselling):**
   * *Scenario:* Product A has 1 unit remaining in stock. Two customers simultaneously submit an order for Product A. If both application threads read `current_stock == 1` concurrently, both validate successfully and write `current_stock = 0`, resulting in overselling (2 orders sold against 1 physical unit).
2. **Concurrent Multi-Round Numbering:**
   * *Scenario:* Two diners at Table 3 scan the QR code and submit round items simultaneously. If both threads query `order.current_round` and increment it concurrently in memory, both might attempt to assign `round_number = 2`, corrupting the sequential history or triggering unique constraint violations.
3. **Double Payment / Duplicate Charge:**
   * *Scenario:* Network latency causes a user to click "Pay" twice in rapid succession. Two concurrent payment requests reach the backend for the same order, creating two charges.

### 1.2 Architectural Defenses Implemented
* **Atomic Conditional Database Updates:**
  Instead of doing a vulnerable "check-then-act" in Python memory (`if stock >= qty: stock -= qty`), stock reduction is executed directly at the database engine level:
  ```sql
  UPDATE stocks 
  SET current_stock = current_stock - :qty 
  WHERE product_id = :product_id AND current_stock >= :qty;
  ```
  If `rowcount == 0`, the transaction knows that the stock was concurrently exhausted and immediately rolls back and raises an `InsufficientStockError` (HTTP 400).
* **Database Check Constraints:**
  At the schema level:
  ```sql
  CONSTRAINT chk_stock_non_negative CHECK (current_stock >= 0)
  ```
  This guarantees that even in unexpected edge cases, stock can never drop below zero.
* **Row-Level Locking on Parent Order:**
  For multi-round ordering, row-level locks (`SELECT ... FOR UPDATE` on `orders WHERE id = :id`) serialize round incrementation within the transaction boundary.
* **Unique Idempotency & Transaction Reference:**
  Payments require unique `transaction_reference` keys backed by database unique indexes to block duplicate concurrent submissions.

---

## 2. Concurrency Defense

### 2.1 The Problems
* High traffic peaks (e.g. lunch/dinner rush) where hundreds of tables, delivery drivers, and kitchen stations concurrently read and write to the database.
* Thread starvation, database connection exhaustion, or transaction deadlocks when locking resources in differing orders.

### 2.2 Architectural Defenses Implemented
* **Asynchronous Non-Blocking I/O:**
  Built with **FastAPI** on top of **Starlette / AnyIO** and **SQLAlchemy 2.0 AsyncIO** with `asyncpg` / `aiosqlite`. Network I/O (database queries, HTTP client requests) does not block Python OS threads, enabling high concurrency on minimal hardware.
* **Granular Database Sessions:**
  Every HTTP request is isolated to its own `AsyncSession` managed by FastAPI's dependency injection (`get_db`). Connections are returned immediately to the connection pool upon request completion.
* **Consistent Lock Ordering:**
  To prevent deadlocks when updating multiple inventory items in a single order, product IDs are acquired and updated in sorted order (`ORDER BY product_id ASC`).

---

## 3. Performance Defense

### 3.1 The Problems
* **N+1 Query Problems:** Iterating over orders and querying items or categories individually generates dozens of roundtrips per request.
* **Large Table Scans:** Reading active orders or KDS tickets across hundreds of historical records without appropriate indexes.
* **Slow Price Computations:** Recalculating totals repeatedly during kitchen or display queries.

### 3.2 Architectural Defenses Implemented
* **Eager Loading Strategies:**
  Using SQLAlchemy 2.0 `selectinload(Order.items)` and `selectinload(Product.stock)` ensures that related collections are fetched in a single optimized query rather than N+1 queries.
* **Targeted Composite & Partial Indexing:**
  - `orders (customer_id, status)`
  - `kitchen_tickets (station, status)`
  - `products (category_id, is_available)`
  - `stocks (product_id)` (unique)
* **Authoritative Price Snapshotting:**
  When an order is created, `unit_price`, `item_name`, and `subtotal` are snapshot onto `order_items`. This avoids runtime joins to the `products` table for historical views and guarantees that future menu price changes do not invalidate past invoices.
* **Offset/Limit Pagination:**
  All listing endpoints support `skip` and `limit` to prevent unbounded query allocations.

---

## 4. Network Reliability Defense

### 4.1 The Problems
* Network packet loss, mobile customer disconnects, or client dropouts right after an order is submitted or paid.
* Retried requests causing duplicate orders or phantom tickets.

### 4.2 Architectural Defenses Implemented
* **ACID Transaction Boundaries:**
  Order creation, stock deduction, and ticket generation execute inside a single atomic database transaction. If the connection terminates prematurely, the transaction rolls back cleanly, leaving no orphaned orders, partial tickets, or missing stock.
* **Source of Truth Discipline:**
  Clients do not rely on transient network states or WebSocket messages alone. Upon reconnecting, the client queries the REST API (`GET /orders/{id}`) to re-synchronize authoritative database state.
* **Client Idempotency Keys:**
  Orders and payments generate unique, predictable tokens (`ORD-YYYYMMDD-...` and `TXN-...`) allowing repeated submissions to identify already-processed transactions.

---

## 5. Data Consistency Defense

### 5.1 The Problems
* Inconsistencies between what the customer ordered and what the kitchen sees.
* Price manipulation: malicious clients attempting to inject tampered unit prices (`"price": 0.01`).
* Discrepancies between payment records and order amounts.

### 5.2 Architectural Defenses Implemented
* **Never Trust the Client:**
  The `OrderItemCreate` API schema **only** accepts `product_id` and `quantity`. The backend retrieves authoritative prices directly from the database and calculates subtotals server-side.
* **Exact Monetary Storage:**
  All monetary fields (`price`, `total_amount`, `amount`, `subtotal`) use `NUMERIC(12, 2)` (Python `Decimal`), eliminating floating-point rounding errors common with `FLOAT` or `DOUBLE PRECISION`.
* **Foreign Key Referential Integrity:**
  - `ON DELETE RESTRICT` on `categories` and `products` prevents deletion of items that belong to historical orders.
  - `ON DELETE CASCADE` on `order_items` ensures clean lifecycles linked directly to their parent order.
* **Decoupled Order and Kitchen Lifecycles:**
  Kitchen tickets have their own state machine (`new` -> `accepted` -> `preparing` -> `ready` -> `served`). Station tickets operate independently (e.g. bar drinks are served while main kitchen food is still preparing), preventing inconsistent forced overall states.

---

## 6. Payment Processing Defense & State Machine

### 6.1 The Core Business Rules (from `Agentic.md`)
1. **Rule 1:** *If when user is paying for the order, the payment fails, the order should not be created.*
2. **Rule 2:** *If the payment is successful, the order should be created.*
3. **Rule 3:** *If the payment is cancelled, the order should be cancelled.*

### 6.2 Architectural Implementation
* **Rule 1 & Rule 2 Enforcement (`POST /api/v1/payments/checkout`):**
  - The checkout process runs in a single database transaction.
  - Payment authorization is requested from the payment processor first.
  - **On Payment Failure:**
    The transaction is aborted and rolled back. No `Order` record is committed, no `KitchenTicket` is generated, and **no inventory stock is deducted**. The API returns HTTP `402 Payment Required`.
  - **On Payment Success:**
    The `Order` is created, stock is deducted, `KitchenTicket`s are routed to kitchen stations, and the `Payment` is recorded as `successful`. The transaction commits atomically.
* **Rule 3 Enforcement (`PUT /api/v1/payments/{id}`):**
  - When a payment is transitioned to `cancelled`, the service triggers `order_service.cancel_order(payment.order_id)`.
  - The order status is updated to `cancelled`, all active kitchen tickets are marked `cancelled`, and **inventory stock is restored** back to the shelves.

