"""
Manshaan Clinical Platform - FastAPI Application.

Multimodal diagnostic platform for Neurodevelopmental Disorders.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from .config import get_settings
from .routers import assessment, vision, emotion, auth

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Get settings
settings = get_settings()

# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    description="""
# Manshaan Clinical Platform

A multimodal, research-backed diagnostic platform for Neurodevelopmental Disorders 
(Autism Spectrum Disorder & Intellectual Disability).

## Features

- **IRT Scoring Engine**: MIRT 3PL with EAP estimation across 5 cognitive domains
- **Empathic Voice Interface**: Hume AI integration for paralinguistic analysis
- **Vision Analysis**: GPT-4o Vision for drawing/sketch evaluation
- **Clinical Reports**: Professional PDF generation with ASD/ID differential insights

## Regulatory Compliance

- AB 3030 disclaimers on all AI-generated content
- Cures Act Non-Device CDS evidence transparency
- Clinician override capabilities

## API Documentation

Use the endpoints below to:
1. Start and manage assessment sessions
2. Submit and analyze drawings
3. Record emotion data from voice interactions
4. Generate clinical insight reports
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(assessment.router, prefix=settings.api_prefix)
app.include_router(vision.router, prefix=settings.api_prefix)
app.include_router(emotion.router, prefix=settings.api_prefix)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": "1.0.0",
        "disclaimer": (
            "This is an AI-powered Clinical Insight Platform. "
            "This is NOT a diagnostic tool. "
            "Consult a licensed healthcare provider for medical advice."
        )
    }


@app.get("/health")
async def health_check():
    """Detailed health check."""
    from .services.irt_engine import get_irt_engine
    
    irt_engine = get_irt_engine()
    items_loaded = len(irt_engine.items)
    
    return {
        "status": "healthy",
        "components": {
            "irt_engine": {
                "status": "ok" if items_loaded > 0 else "warning",
                "items_loaded": items_loaded
            },
            "api": {"status": "ok"}
        }
    }


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    logger.info(f"Starting {settings.app_name}")
    
    # Pre-load IRT engine
    from .services.irt_engine import get_irt_engine
    engine = get_irt_engine()
    logger.info(f"IRT Engine loaded with {len(engine.items)} items")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    logger.info("Shutting down Manshaan Platform")
