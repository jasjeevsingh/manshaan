"""
Supabase Client Service.

Provides singleton Supabase client for authentication and database operations.
"""

from typing import Optional
from supabase import create_client, Client
from functools import lru_cache
import logging
import time

from ..config import get_settings

logger = logging.getLogger(__name__)


class SupabaseService:
    """Supabase service for auth and database operations."""
    
    def __init__(self):
        """Initialize Supabase client."""
        settings = get_settings()
        
        if not settings.supabase_url or not settings.supabase_anon_key:
            logger.warning("Supabase credentials not configured")
            self._client = None
            return
        
        self._client: Client = create_client(
            settings.supabase_url,
            settings.supabase_anon_key
        )
        
        # Service role client for admin operations
        if settings.supabase_service_role_key:
            self._admin_client: Client = create_client(
                settings.supabase_url,
                settings.supabase_service_role_key
            )
        else:
            self._admin_client = None
        
        logger.info("Supabase client initialized")
    
    @property
    def client(self) -> Optional[Client]:
        """Get Supabase client."""
        return self._client
    
    @property
    def admin_client(self) -> Optional[Client]:
        """Get Supabase admin client (service role)."""
        return self._admin_client
    
    def verify_token(self, token: str, _retries: int = 3) -> Optional[dict]:
        """
        Verify JWT token from Supabase.
        
        Retries on transient socket errors (e.g. concurrent requests on the
        same httpx client can raise Errno 35 / Resource temporarily unavailable).
        """
        if not self._client:
            return None
        
        for attempt in range(_retries):
            try:
                response = self._client.auth.get_user(token)
                return response.user.model_dump() if response.user else None
            except OSError as e:
                if attempt < _retries - 1:
                    time.sleep(0.1 * (attempt + 1))
                    continue
                logger.error(f"Token verification failed after {_retries} attempts: {e}")
                return None
            except Exception as e:
                logger.error(f"Token verification failed: {e}")
                return None


# Singleton instance
_supabase_service: Optional[SupabaseService] = None


@lru_cache()
def get_supabase_service() -> SupabaseService:
    """Get or create Supabase service singleton."""
    global _supabase_service
    if _supabase_service is None:
        _supabase_service = SupabaseService()
    return _supabase_service
