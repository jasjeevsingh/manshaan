"""
Assessment Router.

Handles assessment session lifecycle:
- Starting new sessions
- Processing responses
- Getting results
- IRT simulation mode
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
import logging

from ..models.irt import Domain, IRTItem, DomainTheta, SessionState, SimulationResult
from ..models.assessment import (
    StartAssessmentRequest, AssessmentResponse, NextItemResponse,
    SessionStatus, ClinicalInsightReport
)
from ..services.irt_engine import get_irt_engine, IRTEngine
from ..services.gemini import get_gemini_service, GeminiService
from ..services.hume import get_hume_service, HumeService
from ..services.pdf_generator import get_pdf_generator, PDFGenerator

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/assessment", tags=["Assessment"])

# In-memory session storage (replace with database in production)
_sessions: dict[str, SessionState] = {}


@router.post("/start", response_model=dict)
async def start_assessment(
    request: StartAssessmentRequest,
    irt_engine: IRTEngine = Depends(get_irt_engine)
):
    """
    Start a new assessment session.
    
    Creates a new session state and returns the first item.
    """
    # Create new session state
    session = SessionState(
        patient_id=request.patient_id,
        clinician_id=request.clinician_id
    )
    
    # Get first item
    first_item = irt_engine.select_next_item(session)
    
    if not first_item:
        raise HTTPException(
            status_code=500,
            detail="No items available in item bank"
        )
    
    session.current_item_id = first_item.id
    
    # Store session
    _sessions[session.session_id] = session
    
    return {
        "session_id": session.session_id,
        "first_item": first_item.model_dump()
    }


@router.post("/respond", response_model=NextItemResponse)
async def submit_response(
    response: AssessmentResponse,
    irt_engine: IRTEngine = Depends(get_irt_engine)
):
    """
    Submit a response to an item and get the next item.
    
    Updates theta estimates using EAP and selects optimal next item.
    """
    session = _sessions.get(response.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.is_complete:
        raise HTTPException(status_code=400, detail="Session already complete")
    
    # Process response
    try:
        session = irt_engine.process_response(
            session,
            response.item_id,
            response.response,
            response.response_time_ms
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Select next item
    next_item = irt_engine.select_next_item(session)
    
    # Check if session is complete
    status = SessionStatus.IN_PROGRESS
    if next_item is None:
        session.is_complete = True
        status = SessionStatus.COMPLETE
    else:
        session.current_item_id = next_item.id
    
    # Update stored session
    _sessions[response.session_id] = session
    
    # Calculate remaining items (rough estimate)
    items_remaining = None
    if not session.is_complete:
        max_items = 50
        items_remaining = max(0, max_items - session.items_administered)
    
    return NextItemResponse(
        theta_estimates=session.theta_estimates,
        next_item=next_item.model_dump() if next_item else None,
        session_status=status,
        items_remaining=items_remaining
    )


@router.get("/{session_id}")
async def get_session(session_id: str):
    """Get current session state."""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "session": session.model_dump(),
        "status": SessionStatus.COMPLETE if session.is_complete else SessionStatus.IN_PROGRESS
    }


@router.get("/{session_id}/results", response_model=ClinicalInsightReport)
async def get_results(
    session_id: str,
    gemini: GeminiService = Depends(get_gemini_service),
    hume: HumeService = Depends(get_hume_service)
):
    """
    Get complete Clinical Insight Report for a session.
    
    Generates clinical interpretation using Gemini.
    """
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
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
        clinical_markers=[],  # Would come from vision analysis
        emotion_data=emotion_data if emotion_data.timeline else None
    )
    
    return report


@router.get("/{session_id}/results/pdf")
async def get_results_pdf(
    session_id: str,
    gemini: GeminiService = Depends(get_gemini_service),
    hume: HumeService = Depends(get_hume_service),
    pdf_gen: PDFGenerator = Depends(get_pdf_generator)
):
    """
    Generate PDF Clinical Insight Report.
    
    Returns PDF bytes for download.
    """
    from fastapi.responses import Response
    
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if not session.is_complete:
        raise HTTPException(
            status_code=400, 
            detail="Session not complete"
        )
    
    # Get emotion data
    emotion_data = hume.get_timeline(session_id)
    
    # Generate report
    report = await gemini.generate_clinical_report(
        session,
        clinical_markers=[],
        emotion_data=emotion_data if emotion_data.timeline else None
    )
    
    # Generate PDF
    pdf_bytes = pdf_gen.generate_report(report)
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=clinical_report_{session_id[:8]}.pdf"
        }
    )


@router.post("/simulate", response_model=SimulationResult)
async def run_simulation(
    true_theta: dict[str, float],
    num_items: int = 20,
    irt_engine: IRTEngine = Depends(get_irt_engine)
):
    """
    Run IRT simulation to demonstrate θ convergence.
    
    Shows how the adaptive algorithm converges to true ability.
    Used for demonstration purposes.
    """
    # Convert string keys to Domain enum
    theta_dict = {Domain(k): v for k, v in true_theta.items()}
    
    # Fill in missing domains with 0
    for domain in Domain:
        if domain not in theta_dict:
            theta_dict[domain] = 0.0
    
    # Run simulation
    result = irt_engine.run_simulation(theta_dict, num_items)
    
    return result


@router.post("/{session_id}/invalidate/{response_id}")
async def invalidate_response(
    session_id: str,
    response_id: str,
    reason: str,
    clinician_id: str
):
    """
    Clinician override: invalidate a response.
    
    Marks a response as invalid and recalculates θ.
    """
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Find and invalidate response
    response_found = False
    for response in session.responses:
        if response.id == response_id:
            response.is_invalidated = True
            response.invalidation_reason = reason
            response.invalidated_by = clinician_id
            response_found = True
            break
    
    if not response_found:
        raise HTTPException(status_code=404, detail="Response not found")
    
    # Recalculate θ excluding invalidated responses
    irt_engine = get_irt_engine()
    valid_responses = [r for r in session.responses if not r.is_invalidated]
    session.theta_estimates = irt_engine.update_theta_eap(
        valid_responses,
        [r.item_id for r in valid_responses]
    )
    
    _sessions[session_id] = session
    
    return {"success": True, "new_theta": session.theta_estimates}
