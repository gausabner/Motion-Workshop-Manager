import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Float, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from models.base import TenantAwareModel, BaseModel

class JobCard(TenantAwareModel):
    __tablename__ = "job_cards"

    booking_id = Column(ForeignKey("bookings.id"), nullable=True) # Optional link to a booking
    
    # Redundant but useful for walk-ins without a prior booking
    vehicle_make = Column(String(100), nullable=False)
    vehicle_model = Column(String(100), nullable=False)
    registration_number = Column(String(50), nullable=False)
    mileage = Column(String(50), nullable=True)
    
    # Statuses: DRAFT, IN_PROGRESS, WAITING_ON_PARTS, COMPLETED, INVOICED
    status = Column(String(50), default="DRAFT", nullable=False)
    
    customer_notes = Column(Text, nullable=True)
    mechanic_notes = Column(Text, nullable=True)
    
    assigned_mechanic_id = Column(ForeignKey("users.id"), nullable=True)
    
    booking = relationship("Booking")
    assigned_mechanic = relationship("User", backref="jobs")
    parts = relationship("JobPart", back_populates="job", cascade="all, delete-orphan")
    labor = relationship("JobLabor", back_populates="job", cascade="all, delete-orphan")


class JobPart(BaseModel):
    __tablename__ = "job_parts"

    job_id = Column(ForeignKey("job_cards.id"), nullable=False)
    
    part_number = Column(String(100), nullable=True) # E.g., OEM number
    description = Column(String(255), nullable=False)
    quantity = Column(Float, nullable=False, default=1.0)
    unit_cost = Column(Float, nullable=False, default=0.0) # Cost to workshop
    unit_price = Column(Float, nullable=False, default=0.0) # Price to customer
    is_supplied_by_customer = Column(Boolean, default=False)
    
    job = relationship("JobCard", back_populates="parts")


class JobLabor(BaseModel):
    __tablename__ = "job_labor"

    job_id = Column(ForeignKey("job_cards.id"), nullable=False)
    
    description = Column(String(255), nullable=False)
    hours = Column(Float, nullable=False, default=1.0)
    hourly_rate = Column(Float, nullable=False, default=0.0)
    
    job = relationship("JobCard", back_populates="labor")
