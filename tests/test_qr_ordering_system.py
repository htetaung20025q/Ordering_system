import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_table_qr_resolution_and_validation(client: AsyncClient, admin_token: str):
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Admin creates a new table with cryptographic QR
    tbl_res = await client.post("/api/v1/admin/tables", json={
        "table_number": "Table 01",
        "seating_capacity": 4
    }, headers=admin_headers)
    assert tbl_res.status_code == 201
    tbl_data = tbl_res.json()
    assert tbl_data["table_number"] == "Table 01"
    assert tbl_data["seating_capacity"] == 4
    assert tbl_data["qr_token"].startswith("qr_")
    qr_token = tbl_data["qr_token"]

    # 2. Customer scans table QR code (Public Resolution)
    resolve_res = await client.get(f"/api/v1/tables/resolve?token={qr_token}")
    assert resolve_res.status_code == 200
    resolve_data = resolve_res.json()
    assert resolve_data["table_number"] == "Table 01"
    assert resolve_data["seating_capacity"] == 4
    assert resolve_data["qr_token"] == qr_token
    assert resolve_data["is_active"] is True

    # 3. Non-existent token returns 404
    bad_res = await client.get("/api/v1/tables/resolve?token=non_existent_token_123")
    assert bad_res.status_code == 404

    # 4. Deactivated table returns 403
    deactivate_res = await client.put(f"/api/v1/admin/tables/{tbl_data['id']}", json={
        "is_active": False
    }, headers=admin_headers)
    assert deactivate_res.status_code == 200

    inactive_res = await client.get(f"/api/v1/tables/resolve?token={qr_token}")
    assert inactive_res.status_code == 403


@pytest.mark.asyncio
async def test_customer_order_creation_with_qr_token(client: AsyncClient, admin_token: str):
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Setup category and product
    cat_res = await client.post("/api/v1/categories", json={"name": "Specialties"}, headers=admin_headers)
    cat_id = cat_res.json()["id"]

    prod_res = await client.post("/api/v1/products", json={
        "category_id": cat_id,
        "name": "Truffle Burger",
        "price": 15000.00,
        "sku": "BUR-TF",
        "station": "main_kitchen",
        "initial_stock": 25
    }, headers=admin_headers)
    prod_id = prod_res.json()["id"]

    # Create Table 02
    tbl_res = await client.post("/api/v1/admin/tables", json={
        "table_number": "Table 02",
        "seating_capacity": 2
    }, headers=admin_headers)
    tbl_data = tbl_res.json()
    qr_token = tbl_data["qr_token"]

    # Customer orders via QR token without login authentication
    order_res = await client.post("/api/v1/orders", json={
        "order_type": "dine_in",
        "qr_token": qr_token,
        "items": [{"product_id": prod_id, "quantity": 2}]
    })
    assert order_res.status_code == 201
    order_data = order_res.json()
    assert order_data["table_number"] == "Table 02"
    assert order_data["status"] == "pending"
    assert order_data["currency"] == "MMK"
    assert float(order_data["total_amount"]) == 30000.00


