"""
Emotion Recording Router.

Handles Hume AI emotion data from the frontend.
"""

from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from typing import Optional
import logging

from ..models.emotion import EmotionRecordRequest, EmotionTimeline
from ..services.hume import get_hume_service, HumeService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/emotion", tags=["Emotion"])


@router.post("/record")
async def record_emotion(
    request: EmotionRecordRequest,
    hume: HumeService = Depends(get_hume_service)
):
    """
    Record emotion data point from Hume EVI.
    
    Called by frontend when receiving expression measurements.
    """
    try:
        timestamp = datetime.fromisoformat(request.timestamp.replace("Z", "+00:00"))
    except ValueError:
        timestamp = datetime.utcnow()
    
    success = hume.record_emotion(
        session_id=request.session_id,
        timestamp=timestamp,
        emotions=request.emotions,
        item_id=request.item_id
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to record emotion")
    
    return {"recorded": True}


@router.get("/{session_id}/timeline", response_model=EmotionTimeline)
async def get_emotion_timeline(
    session_id: str,
    hume: HumeService = Depends(get_hume_service)
):
    """
    Get emotion timeline for a session.
    
    Returns all emotion data points with aggregated metrics.
    """
    timeline = hume.get_timeline(session_id)
    return timeline
