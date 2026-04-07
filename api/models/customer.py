from sqlalchemy import Column, String, Float
from models.base import TenantAwareModel

class Customer(TenantAwareModel):
    __tablename__ = "customers"

    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    biller = Column(String(255), nullable=True)
    business_number = Column(String(100), nullable=True)
    
    # Dual Addressing
    street_address_1 = Column(String(255))
    street_address_2 = Column(String(255))
    street_suburb = Column(String(100))
    street_city = Column(String(100))
    street_state = Column(String(100)) # Region
    street_country = Column(String(100))
    street_postcode = Column(String(20))
    
    postal_address_1 = Column(String(255))
    postal_address_2 = Column(String(255))
    postal_suburb = Column(String(100))
    postal_city = Column(String(100))
    postal_state = Column(String(100)) # Region
    postal_country = Column(String(100))
    postal_postcode = Column(String(20))
    
    # Contact Info
    phone = Column(String(50))
    mobile = Column(String(50))
    email = Column(String(255))
    fax = Column(String(50))
    preferred_contact_method = Column(String(50), default="EMAIL")
    
    # Financial Tiers
    hourly_rate = Column(Float, nullable=True) # Override workshop default
    discount_percent = Column(Float, default=0.0)
    markup_percent = Column(Float, default=0.0)
    payment_terms = Column(String(50), default="COD") # E.g. COD, NET30
    
    # Reference IDs
    imported_id = Column(String(100))
    government_id = Column(String(100))
    ams_member_number = Column(String(100))
    capricorn_member_number = Column(String(100))
