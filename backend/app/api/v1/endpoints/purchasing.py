from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from decimal import Decimal
from datetime import date
from app.core.database import get_db
from app.models.user import User, Role
from app.models.inventory import Product, StockMovement, StockMovementType
from app.models.purchasing import Supplier, Purchase, PurchaseItem
from app.schemas.purchasing import (SupplierCreate, SupplierOut, PurchaseCreate,
                                    PurchaseOut, SupplierPayment)
from app.api.deps import require_roles
from app.services.audit import log

router = APIRouter()

@router.get("/suppliers", response_model=List[SupplierOut])
def suppliers(db: Session = Depends(get_db)):
    return db.query(Supplier).filter(Supplier.is_active == True).order_by(Supplier.name).all()

@router.post("/suppliers", response_model=SupplierOut, status_code=201)
def create_supplier(data: SupplierCreate, db: Session = Depends(get_db),
                    _: User = Depends(require_roles(Role.owner, Role.manager))):
    s = Supplier(**data.model_dump())
    db.add(s)
    db.commit()
    return s

@router.post("/suppliers/{sid}/pay")
def pay_supplier(sid: int, data: SupplierPayment, db: Session = Depends(get_db),
                 current: User = Depends(require_roles(Role.owner, Role.manager, Role.accountant))):
    s = db.query(Supplier).get(sid)
    if not s:
        raise HTTPException(404, "Supplier not found")
    open_purchases = (db.query(Purchase)
                      .filter(Purchase.supplier_id == sid, Purchase.paid < Purchase.total)
                      .order_by(Purchase.created_at).all())
    remaining = Decimal(data.amount)
    for p in open_purchases:
        if remaining <= 0:
            break
        due = Decimal(p.total) - Decimal(p.paid)
        pay = min(due, remaining)
        p.paid = Decimal(p.paid) + pay
        p.status = "received" if p.paid >= p.total else "partial"
        remaining -= pay
    log(db, current.id, "supplier.payment", "supplier", sid, f"KSh {data.amount}")
    db.commit()
    return {"allocated": str(Decimal(data.amount) - remaining)}

@router.get("/", response_model=List[PurchaseOut])
def purchases(db: Session = Depends(get_db)):
    rows = (db.query(Purchase, Supplier.name.label("supplier_name"))
            .join(Supplier, Purchase.supplier_id == Supplier.id)
            .order_by(Purchase.created_at.desc()).limit(100).all())
    out = []
    for p, sname in rows:
        d = PurchaseOut.model_validate(p).model_dump()
        d["supplier_name"] = sname
        for it, item in zip(p.items, d["items"]):
            item["product_name"] = it.product.name if it.product else None
        out.append(PurchaseOut(**d))
    return out

@router.post("/", response_model=PurchaseOut, status_code=201)
def create_purchase(data: PurchaseCreate, db: Session = Depends(get_db),
                    current: User = Depends(require_roles(Role.owner, Role.manager))):
    total = sum(Decimal(i.unit_cost) * i.quantity for i in data.items)
    purchase = Purchase(supplier_id=data.supplier_id, invoice_no=data.invoice_no,
                        total=total, paid=data.paid,
                        status="received" if Decimal(data.paid) >= total else "partial",
                        created_by=current.id)
    db.add(purchase)
    db.flush()
    for i in data.items:
        p = db.query(Product).get(i.product_id)
        if not p:
            raise HTTPException(400, f"Product {i.product_id} not found")
        db.add(PurchaseItem(purchase_id=purchase.id, product_id=p.id,
                            quantity=i.quantity, unit_cost=i.unit_cost))
        p.quantity += i.quantity
        p.buying_price = i.unit_cost  # latest cost
        db.add(StockMovement(product_id=p.id, movement_type=StockMovementType.purchase,
                             quantity=i.quantity, reference=data.invoice_no or f"PO-{purchase.id}",
                             user_id=current.id))
    log(db, current.id, "purchase.create", "purchase", purchase.id, f"KSh {total}")
    db.commit()
    db.refresh(purchase)
    return purchase

@router.get("/supplier-balances")
def supplier_balances(db: Session = Depends(get_db)):
    rows = (db.query(Supplier).filter(Supplier.is_active == True).all())
    return [{"supplier_id": s.id, "name": s.name,
             "balance": str(sum(max(Decimal(p.total) - Decimal(p.paid), Decimal("0"))
                                for p in s_purchases))}
            for s in rows
            for s_purchases in [[db.query(Purchase).filter(Purchase.supplier_id == s.id).all()]]]