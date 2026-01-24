"""
Vision Analysis Router.

Handles drawing canvas submissions and GPT-4o Vision analysis.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import logging

from ..services.vision import get_vision_service, VisionService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analyze-vision", tags=["Vision"])


class VisionAnalysisRequest(BaseModel):
    """Request for vision analysis."""
    image_base64: str
    task_type: str = "free_draw"  # clock, figure_copy, free_draw
    expected_elements: Optional[list[str]] = None
    session_id: Optional[str] = None
    item_id: Optional[str] = None


class VisionAnalysisResponse(BaseModel):
    """Response from vision analysis."""
    analysis: str
    confidence: float
    clinical_markers: list[dict]
    is_readable: bool
    raw_response: str
    task_type: str


@router.post("", response_model=VisionAnalysisResponse)
async def analyze_drawing(
    request: VisionAnalysisRequest,
    vision: VisionService = Depends(get_vision_service)
):
    """
    Analyze a drawing submission using GPT-4o Vision.
    
    Evaluates drawings against clinical benchmarks like Beery-Buktenica VMI.
    """
    if not request.image_base64:
        raise HTTPException(status_code=400, detail="No image data provided")
    
    # Remove data URL prefix if present
    image_data = request.image_base64
    if image_data.startswith("data:"):
        # Extract base64 part after comma
        image_data = image_data.split(",", 1)[1] if "," in image_data else image_data
    
    # Analyze with GPT-4o
    result = await vision.analyze_drawing(
        image_base64=image_data,
        task_type=request.task_type,
        expected_elements=request.expected_elements
    )
    
    # Convert clinical markers to dicts for response
    markers = [
        m.model_dump() if hasattr(m, 'model_dump') else m 
        for m in result.get("clinical_markers", [])
    ]
    
    return VisionAnalysisResponse(
        analysis=result.get("analysis", ""),
        confidence=result.get("confidence", 0.0),
        clinical_markers=markers,
        is_readable=result.get("is_readable", False),
        raw_response=result.get("raw_response", ""),
        task_type=request.task_type
    )
