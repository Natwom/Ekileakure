from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
from io import BytesIO
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from app.core.database import get_db
from app.models.sales import Sale, SaleItem, SaleStatus
from app.models.mpesa import MpesaTransaction, TxnStatus
from app.models.finance import Expense
from app.models.inventory import Product

router = APIRouter()

@router.get("/profit-loss")
def profit_loss(from_date: date, to_date: date, db: Session = Depends(get_db)):
    revenue = (db.query(func.coalesce(func.sum(Sale.total), 0))
               .filter(func.date(Sale.created_at) >= from_date,
                       func.date(Sale.created_at) <= to_date,
                       Sale.status == SaleStatus.completed).scalar())
    cogs = (db.query(func.coalesce(func.sum(SaleItem.quantity * Product.buying_price), 0))
            .join(Sale, SaleItem.sale_id == Sale.id)
            .join(Product, SaleItem.product_id == Product.id)
            .filter(func.date(Sale.created_at) >= from_date,
                    func.date(Sale.created_at) <= to_date,
                    Sale.status == SaleStatus.completed).scalar())
    commission = (db.query(func.coalesce(func.sum(MpesaTransaction.commission), 0))
                  .filter(func.date(MpesaTransaction.created_at) >= from_date,
                          func.date(MpesaTransaction.created_at) <= to_date,
                          MpesaTransaction.status != TxnStatus.reversed).scalar())
    sp_exp = (db.query(func.coalesce(func.sum(Expense.amount), 0))
              .filter(Expense.division == "spare_parts",
                      func.date(Expense.created_at) >= from_date,
                      func.date(Expense.created_at) <= to_date).scalar())
    mp_exp = (db.query(func.coalesce(func.sum(Expense.amount), 0))
              .filter(Expense.division == "mpesa",
                      func.date(Expense.created_at) >= from_date,
                      func.date(Expense.created_at) <= to_date).scalar())
    gen_exp = (db.query(func.coalesce(func.sum(Expense.amount), 0))
               .filter(Expense.division == "general",
                       func.date(Expense.created_at) >= from_date,
                       func.date(Expense.created_at) <= to_date).scalar())
    gross_sp = float(revenue) - float(cogs)
    return {
        "spare_parts": {"revenue": float(revenue), "cogs": float(cogs),
                        "gross_profit": gross_sp, "expenses": float(sp_exp),
                        "net": gross_sp - float(sp_exp)},
        "mpesa": {"commissions": float(commission), "expenses": float(mp_exp),
                  "net": float(commission) - float(mp_exp)},
        "general_expenses": float(gen_exp),
        "total_net": gross_sp + float(commission) - float(sp_exp) - float(mp_exp) - float(gen_exp),
    }

@router.get("/export/sales")
def export_sales(from_date: date, to_date: date, db: Session = Depends(get_db)):
    rows = (db.query(Sale).filter(func.date(Sale.created_at) >= from_date,
                                  func.date(Sale.created_at) <= to_date)
            .order_by(Sale.created_at).all())
    wb = Workbook()
    ws = wb.active
    ws.append(["Sale No", "Date", "Subtotal", "Discount", "Total", "Payment", "Status"])
    for s in rows:
        ws.append([s.sale_no, s.created_at.isoformat(), float(s.subtotal), float(s.discount),
                   float(s.total), s.payment_method.value, s.status])
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=sales_report.xlsx"})