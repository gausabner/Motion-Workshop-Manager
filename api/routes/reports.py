from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from uuid import UUID
from datetime import datetime, timedelta

from core.database import get_db_session
from models.invoice import Invoice
from models.job import JobCard
from models.payment import Payment

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("/revenue")
async def get_revenue_report(tenant_id: UUID, db: AsyncSession = Depends(get_db_session)):
    # Simple aggregate: sum of completed payments
    query = select(func.sum(Payment.amount)).where(
        Payment.tenant_id == tenant_id,
        Payment.status == "COMPLETED"
    )
    result = await db.execute(query)
    total_revenue = result.scalar() or 0.0
    return {"total_revenue": total_revenue}

@router.get("/aging-invoices")
async def get_aging_invoices(tenant_id: UUID, db: AsyncSession = Depends(get_db_session)):
    # Invoices where total_amount > amount_paid and due_date < now
    now = datetime.utcnow()
    query = select(Invoice).where(
        Invoice.tenant_id == tenant_id,
        Invoice.due_date < now,
        Invoice.amount_paid < Invoice.total_amount
    ).order_by(Invoice.due_date)
    
    result = await db.execute(query)
    invoices = result.scalars().all()
    
    return {
        "count": len(invoices),
        "invoices": [
            {
                "id": inv.id,
                "invoice_number": inv.invoice_number,
                "due_date": inv.due_date,
                "amount_due": inv.total_amount - inv.amount_paid
            } for inv in invoices
        ]
    }

@router.get("/productivity")
async def get_mechanic_productivity(tenant_id: UUID, db: AsyncSession = Depends(get_db_session)):
    # Count of COMPLETED jobs per mechanic
    query = select(JobCard.assigned_mechanic_id, func.count(JobCard.id)).where(
        JobCard.tenant_id == tenant_id,
        JobCard.status == "COMPLETED",
        JobCard.assigned_mechanic_id.isnot(None)
    ).group_by(JobCard.assigned_mechanic_id)
    
    result = await db.execute(query)
    stats = result.all()
    
    return [
        {
            "mechanic_id": mechanic_id,
            "completed_jobs": count
        } for mechanic_id, count in stats
    ]
