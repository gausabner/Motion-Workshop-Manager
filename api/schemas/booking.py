from pydantic import BaseModel, ConfigDict, EmailStr, Field
from typing import Optional
from uuid import UUID
from datetime import datetime

class BookingBase(BaseModel):
    customer_name: str = Field(..., max_length=255)
    customer_email: EmailStr
    customer_phone: Optional[str] = Field(None, max_length=50)
    
    vehicle_make: str = Field(..., max_length=100)
    vehicle_model: str = Field(..., max_length=100)
    vehicle_year: Optional[str] = Field(None, max_length=4)
    registration_number: Optional[str] = Field(None, max_length=50)

    reference: Optional[str] = Field(None, max_length=100)
    customer_order_number: Optional[str] = Field(None, max_length=100)
    
    booking_date: Optional[datetime] = None
    
    scheduled_date: datetime
    due_by_date: Optional[datetime] = None
    
    service_type: str = Field(..., max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    
    event_notes: Optional[str] = None
    notes: Optional[str] = None
    job_card_notes: Optional[str] = None
    
    status: str = Field(default="PENDING", max_length=50)
    assigned_to_id: Optional[UUID] = None

class BookingCreate(BookingBase):
    tenant_id: UUID  # Optional if extracted from context

class BookingUpdate(BaseModel):
    scheduled_date: Optional[datetime] = None
    due_by_date: Optional[datetime] = None
    booking_date: Optional[datetime] = None
    
    service_type: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    
    event_notes: Optional[str] = None
    notes: Optional[str] = None
    job_card_notes: Optional[str] = None
    
    status: Optional[str] = Field(None, max_length=50)
    assigned_to_id: Optional[UUID] = None

class BookingResponse(BookingBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
