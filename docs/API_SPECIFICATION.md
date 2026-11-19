# REST API SPECIFICATION
# FLOW-SYS QR ORDERING & KITCHEN MANAGEMENT SYSTEM

**Document Version:** 1.0 — Approved Requirements  
**Base URL:** `/api/v1`  
**Authentication:** Bearer JWT for Staff (Admin, Manager, Chief); None required for Customer QR Ordering

---

## 1. TABLE RESOLUTION (CUSTOMER INTERFACE)

### 1.1 Resolve Table from Scanned QR Token
* **Endpoint:** `GET /api/v1/tables/resolve`
* **Auth:** Public / Anonymous
* **Query Parameters:**
  - `token` (string, required): The cryptographic QR token scanned from the table.
* **Success Response (200 OK):**
```json
{
  "table_id": 4,
  "table_number": "Table 04",
  "restaurant_id": 1,
  "restaurant_name": "FLOW-SYS Bistro Yangon",
  "currency": "MMK",
  "is_active": true
}
```
* **Error Responses:**
  - `404 Not Found`: Invalid or non-existent QR token.
  - `403 Forbidden`: QR token has been revoked or table is currently deactivated.

---

## 2. ORDERING & TRACKING (CUSTOMER INTERFACE)

### 2.1 Submit Food Order (Individual Order Workflow)
* **Endpoint:** `POST /api/v1/orders`
* **Auth:** None (Guest customer) or Optional Customer JWT
* **Request Body:**
```json
{
  "qr_token": "qr_6735e1a0_8f9c2d1e4b7a5c8e3f1d0b2a9c4e7f1a",
  "order_type": "dine_in",
  "special_instructions": "Less spicy for burger",
  "items": [
    {
      "product_id": 1,
      "quantity": 1
    },
    {
      "product_id": 5,
      "quantity": 2
    }
  ]
}
```
* **Success Response (201 Created):**
```json
{
  "id": 1001,
  "order_number": "ORD-20261115-1001",
  "table_number": "Table 04",
  "status": "pending",
  "subtotal": "29000.00",
  "tax_amount": "1450.00",
  "service_charge": "2900.00",
  "discount_amount": "0.00",
  "total_amount": "33350.00",
  "currency": "MMK",
  "created_at": "2026-11-15T12:45:00Z",
  "items": [
    {
      "id": 201,
      "product_id": 1,
      "item_name": "Signature Truffle Burger",
      "unit_price": "15000.00",
      "quantity": 1,
      "subtotal": "15000.00"
    },
    {
      "id": 202,
      "product_id": 5,
      "item_name": "Craft IPA Beer",
      "unit_price": "7000.00",
      "quantity": 2,
      "subtotal": "14000.00"
    }
  ]
}
```

### 2.2 Get Real-Time Order Details & Status
* **Endpoint:** `GET /api/v1/orders/{order_id}`
* **Auth:** Public with Order Session ID or Staff JWT
* **Success Response (200 OK):**
```json
{
  "id": 1001,
  "order_number": "ORD-20261115-1001",
  "table_number": "Table 04",
  "status": "cooking",
  "customer_stage": "Cooking",
  "subtotal": "29000.00",
  "total_amount": "33350.00",
  "currency": "MMK",
  "has_voucher": true,
  "voucher_number": "VCH-ORD-20261115-1001",
  "status_history": [
    { "status": "pending", "timestamp": "2026-11-15T12:45:00Z" },
    { "status": "confirmed", "timestamp": "2026-11-15T12:46:10Z" },
    { "status": "preparing", "timestamp": "2026-11-15T12:47:30Z" },
    { "status": "cooking", "timestamp": "2026-11-15T12:50:00Z" }
  ]
}
```

---

## 3. ORDER CONFIRMATION VOUCHER (CUSTOMER & STAFF)

### 3.1 Get Digital Order Confirmation Voucher
* **Endpoint:** `GET /api/v1/orders/{order_id}/voucher`
* **Auth:** Customer Session or Staff JWT
* **Success Response (200 OK):**
```json
{
  "voucher_number": "VCH-ORD-20261115-1001",
  "order_number": "ORD-20261115-1001",
  "restaurant_name": "FLOW-SYS Bistro Yangon",
  "table_number": "Table 04",
  "order_status": "Confirmed",
  "confirmed_at": "2026-11-15T12:46:10Z",
  "items": [
    {
      "item_name": "Signature Truffle Burger",
      "quantity": 1,
      "unit_price": "15,000 MMK",
      "subtotal": "15,000 MMK"
    },
    {
      "item_name": "Craft IPA Beer",
      "quantity": 2,
      "unit_price": "7,000 MMK",
      "subtotal": "14,000 MMK"
    }
  ],
  "subtotal": "29,000 MMK",
  "tax": "1,450 MMK",
  "service_charge": "2,900 MMK",
  "discount": "0 MMK",
  "total_amount": "33,350 MMK",
  "currency": "MMK",
  "notice": "This voucher confirms food preparation. Total amount only."
}
```

