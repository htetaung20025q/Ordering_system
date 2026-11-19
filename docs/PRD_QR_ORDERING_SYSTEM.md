# PRODUCT REQUIREMENTS DOCUMENT (PRD)
# QR ORDERING & KITCHEN MANAGEMENT SYSTEM

**Document Version:** 1.0 — User-Approved Baseline  
**Status:** Approved Requirements Specification  
**Architecture:** Modular Monolith (FastAPI + PostgreSQL)  
**System Interfaces:** Customer Mobile Web, Admin Panel, Chef Kitchen Display System (KDS)

---

## 1. PRODUCT VISION & OVERVIEW

The QR Ordering System provides a seamless, real-time dining and kitchen management experience for full-service restaurants.
Customers scan table-specific QR codes to independently order food directly from their mobile browser without downloading an app or registering an account. The kitchen staff receives itemized orders instantly on dedicated station screens, while restaurant management maintains physical table allocations, cryptographic QR tokens, and live order monitoring.

---

## 2. SYSTEM ACTORS & PRIMARY INTERFACES

### 2.1 Interface A: Customer Interface (Mobile Web)

Customers access the application directly by scanning a physical QR code placed on their dining table.

**Core Capabilities:**
1. **Zero-Login Access:** Ordering requires **no login authentication** or user profile creation.
2. **Table QR Auto-Resolution:** Automatically opens the menu bound to the scanned table.
3. **Menu Browsing:** Search, filter categories, view descriptions, allergens, and live stock levels.
4. **Order Placement:** Submit independent food orders associated with the table.
5. **Order Details Viewing:** Review ordered items, quantities, subtotal, and total bill in Myanmar Kyat (`MMK`).
6. **Real-Time Progress Tracking:** Monitor order progress across 4 customer-facing milestone stages:
   `Confirmed ➔ Prepare ➔ Cooking ➔ Order Ready`.
7. **Order Confirmation Voucher:**
   - Automatically generated immediately when the Chef confirms the order.
   - Viewable on mobile device as a digital voucher card.
   - Revisit-able anytime from the Order Details screen.
   - Downloadable as a print-ready, professional A4 PDF.
8. **Ready Alert & Pickup:**
   - Real-time notification when the food reaches **Ready** status.
   - Collect meal at the service counter under the **Customer Pickup** workflow.

### 2.2 Interface B: Admin Panel (Management Portal)

Restaurant owners and managers manage floor tables, security tokens, and operational workflows.

**Core Capabilities:**
1. **Table Management:** Create, configure, seat-count, activate, and deactivate restaurant tables.
2. **Cryptographic QR Code Generation:** Generate secure, unique, opaque random QR tokens per table.
3. **QR Code Export & Print:** Download high-resolution PNG or vector SVG files; print branded table stand cards.
4. **Token Rotation & Revocation:** Invalidate existing table tokens on-demand and regenerate new tokens.
5. **Table-Filtered Order Monitoring:**
   - Live stream of all floor orders.
   - **Filter by Specific Table:** Selecting a table (e.g. `Table 01`) filters the view to show exclusively orders belonging to Table 01.

### 2.3 Interface C: Chef / Kitchen Screen (KDS)

The Kitchen Display System focuses **exclusively on kitchen order operations**.

**Core Capabilities:**
1. **Newly Received Orders:** Displays newly submitted orders in real time.
2. **Active Orders by Station:** Routes dishes to assigned stations (`Main Kitchen`, `Bar`, `Dessert`).
3. **Table & Order Identification:** Prominently displays Table Number and sequential Order Number.
4. **Item Breakdown & Instructions:** Displays food items, quantities, and special preparation instructions.
5. **Chef Workflow Actions:**
   - **Confirm Order:** Accepts order into kitchen queue and triggers immediate voucher generation.
   - **Start Preparation:** Advances status to `preparing`.
   - **Start Cooking:** Advances status to `cooking`.
   - **Mark as Ready:** Advances status to `ready` and emits real-time alert to customer.
6. **Ready Orders View:** Dedicated tab displaying completed orders waiting for customer pickup.

**Strict Boundary Constraint:**
The Kitchen Screen must **NOT** contain unrelated Admin Panel functionality:
- ❌ No table creation or seating management.
- ❌ No QR generation, download, or revocation.
- ❌ No customer records or PII management.
- ❌ No financial reports or sales analytics.
- ❌ No general system administration.

---

## 3. TABLE QR CODE SPECIFICATION

1. **One-to-One Table Binding:** Each table has exactly **one active QR code** at any given time.
2. **Opaque Token Security:**
   - Tokens use high-entropy random strings (e.g. `/t/qr_9f8a3c2e1b4d7f5a`).
   - Predictable sequential IDs (e.g. `/t/1`, `/table/table-01`) are strictly prohibited.
