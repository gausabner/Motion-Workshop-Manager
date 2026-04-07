from models.base import BaseModel, TenantAwareModel
from models.tenant import Tenant
from models.user import User
from models.customer import Customer
from models.vehicle import Vehicle
from models.product import Product
from models.supplier import Supplier
from models.booking import Booking
from models.job import JobCard, JobPart, JobLabor
from models.inspection import Inspection, InspectionItem
from models.invoice import Invoice, InvoiceLineItem
from models.payment import Payment

# Ensure all models are loaded for SQLAlchemy metadata registration
__all__ = [
    "BaseModel",
    "TenantAwareModel",
    "Tenant",
    "User",
    "Customer",
    "Vehicle",
    "Product",
    "Supplier",
    "Booking",
    "JobCard",
    "JobPart",
    "JobLabor",
    "Inspection",
    "InspectionItem",
    "Invoice",
    "InvoiceLineItem",
    "Payment"
]
