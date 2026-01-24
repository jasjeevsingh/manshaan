# Manshaan Platform - TODO & API Contract

## Overview
Multimodal diagnostic platform for Neurodevelopmental Disorders (Autism & ID) with IRT-based adaptive testing.

---

## API Contract (FastAPI ↔ React)

### Authentication
```
POST /api/auth/register
  Request:  { email: string, password: string, role: "parent"|"clinician", name: string }
  Response: { user_id: string, token: string }

POST /api/auth/login
  Request:  { email: string, password: string }
  Response: { token: string, user: User }
```

### Assessment
```
POST /api/assessment/start
  Request:  { patient_id: string, clinician_id?: string }
  Response: { session_id: string, first_item: IRTItem }

POST /api/assessment/respond
  Request:  { session_id: string, item_id: string, response: any, response_time_ms: number }
  Response: { 
    theta_estimates: { [domain: string]: { theta: number, se: number } },
    next_item: IRTItem | null,
    session_status: "in_progress" | "complete"
  }

GET /api/assessment/{session_id}
  Response: { session: SessionData }

GET /api/assessment/{session_id}/results
  Response: {
    domain_scores: DomainScore[],
    evidence: Evidence[],
    differential: DifferentialInsight
  }
```

### Vision Analysis
```
POST /api/analyze-vision
  Request:  { image_base64: string, task_type: "clock"|"figure_copy"|"free_draw" }
  Response: { 
    analysis: string,
    confidence: number,
    clinical_markers: ClinicalMarker[],
    raw_response: string  // For evidence transparency
  }
```

### Emotion Recording
```
POST /api/emotion/record
  Request:  { session_id: string, timestamp: string, emotions: { anxiety: number, calm: number, distress: number } }
  Response: { recorded: true }

GET /api/emotion/{session_id}/timeline
  Response: { timeline: EmotionDataPoint[] }
```

---

## Implementation TODO

### Phase 1: Backend Foundation
- [ ] Initialize FastAPI project with dependencies
- [ ] Create Pydantic models (User, Assessment, IRT, Emotion)
- [ ] Implement IRT 3PL ScoringService
- [ ] Create item_bank.json with sample items
- [ ] Build assessment router endpoints
- [ ] Build vision analysis endpoint (GPT-4o)
- [ ] Build Gemini clinical brain service
- [ ] Write pytest for IRT math validation

### Phase 2: Frontend Foundation  
- [ ] Initialize Vite + React + TypeScript
- [ ] Configure Tailwind CSS
- [ ] Set up React Router for navigation
- [ ] Create Zustand assessment store
- [ ] Build base layout and navigation

### Phase 3: Multimodal Components
- [ ] Integrate @humeai/voice-react SDK
- [ ] Build VoiceModal with emotion capture
- [ ] Create DrawingCanvas with react-canvas-draw
- [ ] Connect canvas to vision analysis API

### Phase 4: Clinical Dashboard
- [ ] Build DomainScores radar chart (Recharts)
- [ ] Build EmotionTimeline line chart
- [ ] Create EvidenceDropdown component
- [ ] Build DifferentialInsight summary

### Phase 5: Compliance
- [ ] Add AIDisclaimer component (AB 3030)
- [ ] Add "Show Evidence" to all AI outputs
- [ ] Implement clinician review workflow

---

## IRT 3PL Model Reference

```python
# Probability of correct response
P(θ) = c + (1 - c) / (1 + exp(-a(θ - b)))

# Parameters:
#   a = discrimination (how well item differentiates)
#   b = difficulty (ability level where P = 0.5 adjusted for c)
#   c = guessing (lower asymptote)
#   θ = latent ability estimate

# 5 Domains:
# 1. Episodic/Semantic Memory
# 2. Executive Function
# 3. Working Memory
# 4. Processing Speed
# 5. Visuospatial Skills
```

---

## Tech Stack
- **Backend:** FastAPI, Pydantic v2, Python 3.12
- **Frontend:** React 18+, TypeScript, Tailwind, Vite
- **State:** Zustand
- **APIs:** Hume AI (EVI), OpenAI (GPT-4o), Gemini
- **Charts:** Recharts
