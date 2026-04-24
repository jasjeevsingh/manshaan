"""
Assessment Router - Redesigned Adaptive Engine.

Handles assessment session lifecycle with:
- Sequential question ordering (items in JSON order)
- Trigger-based adaptation (only when patient struggles)
- Graduated simplification (up to 3 levels)
- Accessibility accommodations
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Union
import logging
from datetime import datetime

from ..models.irt import Domain, IRTItem, SessionState, SimulationResult, ItemType
from ..models.assessment import (
    StartAssessmentRequest, AssessmentResponse, SessionStatus, ClinicalInsightReport
)
from ..models.user import User, UserRole
from ..services.irt_engine import get_irt_engine, IRTEngine
from ..services.gemini import get_gemini_service, GeminiService
from ..services.hume import get_hume_service, HumeService
from ..services.pdf_generator import get_pdf_generator, PDFGenerator
from ..services.supabase_client import get_supabase_service
from ..services.trigger_detector import get_trigger_detector, AdaptiveTriggerDetector
from .auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/assessment", tags=["Assessment"])

# In-memory session cache with optional Supabase persistence.
_sessions: dict[str, SessionState] = {}


def _persist_session(session: SessionState) -> None:
    """Persist session to in-memory cache and Supabase (when configured)."""
    _sessions[session.session_id] = session

    svc = get_supabase_service()
    db = svc.admin_client or svc.client
    if not db or not session.owner_user_id:
        return

    status = "completed" if session.is_complete else "in_progress"
    payload = {
        "id": session.session_id,
        "parent_id": session.owner_user_id,
        "status": status,
        "session_data": session.model_dump(mode="json"),
        "completed_at": session.completed_at.isoformat() if session.completed_at else None,
    }

    try:
        db.table("assessment_sessions").upsert(payload).execute()
    except Exception as e:
        logger.warning(f"Failed to persist session {session.session_id}: {e}")


def _load_session(session_id: str) -> Optional[SessionState]:
    """Load session from cache first, then Supabase if available."""
    cached = _sessions.get(session_id)
    if cached:
        return cached

    svc = get_supabase_service()
    db = svc.admin_client or svc.client
    if not db:
        return None

    try:
        response = (
            db.table("assessment_sessions")
            .select("session_data,parent_id")
            .eq("id", session_id)
            .limit(1)
            .execute()
        )
        if not response.data:
            return None

        record = response.data[0]
        session_data = record.get("session_data")
        if not session_data:
            return None

        session = SessionState.model_validate(session_data)
        # Backfill owner from canonical DB parent_id for older sessions.
        if not session.owner_user_id and record.get("parent_id"):
            session.owner_user_id = record["parent_id"]
        _sessions[session_id] = session
        return session
    except Exception as e:
        logger.warning(f"Failed to load session {session_id}: {e}")
        return None


def _get_item_for_session(session: SessionState, item_id: str, irt_engine: IRTEngine) -> Optional[IRTItem]:
    """Resolve item from session-scoped generated items first, then base item bank."""
    return session.generated_items.get(item_id) or irt_engine.items.get(item_id)


def _get_session_for_user(session_id: str, current_user: User) -> SessionState:
    """
    Load a session and enforce ownership.

    For backward compatibility with older in-memory sessions, we fall back to
    clinician_id as owner when owner_user_id is not present.
    """
    session = _load_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    owner_id = session.owner_user_id or session.clinician_id
    if owner_id and owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this session")

    if not session.owner_user_id:
        session.owner_user_id = current_user.id
        _persist_session(session)

    return session


def _require_clinician_or_admin(current_user: User) -> None:
    """Guard for clinician-only actions."""
    if current_user.role not in {UserRole.CLINICIAN, UserRole.ADMIN}:
        raise HTTPException(
            status_code=403,
            detail="This action requires clinician or admin role"
        )


class HelpRequest(BaseModel):
    """Request for help/accommodation."""
    session_id: str
    message: Optional[str] = None
    voice_transcript: Optional[str] = None
    hume_emotions: Optional[dict] = None
    help_button_pressed: bool = True


class AdaptiveResponse(BaseModel):
    """Response with adaptive question info."""
    next_item: Optional[dict]
    is_simplified: bool = False
    simplification_level: int = 0
    accommodation_applied: Optional[str] = None
    theta_estimates: dict
    session_status: str
    items_remaining: Optional[int] = None


@router.post("/start", response_model=dict)
async def start_assessment(
    request: StartAssessmentRequest,
    irt_engine: IRTEngine = Depends(get_irt_engine),
    current_user: User = Depends(get_current_user)
):
    """
    Start a new assessment session.
    
    Creates a new session state and returns the first item (sequential order).
    """
    # Create new session state
    session = SessionState(
        patient_id=request.patient_id,
        clinician_id=request.clinician_id or current_user.id,
        owner_user_id=current_user.id
    )
    
    # Get first item using sequential order
    first_item = irt_engine.get_next_sequential_item(session)
    
    if not first_item:
        raise HTTPException(
            status_code=500,
            detail="No items available in item bank"
        )
    
    session.current_item_id = first_item.id
    session.current_item_index = 0
    
    # Store session
    _persist_session(session)
    
    return {
        "session_id": session.session_id,
        "first_item": first_item.model_dump(),
        "total_items": len(irt_engine.get_item_list())
    }


@router.post("/respond", response_model=AdaptiveResponse)
async def submit_response(
    response: AssessmentResponse,
    irt_engine: IRTEngine = Depends(get_irt_engine),
    gemini: GeminiService = Depends(get_gemini_service),
    trigger_detector: AdaptiveTriggerDetector = Depends(get_trigger_detector),
    current_user: User = Depends(get_current_user)
):
    """
    Submit a response and get the next item (sequential with trigger-based adaptation).
    
    Flow:
    1. Process response and update IRT θ estimates
    2. Check for adaptation triggers (confusion, help button, etc.)
    3. If triggered: generate simplified question (up to 3 levels)
    4. If not triggered: advance to next sequential item
    5. Handle accessibility accommodations
    """
    session = _get_session_for_user(response.session_id, current_user)
    
    if session.is_complete:
        raise HTTPException(status_code=400, detail="Session already complete")
    
    # Enforce response integrity.
    if response.item_id != session.current_item_id:
        raise HTTPException(
            status_code=409,
            detail="Response item does not match the current active item"
        )

    if any(r.item_id == response.item_id for r in session.responses):
        raise HTTPException(
            status_code=409,
            detail="Duplicate response for this item is not allowed"
        )

    # Get current item info
    current_item = _get_item_for_session(session, response.item_id, irt_engine)
    if not current_item:
        raise HTTPException(status_code=400, detail="Unknown item for this session")

    current_difficulty = current_item.difficulty if current_item else 0.0
    current_type = current_item.item_type if current_item else ItemType.MCQ
    
    # Determine primary domain of current item
    current_domain = Domain.EPISODIC_MEMORY
    if current_item and current_item.domain_loadings:
        current_domain = max(
            current_item.domain_loadings.items(),
            key=lambda x: x[1]
        )[0]
    
    # Check if this is a skip request
    is_skip = isinstance(response.response, str) and response.response == "[SKIPPED]"
    
    # Process response and update IRT scoring (unless it's a skip)
    if not is_skip:
        try:
            session = irt_engine.process_response(
                session,
                response.item_id,
                response.response,
                response.response_time_ms,
                item=current_item,
                extra_items=session.generated_items
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    # Initialize response tracking
    is_simplified = False
    simplification_level = 0
    next_item = None
    
    # Determine which triggers to check based on item type
    # For MCQ: Only check Hume emotions, response time, help button (not text content)
    # For VOICE/DRAWING: Check all triggers including text content
    should_check_triggers = not is_skip
    
    if should_check_triggers:
        # For MCQ, don't pass the response text (it's just an integer anyway)
        # For VOICE/DRAWING, pass the response text for keyword detection
        response_for_trigger = None
        if current_type in [ItemType.VOICE, ItemType.DRAWING] and isinstance(response.response, str):
            response_for_trigger = response.response
        
        # Check for triggers
        trigger_result = await trigger_detector.should_trigger_adaptation(
            item_type=current_type,
            response=response_for_trigger,  # None for MCQ, text for VOICE/DRAWING
            hume_emotions=None,  # TODO: Get from Hume service
            help_button_pressed=False,
            drawing_analysis=None,  # TODO: Get from vision analysis
            response_time_ms=None,  # Not used for triggering
            item_difficulty=current_difficulty
        )
        
        logger.info(f"Trigger check for {current_type}: {trigger_result}")
        
        # If triggered and haven't hit max simplification, generate easier version
        if trigger_result.get("should_adapt", False):
            current_simplification = session.simplification_attempts.get(response.item_id, 0)
            
            if current_simplification < 3:
                # Increment simplification level
                new_level = current_simplification + 1
                session.simplification_attempts[response.item_id] = new_level
                
                logger.info(f"Generating simplified question (level {new_level}) for {response.item_id}")
                
                # Get issue from response
                patient_issue = None
                if isinstance(response.response, str):
                    patient_issue = response.response
                elif trigger_result.get("reason"):
                    patient_issue = trigger_result["reason"]
                
                # Generate simplified question
                simplified_item_data = await gemini.generate_simplified_question(
                    original_item=current_item.model_dump() if current_item else {},
                    domain=current_domain,
                    simplification_level=new_level,
                    patient_issue=patient_issue,
                    session_accommodations=session.accommodations.model_dump()
                )
                
                if simplified_item_data:
                    # Create IRTItem from generated data
                    try:
                        # Handle domain_loadings conversion
                        domain_loadings = simplified_item_data.get("domain_loadings", {})
                        if not isinstance(domain_loadings, dict):
                            domain_loadings = {current_domain: 1.2}
                        elif domain_loadings:
                            # Convert any string keys to Domain enum
                            domain_loadings = {
                                (Domain(k) if isinstance(k, str) else k): v 
                                for k, v in domain_loadings.items()
                            }
                        
                        next_item = IRTItem(
                            id=simplified_item_data.get("id", f"SIMP_{response.item_id}"),
                            prompt=simplified_item_data.get("prompt", ""),
                            item_type=ItemType(simplified_item_data.get("item_type", "mcq")),
                            domain_loadings=domain_loadings,
                            difficulty=simplified_item_data.get("difficulty", -1.0),
                            guessing=simplified_item_data.get("guessing", 0.25),
                            options=simplified_item_data.get("options"),
                            correct_answer=simplified_item_data.get("correct_answer"),
                            instructions=simplified_item_data.get("instructions")
                        )
                        session.generated_items[next_item.id] = next_item
                        is_simplified = True
                        simplification_level = new_level
                        logger.info(f"Created simplified item: {next_item.id}")
                    except Exception as e:
                        logger.error(f"Error creating simplified item: {e}")
                        next_item = None
    
    # If no simplified item, advance to next sequential item
    if next_item is None:
        session.current_item_index += 1
        next_item = irt_engine.get_next_sequential_item(session)
        # Reset simplification counter for new item
        if next_item:
            session.simplification_attempts[next_item.id] = 0
    
    # Check if session is complete
    status = SessionStatus.IN_PROGRESS
    if next_item is None:
        session.is_complete = True
        session.completed_at = datetime.utcnow()
        status = SessionStatus.COMPLETE
    else:
        session.current_item_id = next_item.id
    
    # Update stored session
    _persist_session(session)
    
    # Calculate remaining items
    items_remaining = None
    if not session.is_complete:
        total_items = len(irt_engine.get_item_list())
        items_remaining = max(0, total_items - session.current_item_index)
    
    return AdaptiveResponse(
        next_item=next_item.model_dump() if next_item else None,
        is_simplified=is_simplified,
        simplification_level=simplification_level,
        accommodation_applied=None,
        theta_estimates={d.value: t.model_dump() for d, t in session.theta_estimates.items()},
        session_status=status.value,
        items_remaining=items_remaining
    )


@router.post("/request-help", response_model=AdaptiveResponse)
async def request_help(
    request: HelpRequest,
    irt_engine: IRTEngine = Depends(get_irt_engine),
    gemini: GeminiService = Depends(get_gemini_service),
    current_user: User = Depends(get_current_user)
):
    """
    Patient pressed help button - trigger adaptive question or accommodation.
    
    This endpoint:
    1. Checks for accessibility needs (deaf, dyslexia, etc.)
    2. If accommodation needed, applies to session
    3. Generates simplified version of current question
    """
    session = _get_session_for_user(request.session_id, current_user)
    
    if session.is_complete:
        raise HTTPException(status_code=400, detail="Session already complete")
    
    # Combine text message and voice transcript for analysis
    combined_input = ""
    if request.message:
        combined_input = request.message
    if request.voice_transcript:
        combined_input = f"{combined_input} {request.voice_transcript}".strip()
    
    # Log emotions if provided
    if request.hume_emotions:
        logger.info(f"Hume emotions from help request: {request.hume_emotions}")
        # Check for high confusion/uncertainty
        confusion_score = request.hume_emotions.get("confusion", 0) + request.hume_emotions.get("Confusion", 0)
        uncertainty_score = request.hume_emotions.get("uncertainty", 0) + request.hume_emotions.get("Uncertainty", 0)
        if confusion_score > 0.5 or uncertainty_score > 0.5:
            logger.info(f"High confusion/uncertainty detected from voice: confusion={confusion_score}, uncertainty={uncertainty_score}")
    
    # Check for accommodation needs if message/transcript provided
    accommodation_applied = None
    if combined_input:
        accommodation_result = await gemini.detect_accommodation_needs(combined_input)
        logger.info(f"Accommodation check: {accommodation_result}")
        
        if accommodation_result.get("accommodation_detected", False):
            modality = accommodation_result.get("modality_change")
            
            if modality == "text_only":
                session.accommodations.text_only = True
                accommodation_applied = "text_only"
            elif modality == "audio_only":
                session.accommodations.audio_only = True
                accommodation_applied = "audio_only"
            elif modality == "skip_drawing":
                session.accommodations.skip_drawing = True
                accommodation_applied = "skip_drawing"
            
            logger.info(f"Applied accommodation: {accommodation_applied}")
    
    # Get current item
    current_item = _get_item_for_session(session, session.current_item_id, irt_engine)
    if not current_item:
        raise HTTPException(status_code=400, detail="No current item")
    
    # Determine domain
    current_domain = Domain.EPISODIC_MEMORY
    if current_item.domain_loadings:
        current_domain = max(
            current_item.domain_loadings.items(),
            key=lambda x: x[1]
        )[0]
    
    # Get current simplification level and increment
    current_level = session.simplification_attempts.get(session.current_item_id, 0)
    new_level = min(current_level + 1, 3)  # Cap at 3
    session.simplification_attempts[session.current_item_id] = new_level
    
    # Generate simplified question
    patient_issue = combined_input or "Patient requested help"
    simplified_item_data = await gemini.generate_simplified_question(
        original_item=current_item.model_dump(),
        domain=current_domain,
        simplification_level=new_level,
        patient_issue=patient_issue,
        session_accommodations=session.accommodations.model_dump()
    )
    
    next_item = None
    if simplified_item_data:
        try:
            domain_loadings = simplified_item_data.get("domain_loadings", {})
            if not isinstance(domain_loadings, dict) or not domain_loadings:
                domain_loadings = {current_domain: 1.2}
            else:
                domain_loadings = {
                    (Domain(k) if isinstance(k, str) else k): v 
                    for k, v in domain_loadings.items()
                }
            
            next_item = IRTItem(
                id=simplified_item_data.get("id", f"HELP_{session.current_item_id}"),
                prompt=simplified_item_data.get("prompt", ""),
                item_type=ItemType(simplified_item_data.get("item_type", "mcq")),
                domain_loadings=domain_loadings,
                difficulty=simplified_item_data.get("difficulty", -1.0),
                guessing=simplified_item_data.get("guessing", 0.25),
                options=simplified_item_data.get("options"),
                correct_answer=simplified_item_data.get("correct_answer"),
                instructions=simplified_item_data.get("instructions")
            )
            session.generated_items[next_item.id] = next_item
            session.current_item_id = next_item.id
        except Exception as e:
            logger.error(f"Error creating help item: {e}")
            next_item = current_item  # Fall back to current item
    
    _persist_session(session)
    
    return AdaptiveResponse(
        next_item=next_item.model_dump() if next_item else None,
        is_simplified=True,
        simplification_level=new_level,
        accommodation_applied=accommodation_applied,
        theta_estimates={d.value: t.model_dump() for d, t in session.theta_estimates.items()},
        session_status=SessionStatus.IN_PROGRESS.value,
        items_remaining=len(irt_engine.get_item_list()) - session.current_item_index
    )


@router.get("/{session_id}")
async def get_session(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get current session state."""
    session = _get_session_for_user(session_id, current_user)
    
    return {
        "session": session.model_dump(),
        "status": SessionStatus.COMPLETE if session.is_complete else SessionStatus.IN_PROGRESS
    }


