from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID

from core.database import get_db_session
from models.inspection import Inspection, InspectionItem
from schemas.inspection import (
    InspectionCreate, InspectionResponse, InspectionUpdate,
    InspectionItemCreate, InspectionItemResponse
)

router = APIRouter(prefix="/inspections", tags=["inspections"])

@router.post("/", response_model=InspectionResponse, status_code=status.HTTP_201_CREATED)
async def create_inspection(inspection: InspectionCreate, db: AsyncSession = Depends(get_db_session)):
    db_inspection = Inspection(**inspection.model_dump())
    db.add(db_inspection)
    await db.commit()
    await db.refresh(db_inspection)
    return db_inspection

@router.get("/", response_model=List[InspectionResponse])
async def list_inspections(tenant_id: UUID, db: AsyncSession = Depends(get_db_session)):
    query = select(Inspection).where(Inspection.tenant_id == tenant_id).options(selectinload(Inspection.items))
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{inspection_id}", response_model=InspectionResponse)
async def get_inspection(inspection_id: UUID, db: AsyncSession = Depends(get_db_session)):
    query = select(Inspection).where(Inspection.id == inspection_id).options(selectinload(Inspection.items))
    result = await db.execute(query)
    inspection = result.scalars().first()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    return inspection

@router.patch("/{inspection_id}", response_model=InspectionResponse)
async def update_inspection(inspection_id: UUID, inspection_update: InspectionUpdate, db: AsyncSession = Depends(get_db_session)):
    inspection = await db.get(Inspection, inspection_id)
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
        
    update_data = inspection_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(inspection, key, value)
        
    await db.commit()
    
    # Reload with relationships
    query = select(Inspection).where(Inspection.id == inspection_id).options(selectinload(Inspection.items))
    result = await db.execute(query)
    return result.scalars().first()

@router.post("/{inspection_id}/items", response_model=InspectionItemResponse, status_code=status.HTTP_201_CREATED)
async def add_inspection_item(inspection_id: UUID, item: InspectionItemCreate, db: AsyncSession = Depends(get_db_session)):
    db_item = InspectionItem(**item.model_dump(), inspection_id=inspection_id)
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return db_item
