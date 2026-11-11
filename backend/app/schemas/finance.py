from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import datetime
from app.models.finance import Division

class ExpenseCreate(BaseModel):
    division: Division = Division.general
    category: str
    amount: Decimal
    description: Optional[str] = None

class ExpenseOut(ExpenseCreate):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True