@pytest.mark.asyncio
async def test_chef_kds_workflow_and_voucher_total_amount_only(
    client: AsyncClient,
    admin_token: str,
    kitchen_token: str
):
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    kitchen_headers = {"Authorization": f"Bearer {kitchen_token}"}

    # Setup menu and table
    cat_res = await client.post("/api/v1/categories", json={"name": "Mains"}, headers=admin_headers)
    cat_id = cat_res.json()["id"]

    prod_res = await client.post("/api/v1/products", json={
        "category_id": cat_id,
        "name": "Crispy Chicken Tenders",
        "price": 12000.00,
        "sku": "CHK-TD",
        "station": "main_kitchen",
        "initial_stock": 30
    }, headers=admin_headers)
    prod_id = prod_res.json()["id"]

    tbl_res = await client.post("/api/v1/admin/tables", json={
        "table_number": "Table 03",
        "seating_capacity": 6
    }, headers=admin_headers)
    qr_token = tbl_res.json()["qr_token"]

    # 1. Customer places order
    order_res = await client.post("/api/v1/orders", json={
        "order_type": "dine_in",
        "qr_token": qr_token,
        "items": [{"product_id": prod_id, "quantity": 1}]
    })
    assert order_res.status_code == 201
    order_id = order_res.json()["id"]

    # 2. Before confirmation: Voucher does not exist
    voucher_before = await client.get(f"/api/v1/orders/{order_id}/voucher")
    assert voucher_before.status_code == 404

    # 3. Chef confirms order -> Triggers Order Confirmation Voucher creation
    confirm_res = await client.post(f"/api/v1/kds/orders/{order_id}/confirm", headers=kitchen_headers)
    assert confirm_res.status_code == 200
    confirm_data = confirm_res.json()
    assert confirm_data["status"] in ["confirmed", "preparing"]

    # 4. Digital Voucher retrieval: Verify Total Amount Only rule
    voucher_res = await client.get(f"/api/v1/orders/{order_id}/voucher")
    assert voucher_res.status_code == 200
    vouch_data = voucher_res.json()
    assert vouch_data["order_id"] == order_id
    assert vouch_data["table_number"] == "Table 03"
    assert "13,800" in vouch_data["total_amount"]
    assert vouch_data["currency"] == "MMK"
    assert len(vouch_data["items_snapshot"]) == 1
    assert vouch_data["items_snapshot"][0]["item_name"] == "Crispy Chicken Tenders"

    # STRICT RULE AUDIT: Total Amount Only
    # No payment method, no paid/unpaid status, no payment transaction info
    assert "payment_method" not in vouch_data
    assert "payment_status" not in vouch_data
    assert "transaction_reference" not in vouch_data

    # 5. Voucher PDF download (A4 PDF verification)
    pdf_res = await client.get(f"/api/v1/orders/{order_id}/voucher/pdf")
    assert pdf_res.status_code == 200
    assert "application/pdf" in pdf_res.headers["content-type"]
    assert pdf_res.content.startswith(b"%PDF")

    # 6. Canonical Chef state progression: prepare -> cook -> ready -> picked_up
    prep_res = await client.post(f"/api/v1/kds/orders/{order_id}/prepare", headers=kitchen_headers)
    assert prep_res.status_code == 200
    assert prep_res.json()["status"] == "preparing"

    cook_res = await client.post(f"/api/v1/kds/orders/{order_id}/cook", headers=kitchen_headers)
    assert cook_res.status_code == 200
    assert cook_res.json()["status"] == "cooking"

    ready_res = await client.post(f"/api/v1/kds/orders/{order_id}/ready", headers=kitchen_headers)
    assert ready_res.status_code == 200
    assert ready_res.json()["status"] == "ready"

    # 7. Check Dedicated Ready Orders Queue
    ready_queue_res = await client.get("/api/v1/kds/orders/ready", headers=kitchen_headers)
    assert ready_queue_res.status_code == 200
    ready_orders = ready_queue_res.json()
    assert any(o["id"] == order_id for o in ready_orders)

    # 8. Counter Pickup completion
    pickup_res = await client.post(f"/api/v1/kds/orders/{order_id}/pickup", headers=kitchen_headers)
    assert pickup_res.status_code == 200
    assert pickup_res.json()["status"] == "picked_up"


