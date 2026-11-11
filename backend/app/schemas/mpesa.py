from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import datetime
from app.models.mpesa import TxnType, TxnStatus

class MpesaTxnCreate(BaseModel):
    txn_type: TxnType
    reference: str
    amount: Decimal
    commission: Decimal = Decimal("0")
    customer_phone: Optional[str] = None

class MpesaTxnOut(BaseModel):
    id: int
    txn_type: TxnType
    reference: str
    amount: Decimal
    commission: Decimal
    status: TxnStatus
    customer_phone: Optional[str]
    created_at: datetime
    operator_name: Optional[str] = None
    class Config:
        from_attributes = True

class VerifyRequest(BaseModel):
    status: TxnStatus  # verified / pending

class DayClose(BaseModel):
    business_date: str  # YYYY-MM-DD
    closing_float: Decimal
    closing_cash: Decimal
    other_in: Decimal = Decimal("0")
    other_out: Decimal = Decimal("0")