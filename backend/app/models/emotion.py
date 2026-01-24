from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class EmotionData(BaseModel):
    """
    Emotion data captured from Hume AI EVI.
    Key paralinguistic markers for clinical enrichment.
    """
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    session_id: str
    
    # Primary emotions tracked (0-1 scale)
    anxiety: float = Field(0.0, ge=0.0, le=1.0)
    calm: float = Field(0.0, ge=0.0, le=1.0)
    distress: float = Field(0.0, ge=0.0, le=1.0)
    
    # Additional Hume emotions for enriched analysis
    confusion: Optional[float] = Field(None, ge=0.0, le=1.0)
    concentration: Optional[float] = Field(None, ge=0.0, le=1.0)
    interest: Optional[float] = Field(None, ge=0.0, le=1.0)
    
    # Context
    item_id: Optional[str] = None  # Which item was being presented
    transcript_snippet: Optional[str] = None


class EmotionRecordRequest(BaseModel):
    """Request to record emotion data point."""
    session_id: str
    timestamp: str  # ISO format
    emotions: dict[str, float]  # {anxiety: 0.3, calm: 0.7, ...}
    item_id: Optional[str] = None


class EmotionTimelinePoint(BaseModel):
    """Single point in the emotion timeline."""
    timestamp: datetime
    anxiety: float
    calm: float
    distress: float
    item_id: Optional[str] = None
    event_marker: Optional[str] = None  # "item_start", "item_end", "voice_analysis"


class EmotionTimeline(BaseModel):
    """
    Complete emotion timeline for a session.
    Used in clinical dashboard visualization.
    """
    session_id: str
    timeline: list[EmotionTimelinePoint]
    
    # Aggregated metrics
    avg_anxiety: float = 0.0
    avg_calm: float = 0.0
    avg_distress: float = 0.0
    peak_anxiety_item: Optional[str] = None
    emotional_resilience_score: Optional[float] = None  # 0-100 derived metric
