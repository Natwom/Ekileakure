from sqlalchemy.orm import Session
from app.models.user import AuditLog

def log(db: Session, user_id, action: str, entity: str = None, entity_id=None, detail: str = None, ip: str = None):
    entry = AuditLog(user_id=user_id, action=action, entity=entity,
                     entity_id=str(entity_id) if entity_id else None, detail=detail, ip_address=ip)
    db.add(entry)