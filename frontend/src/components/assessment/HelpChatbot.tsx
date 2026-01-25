/**
 * Help Chatbot Component
 * 
 * Provides text and voice options for patients who need help.
 * - Text input for typing questions
 * - Voice button for speaking with Help Hume assistant
 */

import React, { useState, useCallback } from 'react';
import { HelpVoiceButton } from './HelpVoiceButton';

interface HelpChatbotProps {
    sessionId: string | null;
    currentQuestion?: string;
    isOpen: boolean;
    onClose: () => void;
    onHelpSubmit: (data: {
        message?: string;
        voice_transcript?: string;
        hume_emotions?: Record<string, number>;
    }) => Promise<void>;
    isLoading?: boolean;
    accommodationApplied?: string | null;
    simplificationLevel?: number;
}

export const HelpChatbot: React.FC<HelpChatbotProps> = ({
    sessionId,
    currentQuestion,
    isOpen,
    onClose,
    onHelpSubmit,
    isLoading = false,
    accommodationApplied,
    simplificationLevel = 0,
}) => {
    const [helpMessage, setHelpMessage] = useState('');
    const [isVoiceMode, setIsVoiceMode] = useState(false);

    const handleTextSubmit = useCallback(async () => {
        if (!helpMessage.trim()) return;

        await onHelpSubmit({ message: helpMessage.trim() });
        setHelpMessage('');
    }, [helpMessage, onHelpSubmit]);

    const handleVoiceComplete = useCallback(async (transcript: string, emotions?: Record<string, number>) => {
        setIsVoiceMode(false);
        await onHelpSubmit({
            voice_transcript: transcript,
            hume_emotions: emotions,
        });
    }, [onHelpSubmit]);

    if (!isOpen) return null;

    return (
        <div style={{
            marginTop: '24px',
            padding: '20px',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '2px solid #3b82f6',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
            }}>
                <h3 style={{
                    margin: 0,
                    fontSize: '18px',
                    fontWeight: 600,
                    color: '#1e40af',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}>
                    🆘 Need Help?
                </h3>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '20px',
                        cursor: 'pointer',
                        color: '#6b7280',
                    }}
                >
                    ✕
                </button>
            </div>

            {/* Accommodation indicator */}
            {accommodationApplied && (
                <div style={{
                    marginBottom: '12px',
                    padding: '8px 12px',
                    backgroundColor: '#dbeafe',
                    borderRadius: '8px',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}>
                    ♿ Accommodation active: {accommodationApplied.replace('_', ' ')}
                </div>
            )}

            {/* Simplification indicator */}
            {simplificationLevel > 0 && (
                <div style={{
                    marginBottom: '12px',
                    padding: '8px 12px',
                    backgroundColor: '#fef3c7',
                    borderRadius: '8px',
                    fontSize: '14px',
                }}>
                    🎯 Simplified version (Level {simplificationLevel} of 3)
                </div>
            )}

            {/* Voice mode active */}
            {isVoiceMode ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                    <HelpVoiceButton
                        sessionId={sessionId}
                        currentQuestion={currentQuestion}
                        onComplete={handleVoiceComplete}
                        onCancel={() => setIsVoiceMode(false)}
                    />
                </div>
            ) : (
                <>
                    {/* Instructions */}
                    <p style={{
                        fontSize: '14px',
                        color: '#4b5563',
                        marginBottom: '12px',
                    }}>
                        Tell us what's confusing or if you need accommodations:
                    </p>

                    {/* Text input */}
                    <textarea
                        value={helpMessage}
                        onChange={(e) => setHelpMessage(e.target.value)}
                        placeholder={`Examples:
• "I don't understand this question"
• "This is too hard"
• "I'm deaf and can't hear the audio"
• "I have dyslexia and can't read well"`}
                        style={{
                            width: '100%',
                            minHeight: '100px',
                            padding: '12px',
                            borderRadius: '8px',
                            border: '1px solid #d1d5db',
                            fontSize: '14px',
                            resize: 'vertical',
                            boxSizing: 'border-box',
                        }}
                    />

                    {/* Action buttons */}
                    <div style={{
                        display: 'flex',
                        gap: '12px',
                        marginTop: '16px',
                        flexWrap: 'wrap',
                    }}>
                        <button
                            className="btn btn-primary"
                            onClick={handleTextSubmit}
                            disabled={isLoading || !helpMessage.trim()}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                            }}
                        >
                            {isLoading ? 'Getting help...' : '📤 Send'}
                        </button>

                        <button
                            className="btn btn-secondary"
                            onClick={() => setIsVoiceMode(true)}
                            disabled={isLoading}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                            }}
                        >
                            🎤 Speak Instead
                        </button>

                        <button
                            className="btn btn-secondary"
                            onClick={onClose}
                            style={{ marginLeft: 'auto' }}
                        >
                            Cancel
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default HelpChatbot;
