from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID

from core.database import get_db_session
from models.tenant import Tenant
from schemas.tenant import TenantCreate, TenantResponse, TenantUpdate

router = APIRouter(prefix="/tenants", tags=["tenants"])

@router.get("/", response_model=List[TenantResponse])
async def list_tenants(db: AsyncSession = Depends(get_db_session)):
    result = await db.execute(select(Tenant))
    return result.scalars().all()

@router.post("/", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(tenant: TenantCreate, db: AsyncSession = Depends(get_db_session)):
    query = select(Tenant).where(Tenant.subdomain == tenant.subdomain)
    result = await db.execute(query)
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Subdomain already in use")
        
    db_tenant = Tenant(**tenant.model_dump())
    db.add(db_tenant)
    await db.commit()
    await db.refresh(db_tenant)
    return db_tenant

@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(tenant_id: UUID, db: AsyncSession = Depends(get_db_session)):
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant

@router.patch("/{tenant_id}", response_model=TenantResponse)
async def update_tenant(tenant_id: UUID, tenant_update: TenantUpdate, db: AsyncSession = Depends(get_db_session)):
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
        
    update_data = tenant_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(tenant, key, value)
        
    await db.commit()
    await db.refresh(tenant)
    return tenant
