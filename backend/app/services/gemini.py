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
        target_domain: Domain,
        target_difficulty: float,
        patient_feedback: Optional[str] = None
    ) -> dict:
        """
        Generate an adaptive question based on IRT principles and patient feedback.
        
        Args:
            session_state: Current assessment state
            target_domain: Which domain to target
            target_difficulty: Desired difficulty (b parameter, -3 to +3)
            patient_feedback: Optional patient feedback (e.g., "too hard", "don't understand")
            
        Returns:
            Dict with generated item including estimated IRT parameters
        """
        prompt = self._build_adaptive_prompt(
            session_state, 
            target_domain, 
            target_difficulty,
            patient_feedback
        )
        
        try:
            response = await self.model.generate_content_async(prompt)
            
            # Parse the response to extract question and options
            item_data = self._parse_generated_item(
                response.text, 
                target_domain, 
                target_difficulty
            )
            return item_data
            
        except Exception as e:
            logger.error(f"Gemini adaptive question error: {e}")
            # Fallback to item bank
            return None
    
    def _build_adaptive_prompt(
        self,
        session_state: SessionState,
        target_domain: Domain,
        target_difficulty: float,
        patient_feedback: Optional[str] = None
    ) -> str:
        """Build prompt for adaptive question generation following IRT design principles."""
        
        # Get current theta for the target domain
        current_theta = session_state.theta_estimates.get(target_domain)
        theta_val = current_theta.theta if current_theta else 0.0
        se_val = current_theta.standard_error if current_theta else 1.0
        
        # Determine difficulty level description
        if target_difficulty < -1.0:
            difficulty_desc = "EASY - concrete, familiar concepts with single-step reasoning"
        elif target_difficulty < 0.5:
            difficulty_desc = "MODERATE - 2-3 step reasoning with moderate cognitive load"
        else:
            difficulty_desc = "CHALLENGING - multi-step reasoning, abstract thinking, or high working memory demands"
        
        # Domain-specific guidelines
        domain_guidelines = {
            Domain.EPISODIC_MEMORY: """
- For easy: immediate recall, recognition format, meaningful/semantic content
- For moderate: delayed recall, recognition with interference
- For hard: delayed free recall, multiple items, abstract content""",
            
            Domain.EXECUTIVE_FUNCTION: """
- For easy: concrete rules, simple patterns, familiar sequences
- For moderate: syllogistic reasoning, rule application, pattern recognition
- For hard: rule switching, abstract reasoning, novel problem-solving""",
            
            Domain.WORKING_MEMORY: """
- For easy: 3-4 items, forward span, no manipulation
- For moderate: 4-5 items, backward span, simple manipulation
- For hard: 6+ items, complex manipulation (e.g., add/sort), dual-task""",
            
            Domain.PROCESSING_SPEED: """
- For easy: overlearned facts (2+2), simple decisions, generous time
- For moderate: basic arithmetic (7+5), pattern matching, moderate time pressure
- For hard: mental calculation (15-8), rapid decision-making, tight time limits""",
            
            Domain.VISUOSPATIAL: """
- For easy: simple shapes (circle, square), copying tasks
- For moderate: complex shapes, spatial relationships, simple mental rotation
- For hard: overlapping figures, 3D rotation, abstract geometric patterns"""
        }
        
        # Handle patient feedback
        feedback_context = ""
        if patient_feedback:
            feedback_lower = patient_feedback.lower()
            if any(word in feedback_lower for word in ["hard", "difficult", "don't understand", "confused"]):
                feedback_context = f"""
IMPORTANT: The patient indicated difficulty with the previous question: "{patient_feedback}"
- Make this question SIMPLER and CLEARER
- Use more concrete language
- Break down complex concepts
- Provide more context/scaffolding"""
            elif any(word in feedback_lower for word in ["easy", "simple", "boring"]):
                feedback_context = f"""
The patient found the previous question too easy: "{patient_feedback}"
- Increase complexity appropriately
- Add more cognitive demands"""
        
        return f"""You are a clinical neuropsychologist creating an adaptive assessment item.

CURRENT ASSESSMENT STATE:
- Domain to assess: {target_domain.value.replace('_', ' ').title()}
- Current ability estimate (θ): {theta_val:.2f} (SE: {se_val:.2f})
- Target difficulty (b): {target_difficulty:.2f} ({difficulty_desc})
- Items administered: {session_state.items_administered}
{feedback_context}

DOMAIN-SPECIFIC DESIGN PRINCIPLES:
{domain_guidelines.get(target_domain, "")}

IRT DESIGN REQUIREMENTS:
1. The question should have difficulty b ≈ {target_difficulty:.2f}
2. High discrimination (clear correct answer, unambiguous)
3. Appropriate for neurodevelopmental assessment (ages 6-adult)
4. Natural, conversational tone (not test-like)
5. Culturally neutral and accessible

RESPONSE FORMAT:
Generate a multiple-choice question with exactly 4 options.
Format your response EXACTLY as follows:

QUESTION: [Your question text here]
A) [First option]
B) [Second option]
C) [Third option]
D) [Fourth option]
CORRECT: [A, B, C, or D]
RATIONALE: [Brief explanation of why this measures {target_domain.value} at difficulty {target_difficulty:.2f}]

Generate the question now:"""
    
    def _parse_generated_item(
        self,
        response_text: str,
        target_domain: Domain,
        target_difficulty: float
    ) -> dict:
        """Parse Gemini's response into an IRTItem-compatible dict."""
        import re
        import uuid
        
        # Extract question
        question_match = re.search(r'QUESTION:\s*(.+?)(?=\n[A-D]\))', response_text, re.DOTALL)
        question = question_match.group(1).strip() if question_match else "Generated question parsing failed"
        
        # Extract options
        options = []
        for letter in ['A', 'B', 'C', 'D']:
            option_match = re.search(rf'{letter}\)\s*(.+?)(?=\n[A-D]\)|CORRECT:|$)', response_text, re.DOTALL)
            if option_match:
                options.append(option_match.group(1).strip())
        
        # Extract correct answer
        correct_match = re.search(r'CORRECT:\s*([A-D])', response_text)
        correct_letter = correct_match.group(1) if correct_match else 'A'
        correct_index = ord(correct_letter) - ord('A')
        
        # Estimate IRT parameters based on design principles
        # Discrimination: assume high for well-designed questions
        discrimination = 1.4
        
        # Guessing: 4 options = 0.25, but adjust if options are poor quality
        guessing = 0.25
        
        # Generate unique ID
        item_id = f"GEN_{target_domain.value[:2].upper()}_{uuid.uuid4().hex[:6]}"
        
        return {
            "id": item_id,
            "prompt": question,
            "item_type": "mcq",
            "domain_loadings": {
                target_domain: discrimination
            },
            "difficulty": target_difficulty,
            "guessing": guessing,
            "options": options if len(options) == 4 else ["Option A", "Option B", "Option C", "Option D"],
            "correct_answer": correct_index,
            "is_generated": True,  # Flag to indicate this is LLM-generated
            "generation_metadata": {
                "model": "gemini-2.5-flash",
                "target_difficulty": target_difficulty,
                "estimated_parameters": True
            }
        }
    
    async def detect_patient_frustration(
        self,
        patient_response: str,
        response_time_ms: int,
        item_difficulty: float
    ) -> dict:
        """
        Detect if patient is frustrated or struggling based on their response.
        
        Returns dict with:
        - is_frustrated: bool
        - suggested_difficulty_adjustment: float (how much to adjust b)
        - reason: str
        """
        prompt = f"""Analyze this patient response during a cognitive assessment:

Response: "{patient_response}"
Response time: {response_time_ms}ms
Item difficulty: {item_difficulty:.2f}

Determine if the patient is:
1. Frustrated or confused
2. Finding it too easy
3. Engaged appropriately

Look for indicators:
- Explicit statements: "too hard", "don't understand", "I don't know"
- Confusion markers: "what?", "huh?", "I'm not sure what you mean"
- Frustration: "this is stupid", "I can't do this"
- Boredom: "too easy", "this is simple"
- Very fast responses to hard questions (guessing)
- Very slow responses (struggling)

Respond in this format:
STATUS: [FRUSTRATED | TOO_EASY | APPROPRIATE]
ADJUSTMENT: [number between -2.0 and +2.0, negative = make easier, positive = make harder]
REASON: [brief explanation]"""

        try:
            response = await self.model.generate_content_async(prompt)
            text = response.text
            
            # Parse response
            import re
            status_match = re.search(r'STATUS:\s*(FRUSTRATED|TOO_EASY|APPROPRIATE)', text)
            adjustment_match = re.search(r'ADJUSTMENT:\s*([-+]?\d+\.?\d*)', text)
            reason_match = re.search(r'REASON:\s*(.+)', text)
            
            status = status_match.group(1) if status_match else "APPROPRIATE"
            adjustment = float(adjustment_match.group(1)) if adjustment_match else 0.0
            reason = reason_match.group(1).strip() if reason_match else "No clear indicators"
            
            return {
                "is_frustrated": status == "FRUSTRATED",
                "is_too_easy": status == "TOO_EASY",
                "suggested_difficulty_adjustment": adjustment,
                "reason": reason,
                "should_generate_adaptive": abs(adjustment) > 0.5
            }
            
        except Exception as e:
            logger.error(f"Frustration detection error: {e}")
            return {
                "is_frustrated": False,
                "is_too_easy": False,
                "suggested_difficulty_adjustment": 0.0,
                "reason": "Error in analysis",
                "should_generate_adaptive": False
            }
    
    async def generate_simplified_question(
        self,
        original_item: dict,
        domain: Domain,
        simplification_level: int,
        patient_issue: Optional[str] = None,
        session_accommodations: Optional[dict] = None
    ) -> dict:
        """
        Generate a simplified version of a question using Bloom's Taxonomy scaffolding.
        
        Args:
            original_item: The original item dict from item bank
            domain: The cognitive domain being assessed
            simplification_level: 1, 2, or 3 (progressively easier)
            patient_issue: What confused the patient (optional)
            session_accommodations: Any accessibility needs
            
        Returns:
            Dict with simplified item in item_bank.json format
        """
        original_prompt = original_item.get("prompt", "")
        original_type = original_item.get("item_type", "mcq")
        original_difficulty = original_item.get("difficulty", 0.0)
        
        # Determine new difficulty and format based on level
        level_config = {
            1: {"bloom": "Understand", "difficulty_delta": -0.5, "keep_format": True},
            2: {"bloom": "Remember", "difficulty_delta": -1.0, "keep_format": True},
            3: {"bloom": "Recognize", "difficulty_delta": -1.5, "keep_format": False}
        }
        
        config = level_config.get(simplification_level, level_config[1])
        new_difficulty = max(-2.5, original_difficulty + config["difficulty_delta"])
        
        # Domain-specific simplification strategies
        domain_strategies = {
            Domain.EPISODIC_MEMORY: {
                1: "Reduce number of items to remember, use more meaningful content",
                2: "Change to immediate recall, add context clues",
                3: "Convert to recognition format (pick from options)"
            },
            Domain.EXECUTIVE_FUNCTION: {
                1: "Use more concrete examples, simpler rules",
                2: "Provide step-by-step scaffolding, reduce steps",
                3: "Convert to categorization MCQ"
            },
            Domain.WORKING_MEMORY: {
                1: "Reduce sequence length by 1-2 items",
                2: "Change backward to forward span, or reduce further",
                3: "Convert to recognition (which sequence is correct?)"
            },
            Domain.PROCESSING_SPEED: {
                1: "Use simpler operations, extend time",
                2: "Use overlearned facts only",
                3: "Convert to simple recognition task"
            },
            Domain.VISUOSPATIAL: {
                1: "Reduce complexity of shapes, fewer elements",
                2: "Provide partial template or scaffold",
                3: "Convert to visual recognition MCQ"
            }
        }
        
        strategy = domain_strategies.get(domain, {}).get(
            simplification_level, 
            "Simplify while maintaining domain measurement"
        )
        
        
        
        # Handle format changes for level 3 or accommodations
        force_mcq = simplification_level == 3
        force_voice = False
        
        if session_accommodations:
            # Deaf/hearing impaired → force MCQ (text only, can't hear audio)
            if session_accommodations.get("text_only") and original_type == "voice":
                force_mcq = True
                force_voice = False
            # Dyslexia/visual impairment → force voice (audio only, can't read)
            elif session_accommodations.get("audio_only"):
                force_voice = True
                force_mcq = False  # Override MCQ if audio_only is set
            # Motor impairment → skip drawing, use MCQ instead
            elif session_accommodations.get("skip_drawing") and original_type == "drawing":
                force_mcq = True
        
        # Determine final item type
        if force_voice:
            target_type = "voice"
        elif force_mcq:
            target_type = "mcq"
        else:
            target_type = original_type
        
        prompt = f"""You are simplifying a cognitive assessment question.

ORIGINAL QUESTION:
Type: {original_type}
Domain: {domain.value.replace('_', ' ').title()}
Difficulty: {original_difficulty:.2f}
Prompt: "{original_prompt}"

SIMPLIFICATION LEVEL: {simplification_level} of 3
Bloom's Target: {config["bloom"]}
Target Difficulty: {new_difficulty:.2f}

PATIENT ISSUE: {patient_issue or "General difficulty with the question"}

DOMAIN-SPECIFIC STRATEGY:
{strategy}

ACCOMMODATIONS:
{"- FORCE VOICE FORMAT (patient has dyslexia/visual impairment - needs audio)" if force_voice else ""}
{"- FORCE MCQ FORMAT (patient needs visual options or can't draw)" if force_mcq else ""}

RULES:
- Level 1: Reduce cognitive load but keep same format ({original_type})
- Level 2: Minimal steps, add scaffolding, keep format if possible
- Level 3: Convert to MCQ recognition format
{f"- OVERRIDE: Use {target_type} format due to accommodation" if (force_voice or force_mcq) else ""}

Generate a simplified version. Output EXACTLY in this JSON format:

{{
  "prompt": "The simplified question text",
  "item_type": "{target_type}",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct_answer": 0,
  "difficulty": {new_difficulty:.2f},
  "instructions": "Any special instructions (for voice/drawing)",
  "rationale": "Brief explanation of why this is easier"
}}


IMPORTANT FORMATTING RULES:
- MCQ: Always include 4 options. Prompt should ask "Which option..." or "Select the..."
- Voice: Set options to null. Prompt should be open-ended. Instructions should say "Speak your answer aloud"
- Drawing: Set options to null. Instructions should describe what to draw
Generate the simplified question now:"""

        try:
            response = await self.model.generate_content_async(prompt)
            return self._parse_simplified_response(
                response.text,
                domain,
                simplification_level,
                original_item.get("id", "UNKNOWN")
            )
        except Exception as e:
            logger.error(f"Simplification error: {e}")
            return await self._fallback_simplification(original_item, simplification_level, domain, patient_issue)
    
    def _parse_simplified_response(
        self,
        response_text: str,
        domain: Domain,
        level: int,
        original_id: str
    ) -> dict:
        """Parse Gemini's simplified question response."""
        import json
        import re
        import uuid
        
        # Try to extract JSON from response
        json_match = re.search(r'\{[^{}]*\}', response_text, re.DOTALL)
        
        if json_match:
            try:
                parsed = json.loads(json_match.group())
                
                # Generate ID for simplified item
                item_id = f"SIMP_{original_id}_L{level}_{uuid.uuid4().hex[:4]}"
                
                return {
                    "id": item_id,
                    "prompt": parsed.get("prompt", "Simplified question"),
                    "item_type": parsed.get("item_type", "mcq"),
                    "domain_loadings": {domain: 1.2},
                    "difficulty": parsed.get("difficulty", -1.0),
                    "guessing": 0.25,
                    "options": parsed.get("options", ["A", "B", "C", "D"]),
                    "correct_answer": parsed.get("correct_answer", 0),
                    "instructions": parsed.get("instructions"),
                    "is_simplified": True,
                    "simplification_level": level,
                    "original_item_id": original_id
                }
            except json.JSONDecodeError:
                pass
        
        # Fallback if parsing fails - return simple dict
        import uuid
        return {
            "id": f"SIMP_{original_id}_L{level}_{uuid.uuid4().hex[:4]}",
            "prompt": "Can you tell me what you remember about this?",
            "item_type": "voice",
            "domain_loadings": {domain: 0.8},
            "difficulty": -1.5,
            "guessing": 0.1,
            "is_simplified": True,
            "simplification_level": level,
            "original_item_id": original_id,
            "instructions": "Just tell me anything you remember."
        }
    
    async def _fallback_simplification(
        self, 
        original_item: dict, 
        level: int,
        domain: Domain = Domain.EPISODIC_MEMORY,
        patient_issue: Optional[str] = None
    ) -> dict:
        """Fallback to GPT-4o when Gemini fails (rate limits, etc)."""
        import uuid
        from openai import AsyncOpenAI
        
        logger.warning(f"Gemini failed, falling back to GPT-4o for simplification")
        
        try:
            settings = get_settings()
            client = AsyncOpenAI(api_key=settings.openai_api_key)
            
            original_prompt = original_item.get("prompt", "")
            original_type = original_item.get("item_type", "mcq")
            original_difficulty = original_item.get("difficulty", 0.0)
            
            # Same simplification logic as Gemini
            level_config = {
                1: {"bloom": "Understand", "difficulty_delta": -0.5, "keep_format": True},
                2: {"bloom": "Remember", "difficulty_delta": -1.0, "keep_format": True},
                3: {"bloom": "Recognize", "difficulty_delta": -1.5, "keep_format": False}
            }
            
            config = level_config.get(level, level_config[1])
            new_difficulty = max(-2.5, original_difficulty + config["difficulty_delta"])
            force_mcq = level == 3
            
            prompt = f"""You are simplifying a cognitive assessment question.

ORIGINAL QUESTION:
Type: {original_type}
Domain: {domain.value.replace('_', ' ').title()}
Difficulty: {original_difficulty:.2f}
Prompt: "{original_prompt}"

SIMPLIFICATION LEVEL: {level} of 3
Bloom's Target: {config["bloom"]}
Target Difficulty: {new_difficulty:.2f}

PATIENT ISSUE: {patient_issue or "General difficulty with the question"}

RULES:
- Level 1: Reduce cognitive load but keep same format ({original_type})
- Level 2: Minimal steps, add scaffolding, keep format if possible
- Level 3: Convert to MCQ recognition format
{"- FORCE MCQ FORMAT (patient needs visual options)" if force_mcq else ""}

Generate a simplified version. Output EXACTLY in this JSON format:

{{
  "prompt": "The simplified question text",
  "item_type": "{"mcq" if force_mcq else original_type}",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct_answer": 0,
  "difficulty": {new_difficulty:.2f},
  "instructions": "Any special instructions (for voice/drawing)",
  "rationale": "Brief explanation of why this is easier"
}}

IMPORTANT: Always include 4 options for MCQ. For voice/drawing, options can be null.
Generate the simplified question now:"""

            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a clinical assessment expert who simplifies cognitive tests while maintaining validity."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                response_format={"type": "json_object"}
            )
            
            result_text = response.choices[0].message.content
            return self._parse_simplified_response(
                result_text,
                domain,
                level,
                original_item.get("id", "UNKNOWN")
            )
            
        except Exception as e:
            logger.error(f"GPT-4o fallback also failed: {e}")
            # Ultimate fallback - simple hardcoded question
            return {
                "id": f"SIMP_FALLBACK_{uuid.uuid4().hex[:6]}",
                "prompt": "Can you tell me what you DO remember about this?",
                "item_type": "voice",
                "domain_loadings": {domain: 0.8},
                "difficulty": -1.5,
                "guessing": 0.1,
                "is_simplified": True,
                "simplification_level": level,
                "original_item_id": original_item.get("id", "UNKNOWN"),
                "instructions": "Just tell me anything you remember."
            }
    
    async def detect_accommodation_needs(
        self,
        patient_message: str
    ) -> dict:
        """
        Parse patient/parent message for accessibility accommodation needs.
        
        Args:
            patient_message: The help message from patient/parent
            
        Returns:
            Dict with accommodation type and modality change needed
        """
        prompt = f"""Analyze this help message from a patient or parent during a cognitive assessment:

MESSAGE: "{patient_message}"

Determine if this indicates an ACCESSIBILITY NEED that requires changing how questions are presented.

Look for:
- Hearing impairment: deaf, hard of hearing, can't hear, hearing aids, cochlear implant → needs TEXT_ONLY
- Reading difficulty: dyslexia, can't read, trouble reading, illiterate, reading problems → needs AUDIO_ONLY
- Visual impairment: blind, can't see, low vision, visually impaired → needs AUDIO_ONLY
- Motor impairment: can't draw, hands shake, motor difficulties, cerebral palsy, fine motor → needs SKIP_DRAWING
- Language: needs translation, doesn't speak English well, ESL

NOTE: The message could be from a parent describing their child (e.g., "he's deaf", "she has dyslexia")

MODALITY MAPPINGS:
- text_only: For deaf/hearing impaired (can't hear audio, needs to READ)
- audio_only: For dyslexia/visual impairment (can't read, needs to HEAR)
- skip_drawing: For motor impairments (can't draw)
- large_text: For low vision (can read but needs larger text)

OUTPUT (JSON only, no explanation):
{{
  "accommodation_detected": true or false,
  "accommodation_type": "deaf" | "hard_of_hearing" | "dyslexia" | "visual_impairment" | "motor_impairement" | "language" | null,
  "modality_change": "text_only" | "audio_only" | "skip_drawing" | "large_text" | null,
  "applies_to_session": true or false,
  "reason": "brief explanation"
}}"""

        try:
            response = await self.model.generate_content_async(prompt)
            return self._parse_accommodation_response(response.text)
        except Exception as e:
            logger.error(f"Accommodation detection error: {e}")
            return {
                "accommodation_detected": False,
                "accommodation_type": None,
                "modality_change": None,
                "applies_to_session": False,
                "reason": "Error in analysis"
            }
    
    def _parse_accommodation_response(self, response_text: str) -> dict:
        """Parse Gemini's accommodation detection response."""
        import json
        import re
        
        json_match = re.search(r'\{[^{}]*\}', response_text, re.DOTALL)
        
        if json_match:
            try:
                parsed = json.loads(json_match.group())
                return {
                    "accommodation_detected": parsed.get("accommodation_detected", False),
                    "accommodation_type": parsed.get("accommodation_type"),
                    "modality_change": parsed.get("modality_change"),
                    "applies_to_session": parsed.get("applies_to_session", False),
                    "reason": parsed.get("reason", "")
                }
            except json.JSONDecodeError:
                pass
        
        return {
            "accommodation_detected": False,
            "accommodation_type": None,
            "modality_change": None,
            "applies_to_session": False,
            "reason": "Could not parse response"
        }

    
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
            formatted_markers = []
            for m in clinical_markers:
                # Handle both dict and object formats
                if isinstance(m, dict):
                    name = m.get('name', 'Unknown')
                    value = m.get('value', 'N/A')
                    significance = m.get('significance', 'N/A')
                    source = m.get('evidence_source', 'Unknown')
                else:
                    name = m.name
                    value = m.value
                    significance = m.significance
                    source = m.evidence_source
                formatted_markers.append(f"- {name}: {value} ({significance}) [Source: {source}]")
            markers_text = "\n".join(formatted_markers)
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

