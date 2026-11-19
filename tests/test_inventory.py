import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_category_crud(client: AsyncClient, admin_token: str):
    auth_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create Category
    res = await client.post("/api/v1/categories", json={
        "name": "Beverages",
        "description": "Cold & hot drinks"
    }, headers=auth_headers)
    assert res.status_code == 201
    cat_id = res.json()["id"]

    # 2. View Category
    res = await client.get(f"/api/v1/categories/{cat_id}")
    assert res.status_code == 200
    assert res.json()["name"] == "Beverages"

    # List Categories
    res = await client.get("/api/v1/categories")
    assert res.status_code == 200
    assert len(res.json()) >= 1

    # 3. Update Category
    res = await client.put(f"/api/v1/categories/{cat_id}", json={
        "description": "Premium cold & hot drinks"
    }, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["description"] == "Premium cold & hot drinks"

    # 4. Delete Category
    res = await client.delete(f"/api/v1/categories/{cat_id}", headers=auth_headers)
    assert res.status_code == 204

    # Verify not found
    res = await client.get(f"/api/v1/categories/{cat_id}")
    assert res.status_code == 404

@pytest.mark.asyncio
async def test_product_and_stock_tracking_crud(client: AsyncClient, admin_token: str):
    auth_headers = {"Authorization": f"Bearer {admin_token}"}

    # Setup Category
    cat_res = await client.post("/api/v1/categories", json={"name": "Mains"}, headers=auth_headers)
    cat_id = cat_res.json()["id"]

    # 1. Create Product
    prod_res = await client.post("/api/v1/products", json={
        "category_id": cat_id,
        "name": "Fried Rice",
        "description": "Fragrant rice with eggs and vegetables",
        "price": 12.50,
        "sku": "FR-001",
        "station": "main_kitchen",
        "initial_stock": 20,
        "low_stock_threshold": 5
    }, headers=auth_headers)
    assert prod_res.status_code == 201
    product = prod_res.json()
    prod_id = product["id"]
    assert product["current_stock"] == 20

    # 2. View Product
    res = await client.get(f"/api/v1/products/{prod_id}")
    assert res.status_code == 200
    assert res.json()["name"] == "Fried Rice"

    # 3. Update Product
    res = await client.put(f"/api/v1/products/{prod_id}", json={"price": 14.00}, headers=auth_headers)
    assert res.status_code == 200
    assert float(res.json()["price"]) == 14.00

    # 4. Stock Tracking: View Stock
    res = await client.get(f"/api/v1/stocks/{prod_id}", headers=auth_headers)
    assert res.status_code == 200
    stock_data = res.json()
    assert stock_data["current_stock"] == 20
    assert stock_data["is_low_stock"] is False

    # 5. Stock Tracking: Update Stock
    res = await client.put(f"/api/v1/stocks/{prod_id}", json={"current_stock": 3}, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["is_low_stock"] is True

    # 6. Delete Stock (Resets to 0)
    res = await client.delete(f"/api/v1/stocks/{prod_id}", headers=auth_headers)
    assert res.status_code == 204
    res = await client.get(f"/api/v1/stocks/{prod_id}", headers=auth_headers)
    assert res.json()["current_stock"] == 0

    # 7. Delete Product
    res = await client.delete(f"/api/v1/products/{prod_id}", headers=auth_headers)
    assert res.status_code == 204

@pytest.mark.asyncio
async def test_inventory_adjustments_crud(client: AsyncClient, admin_token: str):
    auth_headers = {"Authorization": f"Bearer {admin_token}"}

    # Setup Product with initial stock 10
    cat_res = await client.post("/api/v1/categories", json={"name": "Sides"}, headers=auth_headers)
    prod_res = await client.post("/api/v1/products", json={
        "category_id": cat_res.json()["id"],
        "name": "French Fries",
        "price": 5.00,
        "sku": "FF-001",
        "station": "main_kitchen",
        "initial_stock": 10
    }, headers=auth_headers)
    prod_id = prod_res.json()["id"]

    # 1. Create Inventory Adjustment (+15 restock)
    adj_res = await client.post("/api/v1/inventory-adjustments", json={
        "product_id": prod_id,
        "change_quantity": 15,
        "reason": "Weekly supplier delivery"
    }, headers=auth_headers)
    assert adj_res.status_code == 201
    adj_id = adj_res.json()["id"]

    # Verify stock increased to 25
    stock_res = await client.get(f"/api/v1/stocks/{prod_id}", headers=auth_headers)
    assert stock_res.json()["current_stock"] == 25

    # 2. View Inventory Adjustment
    res = await client.get(f"/api/v1/inventory-adjustments/{adj_id}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["change_quantity"] == 15

    # 3. Update Inventory Adjustment
    res = await client.put(f"/api/v1/inventory-adjustments/{adj_id}", json={
        "reason": "Supplier delivery invoice #999"
    }, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["reason"] == "Supplier delivery invoice #999"

    # 4. Adjustment with excessive reduction fails
    fail_res = await client.post("/api/v1/inventory-adjustments", json={
        "product_id": prod_id,
        "change_quantity": -50,
        "reason": "Spoilage"
    }, headers=auth_headers)
    assert fail_res.status_code == 400

    # 5. Delete Inventory Adjustment (reverts change)
    res = await client.delete(f"/api/v1/inventory-adjustments/{adj_id}", headers=auth_headers)
    assert res.status_code == 204
    # Stock should revert from 25 back down to 10
    stock_res = await client.get(f"/api/v1/stocks/{prod_id}", headers=auth_headers)
    assert stock_res.json()["current_stock"] == 10