### 3.2 Download Printable Voucher (A4 PDF)
* **Endpoint:** `GET /api/v1/orders/{order_id}/voucher/pdf`
* **Auth:** Customer Session or Staff JWT
* **Response Headers:**
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="Voucher_ORD-20261115-1001.pdf"`
* **Response Body:** Binary A4 formatted PDF stream.

---

## 4. KITCHEN DISPLAY SYSTEM (CHEF SCREEN)

### 4.1 List Active Kitchen Orders
* **Endpoint:** `GET /api/v1/kds/orders`
* **Auth:** Staff JWT (Role: `kitchen`, `manager`, `owner`)
* **Query Parameters:**
  - `station` (optional): `main_kitchen`, `bar`, `dessert`
  - `active_only` (optional, default `true`): Excludes completed/picked-up orders.

### 4.2 Chef Actions (State-Machine Transitions)
* **Confirm Order:** `PUT /api/v1/kds/orders/{id}/confirm`
  - Validates `status == 'pending'`.
  - Sets `status = 'confirmed'`, generates `order_vouchers` record, records status history, emits WebSocket event.
* **Start Preparation:** `PUT /api/v1/kds/orders/{id}/prepare`
  - Validates `status == 'confirmed'`.
  - Sets `status = 'preparing'`, records status history.
* **Start Cooking:** `PUT /api/v1/kds/orders/{id}/cook`
  - Validates `status == 'preparing'`.
  - Sets `status = 'cooking'`, records status history.
* **Mark Order as Ready:** `PUT /api/v1/kds/orders/{id}/ready`
  - Validates `status == 'cooking'`.
  - Sets `status = 'ready'`, emits real-time alert to customer for pickup.

### 4.3 View Ready Orders Awaiting Pickup
* **Endpoint:** `GET /api/v1/kds/orders/ready`
* **Auth:** Staff JWT (Role: `kitchen`, `manager`, `waiter`, `owner`)
* **Returns:** List of orders in `ready` state awaiting customer counter pickup.

---

## 5. ADMIN PANEL (TABLE & QR MANAGEMENT)

### 5.1 List Restaurant Tables
* **Endpoint:** `GET /api/v1/admin/tables`
* **Auth:** Staff JWT (Role: `manager`, `owner`)
* **Success Response (200 OK):**
```json
[
  {
    "id": 1,
    "table_number": "Table 01",
    "seating_capacity": 4,
    "qr_token": "qr_6735e1a0_8f9c2d1e4b...",
    "is_active": true,
    "active_orders_count": 2
  },
  {
    "id": 2,
    "table_number": "Table 02",
    "seating_capacity": 2,
    "qr_token": "qr_6735e1a1_3a8f1b2c5d...",
    "is_active": true,
    "active_orders_count": 0
  }
]
```

### 5.2 Download Table QR Code Asset
* **Endpoint:** `GET /api/v1/admin/tables/{table_id}/qr`
* **Query Parameter:** `format` (`png` or `svg`)
* **Response:** High-resolution image/vector binary for printing table display cards.

### 5.3 Regenerate / Revoke Table QR Token
* **Endpoint:** `POST /api/v1/admin/tables/{table_id}/rotate-qr`
* **Auth:** Staff JWT (Role: `manager`, `owner`)
* **Success Response (200 OK):**
```json
{
  "table_id": 1,
  "table_number": "Table 01",
  "new_qr_token": "qr_6735e2b8_99c1a4e2f3...",
  "rotated_at": "2026-11-15T13:00:00Z"
}
```

### 5.4 Monitor Orders Filtered by Table
* **Endpoint:** `GET /api/v1/admin/orders`
* **Auth:** Staff JWT (Role: `manager`, `owner`)
* **Query Parameters:**
  - `table_id` (integer, optional): When supplied (e.g. `?table_id=1`), returns exclusively orders associated with that table.
* **Success Response (200 OK):**
```json
[
  {
    "order_id": 1001,
    "order_number": "ORD-20261115-1001",
    "table_number": "Table 01",
    "status": "cooking",
    "total_amount": "33350.00"
  },
  {
    "order_id": 1002,
    "order_number": "ORD-20261115-1002",
    "table_number": "Table 01",
    "status": "preparing",
    "total_amount": "12000.00"
  }
]
```
