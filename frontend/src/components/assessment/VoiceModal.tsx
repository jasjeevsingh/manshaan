/**
 * Voice Modal Component
 * 
 * "Talk Now" modal for Hume EVI voice interaction.
 * Displays emotion indicators and handles voice assessment items.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useVoice } from '@humeai/voice-react';
import { useHume } from '../../providers/HumeProvider';
import { useAssessmentStore } from '../../stores/assessmentStore';
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
    const { connect, disconnect, status, sendUserInput, messages } = useVoice();
    const { currentEmotions, startListening, stopListening, apiKey, configId } = useHume();
    const [transcript, setTranscript] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const { sessionId: _sessionId } = useAssessmentStore();

    // Connect when modal opens
    useEffect(() => {
        if (isOpen) {
            connect({
                auth: { type: 'apiKey', value: apiKey },
                configId: configId,
            }).catch(console.error);
        } else {
            disconnect();
            stopListening();
            setTranscript('');
            setIsRecording(false);
        }
    }, [isOpen, connect, disconnect, stopListening, apiKey, configId]);

    // Extract transcript from messages
    useEffect(() => {
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.type === 'user_message' && lastMessage.message?.content) {
                setTranscript((prev) => prev + ' ' + lastMessage.message.content);
            }
        }
    }, [messages]);

    const handleStartRecording = useCallback(() => {
        setIsRecording(true);
        startListening();
        // Send prompt to Hume to start conversation
        if (prompt) {
            sendUserInput(prompt);
        }
    }, [startListening, sendUserInput, prompt]);

    const handleStopRecording = useCallback(() => {
        setIsRecording(false);
        stopListening();
        if (onComplete && transcript.trim()) {
            onComplete(transcript.trim());
        }
    }, [stopListening, onComplete, transcript]);

    const getEmotionIndicator = (emotion: string, value: number) => {
        const colors = {
            anxiety: { bg: '#fed7d7', color: '#c53030' },
            calm: { bg: '#c6f6d5', color: '#22543d' },
            distress: { bg: '#feebc8', color: '#c05621' },
        };
        const style = colors[emotion as keyof typeof colors] || { bg: '#e2e8f0', color: '#4a5568' };

        return (
            <div
                key={emotion}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
                style={{ background: style.bg, color: style.color }}
            >
                <span className="capitalize font-medium">{emotion}</span>
                <span className="font-bold">{(value * 100).toFixed(0)}%</span>
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content voice-modal p-lg" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="mb-lg">
                    <h3 className="text-xl font-semibold mb-sm">Voice Assessment</h3>
                    <p className="text-muted text-sm">
                        {instructions || 'Speak clearly. Your voice patterns help us understand how you are feeling.'}
                    </p>
                </div>

                {/* Voice indicator */}
                <div className={`voice-indicator ${isRecording ? 'active' : ''}`}>
                    <svg
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="white"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                    </svg>
                </div>

                {/* Status */}
                <p className="text-sm text-secondary mb-md">
                    {status.value === 'connected' ? (
                        isRecording ? (
                            <span className="text-success">● Recording...</span>
                        ) : (
                            <span className="text-primary">Connected - Ready</span>
                        )
                    ) : status.value === 'connecting' ? (
                        <span className="text-warning">Connecting...</span>
                    ) : (
                        <span className="text-muted">Disconnected</span>
                    )}
                </p>

                {/* Prompt display */}
                {prompt && (
                    <div className="bg-secondary p-md rounded-lg mb-md text-left">
                        <p className="text-sm font-medium text-secondary mb-sm">Prompt:</p>
                        <p className="text-sm">{prompt}</p>
                    </div>
                )}

                {/* Emotion indicators */}
                {currentEmotions && (
                    <div className="flex flex-wrap justify-center gap-sm mb-lg">
                        {getEmotionIndicator('anxiety', currentEmotions.anxiety || currentEmotions.fear || 0)}
                        {getEmotionIndicator('calm', currentEmotions.calm || currentEmotions.contentment || 0)}
                        {getEmotionIndicator('distress', currentEmotions.distress || currentEmotions.sadness || 0)}
                    </div>
                )}

                {/* Transcript preview */}
                {transcript && (
                    <div className="bg-secondary p-md rounded-lg mb-md text-left max-h-32 overflow-y-auto">
                        <p className="text-xs text-muted mb-sm">Transcript:</p>
                        <p className="text-sm">{transcript}</p>
                    </div>
                )}

                {/* Controls */}
                <div className="flex gap-md justify-center">
                    {!isRecording ? (
                        <button
                            className="btn btn-primary btn-lg"
                            onClick={handleStartRecording}
                            disabled={status.value !== 'connected'}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                            </svg>
                            Start Speaking
                        </button>
                    ) : (
                        <button className="btn btn-danger btn-lg" onClick={handleStopRecording}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="6" width="12" height="12" rx="2" />
                            </svg>
                            Stop & Submit
                        </button>
                    )}

                    <button className="btn btn-secondary" onClick={onClose}>
                        Cancel
                    </button>
                </div>

                {/* Disclaimer */}
                <div className="mt-lg">
                    <AIDisclaimer variant="compact" />
                </div>
            </div>
        </div>
    );
};

export default VoiceModal;
