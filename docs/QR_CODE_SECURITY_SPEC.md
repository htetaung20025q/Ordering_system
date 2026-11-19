# TABLE QR CODE SECURITY & LIFECYCLE SPECIFICATION
# FLOW-SYS RESTAURANT SYSTEM

**Document Version:** 1.0 — Approved Specification  
**Status:** Approved Security Architecture  
**Target:** Table QR Generation, Validation, Rotation & Revocation

---

## 1. OBJECTIVES & THREAT MODEL

Table QR codes serve as the bridge between the physical restaurant floor and the digital ordering backend.

### 1.1 Security Threats Mitigated

1. **Table Spoofing / Injected Orders:** Attackers guessing sequential URLs (`/table/1`, `/table/2`) to submit fraudulent orders to arbitrary tables from outside the restaurant.
2. **Session Hijacking / Stale Ordering:** Diners placing orders using a QR photo taken hours or days earlier after leaving the venue.
3. **Internal ID Harvesting:** Exposing internal database primary keys or schema structures in public barcodes.
4. **Denial of Service via Invalid Tokens:** Submitting forged or deactivated QR tokens to exhaust database query capacity.

---

## 2. QR TOKEN GENERATION SPECIFICATION

### 2.1 Cryptographic Entropy

1. **High-Entropy Generation:** QR tokens must use cryptographically secure pseudo-random generators (`CSPRNG`).
2. **Token Format:**
   ```text
   qr_<timestamp_hex>_<random_bytes_hex>
   Example: qr_6735e1a0_8f9c2d1e4b7a5c8e3f1d0b2a9c4e7f1a
   ```
   - **Length:** At least 32 bytes of randomness (256 bits of entropy).
   - **Prefix:** `qr_` for scannable URL routing and log filtering.
3. **Strict Ban on Sequential Identifiers:** Under no circumstances may an integer `table.id` or plain `table_number` be used as a public QR token.

### 2.2 Table-to-Token Cardinality

- **Cardinality:** Exactly **one active QR token** per table at any time.
- **Uniqueness Constraint:** Database unique index on `(qr_token)` and unique index on `(restaurant_id, table_number)`.

---

## 3. SCAN & VALIDATION SEQUENCE

When a customer scans a table QR code:

```text
Step 1: Client navigates to URL: https://orders.flowsys.com/t/:qrToken
Step 2: Frontend initiates table resolution: GET /api/v1/tables/resolve?token=:qrToken
Step 3: Backend executes atomic query:
        SELECT t.id, t.table_number, t.is_active, r.id, r.is_active, r.name
        FROM restaurant_tables t
        JOIN restaurants r ON t.restaurant_id = r.id
        WHERE t.qr_token = :qrToken;
Step 4: Backend verifies:
        - Record exists? (If NO -> Return HTTP 404 "Table QR Not Found")
        - t.is_active == TRUE? (If NO -> Return HTTP 403 "Table Deactivated")
        - t.revoked_at IS NULL? (If NO -> Return HTTP 403 "QR Token Revoked")
        - r.is_active == TRUE? (If NO -> Return HTTP 403 "Restaurant Inactive")
Step 5: Backend returns safe table session context:
        {
          "table_token": ":qrToken",
          "table_number": "Table 04",
          "restaurant_name": "FLOW-SYS Bistro",
          "currency": "MMK"
        }
Step 6: Customer places order with payload including "qr_token": ":qrToken".
Step 7: Server re-verifies token inside the order creation transaction before persisting order.
```

---

## 4. TOKEN ROTATION & REVOCATION WORKFLOW

Administrators and Managers can rotate or revoke table QR codes on-demand from the Admin Panel.

### 4.1 Rotation Triggers

- **Physical Table Reassignment:** Table re-numbered or moved to another section.
- **Security Invalidation:** Table token compromised or photographed by disruptive guests.
- **Periodic Rotation:** Automated or manual shift-change security rotation.

### 4.2 Rotation Execution Steps

```text
Admin Action (Admin Panel)
       |
       v
POST /api/v1/admin/tables/{table_id}/rotate-qr
       |
       v
Validate Staff Role (Manager / Owner)
       |
       v
Begin Database Transaction
       |
       v
UPDATE restaurant_tables
SET revoked_at = NOW(),
    is_active = FALSE
WHERE id = :table_id;
       |
       v
Generate New Opaque Random Token (qr_token_new)
       |
       v
UPDATE restaurant_tables
SET qr_token = :qr_token_new,
    is_active = TRUE,
    revoked_at = NULL,
    updated_at = NOW()
WHERE id = :table_id;
       |
       v
Commit Transaction
       |
       v
Return new SVG / PNG QR asset to Admin
```

---

## 5. QR ASSET GENERATION & PRINTING

1. **Formats Supported:**
   - **Vector SVG:** For crisp commercial printing on acrylic table stands, wood engravings, or laminated cards.
   - **Raster PNG (High-Res 1024x1024):** For digital downloads and standard desktop printing.
2. **Error Correction Level:**
   - Standard QR code Error Correction Level **Q (25%)** or **H (30%)** to ensure scannability even if physical table cards suffer minor scratches or liquid stains.
3. **URL Scheme:**
   ```text
   https://{restaurant-domain}/t/{qr_token}
   ```