@pytest.mark.asyncio
async def test_admin_table_qr_rotation_and_order_filtering(client: AsyncClient, admin_token: str):
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Setup Category and Product
    cat_res = await client.post("/api/v1/categories", json={"name": "Drinks"}, headers=admin_headers)
    prod_res = await client.post("/api/v1/products", json={
        "category_id": cat_res.json()["id"],
        "name": "Peach Tea",
        "price": 3500.00,
        "sku": "DRK-01",
        "station": "bar",
        "initial_stock": 50
    }, headers=admin_headers)
    prod_id = prod_res.json()["id"]

    # Create Table 04
    t4_res = await client.post("/api/v1/admin/tables", json={"table_number": "Table 04", "seating_capacity": 4}, headers=admin_headers)
    t4_id = t4_res.json()["id"]
    t4_token_orig = t4_res.json()["qr_token"]

    # Create Table 05
    t5_res = await client.post("/api/v1/admin/tables", json={"table_number": "Table 05", "seating_capacity": 2}, headers=admin_headers)
    t5_id = t5_res.json()["id"]
    t5_token = t5_res.json()["qr_token"]

    # Place Order at Table 04
    o4_res = await client.post("/api/v1/orders", json={
        "order_type": "dine_in",
        "qr_token": t4_token_orig,
        "items": [{"product_id": prod_id, "quantity": 2}]
    })
    assert o4_res.status_code == 201

    # Place Order at Table 05
    o5_res = await client.post("/api/v1/orders", json={
        "order_type": "dine_in",
        "qr_token": t5_token,
        "items": [{"product_id": prod_id, "quantity": 1}]
    })
    assert o5_res.status_code == 201

    # 1. Test Filter Orders by Specific Table
    filtered_t4 = await client.get(f"/api/v1/orders?table_id={t4_id}", headers=admin_headers)
    assert filtered_t4.status_code == 200
    t4_orders = filtered_t4.json()
    assert len(t4_orders) == 1
    assert t4_orders[0]["table_number"] == "Table 04"

    filtered_t5 = await client.get(f"/api/v1/orders?table_id={t5_id}", headers=admin_headers)
    assert filtered_t5.status_code == 200
    t5_orders = filtered_t5.json()
    assert len(t5_orders) == 1
    assert t5_orders[0]["table_number"] == "Table 05"

    # 2. Test QR Code Image Generation (PNG and SVG)
    png_res = await client.get(f"/api/v1/admin/tables/{t4_id}/qr?format=png", headers=admin_headers)
    assert png_res.status_code == 200
    assert png_res.headers["content-type"] == "image/png"
    assert png_res.content.startswith(b"\x89PNG")

    svg_res = await client.get(f"/api/v1/admin/tables/{t4_id}/qr?format=svg", headers=admin_headers)
    assert svg_res.status_code == 200
    assert "image/svg+xml" in svg_res.headers["content-type"]
    assert b"<svg" in svg_res.content

    # 3. Test QR Token Rotation
    rotate_res = await client.post(f"/api/v1/admin/tables/{t4_id}/rotate-qr", headers=admin_headers)
    assert rotate_res.status_code == 200
    rot_data = rotate_res.json()
    assert rot_data["previous_qr_token"] == t4_token_orig
    new_token = rot_data["qr_token"]
    assert new_token != t4_token_orig

    # Verify old token resolution fails (revoked / no longer current)
    old_res = await client.get(f"/api/v1/tables/resolve?token={t4_token_orig}")
    assert old_res.status_code in [403, 404]

    # Verify new token resolution succeeds with 200
    new_res = await client.get(f"/api/v1/tables/resolve?token={new_token}")
    assert new_res.status_code == 200
    assert new_res.json()["table_number"] == "Table 04"


