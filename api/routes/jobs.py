from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID

from core.database import get_db_session
from models.job import JobCard, JobPart, JobLabor
from schemas.job import (
    JobCardCreate, JobCardResponse, JobCardUpdate,
    JobPartCreate, JobPartResponse,
    JobLaborCreate, JobLaborResponse
)

router = APIRouter(prefix="/jobs", tags=["jobs"])

@router.post("/", response_model=JobCardResponse, status_code=status.HTTP_201_CREATED)
async def create_job_card(job: JobCardCreate, db: AsyncSession = Depends(get_db_session)):
    job_data = job.model_dump()
    db_job = JobCard(**job_data)
    db.add(db_job)
    await db.commit()
    await db.refresh(db_job)
    return db_job

@router.get("/", response_model=List[JobCardResponse])
async def list_jobs(tenant_id: UUID, db: AsyncSession = Depends(get_db_session)):
    # Use selectinload to eagerly load the relationships for serialization
    query = select(JobCard).where(JobCard.tenant_id == tenant_id).options(
        selectinload(JobCard.parts),
        selectinload(JobCard.labor)
    )
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{job_id}", response_model=JobCardResponse)
async def get_job(job_id: UUID, db: AsyncSession = Depends(get_db_session)):
    query = select(JobCard).where(JobCard.id == job_id).options(
        selectinload(JobCard.parts),
        selectinload(JobCard.labor)
    )
    result = await db.execute(query)
    job = result.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job Card not found")
    return job

@router.patch("/{job_id}", response_model=JobCardResponse)
async def update_job(job_id: UUID, job_update: JobCardUpdate, db: AsyncSession = Depends(get_db_session)):
    job = await db.get(JobCard, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job Card not found")
        
    update_data = job_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(job, key, value)
        
    await db.commit()
    
    # Reload with relationships
    query = select(JobCard).where(JobCard.id == job_id).options(
        selectinload(JobCard.parts),
        selectinload(JobCard.labor)
    )
    result = await db.execute(query)
    return result.scalars().first()

@router.post("/{job_id}/parts", response_model=JobPartResponse, status_code=status.HTTP_201_CREATED)
async def add_job_part(job_id: UUID, part: JobPartCreate, db: AsyncSession = Depends(get_db_session)):
    db_part = JobPart(**part.model_dump(), job_id=job_id)
    db.add(db_part)
    await db.commit()
    await db.refresh(db_part)
    return db_part

@router.post("/{job_id}/labor", response_model=JobLaborResponse, status_code=status.HTTP_201_CREATED)
async def add_job_labor(job_id: UUID, labor: JobLaborCreate, db: AsyncSession = Depends(get_db_session)):
    db_labor = JobLabor(**labor.model_dump(), job_id=job_id)
    db.add(db_labor)
    await db.commit()
    await db.refresh(db_labor)
    return db_labor
