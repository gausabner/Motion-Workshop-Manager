from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID

from core.database import get_db_session
from models.customer import Customer
from schemas.customer import CustomerCreate, CustomerResponse, CustomerUpdate

router = APIRouter(prefix="/customers", tags=["customers"])

@router.post("/", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(customer: CustomerCreate, db: AsyncSession = Depends(get_db_session)):
    customer_data = customer.model_dump()
    db_customer = Customer(**customer_data)
    db.add(db_customer)
    await db.commit()
    await db.refresh(db_customer)
    return db_customer

@router.get("/", response_model=List[CustomerResponse])
async def list_customers(tenant_id: UUID, db: AsyncSession = Depends(get_db_session)):
    query = select(Customer).where(Customer.tenant_id == tenant_id).order_by(Customer.first_name)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(customer_id: UUID, db: AsyncSession = Depends(get_db_session)):
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

@router.patch("/{customer_id}", response_model=CustomerResponse)
async def update_customer(customer_id: UUID, customer_update: CustomerUpdate, db: AsyncSession = Depends(get_db_session)):
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    update_data = customer_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(customer, key, value)
        
    await db.commit()
    await db.refresh(customer)
    return customer
