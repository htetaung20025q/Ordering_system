import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_order_management_lifecycle(client: AsyncClient, admin_token: str):
    auth_headers = {"Authorization": f"Bearer {admin_token}"}

    # Setup Category and 2 Products
    cat_res = await client.post("/api/v1/categories", json={"name": "Dinner"}, headers=auth_headers)
    cat_id = cat_res.json()["id"]

    p1_res = await client.post("/api/v1/products", json={
        "category_id": cat_id,
        "name": "Chicken Curry",
        "price": 15.00,
        "sku": "CC-101",
        "station": "main_kitchen",
        "initial_stock": 10
    }, headers=auth_headers)
    p1_id = p1_res.json()["id"]

    p2_res = await client.post("/api/v1/products", json={
        "category_id": cat_id,
        "name": "Iced Lemon Tea",
        "price": 4.50,
        "sku": "ILT-102",
        "station": "bar",
        "initial_stock": 10
    }, headers=auth_headers)
    p2_id = p2_res.json()["id"]

    # 1. Create Order (Round 1)
    order_res = await client.post("/api/v1/orders", json={
        "order_type": "dine_in",
        "table_number": "Table-5",
        "items": [
            {"product_id": p1_id, "quantity": 2},
            {"product_id": p2_id, "quantity": 1}
        ]
    })
    assert order_res.status_code == 201
    order = order_res.json()
    order_id = order["id"]
    # Total: (15.00 * 2) + (4.50 * 1) = 34.50
    assert float(order["total_amount"]) == 34.50
    assert order["current_round"] == 1
    assert len(order["items"]) == 2

    # Stock should be reduced: p1 -> 8, p2 -> 9
    s1 = await client.get(f"/api/v1/stocks/{p1_id}", headers=auth_headers)
    assert s1.json()["current_stock"] == 8
    s2 = await client.get(f"/api/v1/stocks/{p2_id}", headers=auth_headers)
    assert s2.json()["current_stock"] == 9

    # 2. Multi-Round Ordering: Add Round 2
    round_res = await client.post(f"/api/v1/orders/{order_id}/rounds", json={
        "items": [
            {"product_id": p2_id, "quantity": 2}
        ]
    })
    assert round_res.status_code == 200
    updated_order = round_res.json()
    assert updated_order["current_round"] == 2
    # New Total: 34.50 + (4.50 * 2) = 43.50
    assert float(updated_order["total_amount"]) == 43.50
    assert len(updated_order["items"]) == 3

    # 3. View Order
    view_res = await client.get(f"/api/v1/orders/{order_id}")
    assert view_res.status_code == 200
    assert view_res.json()["table_number"] == "Table-5"

    # List Orders
    list_res = await client.get("/api/v1/orders")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # 4. Update Order
    up_res = await client.put(f"/api/v1/orders/{order_id}", json={
        "status": "preparing",
        "table_number": "Table-5A"
    }, headers=auth_headers)
    assert up_res.status_code == 200
    assert up_res.json()["status"] == "preparing"
    assert up_res.json()["table_number"] == "Table-5A"

    # 5. Cancel Order (Restores Stock)
    cancel_res = await client.post(f"/api/v1/orders/{order_id}/cancel")
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"

    # Verify stock restored: p1 -> 10, p2 -> 10 (1 from R1 + 2 from R2 restored)
    s1 = await client.get(f"/api/v1/stocks/{p1_id}", headers=auth_headers)
    assert s1.json()["current_stock"] == 10
    s2 = await client.get(f"/api/v1/stocks/{p2_id}", headers=auth_headers)
    assert s2.json()["current_stock"] == 10