@pytest.mark.asyncio
async def test_chef_confirm_paid_accepted_order_and_ticket_sync(
    client: AsyncClient,
    admin_token: str,
    kitchen_token: str
):
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    kitchen_headers = {"Authorization": f"Bearer {kitchen_token}"}

    # 1. Setup Category, Product & Table
    cat_res = await client.post("/api/v1/categories", json={"name": "Burgers"}, headers=admin_headers)
    cat_id = cat_res.json()["id"]

    prod_res = await client.post("/api/v1/products", json={
        "category_id": cat_id,
        "name": "Signature Truffle Burger",
        "price": 15000.00,
        "sku": "TRF-BGR",
        "station": "main_kitchen",
        "initial_stock": 20
    }, headers=admin_headers)
    prod_id = prod_res.json()["id"]

    tbl_res = await client.post("/api/v1/admin/tables", json={
        "table_number": "Table 02",
        "seating_capacity": 4
    }, headers=admin_headers)
    qr_token = tbl_res.json()["qr_token"]

    # 2. Customer orders and checks out via payment checkout
    checkout_res = await client.post("/api/v1/payments/checkout", json={
        "order_data": {
            "order_type": "dine_in",
            "qr_token": qr_token,
            "items": [{"product_id": prod_id, "quantity": 1}]
        },
        "payment_method": "cash",
        "simulate_failure": False
    })
    assert checkout_res.status_code == 201
    order_data = checkout_res.json()["order"]
    order_id = order_data["id"]

    # Verify order is in 'accepted' status
    order_check = await client.get(f"/api/v1/orders/{order_id}")
    assert order_check.status_code == 200
    assert order_check.json()["status"] == "accepted"

    # Verify KDS ticket was created in 'new' status
    tickets_res = await client.get("/api/v1/kds/tickets", headers=kitchen_headers)
    assert tickets_res.status_code == 200
    active_tickets = [t for t in tickets_res.json() if t["order_id"] == order_id]
    assert len(active_tickets) == 1
    ticket_id = active_tickets[0]["id"]
    assert active_tickets[0]["status"] == "new"

    # 3. Chef confirms the paid/accepted order via KDS Confirm endpoint
    confirm_res = await client.post(f"/api/v1/kds/orders/{order_id}/confirm", headers=kitchen_headers)
    assert confirm_res.status_code == 200
    confirm_data = confirm_res.json()
    assert confirm_data["status"] in ["confirmed", "preparing"]
    assert confirm_data["voucher_number"].startswith("VCH-")

    # 4. Verify Voucher exists and adheres strictly to Total Amount Only
    voucher_res = await client.get(f"/api/v1/orders/{order_id}/voucher")
    assert voucher_res.status_code == 200
    vouch_data = voucher_res.json()
    assert vouch_data["voucher_number"] == confirm_data["voucher_number"]
    assert "17,250" in vouch_data["total_amount"] or "15,000" in vouch_data["total_amount"]
    assert "payment_method" not in vouch_data
    assert "payment_status" not in vouch_data
    assert "paid" not in vouch_data

    # 5. Verify KDS ticket was synchronized to 'accepted' or 'preparing'
    ticket_res = await client.get(f"/api/v1/kds/tickets/{ticket_id}", headers=kitchen_headers)
    assert ticket_res.status_code == 200
    assert ticket_res.json()["status"] in ["accepted", "preparing"]

    # 6. Chef advances workflow: Prepare -> Cook -> Ready -> Pickup
    prep_res = await client.post(f"/api/v1/kds/orders/{order_id}/prepare", headers=kitchen_headers)
    assert prep_res.status_code == 200
    assert prep_res.json()["status"] == "preparing"

    cook_res = await client.post(f"/api/v1/kds/orders/{order_id}/cook", headers=kitchen_headers)
    assert cook_res.status_code == 200
    assert cook_res.json()["status"] == "cooking"

    ready_res = await client.post(f"/api/v1/kds/orders/{order_id}/ready", headers=kitchen_headers)
    assert ready_res.status_code == 200
    assert ready_res.json()["status"] == "ready"

    # Check ready orders feed
    ready_orders_res = await client.get("/api/v1/kds/orders/ready", headers=kitchen_headers)
    assert ready_orders_res.status_code == 200
    ready_ids = [o["id"] for o in ready_orders_res.json()]
    assert order_id in ready_ids

    # Customer/Staff pickup
    pickup_res = await client.post(f"/api/v1/kds/orders/{order_id}/pickup", headers=kitchen_headers)
    assert pickup_res.status_code == 200
    assert pickup_res.json()["status"] == "picked_up"


