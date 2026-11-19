import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_stock_depletion_defense(client: AsyncClient, admin_token: str):
    auth_headers = {"Authorization": f"Bearer {admin_token}"}

    # Setup Product with exactly 5 items in stock
    cat_res = await client.post("/api/v1/categories", json={"name": "LimitedItems"}, headers=auth_headers)
    cat_id = cat_res.json()["id"]

    prod_res = await client.post("/api/v1/products", json={
        "category_id": cat_id,
        "name": "Special Truffle Pasta",
        "price": 30.00,
        "sku": "TRUF-01",
        "station": "main_kitchen",
        "initial_stock": 5
    }, headers=auth_headers)
    prod_id = prod_res.json()["id"]

    # First order for 3 items: should succeed (remaining stock = 2)
    res1 = await client.post("/api/v1/orders", json={
        "order_type": "pickup",
        "items": [{"product_id": prod_id, "quantity": 3}]
    })
    assert res1.status_code == 201

    # Second order for 3 items: must be rejected with 400 because available stock is only 2
    res2 = await client.post("/api/v1/orders", json={
        "order_type": "pickup",
        "items": [{"product_id": prod_id, "quantity": 3}]
    })
    assert res2.status_code == 400
    assert "Insufficient stock" in res2.json()["detail"]

    # Final stock must be exactly 2, never negative!
    stock_check = await client.get(f"/api/v1/stocks/{prod_id}", headers=auth_headers)
    assert stock_check.json()["current_stock"] == 2

@pytest.mark.asyncio
async def test_price_tampering_immunity(client: AsyncClient, admin_token: str):
    auth_headers = {"Authorization": f"Bearer {admin_token}"}

    # Setup Product at $50.00
    cat_res = await client.post("/api/v1/categories", json={"name": "Steaks"}, headers=auth_headers)
    prod_res = await client.post("/api/v1/products", json={
        "category_id": cat_res.json()["id"],
        "name": "Wagyu Ribeye",
        "price": 50.00,
        "sku": "WAG-01",
        "station": "main_kitchen",
        "initial_stock": 10
    }, headers=auth_headers)
    prod_id = prod_res.json()["id"]

    # Malicious client tries to send price: 1.00 in payload
    order_res = await client.post("/api/v1/orders", json={
        "order_type": "dine_in",
        "items": [{"product_id": prod_id, "quantity": 2, "price": 1.00}]
    })
    assert order_res.status_code == 201
    order = order_res.json()
    # Server calculates authoritative price from DB: 50.00 * 2 = 100.00
    assert float(order["total_amount"]) == 100.00
    assert float(order["items"][0]["unit_price"]) == 50.00

    # Even if product price is changed later, existing order snapshot remains 50.00
    await client.put(f"/api/v1/products/{prod_id}", json={"price": 80.00}, headers=auth_headers)
    order_res_after = await client.get(f"/api/v1/orders/{order['id']}")
    assert float(order_res_after.json()["total_amount"]) == 100.00
    assert float(order_res_after.json()["items"][0]["unit_price"]) == 50.00

@pytest.mark.asyncio
async def test_unavailable_product_defense(client: AsyncClient, admin_token: str):
    auth_headers = {"Authorization": f"Bearer {admin_token}"}

    cat_res = await client.post("/api/v1/categories", json={"name": "Seasonal"}, headers=auth_headers)
    prod_res = await client.post("/api/v1/products", json={
        "category_id": cat_res.json()["id"],
        "name": "Summer Berry Sorbet",
        "price": 8.00,
        "sku": "SBS-01",
        "station": "dessert",
        "is_available": False,  # Sold out / disabled
        "initial_stock": 10
    }, headers=auth_headers)
    prod_id = prod_res.json()["id"]

    order_res = await client.post("/api/v1/orders", json={
        "order_type": "dine_in",
        "items": [{"product_id": prod_id, "quantity": 1}]
    })
    assert order_res.status_code == 409
    assert "currently unavailable" in order_res.json()["detail"]
