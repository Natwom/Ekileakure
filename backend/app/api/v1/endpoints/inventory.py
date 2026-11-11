from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import List, Optional
from decimal import Decimal
from app.core.database import get_db
from app.models.user import User, Role
from app.models.inventory import Product, Category, StockMovement, StockMovementType
from app.schemas.inventory import (CategoryCreate, CategoryOut, ProductCreate,
                                   ProductUpdate, ProductOut, StockAdjust)
from app.api.deps import get_current_user, require_roles
from app.services.audit import log

router = APIRouter()

# ---------- Categories ----------
@router.get("/categories", response_model=List[CategoryOut])
def categories(db: Session = Depends(get_db)):
    return db.query(Category).filter(Category.is_active == True).order_by(Category.name).all()

@router.post("/categories", response_model=CategoryOut, status_code=201)
def create_category(data: CategoryCreate, db: Session = Depends(get_db),
                    _: User = Depends(require_roles(Role.owner, Role.manager))):
    cat = Category(**data.model_dump())
    db.add(cat)
    db.commit()
    return cat

# ---------- Products ----------
@router.get("/products", response_model=List[ProductOut])
def products(
    q: Optional[str] = None, category_id: Optional[int] = None,
    low_stock: bool = False, active_only: bool = True,
    db: Session = Depends(get_db),
):
    query = db.query(Product, Category.name.label("category_name")).outerjoin(Category, Product.category_id == Category.id)
    if active_only:
        query = query.filter(Product.is_active == True)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Product.name.ilike(like), Product.sku.ilike(like),
                                 Product.part_number.ilike(like), Product.brand.ilike(like),
                                 Product.barcode.ilike(like)))
    if category_id:
        query = query.filter(Product.category_id == category_id)
    rows = query.order_by(Product.name).all()
    out = []
    for p, cname in rows:
        d = ProductOut.model_validate(p).model_dump()
        d["category_name"] = cname
        if low_stock and p.quantity > p.min_stock:
            continue
        out.append(ProductOut(**d))
    return out

@router.get("/products/{pid}", response_model=ProductOut)
def get_product(pid: int, db: Session = Depends(get_db)):
    p = db.query(Product).get(pid)
    if not p:
        raise HTTPException(404, "Product not found")
    return p

@router.post("/products", response_model=ProductOut, status_code=201)
def create_product(data: ProductCreate, db: Session = Depends(get_db),
                   current: User = Depends(require_roles(Role.owner, Role.manager, Role.spare_parts_cashier))):
    if db.query(Product).filter(Product.sku == data.sku).first():
        raise HTTPException(409, "SKU already exists")
    p = Product(**data.model_dump())
    db.add(p)
    db.flush()
    log(db, current.id, "product.create", "product", p.id, p.name)
    db.commit()
    return p

@router.put("/products/{pid}", response_model=ProductOut)
def update_product(pid: int, data: ProductUpdate, db: Session = Depends(get_db),
                   current: User = Depends(get_current_user)):
    p = db.query(Product).get(pid)
    if not p:
        raise HTTPException(404, "Product not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    log(db, current.id, "product.update", "product", p.id)
    db.commit()
    return p

@router.post("/stock-adjust")
def stock_adjust(data: StockAdjust, db: Session = Depends(get_db),
                 current: User = Depends(require_roles(Role.owner, Role.manager))):
    p = db.query(Product).get(data.product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    mtype = StockMovementType(data.movement_type)
    sign = -1 if mtype in (StockMovementType.damage,) else 1
    # adjustment allows explicit direction via note convention: use positive = add
    new_qty = p.quantity + (sign * data.quantity)
    if new_qty < 0:
        raise HTTPException(400, "Adjustment would result in negative stock")
    p.quantity = new_qty
    db.add(StockMovement(product_id=p.id, movement_type=mtype,
                         quantity=sign * data.quantity, note=data.note, user_id=current.id))
    log(db, current.id, "stock.adjust", "product", p.id, f"{mtype.value} {data.quantity}")
    db.commit()
    return {"product_id": p.id, "new_quantity": p.quantity}

@router.get("/movements/{pid}")
def movements(pid: int, db: Session = Depends(get_db)):
    return (db.query(StockMovement).filter(StockMovement.product_id == pid)
            .order_by(StockMovement.created_at.desc()).limit(100).all())

@router.get("/valuation")
def valuation(db: Session = Depends(get_db)):
    rows = db.query(
        func.coalesce(func.sum(Product.quantity * Product.buying_price), 0).label("cost_value"),
        func.coalesce(func.sum(Product.quantity * Product.selling_price), 0).label("retail_value"),
    ).filter(Product.is_active == True).first()
    return {"cost_value": str(rows.cost_value), "retail_value": str(rows.retail_value)}