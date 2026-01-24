/**
 * Manshaan Platform TypeScript Types
 * 
 * Shared types matching the FastAPI backend models.
 * Using const objects instead of enums for esbuild compatibility.
 */

// ============================================
// Domain Constants
// ============================================

export const Domain = {
    EPISODIC_MEMORY: 'episodic_memory',
    EXECUTIVE_FUNCTION: 'executive_function',
    WORKING_MEMORY: 'working_memory',
    PROCESSING_SPEED: 'processing_speed',
    VISUOSPATIAL: 'visuospatial',
} as const;
export type Domain = typeof Domain[keyof typeof Domain];

export const ItemType = {
    MCQ: 'mcq',
    VOICE: 'voice',
    DRAWING: 'drawing',
    TIMED: 'timed',
} as const;
export type ItemType = typeof ItemType[keyof typeof ItemType];

export const SessionStatus = {
    NOT_STARTED: 'not_started',
    IN_PROGRESS: 'in_progress',
    COMPLETE: 'complete',
    CANCELLED: 'cancelled',
} as const;
export type SessionStatus = typeof SessionStatus[keyof typeof SessionStatus];

export const UserRole = {
    PARENT: 'parent',
    CLINICIAN: 'clinician',
    ADMIN: 'admin',
} as const;
export type UserRole = typeof UserRole[keyof typeof UserRole];

// ============================================
// User Types
// ============================================

export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    created_at: string;
    is_active: boolean;
}

export interface Token {
    access_token: string;
    token_type: string;
    user: User;
}

// ============================================
// IRT Types
// ============================================

export interface IRTItem {
    id: string;
    prompt: string;
    item_type: ItemType;
    domain_loadings: Record<Domain, number>;
    difficulty: number;
    guessing: number;
    options?: string[];
    correct_answer?: number;
    instructions?: string;
    time_limit_seconds?: number;
}

export interface DomainTheta {
    domain: Domain;
    theta: number;
    standard_error: number;
    percentile?: number;
}

export interface ResponseRecord {
    id: string;
    item_id: string;
    response: number | string | null;
    response_time_ms: number;
    is_correct?: boolean;
    timestamp: string;
    is_invalidated: boolean;
    invalidation_reason?: string;
    invalidated_by?: string;
}

export interface SessionState {
    session_id: string;
    patient_id: string;
    clinician_id?: string;
    theta_estimates: Record<Domain, DomainTheta>;
    responses: ResponseRecord[];
    current_item_id?: string;
    items_administered: number;
    started_at: string;
    completed_at?: string;
    is_complete: boolean;
}

// ============================================
// Assessment Types
// ============================================

export interface StartAssessmentRequest {
    patient_id: string;
    clinician_id?: string;
}

export interface AssessmentResponse {
    session_id: string;
    item_id: string;
    response: number | string;
    response_time_ms: number;
}

export interface NextItemResponse {
    theta_estimates: Record<Domain, DomainTheta>;
    next_item: IRTItem | null;
    session_status: SessionStatus;
    items_remaining?: number;
}

export interface DomainScore {
    domain: Domain;
    theta: number;
    standard_error: number;
    percentile: number;
    classification: string;
    confidence_interval: [number, number];
}

export interface ClinicalMarker {
    name: string;
    value: number | string;
    significance: 'typical' | 'atypical' | 'concerning';
    evidence_source: string;
}

export interface DifferentialInsight {
    primary_pattern: string;
    asd_indicators: string[];
    id_indicators: string[];
    differential_confidence: number;
    clinical_notes: string;
    evidence_summary: string;
}

export interface ClinicalInsightReport {
    report_id: string;
    session_id: string;
    patient_id: string;
    generated_at: string;
    domain_scores: DomainScore[];
    clinical_markers: ClinicalMarker[];
    differential: DifferentialInsight;
    raw_transcripts?: string[];
    irt_calculation_log?: string;
    overrides_applied: Record<string, unknown>[];
    disclaimer: string;
}

// ============================================
// Emotion Types
// ============================================

export interface EmotionData {
    session_id: string;
    timestamp: string;
    anxiety: number;
    calm: number;
    distress: number;
    confusion?: number;
    concentration?: number;
    interest?: number;
    item_id?: string;
}

export interface EmotionTimelinePoint {
    timestamp: string;
    anxiety: number;
    calm: number;
    distress: number;
    item_id?: string;
    event_marker?: string;
}

export interface EmotionTimeline {
    session_id: string;
    timeline: EmotionTimelinePoint[];
    avg_anxiety: number;
    avg_calm: number;
    avg_distress: number;
    peak_anxiety_item?: string;
    emotional_resilience_score?: number;
}

// ============================================
// Vision Types
// ============================================

export interface VisionAnalysisRequest {
    image_base64: string;
    task_type: 'clock' | 'figure_copy' | 'free_draw';
    expected_elements?: string[];
    session_id?: string;
    item_id?: string;
}

export interface VisionAnalysisResponse {
    analysis: string;
    confidence: number;
    clinical_markers: ClinicalMarker[];
    is_readable: boolean;
    raw_response: string;
    task_type: string;
}

// ============================================
// Simulation Types
// ============================================

export interface SimulationResult {
    true_theta: Record<Domain, number>;
    theta_trajectory: Record<Domain, number>[];
    se_trajectory: Record<Domain, number>[];
    items_used: string[];
    final_theta: Record<Domain, DomainTheta>;
    convergence_achieved: boolean;
    num_items_to_convergence: number;
}
