from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from uuid import UUID
from datetime import datetime

class PaymentBase(BaseModel):
    invoice_id: UUID
    amount: float = Field(..., gt=0)
    payment_method: str = Field(..., max_length=50) # "COD" or "EFT"
    payment_date: Optional[datetime] = None
    status: str = Field(default="PENDING", max_length=50)
    proof_of_payment_url: Optional[str] = Field(None, max_length=255)
    reference: Optional[str] = Field(None, max_length=100)

class PaymentCreate(PaymentBase):
    tenant_id: UUID

class PaymentUpdate(BaseModel):
    status: Optional[str] = Field(None, max_length=50)
    proof_of_payment_url: Optional[str] = Field(None, max_length=255)
    reference: Optional[str] = Field(None, max_length=100)

class PaymentResponse(PaymentBase):
    id: UUID
    tenant_id: UUID
    payment_date: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
