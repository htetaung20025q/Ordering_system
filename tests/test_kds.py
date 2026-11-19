import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_kds_routing_and_lifecycle(client: AsyncClient, admin_token: str, kitchen_token: str):
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    kitchen_headers = {"Authorization": f"Bearer {kitchen_token}"}

    # Setup 2 products in different stations
    cat_res = await client.post("/api/v1/categories", json={"name": "Combos"}, headers=admin_headers)
    cat_id = cat_res.json()["id"]

    p_kitchen = await client.post("/api/v1/products", json={
        "category_id": cat_id,
        "name": "Steak",
        "price": 25.00,
        "sku": "STK-1",
        "station": "main_kitchen",
        "initial_stock": 10
    }, headers=admin_headers)

    p_bar = await client.post("/api/v1/products", json={
        "category_id": cat_id,
        "name": "Red Wine",
        "price": 12.00,
        "sku": "RW-1",
        "station": "bar",
        "initial_stock": 10
    }, headers=admin_headers)

    # Create Order containing both steak and wine with customer special instructions
    order_res = await client.post("/api/v1/orders", json={
        "order_type": "dine_in",
        "table_number": "VIP-1",
        "special_instructions": "Table Note: Serve fast",
        "items": [
            {"product_id": p_kitchen.json()["id"], "quantity": 1, "special_instructions": "No spicy"},
            {"product_id": p_bar.json()["id"], "quantity": 2}
        ]
    })
    assert order_res.status_code == 201

    # 1. View KDS Display: Tickets routed to Main Kitchen
    mk_tickets = await client.get("/api/v1/kds/tickets?station=main_kitchen", headers=kitchen_headers)
    assert mk_tickets.status_code == 200
    mk_list = mk_tickets.json()
    assert len(mk_list) == 1
    mk_ticket = mk_list[0]
    assert mk_ticket["station"] == "main_kitchen"
    assert mk_ticket["status"] == "new"
    assert mk_ticket["ticket_items"][0]["item_name"] == "Steak"
    assert mk_ticket["ticket_items"][0]["notes"] == "No spicy"
    assert mk_ticket["special_instructions"] == "Table Note: Serve fast"

    # Tickets routed to Bar
    bar_tickets = await client.get("/api/v1/kds/tickets?station=bar", headers=kitchen_headers)
    assert bar_tickets.status_code == 200
    bar_list = bar_tickets.json()
    assert len(bar_list) == 1
    bar_ticket = bar_list[0]
    assert bar_ticket["station"] == "bar"
    assert bar_ticket["ticket_items"][0]["item_name"] == "Red Wine"

    ticket_id = mk_ticket["id"]

    # 2. Update KDS Display: Bump ticket forward through lifecycle: prepare -> cook -> ready -> served
    # new -> preparing (prepare)
    bump1 = await client.put(f"/api/v1/kds/tickets/{ticket_id}", json={"bump": True}, headers=kitchen_headers)
    assert bump1.json()["status"] == "preparing"

    # preparing -> cooking (cook)
    bump2 = await client.put(f"/api/v1/kds/tickets/{ticket_id}", json={"bump": True}, headers=kitchen_headers)
    assert bump2.json()["status"] == "cooking"

    # cooking -> ready (ready)
    bump3 = await client.put(f"/api/v1/kds/tickets/{ticket_id}", json={"bump": True}, headers=kitchen_headers)
    assert bump3.json()["status"] == "ready"

    # ready -> served (served)
    bump4 = await client.put(f"/api/v1/kds/tickets/{ticket_id}", json={"bump": True}, headers=kitchen_headers)
    assert bump4.json()["status"] == "served"

    # Served ticket should not appear in active_only KDS display
    active_kds = await client.get("/api/v1/kds/tickets?active_only=true", headers=kitchen_headers)
    active_ids = [t["id"] for t in active_kds.json()]
    assert ticket_id not in active_ids

    # 3. Delete KDS Display: Dismiss ticket
    del_res = await client.delete(f"/api/v1/kds/tickets/{bar_ticket['id']}", headers=kitchen_headers)
    assert del_res.status_code == 204