@pytest.mark.asyncio
async def test_admin_table_crud_and_card_export(client: AsyncClient, admin_token: str):
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    # 1. CREATE Table
    create_res = await client.post(
        "/api/v1/admin/tables",
        json={"table_number": "Table 99", "seating_capacity": 6},
        headers=admin_headers
    )
    assert create_res.status_code == 201
    table_data = create_res.json()
    t_id = table_data["id"]
    t_token = table_data["qr_token"]
    assert table_data["table_number"] == "Table 99"
    assert table_data["seating_capacity"] == 6

    # 2. READ Table in list
    list_res = await client.get("/api/v1/admin/tables", headers=admin_headers)
    assert list_res.status_code == 200
    tables = list_res.json()
    matching = [t for t in tables if t["id"] == t_id]
    assert len(matching) == 1
    assert matching[0]["table_number"] == "Table 99"

    # 3. UPDATE Table
    update_res = await client.put(
        f"/api/v1/admin/tables/{t_id}",
        json={"table_number": "Table 99-VIP", "seating_capacity": 8},
        headers=admin_headers
    )
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["table_number"] == "Table 99-VIP"
    assert updated_data["seating_capacity"] == 8

    # 4. EXPORT Table Stand Card (PNG with Table Number rendered)
    card_res = await client.get(f"/api/v1/admin/tables/{t_id}/card", headers=admin_headers)
    assert card_res.status_code == 200
    assert card_res.headers["content-type"] == "image/png"
    assert card_res.content.startswith(b"\x89PNG")
    assert "table_99-vip_qr_card.png" in card_res.headers["content-disposition"].lower()

    # 5. TEST DELETION SAFETY DEFENSE: create an order for this table
    # Create category and product
    cat_res = await client.post("/api/v1/categories", json={"name": "Test Table Cat"}, headers=admin_headers)
    cat_id = cat_res.json()["id"]
    prod_res = await client.post("/api/v1/products", json={
        "category_id": cat_id,
        "name": "Table Test Meal",
        "price": 10000,
        "sku": f"TBL-TEST-{t_id}",
        "station": "main_kitchen",
        "initial_stock": 20
    }, headers=admin_headers)
    prod_id = prod_res.json()["id"]

    order_res = await client.post("/api/v1/orders", json={
        "order_type": "dine_in",
        "qr_token": t_token,
        "items": [{"product_id": prod_id, "quantity": 1}]
    })
    assert order_res.status_code == 201
    order_id = order_res.json()["id"]

    # Deletion MUST be rejected with HTTP 400 because order is active
    del_blocked_res = await client.delete(f"/api/v1/admin/tables/{t_id}", headers=admin_headers)
    assert del_blocked_res.status_code == 400
    assert "active order" in del_blocked_res.json()["detail"].lower()

    # Cancel the active order to free the table
    cancel_res = await client.post(f"/api/v1/orders/{order_id}/cancel", headers=admin_headers)
    assert cancel_res.status_code == 200

    # 6. DELETE Table successfully once active orders are cleared
    del_res = await client.delete(f"/api/v1/admin/tables/{t_id}", headers=admin_headers)
    assert del_res.status_code == 200
    assert "deleted successfully" in del_res.json()["message"]

    # Verify Table is gone from list
    after_list_res = await client.get("/api/v1/admin/tables", headers=admin_headers)
    assert after_list_res.status_code == 200
    after_ids = [t["id"] for t in after_list_res.json()]
    assert t_id not in after_ids


@pytest.mark.asyncio
async def test_admin_analytics_rbac_and_data(client: AsyncClient, admin_token: str, kitchen_token: str, manager_token: str):
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    kitchen_headers = {"Authorization": f"Bearer {kitchen_token}"}
    mgr_headers = {"Authorization": f"Bearer {manager_token}"}

    # 1. Anonymous access is blocked (401)
    unauth_res = await client.get("/api/v1/admin/analytics")
    assert unauth_res.status_code == 401

    # 2. Kitchen role access is blocked (403)
    forbidden_res = await client.get("/api/v1/admin/analytics", headers=kitchen_headers)
    assert forbidden_res.status_code == 403

    # 3. Manager role access is blocked (403)
    mgr_forbidden_res = await client.get("/api/v1/admin/analytics", headers=mgr_headers)
    assert mgr_forbidden_res.status_code == 403

    # 4. Admin role access succeeds (200) with complete analytics schema
    admin_res = await client.get("/api/v1/admin/analytics?date_range=today", headers=admin_headers)
    assert admin_res.status_code == 200
    data = admin_res.json()
    assert "today_sales" in data
    assert "today_orders_count" in data
    assert "completed_orders_count" in data
    assert "pending_orders_count" in data
    assert "average_order_value" in data
    assert "best_sellers" in data
    assert "daily_sales_timeline" in data
    assert isinstance(data["best_sellers"], list)
    assert isinstance(data["daily_sales_timeline"], list)
    if data["daily_sales_timeline"]:
        first_day = data["daily_sales_timeline"][0]
        assert "orders" in first_day
        assert "sales" in first_day
        assert "completed_orders" in first_day
        assert "cancelled_orders" in first_day
    if data["best_sellers"]:
        first_item = data["best_sellers"][0]
        assert "item_name" in first_item
        assert "total_quantity" in first_item
        assert "order_count" in first_item
        assert "percentage" in first_item



