import pytest
import uuid

@pytest.mark.asyncio
async def test_create_user(client, test_tenant):
    user_data = {
        "email": f"mechanic_{uuid.uuid4().hex[:4]}@test.com",
        "first_name": "John",
        "last_name": "Doe",
        "role": "MECHANIC",
        "password": "securepassword123",
        "tenant_id": test_tenant["id"]
    }
    
    response = client.post("/api/v1/users/", json=user_data)
    
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == user_data["email"]
    assert data["role"] == "MECHANIC"
    assert "password" not in data  # Ensure password is not returned
    assert "hashed_password" not in data

@pytest.mark.asyncio
async def test_create_duplicate_user(client, test_tenant):
    email = f"duplicate_{uuid.uuid4().hex[:4]}@test.com"
    user_data = {
        "email": email,
        "first_name": "Jane",
        "last_name": "Smith",
        "password": "securepassword123",
        "tenant_id": test_tenant["id"]
    }
    
    res1 = client.post("/api/v1/users/", json=user_data)
    assert res1.status_code == 201
    
    res2 = client.post("/api/v1/users/", json=user_data)
    assert res2.status_code == 400
    assert "already registered" in res2.json()["detail"]
