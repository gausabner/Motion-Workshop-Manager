import pytest
from httpx import AsyncClient
import uuid

@pytest.mark.asyncio
async def test_create_tenant(client):
    tenant_data = {
        "name": "Test Workshop",
        "subdomain": f"test-{uuid.uuid4().hex[:8]}"
    }
    
    response = client.post("/api/v1/tenants/", json=tenant_data)
    
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == tenant_data["name"]
    assert data["subdomain"] == tenant_data["subdomain"]
    assert "id" in data

@pytest.mark.asyncio
async def test_create_duplicate_subdomain(client):
    subdomain = f"test-{uuid.uuid4().hex[:8]}"
    tenant_data = {
        "name": "Test Workshop 1",
        "subdomain": subdomain
    }
    
    # First creation should succeed
    response1 = client.post("/api/v1/tenants/", json=tenant_data)
    assert response1.status_code == 201
    
    # Second creation with same subdomain should fail
    tenant_data["name"] = "Test Workshop 2"
    response2 = client.post("/api/v1/tenants/", json=tenant_data)
    
    assert response2.status_code == 400
    assert "already in use" in response2.json()["detail"]
