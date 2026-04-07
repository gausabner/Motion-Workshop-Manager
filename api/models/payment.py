from sqlalchemy import Column, String, ForeignKey, Float, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from models.base import TenantAwareModel

class Payment(TenantAwareModel):
    __tablename__ = "payments"

    invoice_id = Column(ForeignKey("invoices.id"), nullable=False)
    
    amount = Column(Float, nullable=False)
    payment_method = Column(String(50), nullable=False) # E.g., COD, EFT
    payment_date = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    
    # Statuses: PENDING, REJECTED, COMPLETED
    status = Column(String(50), default="PENDING", nullable=False)
    
    # Store S3 path or reference for EFT proof
    proof_of_payment_url = Column(String(255), nullable=True)
    reference = Column(String(100), nullable=True) # Bank reference number
    
    invoice = relationship("Invoice")
