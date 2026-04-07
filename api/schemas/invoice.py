from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class InvoiceLineItemBase(BaseModel):
    job_part_id: Optional[UUID] = None
    job_labor_id: Optional[UUID] = None
    description: str = Field(..., max_length=255)
    quantity: float = Field(default=1.0, ge=0)
    unit_price: float = Field(default=0.0, ge=0)
    tax_rate: float = Field(default=0.0, ge=0)

class InvoiceLineItemCreate(InvoiceLineItemBase):
    pass

class InvoiceLineItemResponse(InvoiceLineItemBase):
    id: UUID
    invoice_id: UUID
    tax_amount: float
    line_total: float
    model_config = ConfigDict(from_attributes=True)


class InvoiceBase(BaseModel):
    job_id: UUID
    invoice_number: str = Field(..., max_length=50)
    due_date: Optional[datetime] = None
    status: str = Field(default="DRAFT", max_length=50)
    notes: Optional[str] = None
    terms: Optional[str] = None

class InvoiceCreate(InvoiceBase):
    tenant_id: UUID

class InvoiceUpdate(BaseModel):
    status: Optional[str] = Field(None, max_length=50)
    due_date: Optional[datetime] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    amount_paid: Optional[float] = Field(None, ge=0)

class InvoiceResponse(InvoiceBase):
    id: UUID
    tenant_id: UUID
    issue_date: datetime
    subtotal: float
    total_tax: float
    total_amount: float
    amount_paid: float
    created_at: datetime
    updated_at: datetime
    line_items: List[InvoiceLineItemResponse] = []

    model_config = ConfigDict(from_attributes=True)
