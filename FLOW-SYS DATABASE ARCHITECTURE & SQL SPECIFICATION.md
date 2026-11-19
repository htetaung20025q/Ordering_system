# FLOW-SYS
# DATABASE ARCHITECTURE & SQL SPECIFICATION

**Document Version:** 3.0 — Approved Requirements Integration  
**Database Engine:** PostgreSQL 15+  
**Migration Strategy:** Version-controlled SQL migrations  
**Primary Architecture:** Relational Relational Schema for Modular Monolith  
**Approved Lifecycle:** Canonical Individual Order Lifecycle & Voucher Snapshot Schema

---

# 1. DATABASE DESIGN OBJECTIVES

## 1.1 Purpose

The FLOW-SYS database is responsible for storing, isolating, and protecting restaurant operational data.

It provides authoritative persistence for:

- Restaurant identity and multi-unit metadata.
- Staff accounts, role assignments, and permissions.
- Restaurant tables and cryptographically secure table QR tokens.
- Food categories, menu products, prices, and station routing.
- Real-time stock levels, low-stock thresholds, and adjustment logs.
- Independent customer orders, table bindings, and item snapshots.
- Order Status History tracking every state transition.
- Immutable Order Confirmation Vouchers (Total Amount Only).
- Kitchen stations and live KDS display tickets.
- Real-time database event triggers (PostgreSQL LISTEN / NOTIFY).

## 1.2 Core Data Integrity Principles

1. **Referential Integrity:** Enforced strictly via foreign keys (`ON DELETE RESTRICT` for active financial/inventory records, `ON DELETE CASCADE` for sub-order history).
2. **ACID Transaction Boundaries:** Multi-step mutations (order submission, stock reduction, confirmation voucher generation) must execute inside explicit database transactions.
3. **No Unchecked TOCTOU:** Concurrency-sensitive operations (stock decrements, status bumps) must use atomic conditional updates (`UPDATE ... WHERE current_stock >= :qty`) or row-level locking (`SELECT ... FOR UPDATE`).
4. **Authoritative Price & Name Snapshotting:** Historical orders and vouchers must never mutate when menu names or prices change in the future. Order items store `item_name_snapshot` and `unit_price_snapshot`.
5. **Exact Numeric Financials:** Monetary fields use `numeric(12, 2)` (or integer cents in MMK). Floating-point `float` or `real` is strictly prohibited.
6. **Unique Natural & Business Keys:** `voucher_number`, `order_number`, `qr_token`, and table numbers per restaurant must have unique database constraints.
7. **Pending Decision Quarantine:** Unapproved features (e.g. pickup verification credentials) must not introduce speculative schema columns until approved.

---

# 2. DATABASE ENGINE AND EXTENSIONS

## 2.1 PostgreSQL Version

PostgreSQL 15+ (Production) / SQLite Async (Development test fixture compatibility).

## 2.2 Required Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
```

- **pgcrypto:** Cryptographic token generation (`gen_random_bytes`, `gen_random_uuid`) for opaque table QR tokens.
- **citext:** Case-insensitive text comparison for usernames, emails, and SKU lookups.

---

# 3. ENUM DEFINITIONS (ALIGNED WITH APPROVED WORKFLOW)

```sql
-- Order Service Type
CREATE TYPE order_type_enum AS ENUM (
    'dine_in',
    'pickup',
    'delivery'
);

-- Canonical Individual Order Lifecycle (Approved 6-Stage Internal Flow)
CREATE TYPE order_status_enum AS ENUM (
    'pending',      -- Internal newly received order (not shown on customer 4-stage tracker)
    'confirmed',    -- Chef accepted order; triggers Order Confirmation Voucher generation
    'preparing',    -- Kitchen staff actively preparing ingredients
    'cooking',      -- Kitchen staff actively cooking dish
    'ready',        -- Food prepared and waiting at counter (emits customer notification)
    'picked_up',    -- Customer has collected food after verification (final terminal state)
    'cancelled'     -- Order cancelled; inventory restored
);

