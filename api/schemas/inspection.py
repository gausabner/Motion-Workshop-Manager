from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class InspectionItemBase(BaseModel):
    category: str = Field(..., max_length=100)
    description: str = Field(..., max_length=255)
    condition: str = Field(default="GREEN", max_length=20)
    notes: Optional[str] = None
    is_approved_for_repair: bool = False

class InspectionItemCreate(InspectionItemBase):
    pass

class InspectionItemResponse(InspectionItemBase):
    id: UUID
    inspection_id: UUID
    model_config = ConfigDict(from_attributes=True)


class InspectionBase(BaseModel):
    job_id: Optional[UUID] = None
    vehicle_make: str = Field(..., max_length=100)
    vehicle_model: str = Field(..., max_length=100)
    registration_number: str = Field(..., max_length=50)
    mechanic_id: UUID
    status: str = Field(default="DRAFT", max_length=50)
    customer_notes: Optional[str] = None
    mechanic_notes: Optional[str] = None

class InspectionCreate(InspectionBase):
    tenant_id: UUID

class InspectionUpdate(BaseModel):
    status: Optional[str] = Field(None, max_length=50)
    customer_notes: Optional[str] = None
    mechanic_notes: Optional[str] = None

class InspectionResponse(InspectionBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime
    items: List[InspectionItemResponse] = []

    model_config = ConfigDict(from_attributes=True)
