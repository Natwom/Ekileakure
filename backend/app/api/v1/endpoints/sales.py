from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from decimal import Decimal
from datetime import datetime, date
from app.core.database import get_db
from app.models.user import User, Role
from app.models.inventory import Product, StockMovement, StockMovementType
from app.models.sales import Sale, SaleItem, SaleStatus, PaymentMethod
from app.models.finance import LedgerEntry
from app.schemas.sales import SaleCreate, SaleOut
from app.api.deps import get_current_user, require_roles
from app.api.v1.endpoints.mpesa import _today_ledgers
from app.services.audit import log

router = APIRouter()


def _next_sale_no(db: Session) -> str:
    today = datetime.now().strftime("%Y%m%d")
    count = db.query(Sale).filter(func.date(Sale.created_at) == date.today()).count()
    return f"S-{today}-{count + 1:04d}"


@router.post("/", response_model=SaleOut, status_code=201)
def create_sale(data: SaleCreate, db: Session = Depends(get_db),
                current: User = Depends(require_roles(
                    Role.owner, Role.manager, Role.spare_parts_cashier))):
    if not data.items:
        raise HTTPException(400, "Cart is empty")

    subtotal = Decimal("0")
    products = {}
    for item in data.items:
        if item.quantity <= 0:
            raise HTTPException(400, "Quantity must be positive")
        p = db.get(Product, item.product_id)
        if not p or not p.is_active:
            raise HTTPException(400, f"Product {item.product_id} unavailable")
        if p.quantity < item.quantity:
            raise HTTPException(400, f"Insufficient stock for {p.name} (available: {p.quantity})")
        products[item.product_id] = p
        subtotal += Decimal(str(item.unit_price)) * item.quantity

    discount = Decimal(str(data.discount))
    if discount < 0 or discount > subtotal:
        raise HTTPException(400, "Invalid discount")
    total = subtotal - discount

    sale = Sale(sale_no=_next_sale_no(db), subtotal=subtotal, discount=discount,
                total=total, payment_method=data.payment_method, created_by=current.id)
    db.add(sale)
    db.flush()

    for item in data.items:
        p = products[item.product_id]
        line_total = Decimal(str(item.unit_price)) * item.quantity
        db.add(SaleItem(sale_id=sale.id, product_id=p.id, quantity=item.quantity,
                        unit_price=item.unit_price, line_total=line_total))
        p.quantity -= item.quantity
        db.add(StockMovement(product_id=p.id, movement_type=StockMovementType.sale,
                             quantity=-item.quantity, reference=sale.sale_no, user_id=current.id))

    # Only cash payments change physical cash
    if data.payment_method == PaymentMethod.cash:
        _, cash = _today_ledgers(db)
        cash.other_in = Decimal(cash.other_in or 0) + total
        cash.closing_cash = Decimal(cash.closing_cash or 0) + total
        db.add(LedgerEntry(account="cash", direction="debit", amount=total,
                           source_type="sale", source_id=sale.id,
                           note=f"Sale {sale.sale_no} ({data.payment_method.value})"))

    log(db, current.id, "sale.create", "sale", sale.id, f"{sale.sale_no} KSh {total}")
    db.commit()
    db.refresh(sale)
    return sale


@router.get("/", response_model=List[SaleOut])
def list_sales(q: Optional[str] = None, limit: int = Query(50, le=200),
               db: Session = Depends(get_db),
               current: User = Depends(get_current_user)):
    query = db.query(Sale).order_by(Sale.created_at.desc())
    if q:
        query = query.filter(Sale.sale_no.ilike(f"%{q}%"))
    return query.limit(limit).all()


@router.post("/{sale_id}/return")
def return_sale(sale_id: int, db: Session = Depends(get_db),
                current: User = Depends(require_roles(Role.owner, Role.manager))):
    sale = db.get(Sale, sale_id)
    if not sale:
        raise HTTPException(404, "Sale not found")
    if sale.status == SaleStatus.returned:
        raise HTTPException(400, "Sale already returned")

    for item in sale.items:
        p = db.get(Product, item.product_id)
        p.quantity += item.quantity
        db.add(StockMovement(product_id=p.id, movement_type=StockMovementType.return_in,
                             quantity=item.quantity, reference=sale.sale_no, user_id=current.id))

    sale.status = SaleStatus.returned

    if sale.payment_method == PaymentMethod.cash:
        _, cash = _today_ledgers(db)
        cash.other_out = Decimal(cash.other_out or 0) + sale.total
        cash.closing_cash = Decimal(cash.closing_cash or 0) - sale.total
        db.add(LedgerEntry(account="cash", direction="credit", amount=sale.total,
                           source_type="sale_return", source_id=sale.id,
                           note=f"Return {sale.sale_no}"))

    log(db, current.id, "sale.return", "sale", sale.id, sale.sale_no)
    db.commit()
    return {"status": "returned"}