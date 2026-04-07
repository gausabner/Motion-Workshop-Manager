import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class BaseModel(Base):
    """Abstract base model with UUID primary key and audit timestamps."""
    __abstract__ = True

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class TenantAwareModel(BaseModel):
    """Abstract model for data that belongs to a specific tenant.
    This will be used in conjunction with Row Level Security (RLS) policies.
    """
    __abstract__ = True

    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
