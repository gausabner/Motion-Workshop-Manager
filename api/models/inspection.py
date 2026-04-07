from sqlalchemy import Column, String, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from models.base import TenantAwareModel, BaseModel

class Inspection(TenantAwareModel):
    __tablename__ = "inspections"

    job_id = Column(ForeignKey("job_cards.id"), nullable=True) # Inspections can be standalone or linked to a job
    
    vehicle_make = Column(String(100), nullable=False)
    vehicle_model = Column(String(100), nullable=False)
    registration_number = Column(String(50), nullable=False)
    
    mechanic_id = Column(ForeignKey("users.id"), nullable=False)
    
    # Statuses: DRAFT, SENT_FOR_APPROVAL, APPROVED, REJECTED
    status = Column(String(50), default="DRAFT", nullable=False)
    
    customer_notes = Column(Text, nullable=True)
    mechanic_notes = Column(Text, nullable=True)
    
    mechanic = relationship("User")
    job = relationship("JobCard")
    items = relationship("InspectionItem", back_populates="inspection", cascade="all, delete-orphan")


class InspectionItem(BaseModel):
    __tablename__ = "inspection_items"

    inspection_id = Column(ForeignKey("inspections.id"), nullable=False)
    
    category = Column(String(100), nullable=False) # e.g., 'Brakes', 'Tires', 'Fluids'
    description = Column(String(255), nullable=False)
    
    # RAG Status: RED (Urgent), AMBER (Warning), GREEN (Good)
    condition = Column(String(20), nullable=False, default="GREEN")
    
    notes = Column(Text, nullable=True)
    is_approved_for_repair = Column(Boolean, default=False)
    
    inspection = relationship("Inspection", back_populates="items")
