from sqlalchemy import Column, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from models.base import TenantAwareModel

class User(TenantAwareModel):
    __tablename__ = "users"

    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    
    # Role Types: ADMIN, SERVICE_ADVISOR, MECHANIC
    role = Column(String(50), nullable=False, default="MECHANIC")
    
    # RBAC & Advanced Profiles
    dashboard_privileges = Column(Boolean, default=False)
    mobile_mechanic = Column(Boolean, default=True) # Has access to PWA
    limit_customer_data = Column(Boolean, default=True) 
    
    # User-level UI settings 
    preferences = Column(JSONB, server_default='{}')
    
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False) # Only for motion system admins