7. RECOMMENDED NEXT STEPS: 
   **CRITICAL DECISION RULE**: 
   - If ALL cognitive scores are AVERAGE OR ABOVE (θ ≥ -0.5, percentile ≥ 30%) AND no significant behavioral/emotional concerns from multimodal data:
     → Recommend: "No immediate clinical concerns. Continue monitoring development. Celebrate cognitive strengths."
   - If ANY score is BELOW AVERAGE (θ < -0.5, percentile < 30%) OR significant multimodal concerns exist:
     → Provide 3-5 specific actionable recommendations such as:
       * Specific specialist referrals (e.g., Speech-Language Pathologist, Occupational Therapist, Developmental Pediatrician)
       * IEP/504 accommodation suggestions
       * Follow-up comprehensive neuropsychological evaluation
       * Home/school intervention strategies
   
   **DO NOT recommend professional evaluation for individuals with average or above-average scores across all domains unless there are specific behavioral/emotional concerns from voice or drawing analysis.**

FORMATTING RULES:
- Do NOT use markdown bolding (**) for list item keys. correct: "- Key: Value". incorrect: "- **Key:** Value".
- Section headers must be on their own line.
- Confidence score must be on its own line under the header.

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
            line.lstrip("*- •").replace("**", "").strip() 
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
            line.lstrip("*- •").replace("**", "").strip() 
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
