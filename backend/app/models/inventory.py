from sqlalchemy import Column, Integer, String, Numeric, Text, DateTime, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from app.core.database import Base

class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True)
    sku = Column(String(60), unique=True, index=True, nullable=False)
    part_number = Column(String(80), index=True)
    name = Column(String(160), nullable=False, index=True)
    description = Column(Text)
    brand = Column(String(80))
    manufacturer = Column(String(80))
    vehicle_compatibility = Column(String(160))
    category_id = Column(Integer, ForeignKey("categories.id"))
    buying_price = Column(Numeric(12, 2), default=0)
    selling_price = Column(Numeric(12, 2), default=0)
    quantity = Column(Integer, default=0)
    min_stock = Column(Integer, default=5)
    location = Column(String(80))
    barcode = Column(String(80), index=True)
    image_url = Column(String(255))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    category = relationship("Category")

class StockMovementType(str, enum.Enum):
    purchase = "purchase"
    sale = "sale"
    adjustment = "adjustment"
    damage = "damage"
    return_in = "return_in"

class StockMovement(Base):
    __tablename__ = "stock_movements"
    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    movement_type = Column(Enum(StockMovementType), nullable=False)
    quantity = Column(Integer, nullable=False)  # signed
    reference = Column(String(80))
    note = Column(Text)
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    product = relationship("Product")