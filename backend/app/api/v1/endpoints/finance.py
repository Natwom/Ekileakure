from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.user import User, Role
from app.models.finance import Expense
from app.schemas.finance import ExpenseCreate, ExpenseOut
from app.api.deps import require_roles
from app.services.audit import log

router = APIRouter()


@router.get("/expenses", response_model=List[ExpenseOut])
def expenses(division: Optional[str] = None, db: Session = Depends(get_db),
             _: User = Depends(require_roles(Role.owner, Role.manager, Role.accountant))):
    q = db.query(Expense)
    if division:
        q = q.filter(Expense.division == division)
    return q.order_by(Expense.created_at.desc()).limit(200).all()


@router.post("/expenses", response_model=ExpenseOut, status_code=201)
def create_expense(data: ExpenseCreate, db: Session = Depends(get_db),
                   current: User = Depends(require_roles(
                       Role.owner, Role.manager, Role.accountant))):
    e = Expense(**data.model_dump(), recorded_by=current.id)
    db.add(e)
    db.flush()  # assigns e.id so the audit log can reference it
    log(db, current.id, "expense.create", "expense", e.id, f"{data.category} KSh {data.amount}")
    db.commit()
    db.refresh(e)
    return e


@router.delete("/expenses/{eid}")
def delete_expense(eid: int, db: Session = Depends(get_db),
                   current: User = Depends(require_roles(Role.owner, Role.accountant))):
    e = db.get(Expense, eid)
    if not e:
        raise HTTPException(404, "Expense not found")
    db.delete(e)
    log(db, current.id, "expense.delete", "expense", eid)
    db.commit()
    return {"status": "deleted"}