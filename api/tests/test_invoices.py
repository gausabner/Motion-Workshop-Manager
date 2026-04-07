import pytest
import uuid
from datetime import datetime

from routes.invoices import calculate_invoice_totals
from models.invoice import Invoice, InvoiceLineItem

@pytest.fixture
def test_invoice(test_tenant):
    return {
        "tenant_id": test_tenant["id"],
        "customer_id": str(uuid.uuid4()),
        "job_id": str(uuid.uuid4()),
        "invoice_number": f"INV-{uuid.uuid4().hex[:6].upper()}",
        "issue_date": datetime.utcnow().isoformat(),
        "due_date": datetime.utcnow().isoformat(),
        "status": "DRAFT",
        "subtotal": 0.0,
        "total_tax": 0.0,
        "total_amount": 0.0
    }

def test_calculate_invoice_totals():
    # Pure unit test for the business logic
    invoice = Invoice()
    items = [
        InvoiceLineItem(quantity=2, unit_price=50.0, tax_rate=0.10), # 100 + 10 = 110
        InvoiceLineItem(quantity=1, unit_price=200.0, tax_rate=0.05) # 200 + 10 = 210
    ]
    
    calculate_invoice_totals(invoice, items)
    
    assert items[0].tax_amount == 10.0
    assert items[0].line_total == 110.0
    
    assert items[1].tax_amount == 10.0
    assert items[1].line_total == 210.0
    
    assert invoice.subtotal == 300.0
    assert invoice.total_tax == 20.0
    assert invoice.total_amount == 320.0

@pytest.mark.asyncio
async def test_create_invoice(client, test_invoice):
    response = client.post("/api/v1/invoices/", json=test_invoice)
    assert response.status_code == 201
    data = response.json()
    assert data["invoice_number"] == test_invoice["invoice_number"]
    assert data["status"] == "DRAFT"
    assert "id" in data

@pytest.mark.asyncio
async def test_add_invoice_item(client, test_invoice):
    # Create the invoice first
    create_res = client.post("/api/v1/invoices/", json=test_invoice)
    invoice_id = create_res.json()["id"]
    
    # Add an item to it
    item_data = {
        "description": "Oil Filter",
        "quantity": 2,
        "unit_price": 25.0,
        "tax_rate": 0.15 # 15% tax
    }
    
    # Mock behavior warning: In our current conftest 'mock_get', adding items might not trigger 
    # the exact full query lifecycle because we aren't maintaining the relationships fully in `test_db_state`.
    # But we can at least test the endpoint execution returns 201.
    res = client.post(f"/api/v1/invoices/{invoice_id}/items", json=item_data)
    assert res.status_code == 201
    item_res = res.json()
    assert item_res["description"] == "Oil Filter"
    assert item_res["line_total"] == 57.5  # 50 + (50 * 0.15)
