from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional
from uuid import UUID
from datetime import datetime

class CustomerBase(BaseModel):
    first_name: str
    last_name: str
    biller: Optional[str] = None
    business_number: Optional[str] = None
    
    street_address_1: Optional[str] = None
    street_address_2: Optional[str] = None
    street_suburb: Optional[str] = None
    street_city: Optional[str] = None
    street_state: Optional[str] = None
    street_country: Optional[str] = None
    street_postcode: Optional[str] = None
    
    postal_address_1: Optional[str] = None
    postal_address_2: Optional[str] = None
    postal_suburb: Optional[str] = None
    postal_city: Optional[str] = None
    postal_state: Optional[str] = None
    postal_country: Optional[str] = None
    postal_postcode: Optional[str] = None
    
    phone: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    fax: Optional[str] = None
    preferred_contact_method: Optional[str] = "EMAIL"
    
    hourly_rate: Optional[float] = None
    discount_percent: Optional[float] = 0.0
    markup_percent: Optional[float] = 0.0
    payment_terms: Optional[str] = "COD"
    
    imported_id: Optional[str] = None
    government_id: Optional[str] = None
    ams_member_number: Optional[str] = None
    capricorn_member_number: Optional[str] = None

class CustomerCreate(CustomerBase):
    tenant_id: UUID

class CustomerUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    biller: Optional[str] = None
    business_number: Optional[str] = None
    
    street_address_1: Optional[str] = None
    street_address_2: Optional[str] = None
    street_suburb: Optional[str] = None
    street_city: Optional[str] = None
    street_state: Optional[str] = None
    street_country: Optional[str] = None
    street_postcode: Optional[str] = None
    
    postal_address_1: Optional[str] = None
    postal_address_2: Optional[str] = None
    postal_suburb: Optional[str] = None
    postal_city: Optional[str] = None
    postal_state: Optional[str] = None
    postal_country: Optional[str] = None
    postal_postcode: Optional[str] = None
    
    phone: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    fax: Optional[str] = None
    preferred_contact_method: Optional[str] = None
    
    hourly_rate: Optional[float] = None
    discount_percent: Optional[float] = None
    markup_percent: Optional[float] = None
    payment_terms: Optional[str] = None
    
    imported_id: Optional[str] = None
    government_id: Optional[str] = None
    ams_member_number: Optional[str] = None
    capricorn_member_number: Optional[str] = None

class CustomerResponse(CustomerBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
