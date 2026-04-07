from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID

from core.database import get_db_session
from models.supplier import Supplier
from schemas.supplier import SupplierCreate, SupplierResponse, SupplierUpdate

router = APIRouter(prefix="/suppliers", tags=["suppliers"])

@router.post("/", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
async def create_supplier(supplier: SupplierCreate, db: AsyncSession = Depends(get_db_session)):
    supplier_data = supplier.model_dump()
    db_supplier = Supplier(**supplier_data)
    db.add(db_supplier)
    await db.commit()
    await db.refresh(db_supplier)
    return db_supplier

@router.get("/", response_model=List[SupplierResponse])
async def list_suppliers(tenant_id: UUID, db: AsyncSession = Depends(get_db_session)):
    query = select(Supplier).where(Supplier.tenant_id == tenant_id).order_by(Supplier.company_name)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{supplier_id}", response_model=SupplierResponse)
async def get_supplier(supplier_id: UUID, db: AsyncSession = Depends(get_db_session)):
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier

@router.patch("/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(supplier_id: UUID, supplier_update: SupplierUpdate, db: AsyncSession = Depends(get_db_session)):
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
        
    update_data = supplier_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(supplier, key, value)
        
    await db.commit()
    await db.refresh(supplier)
    return supplier
