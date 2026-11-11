from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from app.core.database import Base

class PaymentMethod(str, enum.Enum):
    cash = "cash"
    mpesa = "mpesa"
    other = "other"

class SaleStatus(str, enum.Enum):
    completed = "completed"
    returned = "returned"

class Sale(Base):
    __tablename__ = "sales"
    id = Column(Integer, primary_key=True)
    sale_no = Column(String(30), unique=True, index=True, nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)
    discount = Column(Numeric(12, 2), default=0)
    total = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(Enum(PaymentMethod), default=PaymentMethod.cash)
    status = Column(Enum(SaleStatus), default=SaleStatus.completed)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")
    creator = relationship("User")

class SaleItem(Base):
    __tablename__ = "sale_items"
    id = Column(Integer, primary_key=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    line_total = Column(Numeric(12, 2), nullable=False)
    sale = relationship("Sale", back_populates="items")
    product = relationship("Product")