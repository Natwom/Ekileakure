from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from app.core.database import Base

class TxnType(str, enum.Enum):
    deposit = "deposit"
    withdrawal = "withdrawal"

class TxnStatus(str, enum.Enum):
    verified = "verified"
    pending = "pending"
    reversed = "reversed"

class MpesaTransaction(Base):
    __tablename__ = "mpesa_transactions"
    __table_args__ = (UniqueConstraint("reference", name="uq_mpesa_reference"),)
    id = Column(Integer, primary_key=True)
    txn_type = Column(Enum(TxnType), nullable=False)
    reference = Column(String(40), index=True, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)        # principal — NEVER revenue
    commission = Column(Numeric(12, 2), default=0)         # agency income
    status = Column(Enum(TxnStatus), default=TxnStatus.verified)
    operator_id = Column(Integer, ForeignKey("users.id"))
    customer_phone = Column(String(20))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    reversed_by_id = Column(Integer, ForeignKey("users.id"))
    reversal_of_id = Column(Integer, ForeignKey("mpesa_transactions.id"))
    operator = relationship("User", foreign_keys=[operator_id])

class FloatLedger(Base):
    __tablename__ = "float_ledgers"
    id = Column(Integer, primary_key=True)
    business_date = Column(DateTime, unique=True, nullable=False, index=True)
    opening_float = Column(Numeric(14, 2), nullable=False)
    deposits = Column(Numeric(14, 2), default=0)      # increases float
    withdrawals = Column(Numeric(14, 2), default=0)   # decreases float
    closing_float = Column(Numeric(14, 2), nullable=False)
    status = Column(String(20), default="open")       # open / closed
    closed_by = Column(Integer, ForeignKey("users.id"))

class CashLedger(Base):
    __tablename__ = "cash_ledgers"
    id = Column(Integer, primary_key=True)
    business_date = Column(DateTime, unique=True, nullable=False, index=True)
    opening_cash = Column(Numeric(14, 2), nullable=False)
    deposits_in = Column(Numeric(14, 2), default=0)     # cash from deposits
    withdrawals_out = Column(Numeric(14, 2), default=0) # cash paid for withdrawals
    other_in = Column(Numeric(14, 2), default=0)
    other_out = Column(Numeric(14, 2), default=0)
    closing_cash = Column(Numeric(14, 2), nullable=False)
    status = Column(String(20), default="open")
    closed_by = Column(Integer, ForeignKey("users.id"))