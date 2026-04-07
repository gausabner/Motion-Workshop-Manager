from sqlalchemy import Column, String, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from models.base import BaseModel

class Tenant(BaseModel):
    __tablename__ = "tenants"

    name = Column(String(255), nullable=False)
    subdomain = Column(String(100), unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Store global configuration overrides here
    settings = Column(JSONB, server_default='{}')