@router.get("/{session_id}/results", response_model=ClinicalInsightReport)
async def get_results(
    session_id: str,
    gemini: GeminiService = Depends(get_gemini_service),
    hume: HumeService = Depends(get_hume_service),
    current_user: User = Depends(get_current_user)
):
    """
    Get complete Clinical Insight Report for a session.
    
    Generates clinical interpretation using the configured LLM (OpenRouter).
    """
    session = _get_session_for_user(session_id, current_user)
    
    if not session.is_complete:
        raise HTTPException(
            status_code=400, 
            detail="Session not complete. Complete assessment first."
        )
    
    # Get emotion timeline if available
    emotion_data = hume.get_timeline(session_id)
    
    # Generate clinical report
    report = await gemini.generate_clinical_report(
        session,
        clinical_markers=session.clinical_markers,
        emotion_data=emotion_data if emotion_data.timeline else None
    )
    
    return report


@router.get("/{session_id}/results/pdf")
async def get_results_pdf(
    session_id: str,
    gemini: GeminiService = Depends(get_gemini_service),
    hume: HumeService = Depends(get_hume_service),
    pdf_gen: PDFGenerator = Depends(get_pdf_generator),
    current_user: User = Depends(get_current_user)
):
    """Generate PDF Clinical Insight Report."""
    from fastapi.responses import Response
    
    session = _get_session_for_user(session_id, current_user)
    
    if not session.is_complete:
        raise HTTPException(status_code=400, detail="Session not complete")
    
    emotion_data = hume.get_timeline(session_id)
    
    report = await gemini.generate_clinical_report(
        session,
        clinical_markers=session.clinical_markers,
        emotion_data=emotion_data if emotion_data.timeline else None
    )
    
    pdf_bytes = pdf_gen.generate_report(report)
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=clinical_report_{session_id}.pdf"
        }
    )


