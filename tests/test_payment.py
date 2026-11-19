import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_payment_and_checkout_rules(client: AsyncClient, admin_token: str):
    auth_headers = {"Authorization": f"Bearer {admin_token}"}

    # Setup Product
    cat_res = await client.post("/api/v1/categories", json={"name": "FastFood"}, headers=auth_headers)
    cat_id = cat_res.json()["id"]

    prod_res = await client.post("/api/v1/products", json={
        "category_id": cat_id,
        "name": "Classic Burger",
        "price": 10.00,
        "sku": "CB-001",
        "station": "main_kitchen",
        "initial_stock": 5
    }, headers=auth_headers)
    prod_id = prod_res.json()["id"]

    # =========================================================================
    # Rule 1: If payment fails, the order should NOT be created
    # =========================================================================
    failed_checkout_res = await client.post("/api/v1/payments/checkout", json={
        "order_data": {
            "order_type": "pickup",
            "items": [{"product_id": prod_id, "quantity": 2}]
        },
        "payment_method": "card",
        "simulate_failure": True
    })
    assert failed_checkout_res.status_code == 402  # Payment Failed

    # Verify order was NOT created and stock was NOT deducted
    orders_res = await client.get("/api/v1/orders")
    assert len(orders_res.json()) == 0

    stock_res = await client.get(f"/api/v1/stocks/{prod_id}", headers=auth_headers)
    assert stock_res.json()["current_stock"] == 5

    # =========================================================================
    # Rule 2: If the payment is successful, the order should be created
    # =========================================================================
    success_checkout_res = await client.post("/api/v1/payments/checkout", json={
        "order_data": {
            "order_type": "pickup",
            "items": [{"product_id": prod_id, "quantity": 2}]
        },
        "payment_method": "card",
        "simulate_failure": False
    })
    assert success_checkout_res.status_code == 201
    checkout_data = success_checkout_res.json()
    assert checkout_data["order"] is not None
    assert checkout_data["payment"]["status"] == "successful"
    order_id = checkout_data["order"]["id"]
    payment_id = checkout_data["payment"]["id"]

    # Verify order exists and stock deducted
    order_check = await client.get(f"/api/v1/orders/{order_id}")
    assert order_check.status_code == 200
    assert order_check.json()["status"] == "accepted"

    stock_res = await client.get(f"/api/v1/stocks/{prod_id}", headers=auth_headers)
    assert stock_res.json()["current_stock"] == 3

    # =========================================================================
    # Rule 3: If the payment is cancelled, the order should be cancelled
    # =========================================================================
    cancel_payment_res = await client.put(f"/api/v1/payments/{payment_id}", json={
        "status": "cancelled",
        "failure_reason": "Customer requested payment cancellation"
    }, headers=auth_headers)
    assert cancel_payment_res.status_code == 200
    assert cancel_payment_res.json()["status"] == "cancelled"

    # Verify the linked order was automatically cancelled and stock restored!
    order_after_cancel = await client.get(f"/api/v1/orders/{order_id}")
    assert order_after_cancel.json()["status"] == "cancelled"

    stock_after_cancel = await client.get(f"/api/v1/stocks/{prod_id}", headers=auth_headers)
    assert stock_after_cancel.json()["current_stock"] == 5

@pytest.mark.asyncio
async def test_payment_crud(client: AsyncClient, admin_token: str):
    auth_headers = {"Authorization": f"Bearer {admin_token}"}

    # Setup Product & Dine-in Order
    cat_res = await client.post("/api/v1/categories", json={"name": "Drinks"}, headers=auth_headers)
    prod_res = await client.post("/api/v1/products", json={
        "category_id": cat_res.json()["id"],
        "name": "Orange Juice",
        "price": 6.00,
        "sku": "OJ-001",
        "station": "bar",
        "initial_stock": 10
    }, headers=auth_headers)
    prod_id = prod_res.json()["id"]

    order_res = await client.post("/api/v1/orders", json={
        "order_type": "dine_in",
        "table_number": "T-1",
        "items": [{"product_id": prod_id, "quantity": 1}]
    })
    order_id = order_res.json()["id"]

    # 1. Create Payment
    pay_res = await client.post("/api/v1/payments", json={
        "order_id": order_id,
        "payment_method": "cash",
        "amount": 6.00
    })
    assert pay_res.status_code == 201
    pay_id = pay_res.json()["id"]

    # 2. View Payment
    get_res = await client.get(f"/api/v1/payments/{pay_id}", headers=auth_headers)
    assert get_res.status_code == 200
    assert float(get_res.json()["amount"]) == 6.00

    # List Payments
    list_res = await client.get("/api/v1/payments", headers=auth_headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # 3. Update Payment
    up_res = await client.put(f"/api/v1/payments/{pay_id}", json={
        "status": "refunded",
        "failure_reason": "Overcharged customer"
    }, headers=auth_headers)
    assert up_res.status_code == 200
    assert up_res.json()["status"] == "refunded"

    # 4. Delete Payment
    del_res = await client.delete(f"/api/v1/payments/{pay_id}", headers=auth_headers)
    assert del_res.status_code == 204

