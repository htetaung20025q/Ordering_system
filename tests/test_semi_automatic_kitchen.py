import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_semi_automatic_kitchen_full_workflow(
    client: AsyncClient,
    admin_token: str,
    kitchen_token: str
):
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    kitchen_headers = {"Authorization": f"Bearer {kitchen_token}"}

    # 1. Setup Menu Items with custom prep durations
    cat_res = await client.post("/api/v1/categories", json={"name": "SemiAuto Test Cat"}, headers=admin_headers)
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["id"]

    # Item A: Quick dish (2 min prep)
    prod_a_res = await client.post("/api/v1/products", json={
        "category_id": cat_id,
        "name": "Iced Lemon Tea",
        "price": 3000.00,
        "sku": "TEA-01",
        "station": "bar",
        "prep_time_minutes": 2,
        "initial_stock": 50
    }, headers=admin_headers)
    assert prod_a_res.status_code == 201
    prod_a_id = prod_a_res.json()["id"]

    # Item B: Long dish (8 min prep)
    prod_b_res = await client.post("/api/v1/products", json={
        "category_id": cat_id,
        "name": "Slow-Roasted Ribs",
        "price": 25000.00,
        "sku": "RIB-01",
        "station": "main_kitchen",
        "prep_time_minutes": 8,
        "initial_stock": 20
    }, headers=admin_headers)
    assert prod_b_res.status_code == 201
    prod_b_id = prod_b_res.json()["id"]

    # Table setup
    tbl_res = await client.post("/api/v1/admin/tables", json={
        "table_number": "Table SA-01",
        "seating_capacity": 4
    }, headers=admin_headers)
    assert tbl_res.status_code == 201
    qr_token = tbl_res.json()["qr_token"]

    # 2. Customer places order with both dishes (2 mins and 8 mins)
    order_res = await client.post("/api/v1/orders", json={
        "order_type": "dine_in",
        "qr_token": qr_token,
        "special_instructions": "Table by window",
        "items": [
            {"product_id": prod_a_id, "quantity": 1, "special_instructions": "Less sweet"},
            {"product_id": prod_b_id, "quantity": 1, "special_instructions": "Well done"}
        ]
    })
    assert order_res.status_code == 201
    order_id = order_res.json()["id"]
    assert order_res.json()["status"] == "pending"

    # 3. Chef clicks Accept Order (POST /kds/orders/{order_id}/accept)
    accept_res = await client.post(f"/api/v1/kds/orders/{order_id}/accept", headers=kitchen_headers)
    assert accept_res.status_code == 200
    accept_data = accept_res.json()
    assert accept_data["status"] == "preparing"
    assert accept_data["preparation_duration_seconds"] == 8 * 60  # Longest item is 8 mins = 480s
    assert accept_data["preparing_at"] is not None
    assert accept_data["preparation_due_at"] is not None

    # Verify voucher generated automatically
    assert accept_data["voucher_number"].startswith("VCH-")
    voucher_res = await client.get(f"/api/v1/orders/{order_id}/voucher")
    assert voucher_res.status_code == 200

    # 4. Check order details via authoritative REST endpoint
    order_get = await client.get(f"/api/v1/orders/{order_id}")
    assert order_get.status_code == 200
    order_info = order_get.json()
    assert order_info["status"] == "preparing"
    assert order_info["preparation_duration_seconds"] == 480
    assert order_info["preparing_at"] is not None
    assert order_info["preparation_due_at"] is not None

    # Check status history records both CONFIRMED (user) and PREPARING (system)
    histories = order_info["status_history"]
    assert len(histories) >= 3  # initial pending + confirmed + preparing
    conf_hist = next(h for h in histories if h["new_status"] == "confirmed")
    prep_hist = next(h for h in histories if h["new_status"] == "preparing")
    assert conf_hist["actor_type"] == "user"
    assert prep_hist["actor_type"] == "system"
    assert prep_hist["is_system"] is True

    # 5. Idempotency Check: Calling Accept again should not duplicate or alter state
    accept_again = await client.post(f"/api/v1/kds/orders/{order_id}/accept", headers=kitchen_headers)
    assert accept_again.status_code == 200
    assert accept_again.json()["status"] == "preparing"

    # 6. Simulate Timer Expiration & Background Worker Auto-Transition to COOKING
    # Backdate preparation_due_at via authenticated testing endpoint
    sim_res = await client.post(f"/api/v1/kds/orders/{order_id}/simulate-overdue", headers=kitchen_headers)
    assert sim_res.status_code == 200

    # Trigger background scheduler tick
    tick_res = await client.post("/api/v1/kds/scheduler/tick", headers=kitchen_headers)
    assert tick_res.status_code == 200
    assert tick_res.json()["updated_count"] >= 1

    # Verify order has auto-transitioned to COOKING
    order_cooking = await client.get(f"/api/v1/orders/{order_id}")
    assert order_cooking.status_code == 200
    assert order_cooking.json()["status"] == "cooking"
    assert order_cooking.json()["cooking_at"] is not None

    # Check that status history contains auto cooking transition by system
    cook_hist = next(h for h in order_cooking.json()["status_history"] if h["new_status"] == "cooking")
    assert cook_hist["is_system"] is True
    assert cook_hist["actor_type"] == "system"

    # 7. Chef clicks Mark as Ready (POST /kds/orders/{order_id}/ready)
    ready_res = await client.post(f"/api/v1/kds/orders/{order_id}/ready", headers=kitchen_headers)
    assert ready_res.status_code == 200
    assert ready_res.json()["status"] == "ready"
    assert ready_res.json()["ready_at"] is not None

    # Verify order is ready
    order_ready = await client.get(f"/api/v1/orders/{order_id}")
    assert order_ready.status_code == 200
    assert order_ready.json()["status"] == "ready"

    # 8. Counter Handover / Pickup Confirmation (POST /kds/orders/{order_id}/pickup)
    pickup_res = await client.post(f"/api/v1/kds/orders/{order_id}/pickup", headers=kitchen_headers)
    assert pickup_res.status_code == 200
    assert pickup_res.json()["status"] == "picked_up"
    assert pickup_res.json()["picked_up_at"] is not None

    # Verify order is in final terminal state
    order_final = await client.get(f"/api/v1/orders/{order_id}")
    assert order_final.status_code == 200
    assert order_final.json()["status"] == "picked_up"

