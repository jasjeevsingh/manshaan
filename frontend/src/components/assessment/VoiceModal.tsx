/**
 * Voice Modal Component - With Proper Token Authentication
 * 
 * Fetches access token from backend for secure Hume EVI connection.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useVoice } from '@humeai/voice-react';
import AIDisclaimer from '../compliance/AIDisclaimer';

interface VoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete?: (transcript: string) => void;
    prompt?: string;
    instructions?: string;
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
    isOpen,
    onClose,
    onComplete,
    prompt,
    instructions,
}) => {
    const configId = import.meta.env.VITE_HUME_CONFIG_ID;
    const { connect, disconnect, status, messages, sendSessionSettings } = useVoice();

    const [transcript, setTranscript] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [debugLog, setDebugLog] = useState<string[]>([]);
    const [showDebug, setShowDebug] = useState(true);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const hasConnected = useRef(false);

    const addLog = useCallback((message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        console.log(logMessage);
        setDebugLog(prev => [...prev.slice(-6), logMessage]); // Keep last 7 logs
    }, []);

    // Monitor status changes
    useEffect(() => {
        addLog(`Status changed: ${status.value}`);

        if (status.value === 'error') {
            addLog('⚠️ Connection error occurred');
            setConnectionError('Connection to Hume AI failed. Click "Skip Task" to continue.');
        } else if (status.value === 'connected') {
            setConnectionError(null);
        }
    }, [status.value, addLog]);

    // Connect when modal opens
    useEffect(() => {
        if (!isOpen) {
            addLog('Modal closed, cleaning up');
            hasConnected.current = false;
            setTranscript('');
            setIsRecording(false);
            setConnectionError(null);
            return;
        }

        if (hasConnected.current) {
            addLog('Already attempted connection, skipping');
            return;
        }

        addLog('Modal opened, fetching access token...');
        hasConnected.current = true;

        // Fetch access token from backend
        const fetchTokenAndConnect = async () => {
            try {
                const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
                addLog(`Requesting token from: ${apiBaseUrl}/hume/token`);

                const response = await fetch(`${apiBaseUrl}/hume/token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Token request failed: ${response.status} - ${errorText}`);
                }

                const tokenData = await response.json();
                addLog('✓ Access token received');
                addLog(`Token expires in: ${tokenData.expires_in}s`);

                // Connect with access token
                const connectOptions: any = {
                    auth: {
                        type: 'accessToken',
                        value: tokenData.access_token
                    }
                };

                if (configId) {
                    connectOptions.configId = configId;
                    addLog(`Using config ID: ${configId}`);
                }

                addLog('Connecting to Hume EVI...');
                await connect(connectOptions);
                addLog('✓ Connection successful');

            } catch (error: any) {
                addLog(`✗ Connection failed: ${error.message}`);
                setConnectionError(`Failed to connect: ${error.message}. Click "Skip Task" to continue.`);
                console.error('Full error:', error);
            }
        };

        fetchTokenAndConnect();
    }, [isOpen, configId, connect, addLog]);

    // Send question context when connected
    useEffect(() => {
        if (status.value === 'connected' && prompt && sendSessionSettings) {
            addLog(`Sending question context to AI`);

            // Send context as a session setting with custom instruction
            sendSessionSettings({
                context: {
                    text: `TASK FOR USER: "${prompt}"\n\nINSTRUCTIONS: You are a clinical assistant conducting cognitive assessments for neurodevelopmental screening. You are to be warm, kind, welcoming, and patient. The patient will likely be a child or teenager. Read this task aloud to the user clearly, then say "Please begin when you're ready" and wait silently for their response. Do not answer the task yourself.`
                }
            });
        }
    }, [status.value, prompt, sendSessionSettings, addLog]);

    // Track transcripts from user messages
    const transcriptRef = useRef('');

    // Monitor messages
    useEffect(() => {
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];

            // Only log certain message types to reduce spam
            if (['chat_metadata', 'user_message', 'assistant_message', 'assistant_end', 'session_settings'].includes(lastMessage.type)) {
                addLog(`Message: ${lastMessage.type}`);
            }

            // For user_message, store the latest transcript (replace, don't append)
            // Hume sends progressive transcripts, so each message contains the updated version
            if (lastMessage.type === 'user_message' && lastMessage.message?.content) {
                const content = lastMessage.message.content;
                transcriptRef.current = content;
                setTranscript(content); // Replace, not append
            }

            // When assistant ends turn, we know user finished speaking for that segment
            if (lastMessage.type === 'assistant_end' && transcriptRef.current) {
                addLog(`Final segment: ${transcriptRef.current}`);
            }
        }
    }, [messages, addLog]);

    const handleStartRecording = useCallback(() => {
        addLog('Start recording clicked');
        setIsRecording(true);
    }, [addLog]);

    const handleStopRecording = useCallback(() => {
        addLog('Stop recording clicked');
        setIsRecording(false);

        if (onComplete && transcript.trim()) {
            addLog(`Submitting transcript: ${transcript.trim()}`);
            onComplete(transcript.trim());
        } else {
            addLog('No transcript to submit');
        }
    }, [onComplete, transcript, addLog]);

    const handleSkip = useCallback(() => {
        addLog('Skipping voice task');
        if (onComplete) {
            onComplete('[Voice task skipped]');
        }
        onClose();
    }, [onComplete, onClose, addLog]);

    const handleClose = useCallback(() => {
        addLog('Closing modal');
        try {
            disconnect();
        } catch (e) {
            addLog(`Error on close: ${e}`);
        }
        onClose();
    }, [disconnect, onClose, addLog]);

    if (!isOpen) return null;

    const isConnected = status.value === 'connected';
    const isConnecting = status.value === 'connecting';

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content voice-modal p-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                {/* Header */}
                <div className="mb-md">
                    <h3 className="text-xl font-semibold mb-sm">Voice Assessment 🎤</h3>
                    <p className="text-muted text-sm">
                        {instructions || 'Speak clearly when recording.'}
                    </p>
                </div>

                {/* Debug Toggle */}
                <div className="mb-sm">
                    <button
                        onClick={() => setShowDebug(!showDebug)}
                        className="text-xs text-primary underline"
                    >
                        {showDebug ? 'Hide' : 'Show'} Debug Info
                    </button>
                </div>

                {/* Debug Log */}
                {showDebug && (
                    <div className="bg-gray-900 text-green-400 p-sm rounded mb-md text-xs font-mono overflow-auto" style={{ maxHeight: '150px', background: '#1a202c', color: '#68d391' }}>
                        {debugLog.map((log, i) => (
                            <div key={i}>{log}</div>
                        ))}
                    </div>
                )}

                {/* Status */}
                <div className="mb-md p-md rounded" style={{ background: isConnected ? '#c6f6d5' : isConnecting ? '#fefcbf' : '#fed7d7' }}>
                    <p className="text-sm font-medium">
                        Status: {status.value}
                    </p>
                    {isConnecting && <p className="text-xs mt-1">Connecting to Hume AI...</p>}
                    {isConnected && <p className="text-xs mt-1 text-success">✓ Ready to record</p>}
                    {connectionError && <p className="text-xs mt-1 text-danger">{connectionError}</p>}
                </div>

                {/* Prompt */}
                {prompt && (
                    <div className="bg-secondary p-md rounded-lg mb-md">
                        <p className="text-sm font-medium mb-1">Task:</p>
                        <p className="text-sm">{prompt}</p>
                    </div>
                )}

                {/* Transcript */}
                {transcript && (
                    <div className="bg-blue-50 p-md rounded mb-md" style={{ background: '#ebf8ff' }}>
                        <p className="text-xs text-muted mb-1">Transcript:</p>
                        <p className="text-sm">{transcript}</p>
                    </div>
                )}

                {/* Controls */}
                <div className="flex gap-sm justify-center flex-wrap">
                    {!isRecording && isConnected && (
                        <button
                            className="btn btn-primary"
                            onClick={handleStartRecording}
                        >
                            🎤 Start Recording
                        </button>
                    )}

                    {isRecording && (
                        <button
                            className="btn btn-danger"
                            onClick={handleStopRecording}
                        >
                            ⏹️ Stop & Submit
                        </button>
                    )}

                    <button
                        className="btn btn-accent"
                        onClick={handleSkip}
                    >
                        Skip Task
                    </button>

                    <button
                        className="btn btn-secondary"
                        onClick={handleClose}
                    >
                        Cancel
                    </button>
                </div>

                {/* Disclaimer */}
                {/* <div className="mt-md">
                    <AIDisclaimer variant="compact" />
                </div> */}
            </div>
        </div>
    );
};

export default VoiceModal;
