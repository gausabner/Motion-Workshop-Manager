from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class JobPartBase(BaseModel):
    part_number: Optional[str] = Field(None, max_length=100)
    description: str = Field(..., max_length=255)
    quantity: float = Field(default=1.0, ge=0)
    unit_cost: float = Field(default=0.0, ge=0)
    unit_price: float = Field(default=0.0, ge=0)
    is_supplied_by_customer: bool = False

class JobPartCreate(JobPartBase):
    pass

class JobPartResponse(JobPartBase):
    id: UUID
    job_id: UUID
    model_config = ConfigDict(from_attributes=True)

class JobLaborBase(BaseModel):
    description: str = Field(..., max_length=255)
    hours: float = Field(default=1.0, ge=0)
    hourly_rate: float = Field(default=0.0, ge=0)

class JobLaborCreate(JobLaborBase):
    pass

class JobLaborResponse(JobLaborBase):
    id: UUID
    job_id: UUID
    model_config = ConfigDict(from_attributes=True)

class JobCardBase(BaseModel):
    booking_id: Optional[UUID] = None
    vehicle_make: str = Field(..., max_length=100)
    vehicle_model: str = Field(..., max_length=100)
    registration_number: str = Field(..., max_length=50)
    mileage: Optional[str] = Field(None, max_length=50)
    status: str = Field(default="DRAFT", max_length=50)
    customer_notes: Optional[str] = None
    mechanic_notes: Optional[str] = None
    assigned_mechanic_id: Optional[UUID] = None

class JobCardCreate(JobCardBase):
    tenant_id: UUID

class JobCardUpdate(BaseModel):
    status: Optional[str] = Field(None, max_length=50)
    mileage: Optional[str] = Field(None, max_length=50)
    customer_notes: Optional[str] = None
    mechanic_notes: Optional[str] = None
    assigned_mechanic_id: Optional[UUID] = None

class JobCardResponse(JobCardBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime
    parts: List[JobPartResponse] = []
    labor: List[JobLaborResponse] = []

    model_config = ConfigDict(from_attributes=True)
