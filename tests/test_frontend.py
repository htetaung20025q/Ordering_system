import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_frontend_home_page_served(client: AsyncClient):
    res = await client.get("/")
    assert res.status_code == 200
    assert "FLOW-SYS" in res.text
    assert "FoodPanda" in res.text or "basket" in res.text.lower()

    # Verify "Switch Test Actor" and 1-tap quick logins have been removed
    assert "Switch Test Actor" not in res.text
    assert "quickLogin" not in res.text
    assert "role-dropdown" not in res.text

    # Verify Staff Login and Customer status are present
    assert "Staff Login" in res.text
    assert "Customer" in res.text
    assert "MMK" in res.text

