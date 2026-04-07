from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID

from core.database import get_db_session
from models.vehicle import Vehicle
from schemas.vehicle import VehicleCreate, VehicleResponse, VehicleUpdate

router = APIRouter(prefix="/vehicles", tags=["vehicles"])

@router.post("/", response_model=VehicleResponse, status_code=status.HTTP_201_CREATED)
async def create_vehicle(vehicle: VehicleCreate, db: AsyncSession = Depends(get_db_session)):
    vehicle_data = vehicle.model_dump()
    db_vehicle = Vehicle(**vehicle_data)
    db.add(db_vehicle)
    await db.commit()
    await db.refresh(db_vehicle)
    return db_vehicle

@router.get("/", response_model=List[VehicleResponse])
async def list_vehicles(tenant_id: UUID, db: AsyncSession = Depends(get_db_session)):
    query = select(Vehicle).where(Vehicle.tenant_id == tenant_id).order_by(Vehicle.registration_number)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{vehicle_id}", response_model=VehicleResponse)
async def get_vehicle(vehicle_id: UUID, db: AsyncSession = Depends(get_db_session)):
    vehicle = await db.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle

@router.patch("/{vehicle_id}", response_model=VehicleResponse)
async def update_vehicle(vehicle_id: UUID, vehicle_update: VehicleUpdate, db: AsyncSession = Depends(get_db_session)):
    vehicle = await db.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
        
    update_data = vehicle_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(vehicle, key, value)
        
    await db.commit()
    await db.refresh(vehicle)
    return vehicle
