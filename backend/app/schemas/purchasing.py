from pydantic import BaseModel
from typing import List, Optional
from decimal import Decimal
from datetime import datetime

class SupplierCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None

class SupplierOut(SupplierCreate):
    id: int
    is_active: bool
    class Config:
        from_attributes = True

class PurchaseItemIn(BaseModel):
    product_id: int
    quantity: int
    unit_cost: Decimal

class PurchaseCreate(BaseModel):
    supplier_id: int
    invoice_no: Optional[str] = None
    paid: Decimal = Decimal("0")
    items: List[PurchaseItemIn]

class PurchaseItemOut(BaseModel):
    product_id: int
    quantity: int
    unit_cost: Decimal
    product_name: Optional[str] = None
    class Config:
        from_attributes = True

class PurchaseOut(BaseModel):
    id: int
    supplier_id: int
    invoice_no: Optional[str]
    total: Decimal
    paid: Decimal
    status: str
    created_at: datetime
    items: List[PurchaseItemOut]
    supplier_name: Optional[str] = None
    class Config:
        from_attributes = True

class SupplierPayment(BaseModel):
    amount: Decimal