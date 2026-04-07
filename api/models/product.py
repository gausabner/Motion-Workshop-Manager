from sqlalchemy import Column, String, Float, Boolean
from models.base import TenantAwareModel

class Product(TenantAwareModel):
    __tablename__ = "products"

    item_code = Column(String(100), nullable=False, index=True)
    description = Column(String(255), nullable=False)
    description_2 = Column(String(255))
    searchable_tags = Column(String(255))
    
    # Grouping
    group = Column(String(100))
    category = Column(String(100))
    supplier_id = Column(String(255)) # ForeignKey in strict schema
    brand = Column(String(100))
    type = Column(String(100))
    
    # Behaviors
    is_service = Column(Boolean, default=False)
    gst_free = Column(Boolean, default=False)
    requires_serial_number = Column(Boolean, default=False)
    
    # Stock
    quantity_on_hand = Column(Float, default=0.0)
    minimum_qty = Column(Float, default=0.0)
    maximum_qty = Column(Float, default=0.0)
    qty_reserved = Column(Float, default=0.0)
    location = Column(String(100))
    
    # Pricing Matrix
    cost_excluding_tax = Column(Float, default=0.0)
    cost_including_tax = Column(Float, default=0.0)
    retail_price = Column(Float, default=0.0)
    price_1 = Column(Float, default=0.0)
    price2 = Column(Float, default=0.0)
    price3 = Column(Float, default=0.0)
    price4 = Column(Float, default=0.0)
    
    comment = Column(String(255))
    job_card_comment = Column(String(255))
