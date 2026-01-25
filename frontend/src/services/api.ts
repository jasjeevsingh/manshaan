/**
 * API Service
 * 
 * Axios client for communicating with FastAPI backend.
 */

import axios from 'axios';
import type {
    StartAssessmentRequest,
    AssessmentResponse,
    NextItemResponse,
    ClinicalInsightReport,
    SimulationResult,
    VisionAnalysisRequest,
    VisionAnalysisResponse,
    EmotionTimeline,
    Token,
    HelpRequest,
} from '../types';

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ============================================
// Authentication
// ============================================

export const authService = {
    async register(email: string, password: string, name: string, role: string): Promise<Token> {
        const response = await api.post<Token>('/auth/register', { email, password, name, role });
        localStorage.setItem('token', response.data.access_token);
        return response.data;
    },

    async login(email: string, password: string): Promise<Token> {
        const response = await api.post<Token>('/auth/login', { email, password });
        localStorage.setItem('token', response.data.access_token);
        return response.data;
    },

    logout() {
        localStorage.removeItem('token');
    },
};

// ============================================
// Assessment
// ============================================

export const assessmentService = {
    async startSession(request: StartAssessmentRequest) {
        const response = await api.post<{ session_id: string; first_item: object }>('/assessment/start', request);
        return response.data;
    },

    async submitResponse(response: AssessmentResponse): Promise<NextItemResponse> {
        const res = await api.post<NextItemResponse>('/assessment/respond', response);
        return res.data;
    },

    async requestHelp(request: HelpRequest): Promise<NextItemResponse> {
        const res = await api.post<NextItemResponse>('/assessment/request-help', request);
        return res.data;
    },

    async getSession(sessionId: string) {
        const response = await api.get(`/assessment/${sessionId}`);
        return response.data;
    },

    async getResults(sessionId: string): Promise<ClinicalInsightReport> {
        const response = await api.get<ClinicalInsightReport>(`/assessment/${sessionId}/results`);
        return response.data;
    },

    async getResultsPdf(sessionId: string): Promise<Blob> {
        const response = await api.get(`/assessment/${sessionId}/results/pdf`, {
            responseType: 'blob',
        });
        return response.data;
    },

    async runSimulation(trueTheta: Record<string, number>, numItems = 20): Promise<SimulationResult> {
        const response = await api.post<SimulationResult>('/assessment/simulate', null, {
            params: { true_theta: trueTheta, num_items: numItems },
        });
        return response.data;
    },

    async invalidateResponse(sessionId: string, responseId: string, reason: string, clinicianId: string) {
        const response = await api.post(`/assessment/${sessionId}/invalidate/${responseId}`, null, {
            params: { reason, clinician_id: clinicianId },
        });
        return response.data;
    },
};

// ============================================
// Vision Analysis
// ============================================

export const visionService = {
    async analyzeDrawing(request: VisionAnalysisRequest): Promise<VisionAnalysisResponse> {
        const response = await api.post<VisionAnalysisResponse>('/analyze-vision', request);
        return response.data;
    },
};

// ============================================
// Emotion Recording
// ============================================

export const emotionService = {
    async recordEmotion(
        sessionId: string,
        timestamp: string,
        emotions: Record<string, number>,
        itemId?: string
    ) {
        const response = await api.post('/emotion/record', {
            session_id: sessionId,
            timestamp,
            emotions,
            item_id: itemId,
        });
        return response.data;
    },

    async getTimeline(sessionId: string): Promise<EmotionTimeline> {
        const response = await api.get<EmotionTimeline>(`/emotion/${sessionId}/timeline`);
        return response.data;
    },
};

export default api;
