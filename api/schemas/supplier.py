from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional
from uuid import UUID
from datetime import datetime

class SupplierBase(BaseModel):
    company_name: str
    website: Optional[str] = None
    biller: Optional[str] = None
    
    address: Optional[str] = None
    address_2: Optional[str] = None
    street: Optional[str] = None
    suburb: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postcode: Optional[str] = None
    
    phone: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    fax: Optional[str] = None
    
    vendor_account_number: Optional[str] = None
    default_payment_terms: Optional[str] = None
    
    contact1_first: Optional[str] = None
    contact1_last: Optional[str] = None
    contact1_position: Optional[str] = None
    contact1_phone: Optional[str] = None
    contact1_email: Optional[str] = None
    
    contact2_first: Optional[str] = None
    contact2_last: Optional[str] = None
    contact2_position: Optional[str] = None
    contact2_phone: Optional[str] = None
    contact2_email: Optional[str] = None

class SupplierCreate(SupplierBase):
    tenant_id: UUID

class SupplierUpdate(BaseModel):
    company_name: Optional[str] = None
    website: Optional[str] = None
    biller: Optional[str] = None
    address: Optional[str] = None
    address_2: Optional[str] = None
    street: Optional[str] = None
    suburb: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postcode: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    fax: Optional[str] = None
    vendor_account_number: Optional[str] = None
    default_payment_terms: Optional[str] = None
    contact1_first: Optional[str] = None
    contact1_last: Optional[str] = None
    contact1_position: Optional[str] = None
    contact1_phone: Optional[str] = None
    contact1_email: Optional[str] = None
    contact2_first: Optional[str] = None
    contact2_last: Optional[str] = None
    contact2_position: Optional[str] = None
    contact2_phone: Optional[str] = None
    contact2_email: Optional[str] = None

class SupplierResponse(SupplierBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
