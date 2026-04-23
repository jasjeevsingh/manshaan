"""
Drawing analysis via OpenRouter (vision-capable chat completions).

Uses clinical benchmark framing (e.g. Beery-Buktenica VMI) in prompts.
Model is set by LLM_VISION_MODEL.
"""

import base64
import logging
from typing import Optional

from openai import AsyncOpenAI

from ..config import get_settings
from ..models.assessment import ClinicalMarker
from .openrouter_client import get_openrouter_client

logger = logging.getLogger(__name__)


class VisionService:
    """
    Multimodal chat (OpenRouter) for drawing analysis.

    Analyzes sketches based on clinical markers from:
    - Beery-Buktenica VMI (Visual-Motor Integration)
    - Clock Drawing Test
    - Figure Copy Tasks
    """
    
    def __init__(self):
        """Initialize OpenRouter client for vision-capable chat completions."""
        settings = get_settings()
        if not settings.openrouter_api_key:
            self.client: Optional[AsyncOpenAI] = None
        else:
            self.client = get_openrouter_client(settings)
        self.model = settings.llm_vision_model
    
    async def analyze_drawing(
        self,
        image_base64: str,
        task_type: str,
        expected_elements: Optional[list[str]] = None
    ) -> dict:
        """
        Analyze a drawing submission using the configured vision model.
        
        Args:
            image_base64: Base64 encoded image data
            task_type: Type of drawing task (clock, figure_copy, free_draw)
            expected_elements: Optional list of elements to look for
            
        Returns:
            Analysis result with clinical markers and confidence
        """
        if not self.client:
            return self._graceful_fallback("OPENROUTER_API_KEY is not configured")

        try:
            # Build task-specific prompt
            prompt = self._build_analysis_prompt(task_type, expected_elements)

            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": self._get_system_prompt()
                    },
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{image_base64}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=1000,
                temperature=0.3  # Lower for more consistent clinical analysis
            )
            
            raw_response = response.choices[0].message.content
            
            # Parse response into structured format
            result = self._parse_analysis_response(raw_response, task_type)
            result["raw_response"] = raw_response
            
            return result
            
        except Exception as e:
            logger.error(f"Vision analysis error: {e}")
            return self._graceful_fallback(str(e))
    
    def _get_system_prompt(self) -> str:
        """Get system prompt for clinical drawing analysis."""
        return """You are a clinical assessment specialist analyzing drawings 
for neurodevelopmental screening. Your analysis should be:

1. OBJECTIVE: Focus on observable features, not artistic quality
2. CLINICAL: Use Beery-Buktenica VMI criteria where applicable
3. STRUCTURED: Rate specific elements on a scale

For Clock Drawing Tests, evaluate:
- Circle closure and symmetry
- Number placement (12, 3, 6, 9 anchor points)
- Number sequence and spacing
- Hand length and positioning
- Overall organization

For Figure Copy tasks, evaluate:
- Shape accuracy
- Proportions
- Spatial relationships
- Line quality
- Integration of elements

Provide confidence levels (0.0-1.0) for your assessments.
Flag as "unreadable" if the image cannot be analyzed."""

    def _build_analysis_prompt(
        self,
        task_type: str,
        expected_elements: Optional[list[str]] = None
    ) -> str:
        """Build task-specific analysis prompt."""
        base_prompts = {
            "clock": """Analyze this clock drawing for clinical markers.
                
Evaluate:
1. Circle: Is it closed? Relatively round?
2. Numbers: Are all 12 present? Correctly placed?
3. Hands: Are there two hands? Correct lengths?
4. Time: If specified, is the time correctly shown?

Rate each element and provide overall VMI-equivalent score.""",

            "figure_copy": """Analyze this figure copy attempt.
                
Evaluate against Beery-Buktenica VMI criteria:
1. Shape accuracy (0-1)
2. Proportions preserved (0-1)
3. Spatial relationships (0-1)
4. Line quality/motor control (0-1)
5. Integration of multiple elements (0-1)

Provide specific observations and age-equivalent estimate if possible.""",

            "free_draw": """Analyze this free drawing for developmental markers.
                
Observe:
1. Motor control / line quality
2. Spatial organization
3. Level of detail
4. Symbolic representation maturity

Note any concerning or notable features."""
        }
        
        prompt = base_prompts.get(task_type, base_prompts["free_draw"])
        
        if expected_elements:
            prompt += f"\n\nExpected elements to find: {', '.join(expected_elements)}"
        
        return prompt
    
    def _parse_analysis_response(
        self,
        raw_response: str,
        task_type: str
    ) -> dict:
        """Parse vision model response into structured format."""
        # Default structure
        result = {
            "analysis": raw_response,
            "confidence": 0.7,  # Default moderate confidence
            "clinical_markers": [],
            "task_type": task_type,
            "is_readable": True
        }
        
        # Check for unreadable flag
        if "unreadable" in raw_response.lower() or "cannot analyze" in raw_response.lower():
            result["is_readable"] = False
            result["confidence"] = 0.0
            return result
        
        # Extract clinical markers based on task type
        if task_type == "clock":
            result["clinical_markers"] = [
                ClinicalMarker(
                    name="clock_circle_quality",
                    value=self._extract_rating(raw_response, "circle"),
                    significance="typical",
                    evidence_source="drawing"
                ),
                ClinicalMarker(
                    name="clock_number_placement",
                    value=self._extract_rating(raw_response, "number"),
                    significance="typical",
                    evidence_source="drawing"
                ),
                ClinicalMarker(
                    name="clock_hand_accuracy",
                    value=self._extract_rating(raw_response, "hand"),
                    significance="typical",
                    evidence_source="drawing"
                )
            ]
        elif task_type == "figure_copy":
            result["clinical_markers"] = [
                ClinicalMarker(
                    name="vmi_shape_accuracy",
                    value=self._extract_rating(raw_response, "accuracy"),
                    significance="typical",
                    evidence_source="drawing"
                ),
                ClinicalMarker(
                    name="vmi_motor_control",
                    value=self._extract_rating(raw_response, "motor"),
                    significance="typical",
                    evidence_source="drawing"
                )
            ]
        
        return result
    
    def _extract_rating(self, text: str, keyword: str) -> float:
        """Extract numeric rating from text near a keyword."""
        # Simple extraction - look for numbers near keyword
        import re
        
        # Find sentences containing the keyword
        lower_text = text.lower()
        if keyword.lower() in lower_text:
            # Look for decimal numbers
            numbers = re.findall(r'\b0?\.\d+|\b1\.0|\b[0-9](?:/10)?\b', text)
            for num_str in numbers:
                try:
                    if '/' in num_str:
                        return float(num_str.split('/')[0]) / 10
                    val = float(num_str)
                    if 0 <= val <= 1:
                        return val
                    elif 1 < val <= 10:
                        return val / 10
                except ValueError:
                    continue
        
        return 0.7  # Default moderate score
    
    def _graceful_fallback(self, error_msg: str) -> dict:
        """Return fallback result when analysis fails."""
        return {
            "analysis": "Unable to complete analysis. The image may be unclear or an error occurred.",
            "confidence": 0.0,
            "clinical_markers": [],
            "is_readable": False,
            "error": error_msg,
            "raw_response": f"Error: {error_msg}"
        }


# Singleton instance
_vision_service: Optional[VisionService] = None


def get_vision_service() -> VisionService:
    """Get or create vision service singleton."""
    global _vision_service
    if _vision_service is None:
        _vision_service = VisionService()
    return _vision_service
