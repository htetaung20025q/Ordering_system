# ORDER CONFIRMATION VOUCHER SPECIFICATION
# FLOW-SYS RESTAURANT SYSTEM

**Document Version:** 1.0 — Approved Specification  
**Status:** Approved Requirements  
**Target Format:** Digital Mobile Card & Printable A4 PDF

---

## 1. PURPOSE & BUSINESS CONTEXT

The **Order Confirmation Voucher** serves as an authoritative, customer-facing confirmation that their dining order has been received, accepted, and queued for cooking by the kitchen Chef.

It provides diners with a clear, itemized reference of what was ordered and the total amount committed, while providing the restaurant with an immutable audit snapshot.

> [!IMPORTANT]
> ### FINAL APPROVED PAYMENT DECISION: TOTAL AMOUNT ONLY
> By explicit user instruction:
> 1. The voucher displays the **Total Amount only**.
> 2. The voucher must **NOT** display payment method (e.g. Cash, Credit Card, E-Wallet).
> 3. The voucher must **NOT** display Paid / Unpaid payment status.
> 4. The voucher must **NOT** display payment transaction numbers, terminal IDs, or gateway references.
> 
> **The Order Confirmation Voucher is NOT a Payment Receipt.**
> Payment processing, cash collection, and billing POS operations remain strictly decoupled from the confirmation voucher lifecycle.

---

## 2. GENERATION LIFECYCLE & INTEGRITY

### 2.1 Trigger & Flow Sequence

```text
Customer Device                       Chef KDS Screen                      Backend & Database
      |                                      |                                      |
      |                                      | 1. Chef clicks [Confirm Order]       |
      |                                      |    PUT /api/v1/kds/orders/{id}/confirm
      |                                      |------------------------------------->|
      |                                      |                                      | 2. DB Transaction Begins
      |                                      |                                      |    - Verify status == 'pending'
      |                                      |                                      |    - UPDATE status = 'confirmed'
      |                                      |                                      |    - Set confirmed_at = NOW()
      |                                      |                                      |    - INSERT INTO order_vouchers
      |                                      |                                      |    - INSERT INTO order_status_history
      |                                      |                                      |    - COMMIT Transaction
      |                                      | 3. Response: 200 OK                  |
      |                                      |<-------------------------------------|
      | 4. Real-Time WebSocket Event Received|                                      |
      |    event: "order_confirmed"          |                                      |
      |<----------------------------------------------------------------------------|
      | 5. Customer fetches Voucher Card     |                                      |
      |    GET /api/v1/orders/{id}/voucher   |                                      |
      |---------------------------------------------------------------------------->|
      | 6. Returns Voucher Data JSON         |                                      |
      |<----------------------------------------------------------------------------|
      |                                      |                                      |
      | 7. (Optional) Customer Downloads PDF |                                      |
      |    GET /api/v1/orders/{id}/voucher/pdf                                      |
      |---------------------------------------------------------------------------->|
      | 8. Streams binary A4 PDF             |                                      |
      |<----------------------------------------------------------------------------|
```

### 2.2 Reliability & Fault-Tolerance Rules

1. **Transaction Isolation:** The voucher record (`order_vouchers`) and confirmation timestamp (`confirmed_at`) are committed to PostgreSQL inside the same transaction as the status transition (`PENDING → CONFIRMED`).
2. **Non-Blocking PDF Generation:** Generating the physical PDF document is handled asynchronously or on-demand. A PDF rendering glitch or font-loading failure must **never** invalidate or rollback an already confirmed order.
3. **Retryable PDF Rendering:** If PDF rendering fails on first request, subsequent download requests immediately re-attempt generation from the stored database snapshot.
4. **Idempotency Guarantee:** Repeated clicks of "Confirm Order" by the Chef must not generate duplicate vouchers. The backend enforces unique constraint `UNIQUE(order_id)` on `order_vouchers`.
5. **Security & Ownership Verification:** Only authorized devices with the order session or staff credentials can access the voucher.

---

## 3. DATA SCHEMA & SNAPSHOT INTEGRITY

### 3.1 Snapshot Immutability Rule

Historical vouchers must **never change** when future menu items or prices are modified.
The system snapshots item names and unit prices directly at order confirmation time.

### 3.2 Database Schema Alignment

