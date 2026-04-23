"""
Hume AI Token Generation Router.

Generates temporary access tokens for client-side EVI connections.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import httpx
import base64
import logging
import traceback

from ..config import get_settings
from ..models.user import User
from .auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/hume", tags=["Hume AI"])


class AccessTokenResponse(BaseModel):
    """Response containing Hume access token."""
    access_token: str
    expires_in: int
    token_type: str


@router.post("/token", response_model=AccessTokenResponse)
async def get_hume_access_token(
    current_user: User = Depends(get_current_user)
):
    """
    Generate a Hume AI access token for client-side EVI connections.
    
    Uses the API key and Secret key to obtain a temporary access token
    that can be safely used in the browser.
    """
    try:
        logger.info(f"=== Hume token endpoint called by user {current_user.id} ===")
        settings = get_settings()
        
        logger.info(f"API key present: {bool(settings.hume_api_key)}")
        logger.info(f"Secret key present: {bool(settings.hume_secret_key)}")
        
        if not settings.hume_api_key or not settings.hume_secret_key:
            logger.error("Hume credentials not configured")
            raise HTTPException(
                status_code=500,
                detail="Hume API credentials not configured on server"
            )
        
        # Create Basic auth credentials: base64(api_key:secret_key)
        credentials = f"{settings.hume_api_key}:{settings.hume_secret_key}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        logger.info("Credentials encoded, making request to Hume API...")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.hume.ai/oauth2-cc/token",
                headers={
                    "Authorization": f"Basic {encoded_credentials}",
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                data={"grant_type": "client_credentials"},
                timeout=10.0
            )
            
            logger.info(f"Hume API responded with status: {response.status_code}")
            
            if response.status_code != 200:
                logger.error(f"Hume token request failed: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to obtain Hume access token: {response.text}"
                )
            
            token_data = response.json()
            logger.info("✓ Access token obtained successfully")
            
            return AccessTokenResponse(
                access_token=token_data["access_token"],
                expires_in=token_data.get("expires_in", 1800),  # Default 30 min
                token_type=token_data.get("token_type", "Bearer")
            )
            
    except HTTPException:
        # Re-raise HTTPExceptions as-is
        raise
    except httpx.TimeoutException as e:
        logger.error(f"Hume API request timed out: {e}")
        raise HTTPException(status_code=504, detail="Hume API request timed out")
    except httpx.RequestError as e:
        logger.error(f"Hume API request failed: {e}")
        raise HTTPException(status_code=500, detail=f"Network error: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error getting Hume token: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
