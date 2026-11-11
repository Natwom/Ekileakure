from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from decimal import Decimal
from datetime import datetime, date
from app.core.database import get_db
from app.models.user import User, Role
from app.models.mpesa import MpesaTransaction, FloatLedger, CashLedger, TxnType, TxnStatus
from app.models.finance import LedgerEntry
from app.schemas.mpesa import MpesaTxnCreate, MpesaTxnOut, DayClose
from app.api.deps import get_current_user, require_roles
from app.services.audit import log

router = APIRouter()

def _today_ledgers(db: Session):
    """Auto-open today's ledgers carrying forward yesterday's verified closings."""
    today = datetime.combine(date.today(), datetime.min.time())
    f = db.query(FloatLedger).filter(func.date(FloatLedger.business_date) == date.today()).first()
    c = db.query(CashLedger).filter(func.date(CashLedger.business_date) == date.today()).first()
    if not f:
        prev = (db.query(FloatLedger).filter(FloatLedger.status == "closed")
                .order_by(FloatLedger.business_date.desc()).first())
        opening_f = Decimal(prev.closing_float) if prev else Decimal("0")
        f = FloatLedger(business_date=today, opening_float=opening_f,
                        deposits=0, withdrawals=0, closing_float=opening_f)
        db.add(f)
    if not c:
        prev = (db.query(CashLedger).filter(CashLedger.status == "closed")
                .order_by(CashLedger.business_date.desc()).first())
        opening_c = Decimal(prev.closing_cash) if prev else Decimal("0")
        c = CashLedger(business_date=today, opening_cash=opening_c,
                       deposits_in=0, withdrawals_out=0, other_in=0, other_out=0,
                       closing_cash=opening_c)
        db.add(c)
    db.flush()
    return f, c

def _apply_to_ledgers(db, f: FloatLedger, c: CashLedger, txn: MpesaTransaction):
    amt = Decimal(txn.amount)
    if txn.txn_type == TxnType.deposit:
        # deposit: float decreases (agent pays out float), physical cash increases
        f.withdrawals = Decimal(f.withdrawals) + amt
        c.deposits_in = Decimal(c.deposits_in) + amt
    else:
        # withdrawal: float increases, physical cash decreases
        f.deposits = Decimal(f.deposits) + amt
        c.withdrawals_out = Decimal(c.withdrawals_out) + amt
    f.closing_float = Decimal(f.opening_float) + Decimal(f.deposits) - Decimal(f.withdrawals)
    c.closing_cash = (Decimal(c.opening_cash) + Decimal(c.deposits_in) + Decimal(c.other_in)
                      - Decimal(c.withdrawals_out) - Decimal(c.other_out))

@router.get("/transactions", response_model=List[MpesaTxnOut])
def transactions(txn_type: Optional[TxnType] = None, limit: int = Query(100, le=300),
                 db: Session = Depends(get_db)):
    q = db.query(MpesaTransaction).order_by(MpesaTransaction.created_at.desc())
    if txn_type:
        q = q.filter(MpesaTransaction.txn_type == txn_type)
    rows = q.limit(limit).all()
    out = []
    for t in rows:
        d = MpesaTxnOut.model_validate(t).model_dump()
        d["operator_name"] = t.operator.full_name if t.operator else None
        out.append(MpesaTxnOut(**d))
    return out

@router.post("/transactions", response_model=MpesaTxnOut, status_code=201)
def record_txn(data: MpesaTxnCreate, db: Session = Depends(get_db),
               current: User = Depends(require_roles(
                   Role.owner, Role.manager, Role.mpesa_operator))):
    if data.amount <= 0:
        raise HTTPException(400, "Amount must be positive")
    if db.query(MpesaTransaction).filter(MpesaTransaction.reference == data.reference).first():
        raise HTTPException(409, "Duplicate transaction reference")
    f, c = _today_ledgers(db)
    txn = MpesaTransaction(**data.model_dump(), status=TxnStatus.verified, operator_id=current.id)
    db.add(txn)
    db.flush()
    _apply_to_ledgers(db, f, c, txn)
    # Commission is agency income — recorded separately, principal never touches revenue
    if txn.commission and Decimal(txn.commission) > 0:
        db.add(LedgerEntry(account="cash", direction="debit", amount=txn.commission,
                           source_type="mpesa_commission", source_id=txn.id,
                           note=f"{txn.txn_type.value} commission {txn.reference}"))
    log(db, current.id, "mpesa.txn", "mpesa_transaction", txn.id,
        f"{txn.txn_type.value} {txn.reference} KSh {txn.amount}")
    db.commit()
    db.refresh(txn)
    d = MpesaTxnOut.model_validate(txn).model_dump()
    d["operator_name"] = current.full_name
    return MpesaTxnOut(**d)

