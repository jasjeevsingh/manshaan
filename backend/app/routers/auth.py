"""
Authentication Router with Supabase.

Handles user authentication via Supabase Auth including Google OAuth.
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional
import logging

from ..models.user import User, UserCreate, UserRole, Token, AuthProvider, Child
from ..services.supabase_client import get_supabase_service, SupabaseService
from ..config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])


class GoogleAuthRequest(BaseModel):
    """Request for Google OAuth."""
    id_token: str


class RefreshTokenRequest(BaseModel):
    """Request to refresh access token."""
    refresh_token: str


def get_current_user(
    authorization: Optional[str] = Header(None),
    supabase: SupabaseService = Depends(get_supabase_service)
) -> User:
    """
    Dependency to get current authenticated user.
    
    Extracts and verifies JWT token from Authorization header.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.split(" ")[1]
    user_data = supabase.verify_token(token)
    
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    # Fetch user profile from Supabase database
    if not supabase.client:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        read_client = supabase.admin_client or supabase.client
        response = read_client.table("profiles").select("*").eq("id", user_data["id"]).execute()

        if not response.data or len(response.data) == 0:
            write_client = supabase.admin_client or supabase.client
            meta = user_data.get("user_metadata") or {}
            profile_data = {
                "id": user_data["id"],
                "email": user_data.get("email", ""),
                "name": meta.get("full_name") or meta.get("name") or user_data.get("email", "").split("@")[0],
                "role": "parent",
                "provider": (user_data.get("app_metadata") or {}).get("provider", "email"),
            }
            write_client.table("profiles").upsert(profile_data).execute()
            response = write_client.table("profiles").select("*").eq("id", user_data["id"]).execute()
            if not response.data or len(response.data) == 0:
                raise HTTPException(status_code=500, detail="Failed to create user profile")

        profile = response.data[0]
        
        # Fetch children
        children_response = read_client.table("children").select("*").eq("parent_id", user_data["id"]).execute()
        children = [Child(**child) for child in children_response.data] if children_response.data else []
        
        return User(
            id=profile["id"],
            email=profile["email"],
            name=profile["name"],
            role=UserRole(profile.get("role", "parent")),
            provider=AuthProvider(profile.get("provider", "email")),
            children=children,
            created_at=profile["created_at"],
            is_active=profile.get("is_active", True)
        )
    except Exception as e:
        logger.error(f"Error fetching user profile: {e}")
        raise HTTPException(status_code=500, detail="Error fetching user profile")


@router.post("/google", response_model=Token)
async def google_auth(
    request: GoogleAuthRequest,
    supabase: SupabaseService = Depends(get_supabase_service)
):
    """
    Authenticate with Google OAuth.
    
    Exchanges Google ID token for Supabase session.
    """
    if not supabase.client:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        # Sign in with Google ID token
        response = supabase.client.auth.sign_in_with_id_token({
            "provider": "google",
            "token": request.id_token
        })
        
        if not response.user or not response.session:
            raise HTTPException(status_code=401, detail="Google authentication failed")
        
        # Create or update profile
        user_data = response.user
        profile_data = {
            "id": user_data.id,
            "email": user_data.email,
            "name": user_data.user_metadata.get("full_name", user_data.email.split("@")[0]),
            "role": "parent",
            "provider": "google"
        }
        
        supabase.client.table("profiles").upsert(profile_data).execute()
        
        # Fetch complete user profile
        user = get_current_user(f"Bearer {response.session.access_token}", supabase)
        
        return Token(
            access_token=response.session.access_token,
            token_type="bearer",
            user=user
        )
    except Exception as e:
        logger.error(f"Google auth error: {e}")
        raise HTTPException(status_code=500, detail=f"Authentication error: {str(e)}")


@router.post("/refresh", response_model=Token)
async def refresh_token(
    request: RefreshTokenRequest,
    supabase: SupabaseService = Depends(get_supabase_service)
):
    """
    Refresh access token using refresh token.
    """
    if not supabase.client:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        response = supabase.client.auth.refresh_session(request.refresh_token)
        
        if not response.session:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        
        user = get_current_user(f"Bearer {response.session.access_token}", supabase)
        
        return Token(
            access_token=response.session.access_token,
            token_type="bearer",
            user=user
        )
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        raise HTTPException(status_code=401, detail="Token refresh failed")


@router.get("/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user profile."""
    return current_user


@router.post("/logout")
async def logout(
    authorization: Optional[str] = Header(None),
    supabase: SupabaseService = Depends(get_supabase_service)
):
    """
    Logout current user.
    
    Invalidates the current session.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.split(" ")[1]
    
    if not supabase.client:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        supabase.client.auth.sign_out(token)
        return {"message": "Logged out successfully"}
    except Exception as e:
        logger.error(f"Logout error: {e}")
        raise HTTPException(status_code=500, detail="Logout failed")


# Child profile management endpoints
@router.post("/children", response_model=Child)
async def create_child(
    child_data: dict,
    current_user: User = Depends(get_current_user),
    supabase: SupabaseService = Depends(get_supabase_service)
):
    """Create a new child profile for the current user."""
    if not supabase.client:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        child_record = {
            "parent_id": current_user.id,
            "name": child_data["name"],
            "date_of_birth": child_data.get("date_of_birth"),
            "notes": child_data.get("notes")
        }
        
        response = supabase.client.table("children").insert(child_record).execute()
        
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to create child profile")
        
        return Child(**response.data[0])
    except Exception as e:
        logger.error(f"Error creating child: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating child profile: {str(e)}")


@router.get("/children", response_model=list[Child])
async def get_children(
    current_user: User = Depends(get_current_user),
    supabase: SupabaseService = Depends(get_supabase_service)
):
    """Get all children for the current user."""
    if not supabase.client:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        response = supabase.client.table("children").select("*").eq("parent_id", current_user.id).execute()
        return [Child(**child) for child in response.data] if response.data else []
    except Exception as e:
        logger.error(f"Error fetching children: {e}")
        raise HTTPException(status_code=500, detail="Error fetching children")


@router.delete("/children/{child_id}")
async def delete_child(
    child_id: str,
    current_user: User = Depends(get_current_user),
    supabase: SupabaseService = Depends(get_supabase_service)
):
    """Delete a child profile."""
    if not supabase.client:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        # Verify ownership
        response = supabase.client.table("children").select("parent_id").eq("id", child_id).execute()
        if not response.data or response.data[0]["parent_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this child")
        
        supabase.client.table("children").delete().eq("id", child_id).execute()
        return {"message": "Child profile deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting child: {e}")
        raise HTTPException(status_code=500, detail="Error deleting child profile")