3. **Scan Validation Sequence:**
   1. Application opens restaurant menu URL.
   2. Backend identifies the table token.
   3. Backend validates token validity, table active status, and restaurant ownership.
   4. Customer submits order bound to the validated table.
4. **Revocation & Invalidation:**
   - Inactive, revoked, or non-existent tokens are rejected with a clear user notice.

---

## 4. APPROVED WORKFLOW: INDIVIDUAL ORDER WORKFLOW

1. **Independent Order Entities:**
   - Every order submission is an independent order with its own unique `Order ID`.
   - Multiple orders from the same table operate completely independently.
   - Orders from the same table can have **different statuses simultaneously**:
     - *Table 01:* Order #1001 (Cooking), Order #1002 (Prepare), Order #1003 (Confirmed).
2. **No Cascading Statuses:** One order's status transition never automatically modifies another order's status.
3. **Canonical Internal Lifecycle:**
   ```text
   PENDING ➔ CONFIRMED ➔ PREPARING ➔ COOKING ➔ READY ➔ PICKED_UP
   ```
   - `PENDING` is an internal received state and is not shown on the customer 4-stage tracker.
   - `READY` means food is prepared and waiting for pickup.
   - `PICKED_UP` is the final terminal state after customer collects food.
4. **Transition Enforcement:** Backend enforces strict state transitions. Skipping or rolling back states is rejected.

---

## 5. CUSTOMER ORDER TRACKING & REAL-TIME SYNC

1. **Four Customer-Facing Milestone Stages:**
   - Stage 1: **Confirmed**
   - Stage 2: **Prepare**
   - Stage 3: **Cooking**
   - Stage 4: **Order Ready**
2. **Real-Time Synchronization:**
   - Real-time updates delivered via WebSockets/Server-Sent Events backed by PostgreSQL LISTEN / NOTIFY.
   - **REST Fallback:** Clients automatically fetch authoritative database state (`GET /api/v1/orders/{id}`) upon reconnecting.
3. **Order Status History:** Complete audit trail recording `order_id`, `previous_status`, `new_status`, `changed_by`, `changed_timestamp`.

---

## 6. CUSTOMER PICKUP WORKFLOW

1. **Pickup Model:** Customer Pickup model.
2. **Notification & Counter Collection:** When the Chef marks `READY`, the customer receives an alert, walks to the counter, and collects the meal.
3. **Pickup Verification Status:**
   > [!IMPORTANT]
   > **PENDING USER DECISION:** The pickup verification method (Pickup Number, Customer Pickup QR, or hybrid) is **NOT YET APPROVED**.
   > It is marked as pending user approval.
   > The pickup credential must be server-validated and separate from the table QR token.

---

## 7. ORDER CONFIRMATION VOUCHER SPECIFICATION

1. **Generation Trigger:** Automatically generated immediately when the Chef confirms the order (`PENDING → CONFIRMED`).
2. **Presentation:** Viewable as a digital mobile card and downloadable as an A4 PDF document.
3. **Included Information:**
   - Restaurant Name & Branding.
   - Order Number & Table Number.
   - Order Date and Time.
   - Order Confirmation Status.
   - Itemized food item names & quantities.
   - Unit prices, Subtotal, Discount (if any).
   - **Total Amount (Prominently Highlighted)**.
4. **Payment Information Rule (FINAL DECISION):**
   > [!IMPORTANT]
   > **TOTAL AMOUNT ONLY.**
   > - Displays Total Amount only.
   > - Must NOT display payment method (Cash, Card, E-Wallet).
   > - Must NOT display Paid / Unpaid status.
   > - Must NOT display payment transaction or gateway details.
   > - **The Voucher is NOT a Payment Receipt.**
5. **Data Snapshot Integrity:**
   - Item names snapshot: `item_name_snapshot`.
   - Unit prices snapshot: `unit_price_snapshot`.
   - Historical vouchers never change when future menu prices update.
6. **Generation Reliability:**
   - Unique voucher number per order.
   - PDF rendering failure does not block order confirmation; retryable on-demand.
   - Repeated confirmation calls are idempotent (no duplicate vouchers).

---

## 8. NON-FUNCTIONAL & CONCURRENCY REQUIREMENTS

1. **Zero Race Conditions:** Row-level locking (`SELECT ... FOR UPDATE`) on order mutations and atomic stock decrements (`WHERE current_stock >= :qty`).
2. **Security & OWASP:** IDOR immunity on staff endpoints, strict schema validation, SQL injection immunity via ORM parameterized queries.
3. **Scalability:** Stateless JWT staff authentication; asynchronous non-blocking I/O.
