from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from decimal import Decimal
from datetime import datetime, date
from app.core.database import get_db
from app.models.user import User, Role
from app.models.mpesa import (MpesaTransaction, FloatLedger, CashLedger, TxnType, TxnStatus,
                              CapitalSettings, DailyReconciliation)
from app.models.finance import LedgerEntry
from app.schemas.mpesa import MpesaTxnCreate, MpesaTxnOut, DayClose, CapitalSetup
from app.api.deps import get_current_user, require_roles
from app.services.audit import log

router = APIRouter()

Q = Decimal("0.01")


def _d(x):
    return Decimal(x or 0)


def _as_date(v):
    return v.date() if isinstance(v, datetime) else v


# --------------------------------------------------------------------------- #
# Ledger helpers
# --------------------------------------------------------------------------- #

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


def _recalc(f: FloatLedger, c: CashLedger):
    f.closing_float = _d(f.opening_float) + _d(f.deposits) - _d(f.withdrawals)
    c.closing_cash = (_d(c.opening_cash) + _d(c.deposits_in) + _d(c.other_in)
                      - _d(c.withdrawals_out) - _d(c.other_out))


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
    _recalc(f, c)


# --------------------------------------------------------------------------- #
# Reconciliation helpers
# --------------------------------------------------------------------------- #

def _settings(db: Session):
    return db.query(CapitalSettings).order_by(CapitalSettings.id.desc()).first()


def _day_commission(db: Session, day: date):
    # No status filter on purpose: a reversal carries negative commission,
    # so the original and its reversal cancel out.
    return _d(db.query(func.coalesce(func.sum(MpesaTransaction.commission), 0))
              .filter(func.date(MpesaTransaction.created_at) == day).scalar())


def _expected(db: Session, f: FloatLedger, c: CashLedger, extra_in=0, extra_out=0):
    s = _settings(db)
    day = _as_date(f.business_date)
    commission = _day_commission(db, day)
    exp_float = _d(f.opening_float) + _d(f.deposits) - _d(f.withdrawals)
    if s and s.commission_in_float:
        exp_float += commission
    exp_cash = (_d(c.opening_cash) + _d(c.deposits_in) + _d(c.other_in) + _d(extra_in)
                - _d(c.withdrawals_out) - _d(c.other_out) - _d(extra_out))
    return day, commission, exp_float, exp_cash


def _verdict(v):
    v = _d(v).quantize(Q)
    status = "balanced" if v == 0 else ("surplus" if v > 0 else "shortage")
    return {"status": status, "amount": str(abs(v)), "signed": str(v)}


def _rec_out(r: DailyReconciliation):
    return {
        "date": r.business_date.isoformat(),
        "opening_float": str(r.opening_float), "opening_cash": str(r.opening_cash),
        "commission": str(r.commission),
        "expected_float": str(r.expected_float), "expected_cash": str(r.expected_cash),
        "expected_total": str(_d(r.expected_float) + _d(r.expected_cash)),
        "counted_float": str(r.counted_float), "counted_cash": str(r.counted_cash),
        "counted_total": str(_d(r.counted_float) + _d(r.counted_cash)),
        "float": _verdict(r.float_variance), "cash": _verdict(r.cash_variance),
        "total": _verdict(r.total_variance),
        "note": r.note,
    }


# --------------------------------------------------------------------------- #
# Transactions
# --------------------------------------------------------------------------- #

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
    original = db.get(MpesaTransaction, txn_id)
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
    # Exclude reversed originals AND the reversal rows, so a reversed pair nets to nothing.
    live = [MpesaTransaction.status != TxnStatus.reversed,
            MpesaTransaction.reversal_of_id.is_(None),
            func.date(MpesaTransaction.created_at) == today]
    deps = (db.query(func.coalesce(func.sum(MpesaTransaction.amount), 0))
            .filter(MpesaTransaction.txn_type == TxnType.deposit, *live).scalar())
    wds = (db.query(func.coalesce(func.sum(MpesaTransaction.amount), 0))
           .filter(MpesaTransaction.txn_type == TxnType.withdrawal, *live).scalar())
    comm = _day_commission(db, today)
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


# --------------------------------------------------------------------------- #
# Capital-based reconciliation
# --------------------------------------------------------------------------- #

@router.post("/capital")
def setup_capital(data: CapitalSetup, db: Session = Depends(get_db),
                  current: User = Depends(require_roles(Role.owner))):
    if data.opening_float < 0 or data.opening_cash < 0:
        raise HTTPException(400, "Amounts cannot be negative")
    if db.query(DailyReconciliation).first():
        raise HTTPException(409, "Reconciliation history exists, so capital can't be reset")
    f, c = _today_ledgers(db)
    if f.status == "closed" or c.status == "closed":
        raise HTTPException(409, "Today is already closed. Reopen it first.")
    f.opening_float = data.opening_float
    c.opening_cash = data.opening_cash
    _recalc(f, c)
    total = _d(data.opening_float) + _d(data.opening_cash)
    db.add(CapitalSettings(starting_capital=total, opening_float=data.opening_float,
                           opening_cash=data.opening_cash,
                           commission_in_float=data.commission_in_float, set_by=current.id))
    log(db, current.id, "mpesa.capital_setup", "capital_settings", 0,
        f"Capital {total} (float {data.opening_float}, cash {data.opening_cash})")
    db.commit()
    return {"status": "ok", "starting_capital": str(total)}


