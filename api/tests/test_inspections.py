import pytest
import uuid
from datetime import datetime

@pytest.fixture
def test_inspection(test_tenant):
    return {
        "tenant_id": test_tenant["id"],
        "job_id": str(uuid.uuid4()),
        "vehicle_make": "Toyota",
        "vehicle_model": "Hilux",
        "registration_number": "NAM-999-XYZ",
        "mechanic_id": str(uuid.uuid4()),
        "status": "DRAFT",
        "mechanic_notes": "Standard 150k km check.",
    }

@pytest.mark.asyncio
async def test_create_inspection(client, test_inspection):
    response = client.post("/api/v1/inspections/", json=test_inspection)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "DRAFT"
    assert "id" in data

@pytest.mark.asyncio
async def test_update_inspection(client, test_inspection):
    # Create the inspection
    create_res = client.post("/api/v1/inspections/", json=test_inspection)
    inspection_id = create_res.json()["id"]
    
    # Update the inspection to pending customer approval
    update_data = {
        "status": "PENDING_APPROVAL",
        "customer_notes": "Please approve the suspension work."
    }
    response = client.patch(f"/api/v1/inspections/{inspection_id}", json=update_data)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "PENDING_APPROVAL"
    assert data["customer_notes"] == "Please approve the suspension work."

@pytest.mark.asyncio
async def test_add_inspection_item(client, test_inspection):
    create_res = client.post("/api/v1/inspections/", json=test_inspection)
    inspection_id = create_res.json()["id"]
    
    item_data = {
        "category": "Suspension",
        "description": "Front left shock absorber leaking",
        "condition": "RED",
        "is_approved_for_repair": False
    }
    res = client.post(f"/api/v1/inspections/{inspection_id}/items", json=item_data)
    assert res.status_code == 201
    item_res = res.json()
    assert item_res["condition"] == "RED"
