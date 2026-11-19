# FLOW-SYS
# SYSTEM WORKFLOW & FUNCTIONAL SPECIFICATION

**Document Version:** 3.0 — Approved Requirements Integration  
**System Type:** Table QR Ordering, KDS & Restaurant Management System  
**Backend Target:** FastAPI (Modular Monolith)  
**Database Target:** PostgreSQL 15+  
**Primary Interfaces:** Customer Interface, Admin Panel, Chef / Kitchen Screen (KDS)

---

# 1. SYSTEM OVERVIEW & PRIMARY INTERFACES

## 1.1 Purpose

FLOW-SYS is an enterprise restaurant ordering and management system connecting customer self-service QR ordering, kitchen preparation operations, administrative table/QR management, and billing.

The system enforces strict architectural separation across three dedicated interfaces:

### Interface A: Customer Interface (Mobile Web)
Customers interact without requiring account registration:
- Scan physical table QR code with mobile camera/browser.
- Automatically access the validated table's live menu.
- Browse categories, food items, images, descriptions, and real-time stock availability.
- Place independent food orders associated with the table.
- View real-time order details and itemized pricing.
- Track order preparation progress across 4 customer-facing stages.
- Receive an **Order Confirmation Voucher** immediately after the Chef confirms the order.
- View the digital voucher on mobile device.
- Revisit the voucher anytime from Order Details.
- Download the voucher as a print-ready A4 PDF.
- Receive immediate push/real-time notifications when the order reaches **Ready** status.
- Present for customer pickup at the service counter.

### Interface B: Admin Panel (Management Portal)
Administrators and Restaurant Managers manage physical operations:
- Create and manage restaurant tables (capacity, section, status).
- Generate a unique, cryptographically random QR code for each table.
- Download QR codes in high-resolution vector (SVG) or raster (PNG) formats.
- Print official branded table QR display cards.
- Regenerate or revoke QR tokens on-demand (e.g. table turnaround, compromised token).
- Activate and deactivate tables (e.g. maintenance, closure).
- View and monitor restaurant-wide orders.
- Filter, search, and monitor orders by specific table (e.g. selecting Table 01 displays exclusively orders for Table 01).
- Manage food categories, dishes, prices, and stock inventory.

### Interface C: Chef / Kitchen Screen (KDS Display)
The Kitchen Display System focuses **exclusively on kitchen order operations**:
- Real-time display of newly received orders.
- Live display of active kitchen orders grouped by station.
- Prominent display of Table Numbers and sequential Order Numbers.
- Detailed item breakdown (dishes, quantities, stations, modifiers).
- Highlighted special instructions and allergy alerts.
- One-click workflow action: **Confirm Order** (triggers voucher generation).
- Step-by-step progress advancement: Start Preparation ➔ Start Cooking ➔ Mark as Ready.
- Distinct view tab for **Ready** orders awaiting customer pickup.
- **Strict Boundary Constraint:** The Kitchen Screen must NOT contain unrelated Admin Panel functionality (no table management, no QR generation, no customer PII, no financial reports, no general system administration).

## 1.2 System Actors & Permissions

| Actor | Primary Interface | Scope & Responsibilities |
|---|---|---|
| **Customer** | Customer Interface | Scan table QR, browse menu, place orders, track order stages, view/download voucher, pickup food |
| **Owner** | Admin Panel & KDS | Full administrative privileges, financial reports, token rotation, system configuration |
| **Manager** | Admin Panel | Table & QR management, menu CRUD, stock adjustments, order voiding, order monitoring by table |
| **Kitchen Chef** | Chef KDS Screen | Confirm orders, advance preparation status (`prepare → cook → ready`), monitor active stations |
| **Cashier / Waiter**| Admin / POS | Assist table ordering, billing closure, pickup handoff confirmation |

---

# 2. TABLE QR CODE ARCHITECTURE & SECURITY

## 2.1 Table QR Lifecycle & Validation Flow

Each physical table in the restaurant has **exactly one active QR code** at any given time.

