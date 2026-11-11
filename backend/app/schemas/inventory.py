from pydantic import BaseModel
from typing import Optional
from decimal import Decimal

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None

class CategoryOut(CategoryCreate):
    id: int
    class Config:
        from_attributes = True

class ProductCreate(BaseModel):
    sku: str
    part_number: Optional[str] = None
    name: str
    description: Optional[str] = None
    brand: Optional[str] = None
    manufacturer: Optional[str] = None
    vehicle_compatibility: Optional[str] = None
    category_id: Optional[int] = None
    buying_price: Decimal = Decimal("0")
    selling_price: Decimal = Decimal("0")
    quantity: int = 0
    min_stock: int = 5
    location: Optional[str] = None
    barcode: Optional[str] = None

class ProductUpdate(BaseModel):
    part_number: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    brand: Optional[str] = None
    manufacturer: Optional[str] = None
    vehicle_compatibility: Optional[str] = None
    category_id: Optional[int] = None
    buying_price: Optional[Decimal] = None
    selling_price: Optional[Decimal] = None
    min_stock: Optional[int] = None
    location: Optional[str] = None
    barcode: Optional[str] = None
    is_active: Optional[bool] = None

class ProductOut(ProductCreate):
    id: int
    is_active: bool
    category_name: Optional[str] = None
    class Config:
        from_attributes = True

class StockAdjust(BaseModel):
    product_id: int
    movement_type: str  # adjustment / damage / return_in
    quantity: int       # positive; type controls sign
    note: Optional[str] = None