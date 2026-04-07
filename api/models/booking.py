from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from models.base import TenantAwareModel

class Booking(TenantAwareModel):
    __tablename__ = "bookings"

    customer_name = Column(String(255), nullable=False)
    customer_email = Column(String(255), nullable=False)
    customer_phone = Column(String(50), nullable=True)
    
    vehicle_make = Column(String(100), nullable=False)
    vehicle_model = Column(String(100), nullable=False)
    vehicle_year = Column(String(4), nullable=True)
    registration_number = Column(String(50), nullable=True)

    reference = Column(String(100), nullable=True)
    customer_order_number = Column(String(100), nullable=True)
    
    booking_date = Column(DateTime(timezone=True), nullable=True)
    scheduled_date = Column(DateTime(timezone=True), nullable=False)
    due_by_date = Column(DateTime(timezone=True), nullable=True)
    
    service_type = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    event_notes = Column(Text, nullable=True) # replacing / extending notes
    notes = Column(Text, nullable=True) # keeping this just in case
    job_card_notes = Column(Text, nullable=True)
    
    # Status: PENDING, CONFIRMED, CANCELLED, COMPLETED
    status = Column(String(50), default="PENDING", nullable=False)
    
    # Optional assignment to a mechanic or service advisor
    assigned_to_id = Column(ForeignKey("users.id"), nullable=True)
    
    assigned_user = relationship("User", backref="bookings")
