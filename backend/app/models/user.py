from pydantic import BaseModel, EmailStr, Field
from enum import Enum
from typing import Optional
from datetime import datetime
import uuid


class UserRole(str, Enum):
    """User role in the system."""
    PARENT = "parent"
    CLINICIAN = "clinician"
    ADMIN = "admin"


class AuthProvider(str, Enum):
    """Authentication provider."""
    EMAIL = "email"
    GOOGLE = "google"


class Child(BaseModel):
    """Child profile associated with a parent account."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    parent_id: str
    name: str = Field(..., min_length=1, max_length=100)
    date_of_birth: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    """Schema for user registration (Supabase handles password)."""
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=100)
    role: UserRole = UserRole.PARENT
    provider: AuthProvider = AuthProvider.EMAIL


class User(BaseModel):
    """User model returned from API."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: UserRole
    provider: AuthProvider = AuthProvider.EMAIL
    children: list[Child] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    """JWT token response."""
    access_token: str
    token_type: str = "bearer"
    user: User