@router.post("/simulate", response_model=SimulationResult)
async def run_simulation(
    true_theta: dict[str, float],
    num_items: int = 20,
    irt_engine: IRTEngine = Depends(get_irt_engine),
    current_user: User = Depends(get_current_user)
):
    """
    Run IRT simulation to demonstrate θ convergence.
    """
    theta_dict = {Domain(k): v for k, v in true_theta.items()}
    
    for domain in Domain:
        if domain not in theta_dict:
            theta_dict[domain] = 0.0
    
    result = irt_engine.run_simulation(theta_dict, num_items)
    return result


@router.post("/{session_id}/invalidate/{response_id}")
async def invalidate_response(
    session_id: str,
    response_id: str,
    reason: str,
    current_user: User = Depends(get_current_user)
):
    """Clinician override: invalidate a response."""
    _require_clinician_or_admin(current_user)
    session = _get_session_for_user(session_id, current_user)
    
    response_found = False
    for response in session.responses:
        if response.id == response_id:
            response.is_invalidated = True
            response.invalidation_reason = reason
            response.invalidated_by = current_user.id
            response_found = True
            break
    
    if not response_found:
        raise HTTPException(status_code=404, detail="Response not found")
    
    irt_engine = get_irt_engine()
    valid_responses = [r for r in session.responses if not r.is_invalidated]
    session.theta_estimates = irt_engine.update_theta_eap(
        valid_responses,
        [r.item_id for r in valid_responses],
        extra_items=session.generated_items
    )
    
    _persist_session(session)
    
    return {"success": True, "new_theta": session.theta_estimates}
