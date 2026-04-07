from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID

from core.database import get_db_session
from models.booking import Booking
from schemas.booking import BookingCreate, BookingResponse, BookingUpdate

router = APIRouter(prefix="/bookings", tags=["bookings"])

@router.post("/", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
async def create_booking(booking: BookingCreate, db: AsyncSession = Depends(get_db_session)):
    booking_data = booking.model_dump()
    db_booking = Booking(**booking_data)
    db.add(db_booking)
    await db.commit()
    await db.refresh(db_booking)
    return db_booking

@router.get("/", response_model=List[BookingResponse])
async def list_bookings(tenant_id: UUID, db: AsyncSession = Depends(get_db_session)):
    query = select(Booking).where(Booking.tenant_id == tenant_id).order_by(Booking.scheduled_date)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking(booking_id: UUID, db: AsyncSession = Depends(get_db_session)):
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking

@router.patch("/{booking_id}", response_model=BookingResponse)
async def update_booking(booking_id: UUID, booking_update: BookingUpdate, db: AsyncSession = Depends(get_db_session)):
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    update_data = booking_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(booking, key, value)
        
    await db.commit()
    await db.refresh(booking)
    return booking
