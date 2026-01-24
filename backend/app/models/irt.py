from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional, Union
from datetime import datetime
import uuid


class Domain(str, Enum):
    """The 5 cognitive domains assessed by MIRT."""
    EPISODIC_MEMORY = "episodic_memory"
    EXECUTIVE_FUNCTION = "executive_function"
    WORKING_MEMORY = "working_memory"
    PROCESSING_SPEED = "processing_speed"
    VISUOSPATIAL = "visuospatial"


class ItemType(str, Enum):
    """Types of assessment items."""
    MCQ = "mcq"                  # Multiple choice
    VOICE = "voice"              # Hume EVI voice response
    DRAWING = "drawing"          # Canvas drawing task
    TIMED_RESPONSE = "timed"     # Reaction time task


class IRTItem(BaseModel):
    """
    MIRT item with multi-domain loadings.
    
    Each item can load on multiple domains with different discrimination (a) values.
    For example, a verbal memory task might load:
      - episodic_memory: 1.2 (primary)
      - executive_function: 0.3 (secondary)
    """
    id: str
    prompt: str
    item_type: ItemType = ItemType.MCQ
    
    # MIRT parameters: domain -> discrimination (a parameter)
    domain_loadings: dict[Domain, float] = Field(
        ...,
        description="Discrimination parameter per domain (how well item differentiates ability)"
    )
    
    # Difficulty parameter (b) - shared across domains for compensatory MIRT
    difficulty: float = Field(
        0.0,
        ge=-4.0, le=4.0,
        description="Difficulty parameter (θ level where P=0.5 adjusted for guessing)"
    )
    
    # Guessing parameter (c) - lower asymptote
    guessing: float = Field(
        0.2,
        ge=0.0, le=0.5,
        description="Guessing/pseudo-chance parameter (lower asymptote)"
    )
    
    # Answer options for MCQ
    options: Optional[list[str]] = None
    correct_answer: Optional[int] = None  # Index of correct option
    
    # Instructions for voice/drawing tasks
    instructions: Optional[str] = None
    time_limit_seconds: Optional[int] = None


class DomainTheta(BaseModel):
    """Theta (ability) estimate for a single domain."""
    domain: Domain
    theta: float = Field(0.0, description="Ability estimate (mean 0, SD 1 scale)")
    standard_error: float = Field(1.0, ge=0.0, description="Standard error of estimate")
    percentile: Optional[float] = Field(None, ge=0, le=100)
    
    @property
    def confidence_interval_95(self) -> tuple[float, float]:
        """95% confidence interval for theta."""
        return (self.theta - 1.96 * self.standard_error, 
                self.theta + 1.96 * self.standard_error)


class ResponseRecord(BaseModel):
    """Record of a single item response."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    item_id: str
    response: Union[int, str, None]  # MCQ index, voice transcript, or drawing base64
    response_time_ms: int = Field(..., ge=0)
    is_correct: Optional[bool] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Clinician override fields
    is_invalidated: bool = False
    invalidation_reason: Optional[str] = None
    invalidated_by: Optional[str] = None  # Clinician user_id


class SessionState(BaseModel):
    """
    Complete state of an assessment session.
    Used by Zustand on frontend and IRT engine on backend.
    """
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: str
    clinician_id: Optional[str] = None
    
    # Current theta estimates per domain (EAP posterior)
    theta_estimates: dict[Domain, DomainTheta] = Field(
        default_factory=lambda: {
            d: DomainTheta(domain=d, theta=0.0, standard_error=1.0) 
            for d in Domain
        }
    )
    
    # Response history
    responses: list[ResponseRecord] = Field(default_factory=list)
    
    # Current item being presented
    current_item_id: Optional[str] = None
    items_administered: int = 0
    
    # Session metadata
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    is_complete: bool = False


class SimulationResult(BaseModel):
    """
    Result of IRT simulation mode showing θ convergence.
    Used to demonstrate algorithm to judges.
    """
    true_theta: dict[Domain, float]
    theta_trajectory: list[dict[Domain, float]]  # θ estimate after each item
    se_trajectory: list[dict[Domain, float]]     # SE after each item
    items_used: list[str]
    final_theta: dict[Domain, DomainTheta]
    convergence_achieved: bool
    num_items_to_convergence: int
