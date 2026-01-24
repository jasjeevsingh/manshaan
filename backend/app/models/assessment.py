from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional, Union
from datetime import datetime
import uuid

from .irt import Domain, DomainTheta, SessionState


class SessionStatus(str, Enum):
    """Status of an assessment session."""
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETE = "complete"
    CANCELLED = "cancelled"


class AssessmentSession(BaseModel):
    """Assessment session metadata and state."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: str
    clinician_id: Optional[str] = None
    status: SessionStatus = SessionStatus.NOT_STARTED
    state: Optional[SessionState] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class StartAssessmentRequest(BaseModel):
    """Request to start a new assessment session."""
    patient_id: str
    clinician_id: Optional[str] = None


class AssessmentResponse(BaseModel):
    """Request to submit a response to an item."""
    session_id: str
    item_id: str
    response: Union[int, str]  # MCQ index or transcript/base64
    response_time_ms: int = Field(..., ge=0)


class NextItemResponse(BaseModel):
    """Response after submitting an answer."""
    theta_estimates: dict[Domain, DomainTheta]
    next_item: Optional[dict] = None  # IRTItem as dict, None if complete
    session_status: SessionStatus
    items_remaining: Optional[int] = None


class DomainScore(BaseModel):
    """
    Final domain score with clinical interpretation.
    Used in Clinical Insight Report.
    """
    domain: Domain
    theta: float
    standard_error: float
    percentile: float
    classification: str  # "Below Average", "Average", "Above Average"
    confidence_interval: tuple[float, float]


class ClinicalMarker(BaseModel):
    """Individual clinical marker from assessment."""
    name: str
    value: Union[float, str]
    significance: str  # "typical", "atypical", "concerning"
    evidence_source: str  # "irt", "voice", "drawing"


class DifferentialInsight(BaseModel):
    """
    Insight distinguishing ASD vs ID markers.
    Part of Clinical Insight Report.
    """
    primary_pattern: str  # e.g., "Profile consistent with ASD features"
    asd_indicators: list[str]
    id_indicators: list[str]
    differential_confidence: float  # 0-1
    clinical_notes: str
    evidence_summary: str


class ClinicalInsightReport(BaseModel):
    """
    Complete Clinical Insight Report (NOT a diagnosis).
    Satisfies Cures Act Non-Device CDS requirements.
    """
    report_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    patient_id: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Domain scores
    domain_scores: list[DomainScore]
    
    # Clinical markers from all modalities
    clinical_markers: list[ClinicalMarker]
    
    # Differential insight (ASD vs ID)
    differential: DifferentialInsight
    
    # Evidence for transparency (Cures Act compliance)
    raw_transcripts: Optional[list[str]] = None
    irt_calculation_log: Optional[str] = None
    
    # Clinician overrides applied
    overrides_applied: list[dict] = Field(default_factory=list)
    
    # Regulatory disclaimer
    disclaimer: str = (
        "This is an AI-generated Clinical Insight Report. "
        "This is NOT a diagnosis. Consult a licensed healthcare provider."
    )
