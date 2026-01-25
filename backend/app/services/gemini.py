"""
Gemini Clinical Brain Service.

Uses Gemini API to act as the "Clinical Brain" for:
- Adaptive question generation
- IRT score interpretation
- Clinical Insight Report generation
- Differential insights (ASD vs ID markers)
"""

import logging
from typing import Optional
import google.generativeai as genai

from ..config import get_settings
from ..models.irt import Domain, DomainTheta, SessionState
from ..models.assessment import (
    DomainScore, DifferentialInsight, ClinicalInsightReport, ClinicalMarker
)
from ..models.emotion import EmotionTimeline

logger = logging.getLogger(__name__)


class GeminiService:
    """
    Gemini Clinical Brain for clinical interpretation and report generation.
    """
    
    def __init__(self):
        """Initialize Gemini client."""
        settings = get_settings()
        genai.configure(api_key=settings.google_api_key)
        # Use gemini-2.5-flash - strong for reasoning and analysis
        self.model = genai.GenerativeModel('gemini-2.5-flash')
    
    async def generate_adaptive_question(
        self,
        session_state: SessionState,
        target_domain: Optional[Domain] = None
    ) -> str:
        """
        Generate an adaptive follow-up question based on session state.
        
        Args:
            session_state: Current assessment state with theta estimates
            target_domain: Optional domain to target
            
        Returns:
            Follow-up question text
        """
        prompt = self._build_adaptive_prompt(session_state, target_domain)
        
        try:
            response = await self.model.generate_content_async(prompt)
            return response.text
        except Exception as e:
            logger.error(f"Gemini adaptive question error: {e}")
            return "Let's continue with the next question."
    
    def _build_adaptive_prompt(
        self,
        session_state: SessionState,
        target_domain: Optional[Domain]
    ) -> str:
        """Build prompt for adaptive question generation."""
        theta_summary = "\n".join([
            f"- {d.value}: θ = {t.theta:.2f} (SE = {t.standard_error:.2f})"
            for d, t in session_state.theta_estimates.items()
        ])
        
        domain_focus = f"Focus on {target_domain.value}" if target_domain else "Balance across domains"
        
        return f"""You are a clinical psychologist conducting a neurodevelopmental assessment.

Current ability estimates:
{theta_summary}

Items administered: {session_state.items_administered}
{domain_focus}

Generate a natural, age-appropriate follow-up question or prompt that:
1. Targets the domain(s) with highest uncertainty (SE)
2. Is calibrated to the estimated ability level
3. Feels conversational, not test-like
4. Would help differentiate ASD from ID patterns if relevant

Respond only with the question/prompt itself, no explanations."""
    
    async def interpret_scores(
        self,
        theta_estimates: dict[Domain, DomainTheta],
        clinical_markers: list[ClinicalMarker],
        emotion_data: Optional[EmotionTimeline] = None
    ) -> DifferentialInsight:
        """
        Generate clinical interpretation of scores with ASD/ID differential.
        
        Args:
            theta_estimates: Final theta estimates per domain
            clinical_markers: Markers from all modalities
            emotion_data: Optional emotion timeline from Hume
            
        Returns:
            DifferentialInsight with clinical interpretation
        """
        prompt = self._build_interpretation_prompt(
            theta_estimates, clinical_markers, emotion_data
        )
        
        try:
            response = await self.model.generate_content_async(prompt)
            return self._parse_differential_response(response.text)
        except Exception as e:
            logger.error(f"Gemini interpretation error: {e}")
            return self._default_differential()
    
    def _build_interpretation_prompt(
        self,
        theta_estimates: dict[Domain, DomainTheta],
        clinical_markers: list[ClinicalMarker],
        emotion_data: Optional[EmotionTimeline]
    ) -> str:
        """Build prompt for clinical score interpretation."""
        theta_text = "\n".join([
            f"- {d.value}: θ = {t.theta:.2f}, percentile = {t.percentile:.0f}, SE = {t.standard_error:.2f}"
            for d, t in theta_estimates.items()
        ])
        
        # Build multimodal evidence section
        markers_text = ""
        if clinical_markers:
            markers_text = "\n".join([
                f"- {m.name}: {m.value} ({m.significance}) [Source: {m.evidence_source}]"
                for m in clinical_markers
            ])
        else:
            markers_text = "No drawing analysis markers available for this session."
        
        # Build emotion data section with specific Hume AI citations
        emotion_text = ""
        if emotion_data and emotion_data.timeline:
            emotion_text = f"""
HUME AI Voice Paralinguistics Analysis:
- Average Anxiety Level: {emotion_data.avg_anxiety:.2%} (0-100% scale)
- Average Calm Level: {emotion_data.avg_calm:.2%}
- Average Distress Level: {emotion_data.avg_distress:.2%}
- Emotional Resilience Score: {emotion_data.emotional_resilience_score:.1f}/100
- Peak Anxiety Item: {emotion_data.peak_anxiety_item or 'N/A'}
- Data Points Collected: {len(emotion_data.timeline)}

Note: Hume AI analyzes voice paralinguistics (tone, pitch, prosody) to detect emotional states in real-time."""
        else:
            emotion_text = "\nHume AI Voice Analysis: No voice emotion data collected for this session."
        
        return f"""You are a clinical neuropsychologist analyzing assessment results for 
a neurodevelopmental screening. Generate a comprehensive differential insight report.

IMPORTANT: This is a Clinical Insight Report, NOT a diagnosis.

=== COGNITIVE DOMAIN SCORES (IRT θ scale, mean=0, SD=1) ===
{theta_text}

=== GPT-4 VISION DRAWING ANALYSIS ===
{markers_text}

{emotion_text}

=== ADMINISTRATION DETAILS ===
- Assessment administered via adaptive IRT algorithm
- CPT Code 96146 applicable (Psychological testing, automated)
- Session qualifies for reimbursement under automated psychological testing

Based on ALL available multimodal evidence, provide:

1. PRIMARY PATTERN: A 1-sentence summary of the overall cognitive profile

2. ASD INDICATORS: List patterns consistent with Autism Spectrum features:
   - Uneven cognitive profile (peaks and valleys)
   - Processing speed/executive function patterns
   - Social-emotional markers from Hume AI voice analysis (if available)
   - Drawing/visual-motor markers from GPT-4 Vision (if available)

3. ID INDICATORS: List patterns consistent with Intellectual Disability features:
   - Globally lowered scores
   - Consistent across domains
   - Processing speed proportional to other domains

4. DIFFERENTIAL CONFIDENCE: Rate 0.0-1.0 how confident the profile distinction is

5. CLINICAL NOTES: Brief observations incorporating multimodal evidence

6. EVIDENCE SUMMARY: List ALL key data points from:
   - IRT cognitive scores
   - Hume AI voice emotion analysis (cite specific findings)
   - GPT-4 Vision drawing analysis (cite specific findings)

7. RECOMMENDED NEXT STEPS: Provide 3-5 actionable recommendations such as:
   - Specific specialist referrals (e.g., Speech-Language Pathologist, Occupational Therapist)
   - IEP/504 accommodation suggestions
   - Follow-up testing recommendations
   - Home/school intervention strategies

Format your response with clear section headers."""
    
    def _parse_differential_response(self, text: str) -> DifferentialInsight:
        """Parse Gemini response into DifferentialInsight."""
        import re
        
        # More flexible section extraction - handle Gemini's markdown format
        sections = {}
        current_section = ""
        current_content = []
        
        for line in text.split("\n"):
            stripped = line.strip()
            # Match headers like "**1. PRIMARY PATTERN:**", "### 1. PRIMARY PATTERN:", etc.
            # Also match plain headers like "PRIMARY PATTERN:" or "1. PRIMARY PATTERN:"
            header_match = re.match(r'^\*?\*?#{0,4}\s*(\d*\.?\s*[A-Z][A-Z\s]+)[:*]*$', stripped, re.IGNORECASE)
            if header_match or (stripped.endswith(":") and len(stripped) < 50 and stripped.isupper()):
                # Save previous section
                if current_section and current_content:
                    sections[current_section] = "\n".join(current_content)
                # Start new section
                if header_match:
                    current_section = header_match.group(1).strip().lower()
                    # Remove numbering like "1. " from section name
                    current_section = re.sub(r'^\d+\.\s*', '', current_section)
                else:
                    current_section = stripped.rstrip(":").strip().lower()
                current_content = []
            else:
                current_content.append(line)
        
        # Save last section
        if current_section and current_content:
            sections[current_section] = "\n".join(current_content)
        
        # Log extracted sections for debugging
        logger.info(f"Parsed sections: {list(sections.keys())}")
        
        # Extract primary pattern - try multiple possible keys
        primary = (
            sections.get("primary pattern") or 
            sections.get("1. primary pattern") or
            sections.get("primary_pattern") or
            "Profile analysis pending"
        ).strip()
        
        # Extract ASD indicators - handle * and - bullet points
        asd_text = (
            sections.get("asd indicators") or 
            sections.get("2. asd indicators") or
            ""
        )
        asd_indicators = [
            line.lstrip("*- •").strip() 
            for line in asd_text.split("\n") 
            if line.strip().startswith(("*", "-", "•")) and len(line.strip()) > 2
        ]
        
        # Extract ID indicators
        id_text = (
            sections.get("id indicators") or 
            sections.get("3. id indicators") or
            ""
        )
        id_indicators = [
            line.lstrip("*- •").strip() 
            for line in id_text.split("\n") 
            if line.strip().startswith(("*", "-", "•")) and len(line.strip()) > 2
        ]
        
        # Extract confidence
        confidence = 0.5
        conf_text = (
            sections.get("differential confidence") or 
            sections.get("4. differential confidence") or
            "0.5"
        )
        conf_match = re.search(r'(\d\.?\d*)', conf_text)
        if conf_match:
            confidence = min(1.0, float(conf_match.group(1)))
        
        # Extract clinical notes
        clinical_notes = (
            sections.get("clinical notes") or 
            sections.get("5. clinical notes") or
            ""
        ).strip()
        
        # Evidence summary - use full text if section not found
        evidence = (
            sections.get("evidence summary") or 
            sections.get("6. evidence summary") or
            text  # Use full response as evidence
        ).strip()
        
        # Extract recommendations (new section 7)
        rec_text = (
            sections.get("recommended next steps") or 
            sections.get("7. recommended next steps") or
            sections.get("recommendations") or
            ""
        )
        recommendations = [
            line.lstrip("*- •1234567890.").strip() 
            for line in rec_text.split("\n") 
            if line.strip().startswith(("*", "-", "•", "1", "2", "3", "4", "5")) and len(line.strip()) > 5
        ]
        
        return DifferentialInsight(
            primary_pattern=primary if primary else "Profile analysis pending",
            asd_indicators=asd_indicators if asd_indicators else ["Insufficient data for ASD indicators"],
            id_indicators=id_indicators if id_indicators else ["Insufficient data for ID indicators"],
            differential_confidence=confidence,
            clinical_notes=clinical_notes,
            evidence_summary=evidence,
            recommendations=recommendations if recommendations else ["Complete full assessment for personalized recommendations"]
        )
    
    def _default_differential(self) -> DifferentialInsight:
        """Return default differential when analysis fails."""
        return DifferentialInsight(
            primary_pattern="Unable to generate clinical interpretation",
            asd_indicators=["Analysis unavailable"],
            id_indicators=["Analysis unavailable"],
            differential_confidence=0.0,
            clinical_notes="An error occurred during interpretation. Please review raw data.",
            evidence_summary="Error in Gemini API call",
            recommendations=["Retry assessment or consult support"]
        )
    
    async def generate_clinical_report(
        self,
        session_state: SessionState,
        clinical_markers: list[ClinicalMarker],
        emotion_data: Optional[EmotionTimeline] = None
    ) -> ClinicalInsightReport:
        """
        Generate complete Clinical Insight Report.
        
        Args:
            session_state: Final session state with all responses
            clinical_markers: Markers from all modalities
            emotion_data: Optional emotion timeline
            
        Returns:
            Complete ClinicalInsightReport
        """
        # Convert theta estimates to domain scores
        domain_scores = []
        for domain, theta in session_state.theta_estimates.items():
            classification = self._classify_score(theta.theta)
            domain_scores.append(DomainScore(
                domain=domain,
                theta=theta.theta,
                standard_error=theta.standard_error,
                percentile=theta.percentile or 50.0,
                classification=classification,
                confidence_interval=theta.confidence_interval_95
            ))
        
        # Get differential insight
        differential = await self.interpret_scores(
            session_state.theta_estimates,
            clinical_markers,
            emotion_data
        )
        
        # Build IRT calculation log for evidence
        irt_log = self._build_irt_log(session_state)
        
        return ClinicalInsightReport(
            session_id=session_state.session_id,
            patient_id=session_state.patient_id,
            domain_scores=domain_scores,
            clinical_markers=clinical_markers,
            differential=differential,
            irt_calculation_log=irt_log
        )
    
    def _classify_score(self, theta: float) -> str:
        """Classify theta score into clinical category."""
        if theta < -1.5:
            return "Significantly Below Average"
        elif theta < -0.5:
            return "Below Average"
        elif theta < 0.5:
            return "Average"
        elif theta < 1.5:
            return "Above Average"
        else:
            return "Significantly Above Average"
    
    def _build_irt_log(self, session_state: SessionState) -> str:
        """Build IRT calculation log for evidence transparency."""
        lines = ["## IRT Calculation Log\n"]
        lines.append(f"Session ID: {session_state.session_id}")
        lines.append(f"Items Administered: {session_state.items_administered}")
        lines.append("\n### Final θ Estimates (EAP)")
        
        for domain, theta in session_state.theta_estimates.items():
            lines.append(f"- {domain.value}: θ = {theta.theta:.3f}, SE = {theta.standard_error:.3f}")
        
        lines.append("\n### Response Summary")
        correct = sum(1 for r in session_state.responses if r.is_correct)
        total = len([r for r in session_state.responses if r.is_correct is not None])
        if total > 0:
            lines.append(f"- Total items: {len(session_state.responses)}")
            lines.append(f"- Correct (MCQ): {correct}/{total} ({100*correct/total:.1f}%)")
        
        return "\n".join(lines)


# Singleton instance
_gemini_service: Optional[GeminiService] = None


def get_gemini_service() -> GeminiService:
    """Get or create Gemini service singleton."""
    global _gemini_service
    if _gemini_service is None:
        _gemini_service = GeminiService()
    return _gemini_service
