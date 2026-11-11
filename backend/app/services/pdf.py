from io import BytesIO
from reportlab.lib.pagesizes import A6
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

def sale_receipt(sale) -> bytes:
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A6)
    width, height = A6
    y = height - 15 * mm
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(width / 2, y, "EKILEAKURE")
    c.setFont("Helvetica", 8)
    y -= 6 * mm
    c.drawCentredString(width / 2, y, "One Business. Complete Control.")
    y -= 10 * mm
    c.setFont("Helvetica", 8)
    c.drawString(10 * mm, y, f"Receipt: {sale.sale_no}")
    y -= 5 * mm
    c.drawString(10 * mm, y, f"Date: {sale.created_at.strftime('%Y-%m-%d %H:%M')}")
    y -= 5 * mm
    c.drawString(10 * mm, y, f"Payment: {sale.payment_method.value.upper()}")
    y -= 8 * mm
    c.line(10 * mm, y, width - 10 * mm, y)
    y -= 6 * mm
    for item in sale.items:
        name = item.product.name[:28] if item.product else "Item"
        c.drawString(10 * mm, y, f"{name}")
        y -= 4 * mm
        c.drawString(12 * mm, y, f"{item.quantity} x {float(item.unit_price):,.2f} = {float(item.line_total):,.2f}")
        y -= 6 * mm
    c.line(10 * mm, y, width - 10 * mm, y)
    y -= 7 * mm
    c.setFont("Helvetica-Bold", 9)
    c.drawString(10 * mm, y, f"Subtotal: KSh {float(sale.subtotal):,.2f}")
    y -= 5 * mm
    c.drawString(10 * mm, y, f"Discount: KSh {float(sale.discount):,.2f}")
    y -= 6 * mm
    c.drawString(10 * mm, y, f"TOTAL: KSh {float(sale.total):,.2f}")
    y -= 10 * mm
    c.setFont("Helvetica", 7)
    c.drawCentredString(width / 2, y, "Thank you for your business!")
    c.showPage()
    c.save()
    buf.seek(0)
    return buf.read()