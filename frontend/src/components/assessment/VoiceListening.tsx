/**
 * Voice Listening Indicator - Inline Voice Interface
 * 
 * Shows a blinking red indicator when Hume is actively listening.
 * No modal, just an inline status display.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useVoice } from '@humeai/voice-react';
import { getAuthHeaders } from '../../lib/authHeaders';

interface VoiceListeningProps {
    isActive: boolean;
    onStop: () => void;
    onComplete?: (transcript: string) => void;
    prompt?: string;
}

export const VoiceListening: React.FC<VoiceListeningProps> = ({
    isActive,
    onStop,
    onComplete,
    prompt,
}) => {
    const configId = import.meta.env.VITE_HUME_CONFIG_ID;
    const { connect, disconnect, status, messages, sendSessionSettings } = useVoice();

    const [transcript, setTranscript] = useState('');
    const hasConnected = useRef(false);
    const transcriptRef = useRef('');

    // Logging helper (console only, no UI)
    const log = useCallback((message: string) => {
        console.log(`[Hume Voice] ${message}`);
    }, []);

    // Monitor status changes
    useEffect(() => {
        log(`Status: ${status.value}`);
    }, [status.value, log]);

    // Connect when activated
    useEffect(() => {
        if (!isActive) {
            log('Voice deactivated, cleaning up');
            hasConnected.current = false;
            setTranscript('');
            return;
        }

        if (hasConnected.current) {
            return;
        }

        log('Voice activated, connecting...');
        hasConnected.current = true;

        const fetchTokenAndConnect = async () => {
            try {
                const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

                const response = await fetch(`${apiBaseUrl}/hume/token`, {
                    method: 'POST',
                    headers: await getAuthHeaders(),
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
                log('Connected to Hume EVI');

            } catch (error: any) {
                log(`Connection failed: ${error.message}`);
                console.error('Hume connection error:', error);
            }
        };

        fetchTokenAndConnect();
    }, [isActive, configId, connect, log]);

    // Send question context when connected
    useEffect(() => {
        if (status.value === 'connected' && prompt && sendSessionSettings) {
            log('Sending question context');

            sendSessionSettings({
                context: {
                    text: `TASK FOR USER: "${prompt}"\n\nINSTRUCTIONS: You are a clinical assistant conducting cognitive assessments for neurodevelopmental screening. You are to be warm, kind, welcoming, and patient. The patient will likely be a child or teenager. Read this task aloud to the user clearly, then say "Please begin when you're ready" and wait silently for their response. Do not answer the task yourself.`
                }
            });
        }
    }, [status.value, prompt, sendSessionSettings, log]);

    // Monitor messages and track transcript
    useEffect(() => {
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];

            // Log important message types
            if (['chat_metadata', 'user_message', 'assistant_message', 'assistant_end', 'session_settings'].includes(lastMessage.type)) {
                log(`Message: ${lastMessage.type}`);
            }

            // Track user's speech (progressive transcript)
            if (lastMessage.type === 'user_message' && lastMessage.message?.content) {
                const content = lastMessage.message.content;
                transcriptRef.current = content;
                setTranscript(content);
            }

            // Log final segment when assistant finishes
            if (lastMessage.type === 'assistant_end' && transcriptRef.current) {
                log(`Final transcript: ${transcriptRef.current}`);
            }
        }
    }, [messages, log]);

    // Handle stop
    const handleStop = useCallback(() => {
        log('Stopping voice session');

        if (onComplete && transcript.trim()) {
            log(`Submitting transcript: ${transcript.trim()}`);
            onComplete(transcript.trim());
        }

        try {
            disconnect();
        } catch (e) {
            log(`Disconnect error: ${e}`);
        }

        onStop();
    }, [transcript, onComplete, onStop, disconnect, log]);

    if (!isActive) return null;

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
            {/* Blinking dot */}
            {isConnected && (
                <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: 'white',
                    animation: 'blink 1s ease-in-out infinite'
                }} />
            )}

            {/* Status text */}
            <div style={{ fontWeight: 600, fontSize: '16px' }}>
                {isConnecting && '🔌 Connecting...'}
                {isConnected && '🎤 Manshaan is listening'}
                {status.value === 'error' && '❌ Connection error'}
            </div>

            {/* Stop button */}
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

            {/* Add CSS animations */}
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

export default VoiceListening;