```text
Customer Device                       Backend API                        PostgreSQL DB
      |                                    |                                   |
      | 1. Scans Table QR Code             |                                   |
      |    GET /t/{qrToken}               |                                   |
      |----------------------------------->|                                   |
      |                                    | 2. SELECT table WHERE             |
      |                                    |    qr_token = :token              |
      |                                    |---------------------------------->|
      |                                    | 3. Validate Token Exists,         |
      |                                    |    table.is_active == TRUE,       |
      |                                    |    restaurant.is_active == TRUE   |
      |                                    |<----------------------------------|
      | 4. Returns Table Context & Menu    |                                   |
      |    { table_id, number, menu_items }|                                   |
      |<-----------------------------------|                                   |
      |                                    |                                   |
      | 5. Customer Submits Order          |                                   |
      |    POST /api/v1/orders             |                                   |
      |    (with qr_token & items)         |                                   |
      |----------------------------------->| 6. Re-verifies Table Token        |
      |                                    |    Associates Order to Table ID   |
      |                                    |---------------------------------->|
```

## 2.2 QR Security & Token Rules

1. **Opaque Random Tokens:** Public QR URLs must never use predictable, sequential database IDs (e.g. `/table/1`). Tokens must use high-entropy cryptographic strings (e.g. `/t/qr_9f8a3c2e1b4d7f5a`).
2. **One Active Token per Table:** A table has exactly one active token. Old tokens are recorded with `revoked_at` timestamp.
3. **Revocation & Regeneration:** Managers can rotate table QR tokens from the Admin Panel. Rotating a token immediately invalidates the previous token for new order submissions.
4. **Rejection of Invalid Tokens:** If a scanned QR token is invalid, expired, revoked, or belongs to a deactivated table, the backend rejects the session with HTTP 403/404 and displays an "Invalid Table QR Code" notice.
5. **Restaurant Ownership Binding:** The token verification strictly checks that the table belongs to the active licensed restaurant entity.

---

# 3. APPROVED ORDER WORKFLOW — INDIVIDUAL ORDER WORKFLOW

## 3.1 Core Workflow Decision (Approved)

The system enforces the **INDIVIDUAL ORDER WORKFLOW**:
- Every customer order submission is managed as an **independent order entity** with its own unique `Order ID` and sequential `Order Number`.
- Multiple orders placed from the same table operate completely independently.
- Multiple orders from the same table may have **different statuses simultaneously**.

**Example:**
```text
Table 01 Orders:
├── Order #1001 — Cooking    (Main courses submitted at 12:15 PM)
├── Order #1002 — Prepare    (Side dishes submitted at 12:22 PM)
└── Order #1003 — Confirmed  (Desserts & drinks submitted at 12:35 PM)
```

**Strict Independence Rule:** One order's status transition must **never** automatically change another order's status merely because both belong to the same table.

## 3.2 Canonical Internal Order Lifecycle

The system enforces a 6-stage internal lifecycle:

```text
  [ PENDING ] (Internal received state)
       │
       ▼ (Chef Action 1: Confirm Order -> Generates Voucher)
  [ CONFIRMED ]
       │
       ▼ (Chef Action 2: Start Preparation)
  [ PREPARING ]
       │
       ▼ (Chef Action 3: Start Cooking)
  [ COOKING ]
       │
       ▼ (Chef Action 4: Mark as Ready -> Triggers Customer Notification)
  [ READY ]
       │
       ▼ (Pickup Verification -> Customer Collects Food)
  [ PICKED_UP ] (Final Terminal State)
```

- **PENDING:** Initial internal state immediately after customer submission. This state is internal to the backend/KDS and is **not** displayed as one of the 4 customer-facing progress stages.
- **CONFIRMED:** The Chef has reviewed and accepted the order into the kitchen queue. This triggers immediate **Order Confirmation Voucher** generation.
- **PREPARING:** Kitchen staff have initiated ingredient prep and assembly.
- **COOKING:** Food items are actively on the stove, grill, or oven.
- **READY:** All items in the order are completed, plated, and waiting at the pickup counter. The customer receives an immediate Ready notification.
- **PICKED_UP:** The customer has verified and collected the meal. Distinct from `READY`.

## 3.3 Chef Actions on Kitchen Display System (KDS)

The Chef advances tickets using strict state transitions:
1. **Confirm Order:** `PENDING → CONFIRMED` (Snapshot saved, voucher created).
2. **Start Preparation:** `CONFIRMED → PREPARING`.
3. **Start Cooking:** `PREPARING → COOKING`.
4. **Mark as Ready:** `COOKING → READY` (Real-time notification emitted).

**Transition Validation:**
The backend validates every transition using state-machine validation. Skipping stages (e.g. `PENDING → READY`) or unapproved rollbacks are strictly rejected with HTTP 422 Unprocessable Entity.

---

