from pydantic import BaseModel, ConfigDict, EmailStr, Field
from typing import Optional
from uuid import UUID
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    role: str = Field(default="MECHANIC", max_length=50)

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    # The tenant_id will be extracted from context or subdomain in practice, 
    # but might be explicitly passed during onboarding.
    tenant_id: UUID

class UserUpdate(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    role: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None

class UserResponse(UserBase):
    id: UUID
    tenant_id: UUID
    is_active: bool
    is_superuser: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
