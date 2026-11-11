from app.core.database import Base, engine, SessionLocal
from app.models import *  # noqa
from app.models.user import User, Role
from app.models.inventory import Category, Product
from app.core.security import hash_password

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    if not db.query(User).filter(User.email == "owner@ekileakure.com").first():
        db.add(User(full_name="Business Owner", email="owner@ekileakure.com",
                    hashed_password=hash_password("Owner@123"), role=Role.owner))
        db.add(User(full_name="MPesa Operator", email="mpesa@ekileakure.com",
                    hashed_password=hash_password("Mpesa@123"), role=Role.mpesa_operator))
        db.add(User(full_name="Cashier", email="cashier@ekileakure.com",
                    hashed_password=hash_password("Cashier@123"), role=Role.spare_parts_cashier))
    if not db.query(Category).first():
        brakes = Category(name="Brakes", description="Brake pads, discs, shoes")
        engine_cat = Category(name="Engine Parts", description="Filters, plugs, gaskets")
        db.add_all([brakes, engine_cat])
        db.flush()
        db.add_all([
            Product(sku="BRK-001", part_number="BP-4421", name="Brake Pad Set Front",
                    brand="Bosch", manufacturer="Bosch", vehicle_compatibility="Toyota Corolla 2008-2013",
                    category_id=brakes.id, buying_price=1800, selling_price=2600,
                    quantity=24, min_stock=8, location="Shelf A1", barcode="6001104421"),
            Product(sku="ENG-014", part_number="OF-9090", name="Oil Filter",
                    brand="Mann", manufacturer="Mann", vehicle_compatibility="Universal",
                    category_id=engine_cat.id, buying_price=350, selling_price=650,
                    quantity=60, min_stock=20, location="Shelf B3", barcode="6002209090"),
        ])
    db.commit()
    db.close()
    print("Seeded. Login: owner@ekileakure.com / Owner@123")

if __name__ == "__main__":
    seed()