@pytest.mark.asyncio
async def test_chef_early_ready_before_timer_expires(
    client: AsyncClient,
    admin_token: str,
    kitchen_token: str
):
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    kitchen_headers = {"Authorization": f"Bearer {kitchen_token}"}

    # Setup category and product
    cat_res = await client.post("/api/v1/categories", json={"name": "Fast Food"}, headers=admin_headers)
    cat_id = cat_res.json()["id"]

    prod_res = await client.post("/api/v1/products", json={
        "category_id": cat_id,
        "name": "Pre-made Sandwich",
        "price": 5000.00,
        "sku": "SND-01",
        "prep_time_minutes": 10,
        "initial_stock": 20
    }, headers=admin_headers)
    prod_id = prod_res.json()["id"]

    tbl_res = await client.post("/api/v1/admin/tables", json={
        "table_number": "Table Early-01",
        "seating_capacity": 2
    }, headers=admin_headers)
    qr_token = tbl_res.json()["qr_token"]

    order_res = await client.post("/api/v1/orders", json={
        "order_type": "dine_in",
        "qr_token": qr_token,
        "items": [{"product_id": prod_id, "quantity": 1}]
    })
    order_id = order_res.json()["id"]

    # Chef accepts order -> PREPARING with 10 min timer
    await client.post(f"/api/v1/kds/orders/{order_id}/accept", headers=kitchen_headers)

    # Chef marks READY early (sandwich was already made)
    ready_res = await client.post(f"/api/v1/kds/orders/{order_id}/ready", headers=kitchen_headers)
    assert ready_res.status_code == 200
    assert ready_res.json()["status"] == "ready"

    # Verify background scheduler will NOT transition READY order to cooking even if overdue
    await client.post(f"/api/v1/kds/orders/{order_id}/simulate-overdue", headers=kitchen_headers)
    tick_res = await client.post("/api/v1/kds/scheduler/tick", headers=kitchen_headers)
    assert tick_res.status_code == 200
    assert tick_res.json()["updated_count"] == 0

    order_check = await client.get(f"/api/v1/orders/{order_id}")
    assert order_check.json()["status"] == "ready"

@pytest.mark.asyncio
async def test_independent_multi_order_progression(
    client: AsyncClient,
    admin_token: str,
    kitchen_token: str
):
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    kitchen_headers = {"Authorization": f"Bearer {kitchen_token}"}

    cat_res = await client.post("/api/v1/categories", json={"name": "MultiOrder Cat"}, headers=admin_headers)
    cat_id = cat_res.json()["id"]

    prod_res = await client.post("/api/v1/products", json={
        "category_id": cat_id,
        "name": "Speedy Noodles",
        "price": 8000.00,
        "sku": "NDL-01",
        "prep_time_minutes": 5,
        "initial_stock": 50
    }, headers=admin_headers)
    prod_id = prod_res.json()["id"]

    tbl_res = await client.post("/api/v1/admin/tables", json={
        "table_number": "Table Multi-01",
        "seating_capacity": 4
    }, headers=admin_headers)
    qr_token = tbl_res.json()["qr_token"]

    # Place Order 1 and Order 2
    o1_res = await client.post("/api/v1/orders", json={
        "order_type": "dine_in",
        "qr_token": qr_token,
        "items": [{"product_id": prod_id, "quantity": 1}]
    })
    o1_id = o1_res.json()["id"]

    o2_res = await client.post("/api/v1/orders", json={
        "order_type": "dine_in",
        "qr_token": qr_token,
        "items": [{"product_id": prod_id, "quantity": 2}]
    })
    o2_id = o2_res.json()["id"]

    # Accept both
    await client.post(f"/api/v1/kds/orders/{o1_id}/accept", headers=kitchen_headers)
    await client.post(f"/api/v1/kds/orders/{o2_id}/accept", headers=kitchen_headers)

    # Only mature Order 1
    await client.post(f"/api/v1/kds/orders/{o1_id}/simulate-overdue", headers=kitchen_headers)
    tick_res = await client.post("/api/v1/kds/scheduler/tick", headers=kitchen_headers)
    assert tick_res.status_code == 200
    assert tick_res.json()["updated_count"] == 1

    # Verify Order 1 is cooking while Order 2 is still preparing
    o1_check = await client.get(f"/api/v1/orders/{o1_id}")
    o2_check = await client.get(f"/api/v1/orders/{o2_id}")
    assert o1_check.json()["status"] == "cooking"
    assert o2_check.json()["status"] == "preparing"
