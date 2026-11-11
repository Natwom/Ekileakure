from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
from decimal import Decimal
from app.core.database import get_db
from app.models.inventory import Product
from app.models.sales import Sale, SaleStatus
from app.models.mpesa import MpesaTransaction, TxnType, TxnStatus
from app.models.finance import Expense

router = APIRouter()

@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    today = date.today()
    month_start = today.replace(day=1)

    sales_today = (db.query(func.coalesce(func.sum(Sale.total), 0))
                   .filter(func.date(Sale.created_at) == today,
                           Sale.status == SaleStatus.completed).scalar())
    sales_month = (db.query(func.coalesce(func.sum(Sale.total), 0))
                   .filter(Sale.created_at >= month_start,
                           Sale.status == SaleStatus.completed).scalar())
    inv_value = (db.query(func.coalesce(func.sum(Product.quantity * Product.buying_price), 0))
                 .filter(Product.is_active == True).scalar())
    low_stock = (db.query(Product).filter(Product.is_active == True,
                                          Product.quantity <= Product.min_stock).count())
    out_of_stock = (db.query(Product).filter(Product.is_active == True,
                                             Product.quantity == 0).count())

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

    recent_sales = (db.query(Sale).order_by(Sale.created_at.desc()).limit(8).all())
    recent_txns = (db.query(MpesaTransaction).order_by(MpesaTransaction.created_at.desc())
                   .limit(8).all())

    # Last 14 days chart data
    chart = []
    for i in range(13, -1, -1):
        d = today - timedelta(days=i)
        s = (db.query(func.coalesce(func.sum(Sale.total), 0))
             .filter(func.date(Sale.created_at) == d, Sale.status == SaleStatus.completed).scalar())
        cm = (db.query(func.coalesce(func.sum(MpesaTransaction.commission), 0))
              .filter(func.date(MpesaTransaction.created_at) == d,
                      MpesaTransaction.status != TxnStatus.reversed).scalar())
        chart.append({"date": d.strftime("%b %d"), "sales": float(s), "commission": float(cm)})

    return {
        "sales_today": float(sales_today), "sales_month": float(sales_month),
        "inventory_value": float(inv_value), "low_stock": low_stock,
        "out_of_stock": out_of_stock,
        "mpesa_deposits_today": float(deps), "mpesa_withdrawals_today": float(wds),
        "mpesa_commission_today": float(comm),
        "recent_sales": [{"sale_no": r.sale_no, "total": float(r.total),
                          "payment_method": r.payment_method.value,
                          "created_at": r.created_at.isoformat()} for r in recent_sales],
        "recent_mpesa": [{"reference": t.reference, "txn_type": t.txn_type.value,
                          "amount": float(t.amount), "commission": float(t.commission),
                          "status": t.status.value,
                          "created_at": t.created_at.isoformat()} for t in recent_txns],
        "chart": chart,
    }