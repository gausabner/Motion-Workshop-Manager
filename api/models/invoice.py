from sqlalchemy import Column, String, ForeignKey, Text, Float, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from models.base import TenantAwareModel, BaseModel

class Invoice(TenantAwareModel):
    __tablename__ = "invoices"

    job_id = Column(ForeignKey("job_cards.id"), nullable=False)
    
    invoice_number = Column(String(50), nullable=False, index=True)
    issue_date = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=True)
    
    # Statuses: DRAFT, SENT, PARTIAL, PAID, VOID, OVERDUE
    status = Column(String(50), default="DRAFT", nullable=False)
    
    # Financials
    subtotal = Column(Float, nullable=False, default=0.0)
    total_tax = Column(Float, nullable=False, default=0.0)
    total_amount = Column(Float, nullable=False, default=0.0)
    amount_paid = Column(Float, nullable=False, default=0.0)
    
    notes = Column(Text, nullable=True)
    terms = Column(Text, nullable=True) # E.g., Payment within 30 days
    
    job = relationship("JobCard")
    line_items = relationship("InvoiceLineItem", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceLineItem(BaseModel):
    __tablename__ = "invoice_line_items"

    invoice_id = Column(ForeignKey("invoices.id"), nullable=False)
    
    # Optional links back to the job items for traceability
    job_part_id = Column(ForeignKey("job_parts.id"), nullable=True)
    job_labor_id = Column(ForeignKey("job_labor.id"), nullable=True)
    
    description = Column(String(255), nullable=False)
    quantity = Column(Float, nullable=False, default=1.0)
    unit_price = Column(Float, nullable=False, default=0.0)
    
    # Pre-calculated fields for the line item
    tax_rate = Column(Float, nullable=False, default=0.0) # E.g., 0.15 for 15%
    tax_amount = Column(Float, nullable=False, default=0.0)
    line_total = Column(Float, nullable=False, default=0.0)
    
    invoice = relationship("Invoice", back_populates="line_items")
