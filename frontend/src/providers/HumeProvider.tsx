/**
 * Hume Provider
 * 
 * WebSocket provider for Hume AI EVI (Empathic Voice Interface).
 * Wraps the VoiceProvider from @humeai/voice-react.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { VoiceProvider } from '@humeai/voice-react';
import type { EmotionTimelinePoint } from '../types';
import { emotionService } from '../services/api';
import { useAssessmentStore } from '../stores/assessmentStore';

interface HumeContextType {
    isConnected: boolean;
    isListening: boolean;
    currentEmotions: Record<string, number> | null;
    startListening: () => void;
    stopListening: () => void;
    apiKey: string;
    configId?: string;
}

const HumeContext = createContext<HumeContextType | null>(null);

export const useHume = () => {
    const context = useContext(HumeContext);
    if (!context) {
        throw new Error('useHume must be used within a HumeProvider');
    }
    return context;
};

interface HumeProviderProps {
    children: React.ReactNode;
    apiKey: string;
    configId?: string;
}

export const HumeProvider: React.FC<HumeProviderProps> = ({ children, apiKey, configId }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [currentEmotions, setCurrentEmotions] = useState<Record<string, number> | null>(null);

    const { sessionId, currentItem, addEmotionPoint } = useAssessmentStore();

    const handleMessage = useCallback((message: unknown) => {
        // Type guard for Hume message
        const humeMessage = message as {
            type?: string;
            models?: {
                prosody?: {
                    predictions?: Array<{
                        emotions: Array<{
                            name: string;
                            score: number;
                        }>;
                    }>;
                };
            };
        };

        // Check if this is an expression measurement
        if (humeMessage?.models?.prosody?.predictions) {
            const predictions = humeMessage.models.prosody.predictions;
            if (predictions.length > 0) {
                const emotions = predictions[0].emotions;

                // Extract key emotions
                const emotionMap: Record<string, number> = {};
                emotions.forEach((e) => {
                    emotionMap[e.name.toLowerCase()] = e.score;
                });

                setCurrentEmotions(emotionMap);

                // Create timeline point
                const point: EmotionTimelinePoint = {
                    timestamp: new Date().toISOString(),
                    anxiety: emotionMap['anxiety'] || emotionMap['fear'] || 0,
                    calm: emotionMap['calm'] || emotionMap['contentment'] || 0,
                    distress: emotionMap['distress'] || emotionMap['sadness'] || 0,
                    item_id: currentItem?.id,
                };

                // Add to local store
                addEmotionPoint(point);

                // Send to backend
                if (sessionId) {
                    emotionService.recordEmotion(
                        sessionId,
                        point.timestamp,
                        {
                            anxiety: point.anxiety,
                            calm: point.calm,
                            distress: point.distress,
                            confusion: emotionMap['confusion'] || 0,
                            concentration: emotionMap['concentration'] || 0,
                            interest: emotionMap['interest'] || 0,
                        },
                        currentItem?.id
                    ).catch(console.error);
                }
            }
        }
    }, [sessionId, currentItem, addEmotionPoint]);

    const startListening = useCallback(() => {
        setIsListening(true);
    }, []);

    const stopListening = useCallback(() => {
        setIsListening(false);
        setCurrentEmotions(null);
    }, []);

    const contextValue: HumeContextType = {
        isConnected,
        isListening,
        currentEmotions,
        startListening,
        stopListening,
        apiKey,
        configId,
    };

    return (
        <HumeContext.Provider value={contextValue}>
            <VoiceProvider
                onOpen={() => setIsConnected(true)}
                onClose={() => setIsConnected(false)}
                onMessage={handleMessage}
            >
                {children}
            </VoiceProvider>
        </HumeContext.Provider>
    );
};

export default HumeProvider;
