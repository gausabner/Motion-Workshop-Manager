import pytest
import uuid
from datetime import datetime

@pytest.fixture
def test_job(test_tenant):
    return {
        "tenant_id": test_tenant["id"],
        "booking_id": str(uuid.uuid4()),
        "vehicle_make": "Ford",
        "vehicle_model": "Ranger",
        "registration_number": "ABC-123",
        "assigned_mechanic_id": str(uuid.uuid4()),
        "status": "IN_PROGRESS",
        "mechanic_notes": "Customer complains about squeaky brakes."
    }

@pytest.mark.asyncio
async def test_create_job(client, test_job):
    response = client.post("/api/v1/jobs/", json=test_job)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "IN_PROGRESS"
    assert "id" in data

@pytest.mark.asyncio
async def test_update_job_status(client, test_job):
    # Create the job
    create_res = client.post("/api/v1/jobs/", json=test_job)
    job_id = create_res.json()["id"]
    
    # Update the job status
    update_data = {
        "status": "COMPLETED",
        "mechanic_notes": "Added some notes."
    }
    # Using patch for partial update assuming the route allows it
    response = client.patch(f"/api/v1/jobs/{job_id}", json=update_data)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "COMPLETED"
    assert data["mechanic_notes"] == "Added some notes."
