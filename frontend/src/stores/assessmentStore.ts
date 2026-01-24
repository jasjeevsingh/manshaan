/**
 * Zustand Assessment Store
 * 
 * Manages the complex adaptive testing state including:
 * - Current session state
 * - Theta estimates per domain
 * - Emotion metadata timeline
 * - Current item and responses
 */

import { create } from 'zustand';
import { SessionStatus } from '../types';
import type {
    IRTItem,
    DomainTheta,
    EmotionTimelinePoint,
    Domain,
    ClinicalInsightReport,
} from '../types';

type SessionStatusValue = typeof SessionStatus[keyof typeof SessionStatus];

interface AssessmentStore {
    // Session state
    sessionId: string | null;
    patientId: string | null;
    clinicianId: string | null;
    status: SessionStatusValue;

    // Current assessment state
    currentItem: IRTItem | null;
    thetaEstimates: Record<Domain, DomainTheta> | null;
    responsesCount: number;
    itemsRemaining: number | null;

    // Response timing
    itemStartTime: number | null;

    // Emotion tracking
    emotionTimeline: EmotionTimelinePoint[];

    // Results
    report: ClinicalInsightReport | null;

    // Loading states
    isLoading: boolean;
    error: string | null;

    // Actions
    startSession: (sessionId: string, patientId: string, clinicianId: string | null, firstItem: IRTItem) => void;
    setCurrentItem: (item: IRTItem | null, startTime?: number) => void;
    updateTheta: (estimates: Record<Domain, DomainTheta>) => void;
    recordResponse: () => void;
    addEmotionPoint: (point: EmotionTimelinePoint) => void;
    setStatus: (status: SessionStatusValue) => void;
    setReport: (report: ClinicalInsightReport) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setItemsRemaining: (count: number | null) => void;
    resetSession: () => void;
}

const initialState = {
    sessionId: null,
    patientId: null,
    clinicianId: null,
    status: SessionStatus.NOT_STARTED as SessionStatusValue,
    currentItem: null,
    thetaEstimates: null,
    responsesCount: 0,
    itemsRemaining: null,
    itemStartTime: null,
    emotionTimeline: [] as EmotionTimelinePoint[],
    report: null,
    isLoading: false,
    error: null,
};

export const useAssessmentStore = create<AssessmentStore>((set) => ({
    ...initialState,

    startSession: (sessionId, patientId, clinicianId, firstItem) => set({
        sessionId,
        patientId,
        clinicianId,
        currentItem: firstItem,
        status: SessionStatus.IN_PROGRESS,
        itemStartTime: Date.now(),
        responsesCount: 0,
        emotionTimeline: [],
        error: null,
    }),

    setCurrentItem: (item, startTime) => set({
        currentItem: item,
        itemStartTime: startTime ?? Date.now(),
    }),

    updateTheta: (estimates) => set({
        thetaEstimates: estimates,
    }),

    recordResponse: () => set((state) => ({
        responsesCount: state.responsesCount + 1,
    })),

    addEmotionPoint: (point) => set((state) => ({
        emotionTimeline: [...state.emotionTimeline, point],
    })),

    setStatus: (status) => set({ status }),

    setReport: (report) => set({ report }),

    setLoading: (isLoading) => set({ isLoading }),

    setError: (error) => set({ error }),

    setItemsRemaining: (itemsRemaining) => set({ itemsRemaining }),

    resetSession: () => set(initialState),
}));


// Selector hooks for specific parts of the state
export const useCurrentItem = () => useAssessmentStore((state) => state.currentItem);
export const useSessionStatus = () => useAssessmentStore((state) => state.status);
export const useThetaEstimates = () => useAssessmentStore((state) => state.thetaEstimates);
export const useEmotionTimeline = () => useAssessmentStore((state) => state.emotionTimeline);
