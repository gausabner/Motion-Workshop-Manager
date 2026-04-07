from sqlalchemy import Column, String
from models.base import TenantAwareModel

class Supplier(TenantAwareModel):
    __tablename__ = "suppliers"

    company_name = Column(String(255), nullable=False)
    website = Column(String(255))
    biller = Column(String(255))
    
    address = Column(String(255)) # alias for Street Address 1 / Address 1
    address_2 = Column(String(255))
    street = Column(String(255))
    suburb = Column(String(100))
    city = Column(String(100))
    state = Column(String(100)) # Region
    country = Column(String(100))
    postcode = Column(String(20))
    
    phone = Column(String(50))
    mobile = Column(String(50))
    email = Column(String(255))
    fax = Column(String(50))
    
    vendor_account_number = Column(String(100))
    default_payment_terms = Column(String(50))
    
    contact1_first = Column(String(100))
    contact1_last = Column(String(100))
    contact1_position = Column(String(100))
    contact1_phone = Column(String(50))
    contact1_email = Column(String(255))
    
    contact2_first = Column(String(100))
    contact2_last = Column(String(100))
    contact2_position = Column(String(100))
    contact2_phone = Column(String(50))
    contact2_email = Column(String(255))