-- Kitchen Ticket Station Flow
CREATE TYPE ticket_status_enum AS ENUM (
    'new',
    'accepted',
    'preparing',
    'cooking',
    'ready',
    'served',
    'cancelled'
);

-- Kitchen Stations
CREATE TYPE kitchen_station_enum AS ENUM (
    'main_kitchen',
    'bar',
    'dessert'
);

-- Bill Status (Separate from Confirmation Voucher)
CREATE TYPE bill_status_enum AS ENUM (
    'open',
    'paid',
    'void'
);

-- Payment Methods (Recorded at checkout/billing POS, separate from voucher)
CREATE TYPE payment_method_enum AS ENUM (
    'cash',
    'card',
    'bank_transfer',
    'ewallet',
    'other'
);
```

### Customer-Facing Progress Mapping

The internal database lifecycle maps directly to the user's approved 4 customer-facing milestone tracker:

| Customer Stage | Database `order_status_enum` | Chef / System Action |
|---|---|---|
| *(Internal Queue)* | `pending` | Customer submitted order |
| **1. Confirmed** | `confirmed` | Chef clicked **Confirm Order** ➔ Generates Voucher |
| **2. Prepare** | `preparing` | Chef clicked **Start Prep** |
| **3. Cooking** | `cooking` | Chef clicked **Start Cooking** |
| **4. Order Ready** | `ready` | Chef clicked **Mark as Ready** ➔ Emits customer alert |
| **Picked Up** | `picked_up` | Customer verified & collected food at counter |

---

# 4. DATABASE DOMAIN SCHEMAS

## 4.1 Restaurant Domain

```sql
CREATE TABLE restaurants (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Yangon',
    currency VARCHAR(10) NOT NULL DEFAULT 'MMK',
    tax_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.0500,          -- 5% Commercial Tax
    service_charge_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.1000,-- 10% Service Charge
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## 4.2 Staff, Users & RBAC Domain

```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT REFERENCES restaurants(id) ON DELETE RESTRICT,
    username CITEXT NOT NULL UNIQUE,
    email CITEXT NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'owner', 'manager', 'kitchen', 'cashier', 'waiter', 'customer'
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_restaurant_role ON users(restaurant_id, role);
```

## 4.3 Table & QR Token Domain

Each physical restaurant table has **exactly one active QR token** at any given time.

```sql
CREATE TABLE restaurant_tables (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    table_number VARCHAR(50) NOT NULL,
    seating_capacity INT NOT NULL DEFAULT 4,
    qr_token VARCHAR(128) NOT NULL UNIQUE, -- High-entropy cryptographic token
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_restaurant_table_number UNIQUE (restaurant_id, table_number)
);

CREATE INDEX idx_tables_lookup ON restaurant_tables(qr_token) WHERE is_active = TRUE;
CREATE INDEX idx_tables_restaurant ON restaurant_tables(restaurant_id, is_active);
```

**Security Rules:**
- `qr_token` generated via `encode(gen_random_bytes(32), 'hex')` (e.g. `qr_f3a1...`).
- Rotation sets `revoked_at = NOW()` and generates a new active token.

## 4.4 Menu & Inventory Domain

```sql
CREATE TABLE categories (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL, -- in MMK (e.g. 15000.00)
    sku VARCHAR(64) NOT NULL UNIQUE,
    station VARCHAR(50) NOT NULL DEFAULT 'main_kitchen', -- 'main_kitchen', 'bar', 'dessert'
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE stocks (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
    current_stock INT NOT NULL DEFAULT 0,
    low_stock_threshold INT NOT NULL DEFAULT 5,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_stock_non_negative CHECK (current_stock >= 0)
);

CREATE TABLE inventory_adjustments (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    change_quantity INT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## 4.5 Approved Individual Order Domain

Each customer submission is an independent order. Multiple orders from the same table can exist concurrently with different statuses.

```sql
CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    order_number VARCHAR(64) NOT NULL UNIQUE, -- e.g. ORD-20261115-0012
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
    table_id BIGINT REFERENCES restaurant_tables(id) ON DELETE SET NULL,
    table_number VARCHAR(50),                  -- Snapshot of table number at order time
    customer_id BIGINT REFERENCES users(id) ON DELETE SET NULL, -- Null for guest customers
    order_type order_type_enum NOT NULL DEFAULT 'dine_in',
    status order_status_enum NOT NULL DEFAULT 'pending',
    
    -- Subtotals & Financial Snapshots
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    service_charge NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'MMK',
    
    -- Confirmation & Voucher Metadata
    confirmed_at TIMESTAMPTZ,
    confirmed_by BIGINT REFERENCES users(id),
    confirmed_total NUMERIC(12, 2),
    
    special_instructions TEXT,
    delivery_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_table_status ON orders(table_id, status);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
```

## 4.6 Order Items & Snapshot Data Integrity

```sql
CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    
    -- Authoritative Historical Snapshots
    item_name_snapshot VARCHAR(255) NOT NULL,
    unit_price_snapshot NUMERIC(12, 2) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    subtotal NUMERIC(12, 2) NOT NULL,
    
    station VARCHAR(50) NOT NULL DEFAULT 'main_kitchen',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
```

## 4.7 Order Confirmation Vouchers (Approved Specification)

Generated immediately when the Chef confirms the order. Strictly displays **Total Amount Only**.

```sql
CREATE TABLE order_vouchers (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    voucher_number VARCHAR(64) NOT NULL UNIQUE, -- e.g. VCH-ORD-20261115-0012
    pdf_storage_key TEXT,                       -- Storage key / path for generated PDF
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_order_vouchers_order ON order_vouchers(order_id);
CREATE INDEX idx_order_vouchers_number ON order_vouchers(voucher_number);
```

> [!IMPORTANT]
> **VOUCHER DATA RULE: TOTAL AMOUNT ONLY.**
> Notice that `order_vouchers` does NOT contain `payment_method`, `paid_status`, or transaction IDs.
> The Order Confirmation Voucher is strictly an acknowledgment of confirmed food preparation, NOT a payment receipt.

## 4.8 Order Status History (Audit Trail)

Records every single status transition for real-time auditability and customer timeline rendering.

```sql
CREATE TABLE order_status_history (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by BIGINT REFERENCES users(id), -- User ID of Chef or Staff
    changed_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_status_history ON order_status_history(order_id, changed_timestamp ASC);
```

## 4.9 Kitchen Display System (KDS) Domain

Focused strictly on kitchen operations:

```sql
CREATE TABLE kitchen_tickets (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    station VARCHAR(50) NOT NULL DEFAULT 'main_kitchen',
    status ticket_status_enum NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE kitchen_ticket_items (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT NOT NULL REFERENCES kitchen_tickets(id) ON DELETE CASCADE,
    order_item_id BIGINT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    special_instructions TEXT
);

CREATE INDEX idx_kds_station_status ON kitchen_tickets(station, status);
```

## 4.10 Customer Pickup Verification Domain (Status: PENDING)

> [!WARNING]
> **PENDING USER DECISION:**
> The exact customer pickup verification method (Pickup Number, Customer QR code, or hybrid) has not yet been approved.
> In accordance with Strict Change Control, no speculative schema tables or columns are added for pickup verification until the user approves the method.
> When approved, pickup credentials will be server-validated and stored in a dedicated verification table separate from table QR tokens.

---

# 5. CONCURRENCY & RACE CONDITION DEFENSES

1. **Atomic Stock Depletion:**
   ```sql
   UPDATE stocks 
   SET current_stock = current_stock - :qty 
   WHERE product_id = :product_id AND current_stock >= :qty;
   ```
2. **Status Transition Serialization:**
   ```sql
   SELECT id, status FROM orders WHERE id = :order_id FOR UPDATE;
   ```
3. **Idempotent Voucher Creation:**
   ```sql
   INSERT INTO order_vouchers (order_id, voucher_number, generated_at)
   VALUES (:order_id, :voucher_number, NOW())
   ON CONFLICT (order_id) DO NOTHING;
   ```

---

# 6. DATABASE CHANGE & RESOLUTION LOG

| Item | Previous State | Approved Specification State |
|---|---|---|
| **Order Lifecycle** | `new, accepted, preparing, ready, served` | Canonical: `pending, confirmed, preparing, cooking, ready, picked_up, cancelled` |
| **Voucher Table** | Not specified | `order_vouchers` table added with immutable snapshot references and Total Amount Only |
| **Status History** | Ad-hoc | `order_status_history` table formalized for complete transition auditability |
| **Table QR Schema** | Basic integer table ID | Cryptographic opaque `qr_token` with rotation, revocation, and unique table constraints |
| **Pickup Verification** | Unspecified | Marked explicitly as **PENDING USER DECISION** |

**END OF DOCUMENT — FLOW-SYS DATABASE ARCHITECTURE & SQL SPECIFICATION V3.0**

The following groups describe the required logical database domains.

They are a database organization proposal, not confirmation that all corresponding tables already exist in the original SQL.

## 4.1 Restaurant Domain

Responsible for restaurant configuration.

Expected logical entities:

- restaurants

Original seed information:

| Field | Sample Value |
|---|---|
| Restaurant Name | FLOW-SYS Bistro Yangon |
| Timezone | Asia/Yangon |
| Currency | MMK |
| Tax Rate | 0.0500 |
| Service Charge Rate | 0.1000 |

## 4.2 Staff and Authorization Domain

Responsible for staff identity and access control.

Expected logical entities:

- users
- roles
- permissions
- role_permissions

Original roles:

```text
owner
manager
cashier
waiter
kitchen
```

Original permissions:

```text
order:read
order:create_manual
order:cancel
kds:manage
bill:close
table:manage
menu:manage
customer:view_pii
```

## 4.3 Table and QR Domain

Responsible for restaurant table identification and QR access.

Expected logical entities:

- restaurant_tables
- QR token records or equivalent table token fields

**Original Requirement**

Each table has a QR Code containing an unpredictable token.

Owner or Manager can rotate the QR token.

**Engineering Addition**

The database must support invalidating old tokens and identifying the currently valid token.

## 4.4 Menu Domain

Responsible for menu information.

Expected logical entities:

- menu_categories
- menu_items
- modifier_groups
- modifier_options
- item_modifier_groups or equivalent relationship records

**Original Requirement**

Menu items include:

- Name.
- Price.
- Image.
- Category.
- Availability.
- Add-ons.

The original SQL defines `selection_type_enum` with `single` and `multiple`.

The complete table structure and relationship definitions are not visible in the supplied SQL PDF.

## 4.5 Customer Domain

Responsible for customer identification.

Expected logical entity:

- customers

**Original Requirement**

Phone number is the primary customer identification method for Phone/Web ordering.

New phone numbers create new customer records.

Existing phone numbers reuse existing records.

**Engineering Addition**

Phone number normalization and duplicate prevention must be implemented consistently.

## 4.6 Order Domain

Responsible for order lifecycle and order contents.

Expected logical entities:

- orders
- order_rounds
- order_items
- order_item_modifiers or equivalent snapshot records

**Original Requirement**

Multiple ordering rounds belong to one Order ID.

The original guide references `current_round`.

Order item names and prices must be saved as snapshots.

**Engineering Addition**

The database must enforce round uniqueness within an order.

Concurrent submissions must not create duplicate round numbers.

The final table design must be confirmed before implementation.

## 4.7 Kitchen Domain

Responsible for station routing and kitchen ticket processing.

Expected logical entities:

- kitchen_stations
- kitchen_tickets
- kitchen_ticket_items or equivalent records

**Original Requirement**

Kitchen stations include examples such as:

- Main Kitchen.
- Bar.
- Dessert.

Tickets are separated by station.

**Engineering Addition**

A single order may have multiple tickets.

Each ticket must have its own status and lifecycle.

The relationship between Order status and Ticket statuses must be explicitly defined.

## 4.8 Billing Domain

Responsible for bills and payment records.

Expected logical entities:

- bills
- payments

Original Bill Status:

```text
open
paid
void
```

Original Payment Methods:

```text
cash
card
bank_transfer
ewallet
other
```

The original SQL PDF does not show the complete billing table definitions.

---

# 5. RELATIONAL INTEGRITY

**Engineering Addition**

The database should enforce the following relationship rules.

| Relationship | Integrity Requirement |
|---|---|
| Restaurant → Users | A staff account belongs to an appropriate restaurant scope |
| Restaurant → Tables | A table belongs to a restaurant |
| Restaurant → Menu Items | Menu items belong to a restaurant |
| Customer → Orders | An order references the appropriate customer where applicable |
| Table → Orders | Dine-in orders reference the appropriate table |
| Order → Rounds | A round belongs to one order |
| Order → Order Items | Items belong to the appropriate order and round |
| Menu Item → Order Item | Historical order item references preserve their snapshot |
| Order → Kitchen Tickets | Tickets belong to an order |
| Kitchen Station → Kitchen Tickets | Tickets belong to their assigned station |
| Order → Bill | Billing relationship follows the approved billing model |
| Bill → Payments | Payments reference their associated bill |

The exact cardinality of these relationships must be confirmed.

---

# 6. DATABASE CONSTRAINTS

**Engineering Addition**

The completed schema should include appropriate constraints.

## 6.1 Primary Keys

Every entity must have a primary key.

The key format must be consistent throughout the schema.

The original PDF does not expose the complete primary key definitions.

## 6.2 Foreign Keys

Foreign keys must protect relationships between tables.

Delete behavior must be selected deliberately.

Do not use cascading deletion for historical orders, bills, or payments without an approved retention policy.

## 6.3 Unique Constraints

Candidate uniqueness requirements:

- Staff email uniqueness within the approved account scope.
- Customer phone uniqueness within the approved customer scope.
- Unique round number per Order.
- Unique permission code.
- Unique role name within the approved scope.
- Unique table QR token identifier.

These are proposed constraints and must be checked against the intended multi-restaurant data model.

## 6.4 Check Constraints

Candidate validation rules:

- Quantity must be greater than zero.
- Price must not be negative.
- Tax rate must be within an approved range.
- Service charge rate must be within an approved range.
- Payment amount must be greater than zero.
- Round number must be greater than zero.

Exact rules must match the approved business requirements.

---

# 7. MONEY AND PRICE STORAGE

**Engineering Addition**

Money must use exact decimal storage.

Recommended PostgreSQL type:

```sql
NUMERIC(12, 2)
```

The precision and scale must be validated against the restaurant's currency and pricing requirements.

Do not use `REAL` or `DOUBLE PRECISION` for financial amounts.

## 7.1 Price Snapshot

The original requirement states that historical order item names and prices must remain unchanged when menu prices change.

Therefore, order item records must preserve the price at ordering time.

Potential snapshot fields:

- Item name.
- Unit price.
- Quantity.
- Add-on name.
- Add-on price.
- Applicable charge information.

These are proposed field requirements; the exact original schema is not visible in the supplied PDF.

---

# 8. INDEXING STRATEGY

**Engineering Addition**

Indexes should be designed around actual query patterns.

Potential indexes include:

| Table / Domain | Candidate Index |
|---|---|
| users | Email lookup |
| customers | Normalized phone lookup |
| restaurant_tables | Restaurant and table lookup |
| QR token records | Token lookup |
| menu_items | Restaurant and category lookup |
| orders | Restaurant and creation time |
| orders | Table and active order lookup |
| order_rounds | Order ID and round number |
| kitchen_tickets | Station, status, and creation time |
| bills | Order ID and bill status |
| payments | Bill ID and creation time |

Unique constraints may create their own indexes.

Do not create redundant indexes without query-plan evidence.

---

# 9. TRIGGER FUNCTIONS

The original SQL includes two trigger functions.

## 9.1 set_updated_at()

Original SQL:

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Purpose:

Automatically update `updated_at` when the associated row is updated.

**Important**

The function alone does not attach triggers to tables.

The complete migration must define the actual trigger attachments.

## 9.2 notify_realtime_event()

The original SQL begins a function named:

```sql
notify_realtime_event()
```

It builds JSON payloads for:

- `orders`
- `kitchen_tickets`

The visible original SQL includes fields such as:

For orders:

- event
- order_id
- order_number
- table_id
- status
- updated_at

For kitchen tickets:

- event
- ticket_id
- order_id
- station_id
- round_number
- status
- updated_at

**Important**

The supplied PDF truncates the function before its complete implementation is visible.

The following must be verified in the original SQL:

- Notification channel name.
- Final `pg_notify` call.
- INSERT / UPDATE / DELETE handling.
- OLD versus NEW record handling.
- Trigger attachment definitions.
- Transaction behavior.

Do not assume the incomplete function is executable.

---

# 10. REAL-TIME DATABASE DESIGN

**Original Requirement**

PostgreSQL LISTEN / NOTIFY is used for real-time updates.

**Engineering Addition**

Notifications should be treated as signals rather than durable records.

The database must remain the source of truth.

A client reconnecting after disconnection must be able to retrieve the latest state from the API.

Critical events should be recoverable from persistent database records.

If guaranteed event delivery is required, a transactional outbox design may be considered separately.

An outbox is an engineering proposal, not an original FLOW-SYS requirement.

---

# 11. TRANSACTION AND CONCURRENCY REQUIREMENTS

**Engineering Addition**

The following operations require carefully designed transaction boundaries:

1. Order creation.
2. Multi-round submission.
3. Order item insertion.
4. Kitchen ticket generation.
5. Customer creation or reuse.
6. Bill creation or update.
7. Payment recording.
8. QR token rotation.
9. Kitchen ticket status updates.

## 11.1 Multi-Round Concurrency

When multiple customers submit orders simultaneously at the same table, the backend must prevent duplicate round numbers and incorrect item assignments.

Possible database mechanisms:

- Transactions.
- Row-level locking.
- Unique constraints.
- Atomic update patterns.

The exact mechanism should be selected during implementation.

## 11.2 Payment Concurrency

Multiple payment requests must not cause the bill to be overpaid or incorrectly marked as paid.

Payment creation and outstanding balance validation must be atomic.

## 11.3 Idempotency

**Engineering Addition**

Operations that may be retried should support idempotency where appropriate.

This is especially important for:

- Order submission.
- Payment recording.
- Other operations that create financial or operational records.

The idempotency key scope and retention policy must be defined.

---

# 12. DATABASE SECURITY

**Engineering Addition**

## 12.1 Password Storage

Passwords must be stored as secure password hashes.

Plain-text password storage is prohibited.

The original seed document includes a bcrypt-formatted password hash example.

The example hash must not be treated as a production credential.

## 12.2 QR Token Storage

QR tokens must be unpredictable.

The database design should consider hashed token storage and secure token comparison.

The exact token-storage policy must be approved.

## 12.3 PII Protection

Customer phone numbers must only be accessible to authorized users.

The original SQL includes:

`customer:view_pii`

The backend must enforce this permission.

## 12.4 Database Permissions

Application database accounts should use least-privilege access.

Migration privileges and runtime application privileges should be separated where practical.

---

# 13. MIGRATION STRUCTURE

**Engineering Addition**

Database schema changes must be version-controlled.

Suggested migration organization:

```text
database/
│
├── migrations/
│   ├── 001_init.sql
│   ├── 002_seed.sql
│   ├── 003_add_order_rounds.sql
│   ├── 004_add_kitchen_stations.sql
│   └── ...
│
├── seeds/
│   ├── roles_permissions.sql
│   └── development_data.sql
│
└── README.md
```

The filenames above are an organizational proposal, not a statement that these migrations already exist.

Each migration must:

1. Have a clear purpose.
2. Be reviewed before execution.
3. Be tested against a clean database.
4. Be tested against an existing database when applicable.
5. Have a rollback or recovery strategy.
6. Avoid silently modifying historical business data.

The project must select one authoritative migration system.

If Alembic is selected, schema changes should be managed through Alembic rather than mixing unmanaged SQL migration execution with application startup table creation.

---

# 14. SEED DATA REQUIREMENTS

The original seed SQL defines:

## 14.1 Restaurant

```text
Name: FLOW-SYS Bistro Yangon
Timezone: Asia/Yangon
Currency: MMK
Tax Rate: 0.0500
Service Charge Rate: 0.1000
```

## 14.2 Roles

```text
owner
manager
cashier
waiter
kitchen
```

## 14.3 Permissions

```text
order:read
order:create_manual
order:cancel
kds:manage
bill:close
table:manage
menu:manage
customer:view_pii
```

## 14.4 Role-Permission Assignments

The original seed SQL assigns:

- Owner: all listed permissions.
- Manager: all listed permissions.
- Cashier: order:read, order:create_manual, bill:close, customer:view_pii.
- Waiter: order:read, order:create_manual, kds:manage.
- Kitchen: order:read, kds:manage.

These assignments must be reviewed against the intended least-privilege policy before production use.

## 14.5 Incomplete Seed Data

The supplied PDF shows a user insertion beginning with:

- Aung Kyaw (Manager)
- Chef Thiha

However, the SQL is truncated after a `UNION ALL` statement.

Therefore, the complete user seed data cannot be verified.

The original SQL file must be inspected before claiming the seed migration is complete.

---

# 15. DATABASE TESTING REQUIREMENTS

**Engineering Addition**

The database implementation should be tested for:

## Schema Tests

- All required tables exist.
- All enum types exist.
- All foreign keys are valid.
- All unique constraints work.
- All check constraints work.
- All required indexes exist.

## Business Integrity Tests

- Duplicate customer creation is prevented.
- Round numbers remain unique per order.
- Order item snapshots remain unchanged after menu price updates.
- Invalid payment amounts are rejected.
- Invalid ticket transitions are rejected by the application rules.
- QR token rotation invalidates old tokens.

## Transaction Tests

- Failed order creation does not leave partial order data.
- Failed kitchen ticket creation does not leave inconsistent order data.
- Duplicate payment requests do not create duplicate payment records.
- Concurrent round submissions do not corrupt round assignments.

## Real-Time Tests

- Order notifications are generated.
- Ticket notifications are generated.
- Listener reconnection works.
- Client state can be recovered after missed notifications.

---

# 16. ORIGINAL SQL COMPLETENESS AUDIT

The supplied PostgreSQL PDF is incomplete as a source artifact.

The following items are visible:

- PostgreSQL extension creation.
- Enum definitions.
- `set_updated_at()` trigger function.
- Beginning of `notify_realtime_event()` trigger function.
- Initial role and permission seed data.
- Role-permission assignments.
- Beginning of restaurant and user seed insertion.

The following items are not fully visible:

| Missing / Incomplete Item | Required Action |
|---|---|
| Complete CREATE TABLE statements | Recover original SQL |
| Primary key definitions | Verify original schema |
| Foreign key definitions | Verify original schema |
| Unique constraints | Verify original schema |
| Check constraints | Verify original schema |
| Index definitions | Recover original SQL |
| Trigger attachments | Recover original SQL |
| Complete NOTIFY function | Recover original SQL |
| Complete user seed records | Recover original SQL |
| Seed transaction completion | Verify original SQL |
| Full SQL execution result | Execute only after review in a test database |

**Important:** These are omissions from the supplied PDF, not proof that the original SQL source does not contain the missing definitions.

---

# 17. DATABASE IMPLEMENTATION RULES

1. PostgreSQL 15+ is the target database.
2. Preserve the original enum values.
3. Preserve the original role and permission identifiers.
4. Preserve order item price snapshots.
5. Preserve multi-round ordering under one Order ID.
6. Keep Order and Kitchen Ticket states separate.
7. Enforce data integrity through database constraints.
8. Use transactions for critical operations.
9. Use exact numeric types for money.
10. Treat LISTEN / NOTIFY as a notification mechanism, not durable storage.
11. Do not assume missing table definitions.
12. Do not introduce unapproved business rules.
13. Recover and verify the complete original SQL before finalizing production migrations.

**END OF DOCUMENT 02**
