from fastapi import APIRouter
from app.api.v1.endpoints import audit

from app.api.v1.endpoints import auth, users, inventory, sales, purchasing, mpesa, finance, dashboard, reports

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["inventory"])
api_router.include_router(sales.router, prefix="/sales", tags=["sales"])
api_router.include_router(purchasing.router, prefix="/purchasing", tags=["purchasing"])
api_router.include_router(mpesa.router, prefix="/mpesa", tags=["mpesa"])
api_router.include_router(finance.router, prefix="/finance", tags=["finance"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(audit.router, prefix="/audit", tags=["audit"])