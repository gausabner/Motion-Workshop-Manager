from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID

from core.database import get_db_session
from models.payment import Payment
from models.invoice import Invoice
from schemas.payment import PaymentCreate, PaymentResponse, PaymentUpdate

router = APIRouter(prefix="/payments", tags=["payments"])

@router.post("/", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def create_payment(payment: PaymentCreate, db: AsyncSession = Depends(get_db_session)):
    # Validate invoice exists
    invoice = await db.get(Invoice, payment.invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    db_payment = Payment(**payment.model_dump())
    db.add(db_payment)
    await db.commit()
    await db.refresh(db_payment)
    return db_payment

@router.get("/", response_model=List[PaymentResponse])
async def list_payments(tenant_id: UUID, db: AsyncSession = Depends(get_db_session)):
    query = select(Payment).where(Payment.tenant_id == tenant_id)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{payment_id}", response_model=PaymentResponse)
async def get_payment(payment_id: UUID, db: AsyncSession = Depends(get_db_session)):
    payment = await db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment

@router.patch("/{payment_id}", response_model=PaymentResponse)
async def update_payment(payment_id: UUID, payment_update: PaymentUpdate, db: AsyncSession = Depends(get_db_session)):
    payment = await db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
        
    update_data = payment_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(payment, key, value)
        
    await db.commit()
    await db.refresh(payment)
    
    # Optional logic here: if status is changed to COMPLETED, 
    # update the linked invoice's amount_paid and status
    
    return payment
