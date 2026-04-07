from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime

class ProductBase(BaseModel):
    item_code: str
    description: str
    description_2: Optional[str] = None
    searchable_tags: Optional[str] = None
    
    group: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    type: Optional[str] = None
    supplier_id: Optional[str] = None
    
    is_service: Optional[bool] = False
    gst_free: Optional[bool] = False
    requires_serial_number: Optional[bool] = False
    
    quantity_on_hand: Optional[float] = 0.0
    minimum_qty: Optional[float] = 0.0
    maximum_qty: Optional[float] = 0.0
    qty_reserved: Optional[float] = 0.0
    location: Optional[str] = None
    
    cost_excluding_tax: Optional[float] = 0.0
    cost_including_tax: Optional[float] = 0.0
    retail_price: Optional[float] = 0.0
    price_1: Optional[float] = 0.0
    price2: Optional[float] = 0.0
    price3: Optional[float] = 0.0
    price4: Optional[float] = 0.0
    
    comment: Optional[str] = None
    job_card_comment: Optional[str] = None

class ProductCreate(ProductBase):
    tenant_id: UUID

class ProductUpdate(BaseModel):
    item_code: Optional[str] = None
    description: Optional[str] = None
    description_2: Optional[str] = None
    searchable_tags: Optional[str] = None
    group: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    type: Optional[str] = None
    supplier_id: Optional[str] = None
    is_service: Optional[bool] = None
    gst_free: Optional[bool] = None
    requires_serial_number: Optional[bool] = None
    quantity_on_hand: Optional[float] = None
    minimum_qty: Optional[float] = None
    maximum_qty: Optional[float] = None
    qty_reserved: Optional[float] = None
    location: Optional[str] = None
    cost_excluding_tax: Optional[float] = None
    cost_including_tax: Optional[float] = None
    retail_price: Optional[float] = None
    price_1: Optional[float] = None
    price2: Optional[float] = None
    price3: Optional[float] = None
    price4: Optional[float] = None
    comment: Optional[str] = None
    job_card_comment: Optional[str] = None

class ProductResponse(ProductBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