@router.get("/reconciliation")
def reconciliation(db: Session = Depends(get_db),
                   current: User = Depends(require_roles(
                       Role.owner, Role.manager, Role.accountant, Role.mpesa_operator))):
    s = _settings(db)
    rows = (db.query(DailyReconciliation)
            .order_by(DailyReconciliation.business_date.desc()).limit(60).all())
    cumulative = db.query(func.coalesce(func.sum(DailyReconciliation.total_variance), 0)).scalar()
    out = {
        "setup_done": bool(s),
        "settings": None,
        "cumulative": _verdict(cumulative),
        "history": [_rec_out(r) for r in rows],
        "today": None,
        "unclosed_date": None,
    }
    if s:
        out["settings"] = {
            "starting_capital": str(s.starting_capital),
            "commission_in_float": bool(s.commission_in_float),
        }
        f, c = _today_ledgers(db)
        today_dt = datetime.combine(date.today(), datetime.min.time())
        stale = (db.query(FloatLedger)
                 .filter(FloatLedger.status != "closed", FloatLedger.business_date < today_dt)
                 .order_by(FloatLedger.business_date.desc()).first())
        if stale:
            out["unclosed_date"] = _as_date(stale.business_date).isoformat()
        day, commission, exp_f, exp_c = _expected(db, f, c)
        out["today"] = {
            "date": day.isoformat(), "status": f.status,
            "opening_float": str(f.opening_float), "opening_cash": str(c.opening_cash),
            "float_in": str(f.deposits), "float_out": str(f.withdrawals),
            "cash_in": str(c.deposits_in), "cash_out": str(c.withdrawals_out),
            "other_in": str(c.other_in), "other_out": str(c.other_out),
            "commission": str(commission),
            "expected_float": str(exp_f), "expected_cash": str(exp_c),
            "expected_total": str(exp_f + exp_c),
        }
    db.commit()  # persists today's ledgers if they were just opened
    return out


@router.post("/close-day")
def close_day(data: DayClose, db: Session = Depends(get_db),
              current: User = Depends(require_roles(Role.owner, Role.manager, Role.accountant))):
    if not _settings(db):
        raise HTTPException(400, "The owner must set the starting capital first.")
    f, c = _today_ledgers(db)
    if f.status == "closed" or c.status == "closed":
        raise HTTPException(409, "Today is already closed. An owner can reopen it.")
    other_in, other_out = _d(data.other_in), _d(data.other_out)
    if min(_d(data.closing_float), _d(data.closing_cash), other_in, other_out) < 0:
        raise HTTPException(400, "Amounts cannot be negative")

    day, commission, exp_f, exp_c = _expected(db, f, c, other_in, other_out)
    fv = (_d(data.closing_float) - exp_f).quantize(Q)
    cv = (_d(data.closing_cash) - exp_c).quantize(Q)
    tv = fv + cv
    note = (data.note or "").strip()
    if (fv != 0 or cv != 0) and not note:
        raise HTTPException(400, "There is a shortage or surplus. Add a note explaining it before closing.")

    c.other_in = _d(c.other_in) + other_in
    c.other_out = _d(c.other_out) + other_out
    f.closing_float = data.closing_float
    c.closing_cash = data.closing_cash
    f.status = c.status = "closed"
    f.closed_by = c.closed_by = current.id
    db.add(DailyReconciliation(
        business_date=day, opening_float=f.opening_float, opening_cash=c.opening_cash,
        commission=commission, expected_float=exp_f, expected_cash=exp_c,
        counted_float=data.closing_float, counted_cash=data.closing_cash,
        float_variance=fv, cash_variance=cv, total_variance=tv,
        note=note or None, closed_by=current.id))
    log(db, current.id, "mpesa.close_day", "float_ledger", f.id,
        f"Float {data.closing_float} (var {fv}) Cash {data.closing_cash} (var {cv}) Total var {tv}. {note}")
    db.commit()
    return {"status": "closed", "float": _verdict(fv), "cash": _verdict(cv), "total": _verdict(tv)}


@router.post("/reopen-day")
def reopen_day(reason: str = "", db: Session = Depends(get_db),
               current: User = Depends(require_roles(Role.owner))):
    if not reason.strip():
        raise HTTPException(400, "A reason is required to reopen a day")
    f = (db.query(FloatLedger).filter(FloatLedger.status == "closed")
         .order_by(FloatLedger.business_date.desc()).first())
    c = (db.query(CashLedger).filter(CashLedger.status == "closed")
         .order_by(CashLedger.business_date.desc()).first())
    if not f or not c:
        raise HTTPException(404, "No closed day to reopen")
    if (db.query(FloatLedger).filter(FloatLedger.business_date > f.business_date).first()
            or db.query(CashLedger).filter(CashLedger.business_date > c.business_date).first()):
        raise HTTPException(409, "A later day has already started, so this one can't be reopened")
    rec = (db.query(DailyReconciliation)
           .filter(DailyReconciliation.business_date == _as_date(f.business_date)).first())
    detail = ""
    if rec:
        detail = f"(was float var {rec.float_variance}, cash var {rec.cash_variance}) "
        db.delete(rec)
    f.status = c.status = "open"
    f.closed_by = c.closed_by = None
    _recalc(f, c)
    log(db, current.id, "mpesa.reopen_day", "float_ledger", f.id,
        f"Reopened {_as_date(f.business_date)} {detail}Reason: {reason.strip()}")
    db.commit()
    return {"status": "reopened"}