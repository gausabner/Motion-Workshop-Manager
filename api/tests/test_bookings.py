import pytest
import uuid
from datetime import datetime, timedelta

@pytest.fixture
def mock_booking_data(test_tenant):
    return {
        "tenant_id": test_tenant["id"],
        "customer_name": "Alice Smith",
        "customer_email": "alice@example.com",
        "customer_phone": "555-0100",
        "vehicle_make": "Toyota",
        "vehicle_model": "Camry",
        "vehicle_year": "2019",
        "registration_number": "XYZ-1234",
        "service_type": "Logbook Service",
        "notes": "Has a weird sound when turning left.",
        "scheduled_date": (datetime.utcnow() + timedelta(days=2)).isoformat(),
        "status": "PENDING"
    }

@pytest.mark.asyncio
async def test_create_booking(client, mock_booking_data):
    response = client.post("/api/v1/bookings/", json=mock_booking_data)
    
    assert response.status_code == 201
    data = response.json()
    assert data["customer_name"] == mock_booking_data["customer_name"]
    assert data["registration_number"] == mock_booking_data["registration_number"]
    assert data["status"] == "PENDING"
    assert "id" in data

@pytest.mark.asyncio
async def test_create_booking_missing_fields(client, test_tenant):
    invalid_booking = {
        "tenant_id": test_tenant["id"],
        "customer_name": "Bob Jones"
        # Missing required fields like preferred_date, vehicle_make
    }
    
    response = client.post("/api/v1/bookings/", json=invalid_booking)
    
    assert response.status_code == 422 # Unprocessable Entity from Pydantic

@pytest.mark.asyncio
async def test_get_booking(client, mock_booking_data):
    # First create
    create_res = client.post("/api/v1/bookings/", json=mock_booking_data)
    booking_id = create_res.json()["id"]
    
    # Then get
    response = client.get(f"/api/v1/bookings/{booking_id}")
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == booking_id
    assert data["customer_email"] == mock_booking_data["customer_email"]

@pytest.mark.asyncio
async def test_update_booking_status(client, mock_booking_data):
    # Create booking
    create_res = client.post("/api/v1/bookings/", json=mock_booking_data)
    booking_id = create_res.json()["id"]
    
    # Update status to CONFIRMED
    update_data = {"status": "CONFIRMED"}
    # The patch endpoint might be set up to validate the partial fields
    response = client.patch(f"/api/v1/bookings/{booking_id}", json=update_data)
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "CONFIRMED"
