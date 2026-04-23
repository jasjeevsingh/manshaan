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
    
    # API Keys (legacy: optional if using OpenRouter for LLM)
    openai_api_key: Optional[str] = None
    google_api_key: Optional[str] = None
    hume_api_key: Optional[str] = None
    hume_secret_key: Optional[str] = None

    # OpenRouter (OpenAI-compatible): primary path for text + vision LLM calls
    # Model IDs are slugs like "openai/gpt-4o", "google/gemini-2.0-flash-001" — see https://openrouter.ai/models
    openrouter_api_key: Optional[str] = None
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_http_referer: Optional[str] = None
    openrouter_app_title: str = "Manshaan Clinical Platform"
    llm_text_model: str = "google/gemini-2.0-flash-001"
    llm_vision_model: str = "openai/gpt-4o"
    llm_fallback_text_model: Optional[str] = None
    
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
