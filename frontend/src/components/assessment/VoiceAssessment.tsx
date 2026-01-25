/**
 * Voice Assessment Manager - Persistent Connection
 * 
 * Maintains a single Hume connection throughout the entire assessment
 * to preserve conversation context across multiple questions.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useVoice } from '@humeai/voice-react';

interface VoiceAssessmentProps {
    sessionId: string | null;
    currentQuestion?: string;
    currentItemId?: string;
    isListening: boolean;
    onTranscriptReady: (transcript: string) => void;
    onStopListening: () => void;
}

export const VoiceAssessment: React.FC<VoiceAssessmentProps> = ({
    sessionId,
    currentQuestion,
    currentItemId,
    isListening,
    onTranscriptReady,
    onStopListening,
}) => {
    const configId = import.meta.env.VITE_HUME_CONFIG_ID;
    const { connect, disconnect, status, messages, sendSessionSettings } = useVoice();

    const [transcript, setTranscript] = useState('');
    const hasConnected = useRef(false);
    const transcriptRef = useRef('');
    const lastQuestionRef = useRef('');

    const log = useCallback((message: string) => {
        console.log(`[Hume Voice] ${message}`);
    }, []);

    // Connect only when user clicks "Talk Now" button (isListening becomes true)
    useEffect(() => {
        // If not listening, disconnect if connected
        if (!isListening) {
            if (hasConnected.current) {
                log('User stopped listening, disconnecting');
                disconnect();
                hasConnected.current = false;
            }
            return;
        }

        // If already connected, don't reconnect
        if (hasConnected.current) {
            return;
        }

        // User clicked "Talk Now" - establish connection
        log('User started voice question, establishing connection');
        hasConnected.current = true;

        const fetchTokenAndConnect = async () => {
            try {
                const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

                const response = await fetch(`${apiBaseUrl}/hume/token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                });

                if (!response.ok) {
                    throw new Error(`Token request failed: ${response.status}`);
                }

                const tokenData = await response.json();
                log('Access token received');

                const connectOptions: any = {
                    auth: {
                        type: 'accessToken',
                        value: tokenData.access_token
                    }
                };

                if (configId) {
                    connectOptions.configId = configId;
                }

                await connect(connectOptions);
                log('Connected to Hume EVI for voice question');

            } catch (error: any) {
                log(`Connection failed: ${error.message}`);
                console.error('Hume connection error:', error);
            }
        };

        fetchTokenAndConnect();
    }, [isListening, configId, connect, disconnect, log]);

    // Send new question context ONLY when user is actively listening
    useEffect(() => {
        if (status.value === 'connected' && currentQuestion && currentQuestion !== lastQuestionRef.current && sendSessionSettings && isListening) {
            lastQuestionRef.current = currentQuestion;
            log(`New question: ${currentQuestion}`);

            sendSessionSettings({
                context: {
                    text: `TASK FOR USER: "${currentQuestion}"\n\nINSTRUCTIONS: You are a clinical assistant conducting cognitive assessments for neurodevelopmental screening. You are warm, kind, welcoming, and patient. The patient will likely be a child or teenager. Read this task aloud to the user clearly, then say "Please begin when you're ready" and wait silently for their response. Do not answer the task yourself.`
                }
            });
        }
    }, [status.value, currentQuestion, sendSessionSettings, isListening, log]);

    // Monitor messages and track transcript + emotions
    useEffect(() => {
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];

            if (['chat_metadata', 'user_message', 'assistant_message', 'assistant_end', 'session_settings'].includes(lastMessage.type)) {
                log(`Message: ${lastMessage.type}`);
            }

            // Track user's speech and emotions
            if (lastMessage.type === 'user_message' && lastMessage.message?.content) {
                const content = lastMessage.message.content;
                transcriptRef.current = content;
                setTranscript(content);

                // Extract emotions from prosody if available
                log(`Checking for prosody data: models=${!!lastMessage.models}, prosody=${!!lastMessage.models?.prosody}, scores=${!!lastMessage.models?.prosody?.scores}`);

                if (lastMessage.models?.prosody?.scores && sessionId && currentItemId) {
                    const scores = lastMessage.models.prosody.scores;
                    log(`Found prosody scores with ${Object.keys(scores).length} emotions`);

                    // Get top 5 emotions
                    const sortedEmotions = Object.entries(scores)
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .slice(0, 5);

                    const topEmotions: Record<string, number> = {};
                    sortedEmotions.forEach(([emotion, score]) => {
                        topEmotions[emotion] = score as number;
                    });

                    // Send to emotion API
                    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
                    fetch(`${apiBaseUrl}/emotion/record`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            session_id: sessionId,
                            item_id: currentItemId,
                            emotions: topEmotions,
                            source: 'hume_voice'
                        })
                    }).then(() => {
                        log(`✓ Emotions recorded successfully`);
                    }).catch(err => {
                        console.error('Failed to record emotions:', err);
                        log(`✗ Failed to record emotions: ${err.message}`);
                    });

                    log(`Recorded emotions: ${Object.keys(topEmotions).join(', ')}`);
                } else {
                    if (!lastMessage.models?.prosody?.scores) {
                        log('No prosody scores in message');
                    }
                    if (!sessionId) {
                        log('No sessionId available');
                    }
                    if (!currentItemId) {
                        log('No currentItemId available');
                    }
                }
            }

            if (lastMessage.type === 'assistant_end' && transcriptRef.current) {
                log(`Final transcript: ${transcriptRef.current}`);
            }
        }
    }, [messages, sessionId, currentItemId, log]);

    // Handle stop listening (submit transcript but keep connection)
    const handleStop = useCallback(() => {
        log('Stopping listening for this question');

        if (transcript.trim()) {
            log(`Submitting transcript: ${transcript.trim()}`);
            onTranscriptReady(transcript.trim());
        }

        // Clear transcript for next question
        setTranscript('');
        transcriptRef.current = '';

        // Stop listening but DON'T disconnect
        onStopListening();
    }, [transcript, onTranscriptReady, onStopListening, log]);

    // Only show indicator when actively listening
    if (!isListening || !sessionId) return null;

    const isConnected = status.value === 'connected';
    const isConnecting = status.value === 'connecting';

    return (
        <div className="voice-listening-indicator" style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 1000,
            background: 'linear-gradient(135deg, #ff4444, #cc0000)',
            color: 'white',
            padding: '16px 24px',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(255, 68, 68, 0.4)',
            animation: isConnected ? 'pulse 2s ease-in-out infinite' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
        }}>
            {isConnected && (
                <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: 'white',
                    animation: 'blink 1s ease-in-out infinite'
                }} />
            )}

            <div style={{ fontWeight: 600, fontSize: '16px' }}>
                {isConnecting && '🔌 Connecting...'}
                {isConnected && '🎤 Manshaan is listening'}
                {status.value === 'error' && '❌ Connection error'}
            </div>

            {isConnected && (
                <button
                    onClick={handleStop}
                    className="btn btn-secondary"
                    style={{
                        marginLeft: '8px',
                        padding: '8px 16px',
                        fontSize: '14px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        border: '1px solid white',
                        color: 'white'
                    }}
                >
                    ⏹️ Stop
                </button>
            )}

            <style>{`
                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.05); opacity: 0.9; }
                }
                
                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
            `}</style>
        </div>
    );
};

export default VoiceAssessment;
