import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_user_registration_and_login(client: AsyncClient):
    # 1. Register User
    reg_resp = await client.post("/api/v1/auth/register", json={
        "username": "john_doe",
        "email": "john@example.com",
        "password": "mypassword123",
        "full_name": "John Doe"
    })
    assert reg_resp.status_code == 201
    reg_data = reg_resp.json()
    assert reg_data["username"] == "john_doe"
    assert reg_data["role"] == "customer"
    assert "password" not in reg_data

    # 2. Duplicate registration rejected
    dup_resp = await client.post("/api/v1/auth/register", json={
        "username": "john_doe",
        "email": "another@example.com",
        "password": "mypassword123"
    })
    assert dup_resp.status_code == 409

    # 3. Login
    login_resp = await client.post("/api/v1/auth/login", json={
        "username_or_email": "john_doe",
        "password": "mypassword123"
    })
    assert login_resp.status_code == 200
    token_data = login_resp.json()
    assert "access_token" in token_data
    token = token_data["access_token"]

    # 4. Access protected /me
    me_resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "john@example.com"

    # 5. Logout
    logout_resp = await client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert logout_resp.status_code == 200

    # 6. Access /me with revoked token rejected
    revoked_resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert revoked_resp.status_code == 401

@pytest.mark.asyncio
async def test_rbac_manager_and_admin(client: AsyncClient, admin_token: str, customer_token: str):
    # 1. Register a Manager
    reg_mgr = await client.post("/api/v1/auth/register", json={
        "username": "manager_alice",
        "email": "alice_mgr@flowsys.com",
        "password": "managerpass123",
        "full_name": "Alice Manager",
        "role": "manager"
    })
    assert reg_mgr.status_code == 201
    assert reg_mgr.json()["role"] == "manager"

    # 2. Login as Manager
    login_mgr = await client.post("/api/v1/auth/login", json={
        "username_or_email": "manager_alice",
        "password": "managerpass123"
    })
    assert login_mgr.status_code == 200
    mgr_token = login_mgr.json()["access_token"]

    # 3. Manager can access protected /users list
    mgr_users_resp = await client.get("/api/v1/auth/users", headers={"Authorization": f"Bearer {mgr_token}"})
    assert mgr_users_resp.status_code == 200

    # 4. Customer is forbidden
    cust_resp = await client.get("/api/v1/auth/users", headers={"Authorization": f"Bearer {customer_token}"})
    assert cust_resp.status_code == 403

    # 5. Manager can manage food categories
    cat_create = await client.post("/api/v1/categories", json={
        "name": "Chef Specials",
        "description": "Daily specialty creations"
    }, headers={"Authorization": f"Bearer {mgr_token}"})
    assert cat_create.status_code == 201
    cat_id = cat_create.json()["id"]

    # 6. Manager can delete category
    cat_del = await client.delete(f"/api/v1/categories/{cat_id}", headers={"Authorization": f"Bearer {mgr_token}"})
    assert cat_del.status_code == 204

