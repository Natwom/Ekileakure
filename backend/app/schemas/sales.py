from pydantic import BaseModel
from typing import List, Optional
from decimal import Decimal
from datetime import datetime
from app.models.sales import PaymentMethod

class SaleItemIn(BaseModel):
    product_id: int
    quantity: int
    unit_price: Decimal

class SaleCreate(BaseModel):
    items: List[SaleItemIn]
    discount: Decimal = Decimal("0")
    payment_method: PaymentMethod = PaymentMethod.cash

class SaleItemOut(BaseModel):
    product_id: int
    quantity: int
    unit_price: Decimal
    line_total: Decimal
    product_name: Optional[str] = None
    class Config:
        from_attributes = True

class SaleOut(BaseModel):
    id: int
    sale_no: str
    subtotal: Decimal
    discount: Decimal
    total: Decimal
    payment_method: PaymentMethod
    status: str
    created_at: datetime
    items: List[SaleItemOut]
    class Config:
        from_attributes = True