/**
 * Help Voice Button - On-Demand Hume Connection
 *
 * Creates a new Hume EVI connection specifically for help requests.
 * Uses a clinical assistant persona that:
 * 1. Greets: "Hey, how can I help you?"
 * 2. Listens for confusion/struggle
 * 3. Records emotions and transcript
 * 4. Returns data for simplification trigger
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useVoice, VoiceProvider } from '@humeai/voice-react';

interface HelpVoiceButtonProps {
    sessionId: string | null;
    currentQuestion?: string;
    onComplete: (transcript: string, emotions?: Record<string, number>) => void;
    onCancel: () => void;
}

// Inner component that uses the Hume voice hook
const HelpVoiceInner: React.FC<HelpVoiceButtonProps> = ({
    currentQuestion,
    onComplete,
    onCancel,
}) => {
    const helpConfigId = import.meta.env.VITE_HUME_HELP_CONFIG_ID || import.meta.env.VITE_HUME_CONFIG_ID;
    const { connect, disconnect, status, messages, sendSessionSettings } = useVoice();

    const [transcript, setTranscript] = useState('');
    const [emotions, setEmotions] = useState<Record<string, number>>({});
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const hasConnected = useRef(false);
    const hasGreeted = useRef(false);

    const log = useCallback((message: string) => {
        console.log(`[Help Voice] ${message}`);
    }, []);

    // Fetch token when component mounts
    useEffect(() => {
        const fetchToken = async () => {
            try {
                const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
                const response = await fetch(`${apiBaseUrl}/hume/token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                });

                if (!response.ok) {
                    throw new Error(`Token request failed: ${response.status}`);
                }

                const data = await response.json();
                setAccessToken(data.access_token);
                log('Access token received');
            } catch (err: any) {
                console.error('Failed to get Hume token:', err);
                setError(err.message);
            }
        };

        fetchToken();
    }, [log]);

    // Connect when token is ready
    useEffect(() => {
        if (!accessToken || hasConnected.current) return;
        hasConnected.current = true;

        log('Starting help voice connection');

        const connectToHume = async () => {
            try {
                const connectOptions: any = {
                    auth: {
                        type: 'accessToken',
                        value: accessToken,
                    },
                };

                if (helpConfigId) {
                    connectOptions.configId = helpConfigId;
                }

                await connect(connectOptions);
                log('Connected to Help Hume');
            } catch (error: any) {
                log(`Connection failed: ${error.message}`);
                console.error('Help Hume connection error:', error);
                setError(error.message);
            }
        };

        connectToHume();
        // Note: No cleanup - disconnect is handled by Cancel/Complete buttons
    }, [accessToken, helpConfigId, connect, log]);

    // Send context when connected
    useEffect(() => {
        if (status.value === 'connected' && !hasGreeted.current && sendSessionSettings) {
            hasGreeted.current = true;
            log('Sending help context');

            // Help assistant persona with current question context
            const helpContext = `You are a kind clinical assistant helping a patient who is confused during a cognitive assessment.

CURRENT ASSESSMENT QUESTION: "${currentQuestion || 'Unknown question'}"

YOUR ROLE:
1. First, greet warmly: "Hey, how can I help you?"
2. Listen to what they say about being confused or struggling
3. If they express confusion, frustration, or say they don't understand, respond with:
   "I understand. Let me get you an easier version of this question."
   Then stop talking.
4. Do NOT ask the assessment question yourself
5. Do NOT try to answer or explain the assessment question
6. Keep your responses brief and supportive

If the patient says something like "I don't understand", "this is too hard", "I'm confused", or "I don't know what to do", immediately offer the easier version.`;

            sendSessionSettings({
                context: { text: helpContext },
            });
        }
    }, [status.value, currentQuestion, sendSessionSettings, log]);

    // Monitor messages for transcript and emotions
    useEffect(() => {
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];

            // Track user's speech
            if (lastMessage.type === 'user_message' && lastMessage.message?.content) {
                const content = lastMessage.message.content;
                setTranscript(content);
                log(`User said: ${content}`);

                // Extract emotions from prosody if available
                if (lastMessage.models?.prosody?.scores) {
                    const scores = lastMessage.models.prosody.scores;
                    const topEmotions: Record<string, number> = {};

                    // Get top 5 emotions
                    const sorted = Object.entries(scores)
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .slice(0, 5);

                    sorted.forEach(([emotion, score]) => {
                        topEmotions[emotion] = score as number;
                    });

                    setEmotions(topEmotions);
                    log(`Emotions: ${JSON.stringify(topEmotions)}`);
                }
            }

            // Check for assistant saying "easier version" - auto-complete
            if (lastMessage.type === 'assistant_message' && lastMessage.message?.content) {
                const assistantText = lastMessage.message.content.toLowerCase();
                if (assistantText.includes('easier version') || assistantText.includes('simpler version')) {
                    log('Help Hume offered easier version - completing');
                    setTimeout(() => handleComplete(), 1500);
                }
            }
        }
    }, [messages, log]);

    const handleComplete = useCallback(() => {
        log(`Completing with transcript: ${transcript}`);
        disconnect();
        onComplete(transcript, Object.keys(emotions).length > 0 ? emotions : undefined);
    }, [transcript, emotions, disconnect, onComplete, log]);

    const handleCancel = useCallback(() => {
        log('Cancelled');
        disconnect();
        onCancel();
    }, [disconnect, onCancel, log]);

    // Error state
    if (error) {
        return (
            <div style={{ textAlign: 'center', padding: '20px', color: '#dc2626' }}>
                <p>Failed to connect to voice assistant</p>
                <button className="btn btn-secondary" onClick={onCancel}>
                    Go Back
                </button>
            </div>
        );
    }

    // Loading state
    if (!accessToken) {
        return (
            <div style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔌</div>
                <p>Connecting to voice assistant...</p>
            </div>
        );
    }

    const isConnected = status.value === 'connected';
    const isConnecting = status.value === 'connecting';

    return (
        <div style={{
            padding: '24px',
            textAlign: 'center',
        }}>
            {/* Status indicator */}
            <div style={{
                marginBottom: '20px',
                padding: '16px',
                borderRadius: '12px',
                background: isConnected
                    ? 'linear-gradient(135deg, #10b981, #059669)'
                    : isConnecting
                        ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                        : '#e5e7eb',
                color: 'white',
                animation: isConnected ? 'pulse 2s ease-in-out infinite' : 'none',
            }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                    {isConnecting ? '🔌' : isConnected ? '🎤' : '❌'}
                </div>
                <div style={{ fontWeight: 600, fontSize: '16px' }}>
                    {isConnecting && 'Connecting to Help Assistant...'}
                    {isConnected && 'Help Assistant is listening'}
                    {status.value === 'error' && 'Connection failed'}
                </div>
            </div>

            {/* Transcript display */}
            {transcript && (
                <div style={{
                    marginBottom: '16px',
                    padding: '12px',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontStyle: 'italic',
                }}>
                    "{transcript}"
                </div>
            )}

            {/* Emotion display */}
            {Object.keys(emotions).length > 0 && (
                <div style={{
                    marginBottom: '16px',
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                }}>
                    {Object.entries(emotions).slice(0, 3).map(([emotion, score]) => (
                        <span
                            key={emotion}
                            style={{
                                padding: '4px 8px',
                                backgroundColor: '#e0e7ff',
                                borderRadius: '4px',
                                fontSize: '12px',
                            }}
                        >
                            {emotion}: {(score * 100).toFixed(0)}%
                        </span>
                    ))}
                </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                {isConnected && (
                    <button
                        className="btn btn-primary"
                        onClick={handleComplete}
                        disabled={!transcript}
                    >
                        ✓ Done Speaking
                    </button>
                )}
                <button
                    className="btn btn-secondary"
                    onClick={handleCancel}
                >
                    ✕ Cancel
                </button>
            </div>

            <style>{`
                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.02); opacity: 0.9; }
                }
            `}</style>
        </div>
    );
};

// Outer component that wraps with its own VoiceProvider
export const HelpVoiceButton: React.FC<HelpVoiceButtonProps> = (props) => {
    return (
        <VoiceProvider>
            <HelpVoiceInner {...props} />
        </VoiceProvider>
    );
};

export default HelpVoiceButton;