# 4. CUSTOMER ORDER TRACKING & REAL-TIME SYNCHRONIZATION

## 4.1 Four Customer-Facing Progress Stages

Customers track their order through 4 clear, scannable milestone stages:

```text
[ 1. Confirmed ] ───▶ [ 2. Prepare ] ───▶ [ 3. Cooking ] ───▶ [ 4. Order Ready ]
```

When the customer collects the order at the counter, the UI updates to show the terminal **Picked Up** state.

## 4.2 Real-Time Event Synchronization & REST Fallback

```text
Chef Action (KDS) ──▶ PostgreSQL Transaction (Commit) ──▶ Real-Time Event Published
                                                                    │
                                                                    ▼
                                                            WebSocket Broadcast
                                                                    │
                                                                    ▼
                                                            Customer UI Updates
```

1. **Database as Single Source of Truth:** State changes are committed in ACID transactions before events are broadcast.
2. **Durable Fallback via REST:** WebSocket notifications notify the client of state changes. If a mobile device loses connection, reconnecting triggers a polling fetch (`GET /api/v1/orders/{id}`) to re-synchronize authoritative state.
3. **Audit Logging (Order Status History):** Every transition is permanently recorded in `order_status_history`:
   - `order_id`
   - `previous_status`
   - `new_status`
   - `changed_by` (Chef user ID)
   - `changed_timestamp`

---

# 5. CUSTOMER PICKUP WORKFLOW

## 5.1 Pickup Model

The system operates on the **CUSTOMER PICKUP** model:
1. When the Chef marks an order as `READY`, the customer receives an immediate on-screen visual alert and browser notification.
2. The customer walks to the restaurant pickup counter.
3. The customer collects their food after pickup verification.
4. The staff verifies the pickup credential and marks the order as `PICKED_UP`.

## 5.2 Pickup Verification Status

> [!IMPORTANT]
> **PENDING USER DECISION:** The specific pickup verification credential method has **not yet been approved by the user**. Potential options include:
> - Option A: Order Pickup Number matching.
> - Option B: Customer Pickup QR code scanned by staff at the counter.
> - Option C: Hybrid Number + QR verification.
>
> The system strictly documents this as **PENDING USER DECISION** and does NOT implement any unapproved verification mechanism.
>
> **Architectural Guardrail:** Regardless of the final chosen method, the pickup verification credential must be server-validated and **strictly separate from the table QR token**.

---

# 6. ORDER CONFIRMATION VOUCHER SPECIFICATION

## 6.1 Generation Trigger & Access

- **Trigger:** Generated immediately and automatically upon the Chef successfully transitioning the order to `CONFIRMED`.
- **Digital Access:** Customer can view the digital voucher card directly on mobile immediately after confirmation and revisit it anytime from Order Details.
- **PDF Download:** A dedicated "Download Voucher (PDF)" action generates and downloads an A4 print-ready PDF document.

## 6.2 Content & Information Display

The Order Confirmation Voucher contains:
- Restaurant Name & Branding.
- Order Number (e.g. `ORD-20261115-0012`).
- Table Number (e.g. `Table 04`).
- Order Date & Timestamp (Asia/Yangon).
- Order Status: **Confirmed**.
- Itemized food item names.
- Quantities ordered.
- Unit prices.
- Subtotal.
- Discount (if applicable).
- **Total Amount (Prominently Highlighted)**.

### Payment Information — Final Approved Decision

> [!IMPORTANT]
> **FINAL APPROVED DECISION: TOTAL AMOUNT ONLY.**
>
> By explicit user instruction:
> - The voucher displays the **Total Amount only**.
> - The voucher must **NOT** display payment method (Cash, Card, E-Wallet).
> - The voucher must **NOT** display Paid / Unpaid status.
> - The voucher must **NOT** display payment transaction or gateway details.
>
> **The Order Confirmation Voucher is NOT a Payment Receipt.** Payment workflows and payment records remain strictly separated from confirmation vouchers.

## 6.3 Voucher Data Snapshot & Immutability

To guarantee that future menu item name or price changes never alter historical vouchers:
- Item names are snapshot into `item_name_snapshot`.
- Unit prices are snapshot into `unit_price_snapshot`.
- Confirmed order total is stored in `confirmed_total`.
- Voucher records are stored in `order_vouchers` linked by unique `voucher_number`.
- **Idempotency Rule:** Repeated Chef confirmation calls must never create duplicate voucher records.
- **Fault-Tolerance Rule:** PDF generation failure must never block or rollback an already confirmed order. PDF rendering is retryable on-demand.