@router.post("/transactions/{txn_id}/reverse")
def reverse_txn(txn_id: int, reason: str = "", db: Session = Depends(get_db),
                current: User = Depends(require_roles(Role.owner, Role.manager))):
    original = db.query(MpesaTransaction).get(txn_id)
    if not original:
        raise HTTPException(404, "Transaction not found")
    if original.status != TxnStatus.verified:
        raise HTTPException(400, "Only verified transactions can be reversed")
    # Controlled reversal: new record, original preserved
    rev = MpesaTransaction(
        txn_type=TxnType.withdrawal if original.txn_type == TxnType.deposit else TxnType.deposit,
        reference=f"REV-{original.reference}",
        amount=original.amount, commission=-original.commission,
        status=TxnStatus.verified, operator_id=current.id,
        reversal_of_id=original.id, customer_phone=original.customer_phone)
    db.add(rev)
    original.status = TxnStatus.reversed
    original.reversed_by_id = current.id
    f, c = _today_ledgers(db)
    db.flush()
    _apply_to_ledgers(db, f, c, rev)
    log(db, current.id, "mpesa.reverse", "mpesa_transaction", txn_id,
        f"Reversed {original.reference}: {reason}")
    db.commit()
    return {"status": "reversed", "reversal_reference": rev.reference}

@router.get("/state")
def state(db: Session = Depends(get_db)):
    f, c = _today_ledgers(db)
    today = date.today()
    deps = (db.query(func.coalesce(func.sum(MpesaTransaction.amount), 0))
            .filter(MpesaTransaction.txn_type == TxnType.deposit,
                    MpesaTransaction.status != TxnStatus.reversed,
                    func.date(MpesaTransaction.created_at) == today).scalar())
    wds = (db.query(func.coalesce(func.sum(MpesaTransaction.amount), 0))
           .filter(MpesaTransaction.txn_type == TxnType.withdrawal,
                   MpesaTransaction.status != TxnStatus.reversed,
                   func.date(MpesaTransaction.created_at) == today).scalar())
    comm = (db.query(func.coalesce(func.sum(MpesaTransaction.commission), 0))
            .filter(MpesaTransaction.status != TxnStatus.reversed,
                    func.date(MpesaTransaction.created_at) == today).scalar())
    return {
        "opening_float": str(f.opening_float), "current_float": str(f.closing_float),
        "float_movements": {"deposits_in": str(f.deposits), "withdrawals_out": str(f.withdrawals)},
        "opening_cash": str(c.opening_cash), "current_cash": str(c.closing_cash),
        "cash_movements": {"deposits_in": str(c.deposits_in),
                           "withdrawals_out": str(c.withdrawals_out),
                           "other_in": str(c.other_in), "other_out": str(c.other_out)},
        "today_deposits": str(deps), "today_withdrawals": str(wds),
        "today_commission": str(comm), "ledger_status": f.status,
    }

@router.post("/close-day")
def close_day(data: DayClose, db: Session = Depends(get_db),
              current: User = Depends(require_roles(Role.owner, Role.manager, Role.accountant))):
    f, c = _today_ledgers(db)
    f.closing_float = data.closing_float
    c.other_in = Decimal(c.other_in) + Decimal(data.other_in)
    c.other_out = Decimal(c.other_out) + Decimal(data.other_out)
    c.closing_cash = data.closing_cash
    f.status = "closed"
    c.status = "closed"
    f.closed_by = current.id
    c.closed_by = current.id
    log(db, current.id, "mpesa.close_day", "float_ledger", f.id,
        f"Float {data.closing_float} Cash {data.closing_cash}")
    db.commit()
    return {"status": "closed"}