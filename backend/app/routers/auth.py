"""
Authentication Router.

Handles user registration and login.
Simplified implementation - use proper auth in production.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional
import uuid
import logging

from jose import jwt

from ..models.user import User, UserCreate, UserRole, Token
from ..config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])

# In-memory user storage (replace with database in production)
_users: dict[str, dict] = {}


class LoginRequest(BaseModel):
    """Login request."""
    email: str
    password: str


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token."""
    settings = get_settings()
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    
    return encoded_jwt


@router.post("/register", response_model=Token)
async def register(request: UserCreate):
    """
    Register a new user.
    
    Creates user account and returns JWT token.
    """
    # Check if email already exists
    for user_data in _users.values():
        if user_data["email"] == request.email:
            raise HTTPException(
                status_code=400,
                detail="Email already registered"
            )
    
    # Create user
    user_id = str(uuid.uuid4())
    user = User(
        id=user_id,
        email=request.email,
        name=request.name,
        role=request.role
    )
    
    # Store user (hash password in production!)
    _users[user_id] = {
        **user.model_dump(),
        "password": request.password  # NEVER do this in production
    }
    
    # Create token
    access_token = create_access_token(
        data={"sub": user.email, "user_id": user_id, "role": user.role.value}
    )
    
    return Token(
        access_token=access_token,
        user=user
    )


@router.post("/login", response_model=Token)
async def login(request: LoginRequest):
    """
    Login with email and password.
    
    Returns JWT token on success.
    """
    # Find user by email
    user_data = None
    for data in _users.values():
        if data["email"] == request.email:
            user_data = data
            break
    
    if not user_data:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )
    
    # Check password (use proper hashing in production!)
    if user_data["password"] != request.password:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )
    
    # Create user object
    user = User(
        id=user_data["id"],
        email=user_data["email"],
        name=user_data["name"],
        role=UserRole(user_data["role"])
    )
    
    # Create token
    access_token = create_access_token(
        data={"sub": user.email, "user_id": user.id, "role": user.role.value}
    )
    
    return Token(
        access_token=access_token,
        user=user
    )


@router.get("/me")
async def get_current_user():
    """Get current user info (placeholder - needs auth middleware)."""
    return {"message": "Implement auth middleware to get current user"}