```sql
-- Orders Table Confirmation Metadata
ALTER TABLE orders 
ADD COLUMN confirmed_at TIMESTAMPTZ,
ADD COLUMN confirmed_by BIGINT REFERENCES users(id),
ADD COLUMN confirmed_total NUMERIC(12, 2),
ADD COLUMN currency VARCHAR(10) DEFAULT 'MMK';

-- Order Items Snapshots
ALTER TABLE order_items
ADD COLUMN item_name_snapshot VARCHAR(255) NOT NULL,
ADD COLUMN unit_price_snapshot NUMERIC(12, 2) NOT NULL;

-- Order Vouchers Table
CREATE TABLE order_vouchers (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    voucher_number VARCHAR(64) NOT NULL UNIQUE, -- e.g. VCH-20261115-0012
    pdf_storage_key TEXT,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE
);
```

---

## 4. VOUCHER CONTENT SPECIFICATION

The Order Confirmation Voucher contains the following mandatory data fields:

| Field | Source | Example Display |
|---|---|---|
| **Restaurant Name** | `restaurants.name` | FLOW-SYS Bistro Yangon |
| **Order Number** | `orders.order_number` | ORD-20261115-0012 |
| **Voucher Number** | `order_vouchers.voucher_number` | VCH-ORD-20261115-0012 |
| **Table Number** | `orders.table_number` | Table 04 |
| **Order Date & Time** | `orders.confirmed_at` | 15-Nov-2026, 12:45 PM |
| **Confirmation Status**| `orders.status` | **ORDER CONFIRMED** |
| **Itemized Dishes** | `order_items` | Signature Truffle Burger (1x), Craft IPA Beer (2x) |
| **Item Quantities** | `order_items.quantity` | 1x, 2x |
| **Unit Prices** | `order_items.unit_price_snapshot`| 15,000 MMK, 7,000 MMK |
| **Subtotal** | `orders.subtotal` | 29,000 MMK |
| **Discount** | `orders.discount_amount` | 0 MMK |
| **Total Amount** | `orders.total_amount` | **29,000 MMK** |
| **Closing Note** | Static branding | *Thank you for dining with us! Please present for counter collection when Ready.* |

---

## 5. PRINT-FRIENDLY A4 PDF LAYOUT BLUEPRINT

The PDF is generated as a clean, high-contrast, professional A4 layout suitable for standard black-and-white or color thermal/laser printing:

```text
+---------------------------------------------------------------+
|                       FLOW-SYS BISTRO                         |
|                   12 Inya Road, Yangon City                   |
|                      Tel: +95 9 123 4567                      |
+---------------------------------------------------------------+
|                 ORDER CONFIRMATION VOUCHER                    |
|                      [ ORDER CONFIRMED ]                      |
+---------------------------------------------------------------+
| Order No:  ORD-20261115-0012        Date:  15-Nov-2026 12:45PM|
| Table:     Table 04                 Voucher: VCH-20261115-0012|
+---------------------------------------------------------------+
| ITEM DESCRIPTION             QTY    UNIT PRICE     TOTAL (MMK)|
|---------------------------------------------------------------|
| Signature Truffle Burger       1     15,000 MMK     15,000 MMK|
| Craft IPA Beer (Chilled)       2      7,000 MMK     14,000 MMK|
| Golden Truffle Fries           1      5,000 MMK      5,000 MMK|
+---------------------------------------------------------------+
| Subtotal:                                           34,000 MMK|
| Commercial Tax (5%):                                 1,700 MMK|
| Service Charge (10%):                                3,400 MMK|
| Discount:                                                0 MMK|
+---------------------------------------------------------------+
| TOTAL AMOUNT:                                       39,100 MMK|
+---------------------------------------------------------------+
|                                                               |
|    * Note: This is an Order Confirmation Voucher, NOT a       |
|      payment receipt. Please retain for meal collection.     |
|                                                               |
|              Thank you for dining with us!                    |
+---------------------------------------------------------------+
```

---

## 6. DIGITAL MOBILE UI BLUEPRINT

On mobile screens, the voucher renders as an interactive card accessible from the order tracking view:

```text
+---------------------------------------+
|  <- Back to Menu        Order Tracker |
+---------------------------------------+
| [✓] ORDER CONFIRMED                   |
| Order #ORD-20261115-0012 • Table 04   |
+---------------------------------------+
|  ORDER CONFIRMATION VOUCHER           |
|  FLOW-SYS Bistro • 15 Nov, 12:45 PM   |
|                                       |
|  - Signature Truffle Burger  x1       |
|    15,000 MMK                         |
|  - Craft IPA Beer            x2       |
|    14,000 MMK                         |
|                                       |
|  -----------------------------------  |
|  TOTAL AMOUNT:             29,000 MMK |
|                                       |
|  [⬇ Download Voucher (A4 PDF)]        |
+---------------------------------------+
|  Preparation Timeline:                |
|  (✓) Confirmed ➔ ( ) Prepare ➔ ( ) Cook|
+---------------------------------------+
```