@pytest.mark.asyncio
async def test_customer_no_login_order_and_staff_rbac_isolation(
    client: AsyncClient,
    admin_token: str,
    kitchen_token: str
):
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    kitchen_headers = {"Authorization": f"Bearer {kitchen_token}"}

    # 1. Setup a test Category and Product using Admin
    cat_res = await client.post("/api/v1/categories", json={"name": "Burgers"}, headers=admin_headers)
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["id"]

    prod_res = await client.post("/api/v1/products", json={
        "category_id": cat_id,
        "name": "Cheeseburger Deluxe",
        "price": 8500.00,
        "sku": "BUR-DX",
        "station": "main_kitchen",
        "initial_stock": 20
    }, headers=admin_headers)
    assert prod_res.status_code == 201
    prod_id = prod_res.json()["id"]

    # 2. Customer orders without ANY login auth (no Authorization header provided)
    guest_order = await client.post("/api/v1/orders", json={
        "order_type": "dine_in",
        "table_number": "Table 12",
        "items": [{"product_id": prod_id, "quantity": 2}]
    })
    assert guest_order.status_code == 201
    order_data = guest_order.json()
    assert order_data["customer_id"] is None
    assert float(order_data["total_amount"]) == 17000.00

    # 3. Customer checks out and pays without ANY login auth
    guest_checkout = await client.post("/api/v1/payments/checkout", json={
        "order_data": {
            "order_type": "delivery",
            "delivery_address": "No. 12 Cherry Street",
            "items": [{"product_id": prod_id, "quantity": 1}]
        },
        "payment_method": "card",
        "simulate_failure": False
    })
    assert guest_checkout.status_code == 201
    chk_data = guest_checkout.json()
    assert chk_data["order"]["customer_id"] is None
    assert chk_data["payment"]["status"] == "successful"

    # 4. Unauthenticated guest CANNOT access Staff KDS Tickets (401 Unauthorized)
    kds_unauth = await client.get("/api/v1/kds/tickets")
    assert kds_unauth.status_code == 401

    # 5. Unauthenticated guest CANNOT access Staff Stock Controls (401 Unauthorized)
    stock_unauth = await client.get("/api/v1/stocks")
    assert stock_unauth.status_code == 401

    # 6. Unauthenticated guest CANNOT add food menu items (401 Unauthorized)
    prod_unauth = await client.post("/api/v1/products", json={
        "category_id": cat_id,
        "name": "Hacker Burger",
        "price": 100.00,
        "sku": "HACK-01",
        "station": "main_kitchen",
        "initial_stock": 5
    })
    assert prod_unauth.status_code == 401

    # 7. Chief Chef (kitchen_token) CAN view and bump KDS tickets
    kds_chef = await client.get("/api/v1/kds/tickets", headers=kitchen_headers)
    assert kds_chef.status_code == 200

    # 8. Chief Chef CANNOT create menu products (403 Forbidden - only Admin & Manager)
    chef_prod = await client.post("/api/v1/products", json={
        "category_id": cat_id,
        "name": "Chef Secret Soup",
        "price": 5000.00,
        "sku": "SOUP-01",
        "station": "main_kitchen",
        "initial_stock": 10
    }, headers=kitchen_headers)
    assert chef_prod.status_code == 403

    # 9. Register and Login a Manager with username & password
    await client.post("/api/v1/auth/register", json={
        "username": "manager_bob",
        "email": "bob@flowsys.com",
        "password": "bobpassword123",
        "full_name": "Bob Manager",
        "role": "manager"
    })
    login_bob = await client.post("/api/v1/auth/login", json={
        "username_or_email": "manager_bob",
        "password": "bobpassword123"
    })
    assert login_bob.status_code == 200
    bob_token = login_bob.json()["access_token"]
    bob_headers = {"Authorization": f"Bearer {bob_token}"}

    # Manager CAN create food menu items
    mgr_prod = await client.post("/api/v1/products", json={
        "category_id": cat_id,
        "name": "Manager Choice Steak",
        "price": 22000.00,
        "sku": "STK-MGR",
        "station": "main_kitchen",
        "initial_stock": 15
    }, headers=bob_headers)
    assert mgr_prod.status_code == 201

@pytest.mark.asyncio
async def test_env_credentials_configuration():
    from app.core.config import Settings
    custom_settings = Settings(
        ADMIN_USERNAME="custom_admin",
        ADMIN_PASSWORD="secure_prod_password_999",
        KITCHEN_USERNAME="custom_chef",
        KITCHEN_PASSWORD="secure_kitchen_pass_888"
    )
    assert custom_settings.ADMIN_USERNAME == "custom_admin"
    assert custom_settings.ADMIN_PASSWORD == "secure_prod_password_999"
    assert custom_settings.KITCHEN_USERNAME == "custom_chef"
    assert custom_settings.KITCHEN_PASSWORD == "secure_kitchen_pass_888"

