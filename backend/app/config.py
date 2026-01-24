from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional, Union


from pydantic import field_validator
class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""
    
    # App settings
    app_name: str = "Manshaan Clinical Platform"
    debug: bool = False
    api_prefix: str = "/api"
    
    # CORS
    allowed_origins: Union[str, list[str]] = ["http://localhost:5173", "http://localhost:3000"]

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v
    
    # API Keys
    openai_api_key: Optional[str] = None
    google_api_key: Optional[str] = None
    hume_api_key: Optional[str] = None
    
    # Supabase
    supabase_url: Optional[str] = None
    supabase_anon_key: Optional[str] = None
    supabase_service_role_key: Optional[str] = None
    
    # JWT Settings
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # IRT Settings
    irt_prior_mean: float = 0.0
    irt_prior_sd: float = 1.0
    irt_quadrature_points: int = 41
    irt_convergence_threshold: float = 0.001
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Cached settings loader."""
    return Settings()
