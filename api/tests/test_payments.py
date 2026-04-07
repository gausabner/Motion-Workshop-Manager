import pytest
import uuid
from datetime import datetime

@pytest.fixture
def test_payment(test_tenant):
    return {
        "tenant_id": test_tenant["id"],
        "invoice_id": str(uuid.uuid4()), # Note: Mock execute intercept will need to pass this 404 validation
        "amount": 1050.50,
        "payment_method": "EFT",
        "payment_date": datetime.utcnow().isoformat(),
        "status": "PENDING"
    }

@pytest.mark.asyncio
async def test_create_payment(client, test_payment):
    # Depending on our conftest, if we just blindly pass a mock get for Invoice, this works
    response = client.post("/api/v1/payments/", json=test_payment)
    assert response.status_code == 201
    data = response.json()
    assert data["amount"] == 1050.50
    assert data["payment_method"] == "EFT"
    assert "id" in data

@pytest.mark.asyncio
async def test_update_payment_status(client, test_payment):
    # Create the payment
    create_res = client.post("/api/v1/payments/", json=test_payment)
    payment_id = create_res.json()["id"]
    
    # Update the payment status to completed
    update_data = {
        "status": "COMPLETED",
        "reference": "EFT-TRACE-999333"
    }
    response = client.patch(f"/api/v1/payments/{payment_id}", json=update_data)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "COMPLETED"
    assert data["reference"] == "EFT-TRACE-999333"