---

# 7. ADMIN PANEL SPECIFICATION

The Admin Panel provides operational control for owners and managers:

1. **Table Management:**
   - Create, edit, and deactivate restaurant tables.
   - Assign table numbers and seating capacities.
2. **Table QR Code Generation & Printing:**
   - Generate secure opaque QR tokens for tables.
   - Download individual or batch table QR codes as vector SVG or high-res PNG.
   - Print pre-formatted table display cards.
   - Regenerate / revoke tokens when tables turn over or if tokens are compromised.
3. **Table-Filtered Order Monitoring:**
   - Live order stream showing active orders across the floor.
   - Filter by table: selecting a specific table (e.g. Table 01) filters the view to show exclusively orders belonging to Table 01, displaying their individual statuses (`Order #1001: Cooking`, `Order #1002: Prepare`).
4. **Menu & Category CRUD:**
   - Add, edit, and delete food items, prices, and station assignments.
   - Live stock quantity adjustments and low-stock alerts.

---

# 8. ARCHITECTURAL DATA INTEGRITY & CONCURRENCY

1. **ACID Transactions:** Order creation, status updates, voucher generation, and inventory deductions execute inside atomic database transactions.
2. **TOCTOU & Race Condition Immunity:** Stock deductions use atomic database conditional updates (`UPDATE stocks SET current_stock = current_stock - :qty WHERE product_id = :id AND current_stock >= :qty`).
3. **Status Race Protection:** Order status changes use row-level locking (`SELECT ... FOR UPDATE`) to prevent concurrent race conditions between multiple staff members or retried requests.
4. **Strict 3-Tier Separation:** `Router/Controller` ➔ `Service` ➔ `Repository/Model`. No raw queries or business logic in routes or UI.

---

# 9. BUSINESS DECISIONS RESOLUTION MATRIX

| ID | Decision Item | Status | Approved Resolution |
|---|---|---|---|
| **WF-01** | Table Order Structure | **RESOLVED** | **Individual Order Workflow:** Each order is managed independently. Orders from the same table have independent lifecycles. |
| **WF-02** | Customer Order Stages | **RESOLVED** | 4 customer-facing stages: `Confirmed ➔ Prepare ➔ Cooking ➔ Order Ready`, followed by `Picked Up`. |
| **WF-03** | Internal Order Lifecycle | **RESOLVED** | `PENDING → CONFIRMED → PREPARING → COOKING → READY → PICKED_UP`. |
| **WF-04** | Voucher Generation Trigger | **RESOLVED** | Generated immediately when Chef confirms the order. Available digitally and as A4 PDF. |
| **WF-05** | Voucher Payment Display | **RESOLVED** | **Total Amount Only.** No payment method, no Paid/Unpaid status. Voucher is not a payment receipt. |
| **WF-06** | Table QR Security | **RESOLVED** | Cryptographically random opaque tokens. Revocable & regenerable. Non-sequential. |
| **WF-07** | Kitchen Screen Scope | **RESOLVED** | Exclusively kitchen operations. No table management, no QR generation, no analytics. |
| **WF-08** | Admin Table Order Filter | **RESOLVED** | Admin can select a specific table (e.g. Table 01) to view only its associated orders. |
| **WF-09** | Pickup Model | **RESOLVED** | Customer Pickup model. Food collected at counter upon Ready notification. |
| **WF-10** | **Pickup Verification Method** | **PENDING** | **PENDING USER DECISION:** Choice between Pickup Number, Pickup QR code, or hybrid. |
| **WF-11** | Customer Login Requirement | **RESOLVED** | Customer ordering requires **no login authentication**. Open guest ordering. |
| **WF-12** | Staff Login Requirement | **RESOLVED** | Staff (Admin, Manager, Chief) must authenticate with dedicated username & password. |

---

# 10. IMPLEMENTATION PRINCIPLES

1. Preserve all approved user requirements.
2. Keep Customer, Admin, and KDS boundaries strictly isolated.
3. Treat PostgreSQL as the immutable source of truth.
4. Maintain price and item name snapshots for all confirmed orders and vouchers.
5. Never implement unapproved pickup verification mechanisms without user approval.
6. Enforce zero race conditions using database-level locking and atomic constraints.

**END OF DOCUMENT — FLOW-SYS SYSTEM WORKFLOW V3.0**
