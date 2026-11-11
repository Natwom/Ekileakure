from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from app.core.database import Base

class Role(str, enum.Enum):
    owner = "owner"
    manager = "manager"
    spare_parts_cashier = "spare_parts_cashier"
    mpesa_operator = "mpesa_operator"
    accountant = "accountant"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    full_name = Column(String(120), nullable=False)
    email = Column(String(120), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(Role), default=Role.spare_parts_cashier, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(80), nullable=False)
    entity = Column(String(80))
    entity_id = Column(String(40))
    detail = Column(Text)
    ip_address = Column(String(60))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    user = relationship("User")