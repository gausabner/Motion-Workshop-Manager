from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime, date

class VehicleBase(BaseModel):
    customer_id: Optional[UUID] = None
    
    registration_number: str
    vin: Optional[str] = None
    make: str
    model: str
    model_series: Optional[str] = None
    engine_number: Optional[str] = None
    chassis_number: Optional[str] = None
    fleet_code: Optional[str] = None
    
    transmission: Optional[str] = None
    has_ac: Optional[bool] = False
    body_type: Optional[str] = None
    seating: Optional[int] = None
    fuel_type: Optional[str] = None
    color: Optional[str] = None
    build_date: Optional[date] = None
    tyre_size: Optional[str] = None
    
    region: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    
    rego_due_date: Optional[date] = None
    wof_due_date: Optional[date] = None
    odometer: Optional[int] = 0
    engine_hours: Optional[float] = 0.0
    last_in_date: Optional[date] = None
    last_service_date: Optional[date] = None
    next_service_date: Optional[date] = None
    next_service_km: Optional[int] = None
    service_interval_months: Optional[int] = None

class VehicleCreate(VehicleBase):
    tenant_id: UUID

class VehicleUpdate(VehicleBase):
    customer_id: Optional[UUID] = None
    registration_number: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None

class VehicleResponse(VehicleBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
