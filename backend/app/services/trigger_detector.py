"""
Adaptive Trigger Detector for Manshaan Platform.

Detects when a patient needs adaptive question generation based on:
- Voice responses containing confusion keywords
- Hume emotion detection (confusion, uncertainty)
- Drawing quality analysis
- Help button presses
"""

from typing import Optional, Union
import logging
import re

from ..models.irt import Domain, ItemType

logger = logging.getLogger(__name__)


# Keywords that indicate confusion/difficulty
CONFUSION_KEYWORDS = [
    "don't know", "dont know", "i don't know", "i dont know",
    "don't understand", "dont understand", "i don't understand",
    "confused", "i'm confused", "im confused",
    "what", "what?", "huh", "huh?",
    "too hard", "this is hard", "this is too hard",
    "i can't", "i cant", "can't do this",
    "help", "need help", "help me",
    "skip", "skip this",
]

# Keywords for "too easy" detection
TOO_EASY_KEYWORDS = [
    "too easy", "this is easy", "boring", "simple",
]


class AdaptiveTriggerDetector:
    """Detects when patient needs an easier question or accommodation."""
    
    def __init__(self):
        """Initialize detector."""
        pass
    
    async def should_trigger_adaptation(
        self,
        item_type: ItemType,
        response: Union[str, int, None],
        hume_emotions: Optional[dict] = None,
        help_button_pressed: bool = False,
        drawing_analysis: Optional[dict] = None,
        response_time_ms: Optional[int] = None,  # Kept for compatibility but not used
        item_difficulty: float = 0.0
    ) -> dict:
        """
        Determine if adaptive question generation should be triggered.
        
        Args:
            item_type: Type of the current item (mcq, voice, drawing)
            response: The patient's response
            hume_emotions: Emotion data from Hume AI
            help_button_pressed: Whether help button was clicked
            drawing_analysis: GPT-4 Vision analysis of drawing
            response_time_ms: Not used for triggering (kept for compatibility)
            item_difficulty: Current item's difficulty (b parameter)
            
        Returns:
            Dict with trigger decision and metadata
        """
        triggers = []
        
        # 1. Help button is always a trigger
        if help_button_pressed:
            triggers.append({
                "source": "help_button",
                "confidence": 1.0,
                "reason": "Patient pressed help button"
            })
        
        # 2. Check text/voice response for confusion keywords
        if isinstance(response, str) and response.strip():
            text_trigger = self._check_text_for_confusion(response)
            if text_trigger:
                triggers.append(text_trigger)
        
        # 3. Check Hume emotions
        if hume_emotions:
            hume_trigger = self._check_hume_emotions(hume_emotions)
            if hume_trigger:
                triggers.append(hume_trigger)
        
        # 4. Check drawing quality (for drawing items)
        if item_type == ItemType.DRAWING and drawing_analysis:
            drawing_trigger = self._check_drawing_quality(drawing_analysis)
            if drawing_trigger:
                triggers.append(drawing_trigger)
        
        # Determine if we should adapt
        should_adapt = len(triggers) > 0
        primary_trigger = triggers[0] if triggers else None
        
        return {
            "should_adapt": should_adapt,
            "triggers": triggers,
            "primary_trigger": primary_trigger,
            "trigger_count": len(triggers),
            "reason": primary_trigger["reason"] if primary_trigger else None,
            "source": primary_trigger["source"] if primary_trigger else None
        }
    
    def _check_text_for_confusion(self, text: str) -> Optional[dict]:
        """Check text response for confusion keywords."""
        text_lower = text.lower().strip()
        
        for keyword in CONFUSION_KEYWORDS:
            if keyword in text_lower:
                return {
                    "source": "voice_text",
                    "confidence": 0.9,
                    "reason": f"Patient indicated difficulty: '{keyword}'",
                    "keyword_matched": keyword
                }
        
        return None
    
    def _check_hume_emotions(self, emotions: dict) -> Optional[dict]:
        """Check Hume emotion data for confusion indicators."""
        confusion = emotions.get("confusion", 0)
        uncertainty = emotions.get("uncertainty", 0)
        distress = emotions.get("distress", 0)
        anxiety = emotions.get("anxiety", 0)
        
        # Threshold for triggering
        if confusion > 0.6:
            return {
                "source": "hume_emotion",
                "confidence": confusion,
                "reason": f"Hume detected confusion ({confusion:.0%})",
                "emotion": "confusion"
            }
        
        if uncertainty > 0.6:
            return {
                "source": "hume_emotion",
                "confidence": uncertainty,
                "reason": f"Hume detected uncertainty ({uncertainty:.0%})",
                "emotion": "uncertainty"
            }
        
        if distress > 0.7:
            return {
                "source": "hume_emotion",
                "confidence": distress,
                "reason": f"Hume detected distress ({distress:.0%})",
                "emotion": "distress"
            }
        
        return None
    
    def _check_drawing_quality(self, analysis: dict) -> Optional[dict]:
        """Check GPT-4 Vision drawing analysis for poor quality."""
        is_readable = analysis.get("is_readable", True)
        confidence = analysis.get("confidence", 1.0)
        
        if not is_readable:
            return {
                "source": "drawing_quality",
                "confidence": 1.0 - confidence,
                "reason": "Drawing was unreadable or incomplete"
            }
        
        if confidence < 0.3:
            return {
                "source": "drawing_quality",
                "confidence": 1.0 - confidence,
                "reason": f"Drawing quality very low (confidence: {confidence:.0%})"
            }
        
        return None
    
    def _check_response_time(
        self,
        response_time_ms: int,
        item_difficulty: float,
        item_type: ItemType
    ) -> Optional[dict]:
        """Check if response time indicates guessing or struggling."""
        # Very fast response on hard item = probably guessing
        if item_difficulty > 0.5 and response_time_ms < 2000:
            return {
                "source": "response_time",
                "confidence": 0.7,
                "reason": "Very fast response on difficult item (possible guessing)"
            }
        
        # Very slow response = struggling (but not for drawing/voice)
        if item_type == ItemType.MCQ and response_time_ms > 60000:
            return {
                "source": "response_time",
                "confidence": 0.6,
                "reason": "Very slow response (possible difficulty)"
            }
        
        return None


# Singleton instance
_detector: Optional[AdaptiveTriggerDetector] = None


def get_trigger_detector() -> AdaptiveTriggerDetector:
    """Get or create trigger detector singleton."""
    global _detector
    if _detector is None:
        _detector = AdaptiveTriggerDetector()
    return _detector
