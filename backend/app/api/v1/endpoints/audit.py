# backend/app/api/v1/endpoints/audit.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.user import User, Role, AuditLog
from app.api.deps import require_roles

router = APIRouter()

@router.get("/audit-logs")
def list_logs(limit: int = 200, db: Session = Depends(get_db),
              _: User = Depends(require_roles(Role.owner))):
    return (db.query(AuditLog).order_by(AuditLog.created_at.desc())
            .limit(limit).all())