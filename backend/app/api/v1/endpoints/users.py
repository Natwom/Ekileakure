from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import hash_password
from app.models.user import User, Role
from app.schemas.auth import UserCreate, UserUpdate, UserOut
from app.api.deps import get_current_user, require_roles
from app.services.audit import log

router = APIRouter()

@router.get("/", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db),
               _: User = Depends(require_roles(Role.owner, Role.manager))):
    return db.query(User).order_by(User.id).all()

@router.post("/", response_model=UserOut)
def create_user(data: UserCreate, db: Session = Depends(get_db),
                current: User = Depends(require_roles(Role.owner))):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(409, "Email already registered")
    user = User(full_name=data.full_name, email=data.email,
                hashed_password=hash_password(data.password), role=data.role)
    db.add(user)
    db.commit()
    log(db, current.id, "user.create", "user", user.id, f"Created {data.email}")
    db.commit()
    return user

@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db),
                current: User = Depends(require_roles(Role.owner, Role.manager))):
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "password" and value:
            user.hashed_password = hash_password(value)
        else:
            setattr(user, field, value)
    log(db, current.id, "user.update", "user", user.id)
    db.commit()
    return user