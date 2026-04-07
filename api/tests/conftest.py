import pytest
import asyncio
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from fastapi.testclient import TestClient

from core.database import get_db_session
from models.base import Base
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient

from core.database import get_db_session
from models.base import Base
from core.config import settings
from main import app

# Simple in-memory storage to simulate DB state in tests
test_db_state = {"tenants": [], "users": [], "bookings": [], "invoices": [], "jobs": [], "job_parts": [], "job_labor": [], "inspections": [], "inspection_items": [], "payments": []}

@pytest.fixture(scope="function", autouse=True)
def reset_test_db_state():
    test_db_state["tenants"].clear()
    test_db_state["users"].clear()
    test_db_state["bookings"].clear()
    test_db_state["invoices"].clear()
    test_db_state["jobs"].clear()
    test_db_state["job_parts"].clear()
    test_db_state["job_labor"].clear()
    test_db_state["inspections"].clear()
    test_db_state["inspection_items"].clear()
    test_db_state["payments"].clear()
    yield

class MockResult:
    def __init__(self, data):
        self._data = data

    def scalars(self):
        return self

    def first(self):
        return self._data[0] if self._data else None

    def all(self):
        return self._data

# Setup the mock database session
mock_session = AsyncMock()

def mock_add(instance):
    table = instance.__tablename__
    state_key = table
    if table == "job_cards":
        state_key = "jobs"
        
    if state_key in test_db_state:
        test_db_state[state_key].append(instance)
        
    # Some routers (like jobs) fetch relationships explicitly with selectinload and then return instances.
    # We must patch those relationship collections as empty lists initially if they don't exist.
    if state_key == "jobs":
        if getattr(instance, "parts", None) is None: instance.parts = []
        if getattr(instance, "labor", None) is None: instance.labor = []
    if state_key == "invoices":
        if getattr(instance, "line_items", None) is None: instance.line_items = []
    if state_key == "inspections":
        if getattr(instance, "items", None) is None: instance.items = []
            
    return instance

# db.add is synchronous in AsyncSession. AsyncMock() by default returns a coroutine.
# We override it to be a plain MagicMock.
mock_session.add = MagicMock(side_effect=mock_add)

async def mock_execute(query, *args, **kwargs):
    query_str = str(query)
    print("Executing query:", query_str)
    
    # Simulate Duplicate checks
    if "users" in query_str:
        # Check against the stored state precisely
        for u in test_db_state["users"]:
             # Basic proxy for email equality check
             if f"'{u.email}'" in query_str or f"users.email = :email" in query_str: 
                 return MockResult([u])
                 
    if "tenants" in query_str:
        for t in test_db_state["tenants"]:
             if f"'{t.subdomain}'" in query_str or f"tenants.subdomain = :subdomain" in query_str:
                 return MockResult([t])
                 
    # Basic get operations by ID typically use where(table.id == X) queries which we intercept
    if "job_cards.id" in query_str:
         for j in test_db_state["jobs"]:
             # Note: This is a hacky fallback string lookup. We assume test_db_state has what was inserted.
             # If the id of the job is in the query_str at all, we return it.
             if str(getattr(j, "id", "")) in query_str or f"job_cards.id = :id" in query_str:
                 return MockResult([j])

    if "inspections.id" in query_str:
        for i in test_db_state["inspections"]:
            if str(getattr(i, "id", "")) in query_str or f"inspections.id = :id" in query_str:
                return MockResult([i])

    print("DB State Jobs:", [j.id for j in test_db_state.get("jobs", [])])
    return MockResult([])
    
async def mock_refresh(instance):
    import uuid
    from datetime import datetime
    if not getattr(instance, "id", None):
        instance.id = uuid.uuid4()
    if getattr(instance, "created_at", None) is None:
        instance.created_at = datetime.utcnow()
    if getattr(instance, "updated_at", None) is None:
        instance.updated_at = datetime.utcnow()
    if getattr(instance, "is_active", None) is None:
        instance.is_active = True
    if getattr(instance, "is_superuser", None) is None:
        instance.is_superuser = False
    if getattr(instance, "tenant_id", None) is None:
        instance.tenant_id = uuid.uuid4()
        
    # Mock defaults for Invoices and Line Items
    if getattr(instance, "subtotal", None) is None:
        instance.subtotal = 0.0
    if getattr(instance, "total_tax", None) is None:
        instance.total_tax = 0.0
    if getattr(instance, "total_amount", None) is None:
        instance.total_amount = 0.0
    if getattr(instance, "amount_paid", None) is None:
        instance.amount_paid = 0.0
    if getattr(instance, "issue_date", None) is None:
        instance.issue_date = datetime.utcnow()
    if getattr(instance, "due_date", None) is None:
        instance.due_date = datetime.utcnow()
    # For Line Items
    if getattr(instance, "line_total", None) is None:
        instance.line_total = 0.0
    if getattr(instance, "tax_amount", None) is None:
        instance.tax_amount = 0.0
        
    # For Jobs and related entities
    if getattr(instance, "__tablename__", None) == "job_parts":
        if getattr(instance, "quantity", None) is None: instance.quantity = 1.0
        if getattr(instance, "unit_cost", None) is None: instance.unit_cost = 0.0
        if getattr(instance, "unit_price", None) is None: instance.unit_price = 0.0
    if getattr(instance, "__tablename__", None) == "job_labor":
        if getattr(instance, "hours", None) is None: instance.hours = 1.0
        if getattr(instance, "hourly_rate", None) is None: instance.hourly_rate = 0.0

    # For Inspections
    if getattr(instance, "__tablename__", None) == "inspection_items":
        if getattr(instance, "is_approved_for_repair", None) is None: instance.is_approved_for_repair = False

async def mock_get(model, ident, **kwargs):
    # Depending on what 'model' is passed, check the relevant list in test_db_state
    table_name = getattr(model, "__tablename__", None)
    
    # Map model table names to our test_db_state keys
    state_key = table_name
    if table_name == "job_cards":
        state_key = "jobs"
        
    if state_key and state_key in test_db_state:
        for item in test_db_state[state_key]:
            if str(getattr(item, "id", "")) == str(ident):
                return item
                
    # Fallback to satisfy foreign key mock validation checks
    if table_name == "invoices":
        class DummyInvoice:
            id = ident
        return DummyInvoice()
        
    return None

mock_session.execute.side_effect = mock_execute
mock_session.commit = AsyncMock()
mock_session.refresh.side_effect = mock_refresh
mock_session.get.side_effect = mock_get

async def override_get_db_session() -> AsyncGenerator[AsyncSession, None]:
    yield mock_session

app.dependency_overrides[get_db_session] = override_get_db_session

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test case."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="function", autouse=True)
def reset_mock_session():
    """Reset the mock session before each test."""
    mock_session.reset_mock()
    yield
    
@pytest.fixture(scope="module")
def client() -> TestClient:
    """Provide a FastAPI TestClient."""
    with TestClient(app) as c:
        yield c

@pytest.fixture
def test_tenant(client):
    import uuid
    tenant_data = {
        "name": "Fixture Workshop",
        "subdomain": f"fix-{uuid.uuid4().hex[:8]}"
    }
    response = client.post("/api/v1/tenants/", json=tenant_data)
    assert response.status_code == 201
    return response.json()

@pytest.fixture(scope="function")
def db_session() -> AsyncMock:
    """Provide the mocked session for test configuration."""
    return mock_session
