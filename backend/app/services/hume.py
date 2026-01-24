"""
Hume AI Emotion Data Processing Service.

Processes emotion metadata from Hume EVI (Empathic Voice Interface)
for clinical data enrichment.
"""

import logging
from datetime import datetime
from typing import Optional
from collections import defaultdict

from ..models.emotion import EmotionData, EmotionTimeline, EmotionTimelinePoint

logger = logging.getLogger(__name__)


class HumeService:
    """
    Service for processing Hume AI emotion data.
    
    Aggregates emotion measurements from the frontend into
    timeline data for clinical visualization.
    """
    
    def __init__(self):
        """Initialize emotion storage."""
        # In-memory storage (replace with database in production)
        self._emotion_data: dict[str, list[EmotionData]] = defaultdict(list)
    
    def record_emotion(
        self,
        session_id: str,
        timestamp: datetime,
        emotions: dict[str, float],
        item_id: Optional[str] = None
    ) -> bool:
        """
        Record emotion data point from Hume EVI.
        
        Args:
            session_id: Assessment session ID
            timestamp: When the measurement was taken
            emotions: Dict of emotion name to intensity (0-1)
            item_id: Optional current item being presented
            
        Returns:
            True if recorded successfully
        """
        try:
            data = EmotionData(
                session_id=session_id,
                timestamp=timestamp,
                anxiety=emotions.get("anxiety", 0.0),
                calm=emotions.get("calm", 0.0),
                distress=emotions.get("distress", 0.0),
                confusion=emotions.get("confusion"),
                concentration=emotions.get("concentration"),
                interest=emotions.get("interest"),
                item_id=item_id
            )
            
            self._emotion_data[session_id].append(data)
            logger.debug(f"Recorded emotion for session {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error recording emotion: {e}")
            return False
    
    def get_timeline(self, session_id: str) -> EmotionTimeline:
        """
        Get emotion timeline for a session.
        
        Args:
            session_id: Assessment session ID
            
        Returns:
            EmotionTimeline with all data points and aggregates
        """
        data_points = self._emotion_data.get(session_id, [])
        
        if not data_points:
            return EmotionTimeline(session_id=session_id, timeline=[])
        
        # Convert to timeline points
        timeline = [
            EmotionTimelinePoint(
                timestamp=d.timestamp,
                anxiety=d.anxiety,
                calm=d.calm,
                distress=d.distress,
                item_id=d.item_id
            )
            for d in sorted(data_points, key=lambda x: x.timestamp)
        ]
        
        # Calculate aggregates
        avg_anxiety = sum(d.anxiety for d in data_points) / len(data_points)
        avg_calm = sum(d.calm for d in data_points) / len(data_points)
        avg_distress = sum(d.distress for d in data_points) / len(data_points)
        
        # Find peak anxiety item
        peak_anxiety_point = max(data_points, key=lambda x: x.anxiety)
        peak_anxiety_item = peak_anxiety_point.item_id
        
        # Calculate emotional resilience score (0-100)
        # Higher calm, lower anxiety/distress = higher resilience
        resilience = self._calculate_resilience(data_points)
        
        return EmotionTimeline(
            session_id=session_id,
            timeline=timeline,
            avg_anxiety=avg_anxiety,
            avg_calm=avg_calm,
            avg_distress=avg_distress,
            peak_anxiety_item=peak_anxiety_item,
            emotional_resilience_score=resilience
        )
    
    def _calculate_resilience(self, data_points: list[EmotionData]) -> float:
        """
        Calculate emotional resilience score (0-100).
        
        Formula:
        - Base score from average calm level
        - Penalize for sustained high anxiety/distress
        - Bonus for emotional recovery patterns
        """
        if not data_points:
            return 50.0  # Default neutral
        
        # Average calm contributes positively
        avg_calm = sum(d.calm for d in data_points) / len(data_points)
        
        # Average anxiety/distress contribute negatively
        avg_negative = sum(
            (d.anxiety + d.distress) / 2 
            for d in data_points
        ) / len(data_points)
        
        # Base resilience: high calm, low negative
        base_score = (avg_calm * 50) + ((1 - avg_negative) * 50)
        
        # Look for recovery patterns (anxiety spike followed by calm increase)
        recovery_bonus = self._detect_recovery_patterns(data_points)
        
        # Clamp to 0-100
        final_score = min(100, max(0, base_score + recovery_bonus))
        
        return round(final_score, 1)
    
    def _detect_recovery_patterns(self, data_points: list[EmotionData]) -> float:
        """
        Detect emotional recovery patterns for resilience bonus.
        
        Recovery = anxiety spike followed by calm increase within 30 seconds.
        """
        if len(data_points) < 3:
            return 0.0
        
        sorted_points = sorted(data_points, key=lambda x: x.timestamp)
        recovery_count = 0
        
        for i in range(1, len(sorted_points) - 1):
            prev = sorted_points[i-1]
            curr = sorted_points[i]
            next_p = sorted_points[i+1]
            
            # Detect spike: anxiety increased significantly
            if curr.anxiety > prev.anxiety + 0.2:
                # Check if followed by calm increase
                if next_p.calm > curr.calm + 0.1:
                    recovery_count += 1
        
        # Each recovery pattern adds small bonus (max 15 points)
        return min(15, recovery_count * 5)
    
    def clear_session(self, session_id: str) -> None:
        """Clear emotion data for a session."""
        if session_id in self._emotion_data:
            del self._emotion_data[session_id]


# Singleton instance
_hume_service: Optional[HumeService] = None


def get_hume_service() -> HumeService:
    """Get or create Hume service singleton."""
    global _hume_service
    if _hume_service is None:
        _hume_service = HumeService()
    return _hume_service
