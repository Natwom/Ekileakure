from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Enum
from datetime import datetime, timezone
import enum
from app.core.database import Base


class Division(str, enum.Enum):
    spare_parts = "spare_parts"
    mpesa = "mpesa"
    general = "general"


class Expense(Base):
    __tablename__ = "expenses"
    id = Column(Integer, primary_key=True)
    division = Column(Enum(Division), default=Division.general)
    category = Column(String(80), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    description = Column(String(255))
    recorded_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"
    id = Column(Integer, primary_key=True)
    account = Column(Enum("float", "cash", name="ledger_account"), nullable=False)
    direction = Column(Enum("debit", "credit", name="ledger_direction"), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    source_type = Column(String(40))
    source_id = Column(Integer)
    note = Column(String(255))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


class BusinessSetting(Base):
    __tablename__ = "business_settings"
    key = Column(String(60), primary_key=True)
    value = Column(String(255))