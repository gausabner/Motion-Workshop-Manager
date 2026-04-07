from sqlalchemy import Column, String, Integer, Date, Float, ForeignKey, Boolean
from models.base import TenantAwareModel

class Vehicle(TenantAwareModel):
    __tablename__ = "vehicles"

    customer_id = Column(ForeignKey("customers.id"), nullable=True)
    
    # Core Specs
    registration_number = Column(String(50), nullable=False, index=True)
    vin = Column(String(17), nullable=True, index=True)
    make = Column(String(100), nullable=False)
    model = Column(String(100), nullable=False)
    model_series = Column(String(100))
    engine_number = Column(String(100))
    chassis_number = Column(String(100))
    fleet_code = Column(String(100))
    
    # Details
    transmission = Column(String(50))
    has_ac = Column(Boolean, default=False)
    body_type = Column(String(100))
    seating = Column(Integer)
    fuel_type = Column(String(50))
    color = Column(String(50))
    build_date = Column(Date)
    tyre_size = Column(String(50))
    
    # Addressing/Location
    region = Column(String(100))
    city = Column(String(100))
    country = Column(String(100))
    
    # Compliance & Servicing
    rego_due_date = Column(Date)
    wof_due_date = Column(Date)
    odometer = Column(Integer, default=0)
    engine_hours = Column(Float, default=0.0)
    last_in_date = Column(Date)
    last_service_date = Column(Date)
    next_service_date = Column(Date)
    next_service_km = Column(Integer)
    service_interval_months = Column(Integer)
