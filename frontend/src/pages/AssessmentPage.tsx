/**
 * Assessment Page
 * 
 * Main assessment flow with adaptive questioning.
 * Features:
 * - Sequential question ordering
 * - Help button for adaptive simplification
 * - Text input for accessibility accommodations
 * - Graduated simplification (up to 3 levels)
 */

import React, { useState, useCallback } from 'react';
import { useAssessmentStore } from '../stores/assessmentStore';
import { assessmentService } from '../services/api';
import { AIDisclaimer } from '../components/compliance/AIDisclaimer';
import { VoiceAssessment } from '../components/assessment/VoiceAssessment';
import { DrawingCanvas } from '../components/assessment/DrawingCanvas';
import { HelpChatbot } from '../components/assessment/HelpChatbot';
import { SessionStatus } from '../types';
import type { IRTItem } from '../types';
import { Link } from 'react-router-dom';

const AssessmentPage: React.FC = () => {
    const {
        sessionId,
        status,
        currentItem,
        thetaEstimates,
        responsesCount,
        itemsRemaining,
        itemStartTime,
        isLoading,
        error,
        startSession,
        setCurrentItem,
        updateTheta,
        recordResponse,
        setStatus,
        setLoading,
        setError,
        setItemsRemaining,
    } = useAssessmentStore();

    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [isVoiceActive, setIsVoiceActive] = useState(false);
    const [showDrawingCanvas, setShowDrawingCanvas] = useState(false);

    // Help/Accommodation state
    const [showHelpChatbot, setShowHelpChatbot] = useState(false);
    const [accommodationApplied, setAccommodationApplied] = useState<string | null>(null);
    const [simplificationLevel, setSimplificationLevel] = useState(0);
    const [isSimplified, setIsSimplified] = useState(false);

    // Start new session
    const handleStartSession = async () => {
        setLoading(true);
        setError(null);

        try {
            const autoPatientId = `patient_${Date.now()}`;
            const result = await assessmentService.startSession({ patient_id: autoPatientId });
            startSession(result.session_id, autoPatientId, null, result.first_item as IRTItem);
            // Reset accommodation state
            setAccommodationApplied(null);
            setSimplificationLevel(0);
            setIsSimplified(false);
        } catch (err) {
            setError('Failed to start session. Is the backend running?');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Submit response
    const handleSubmitResponse = useCallback(async (response: number | string) => {
        if (!sessionId || !currentItem) return;

        const responseTime = itemStartTime ? Date.now() - itemStartTime : 1000;
        setLoading(true);

        try {
            const result = await assessmentService.submitResponse({
                session_id: sessionId,
                item_id: currentItem.id,
                response,
                response_time_ms: responseTime,
            });

            recordResponse();
            updateTheta(result.theta_estimates);
            setItemsRemaining(result.items_remaining ?? null);

            // Track simplification state
            setIsSimplified(result.is_simplified ?? false);
            setSimplificationLevel(result.simplification_level ?? 0);
            if (result.accommodation_applied) {
                setAccommodationApplied(result.accommodation_applied);
            }

            if (result.session_status === 'complete') {
                setStatus(SessionStatus.COMPLETE);
                setCurrentItem(null);
            } else if (result.next_item) {
                setCurrentItem(result.next_item as IRTItem);
            }

            setSelectedAnswer(null);
            setShowHelpChatbot(false);
        } catch (err: any) {
            // Check if session was lost (404)
            if (err?.response?.status === 404) {
                setError('Session expired. Please start a new assessment.');
                setStatus(SessionStatus.NOT_STARTED);
            } else {
                setError('Failed to submit response');
            }
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [sessionId, currentItem, itemStartTime, recordResponse, updateTheta, setItemsRemaining, setStatus, setCurrentItem, setLoading, setError]);

    // Request help - triggers adaptive simplification (supports text and voice)
    const handleRequestHelp = useCallback(async (data: {
        message?: string;
        voice_transcript?: string;
        hume_emotions?: Record<string, number>;
    }) => {
        if (!sessionId) return;

        setLoading(true);
        setError(null);

        try {
            const result = await assessmentService.requestHelp({
                session_id: sessionId,
                message: data.message,
                voice_transcript: data.voice_transcript,
                hume_emotions: data.hume_emotions,
                help_button_pressed: true,
            });

            // Update state with simplified question
            if (result.next_item) {
                setCurrentItem(result.next_item as IRTItem);
            }

            setIsSimplified(result.is_simplified ?? true);
            setSimplificationLevel(result.simplification_level ?? 1);

            if (result.accommodation_applied) {
                setAccommodationApplied(result.accommodation_applied);
            }

            setShowHelpChatbot(false);
        } catch (err) {
            setError('Failed to get help. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [sessionId, setCurrentItem, setLoading, setError]);

    // Handle voice completion
    const handleVoiceComplete = (transcript: string) => {
        setIsVoiceActive(false);
        handleSubmitResponse(transcript);
    };

    // Handle drawing completion
    const handleDrawingComplete = (analysis: unknown) => {
        setShowDrawingCanvas(false);
        handleSubmitResponse(JSON.stringify(analysis));
    };

    // DEBUG: Auto-fill assessment
    const handleDebugFill = async () => {
        if (!sessionId || !currentItem) return;

        if (!window.confirm('⚡ Auto-Complete Assessment?\n\nThis will randomly answer all remaining MCQs and skip other items. This cannot be undone.')) {
            return;
        }

        setLoading(true);
        try {
            let nextItem: IRTItem | null = currentItem;
            let isComplete = false;

            // Loop until complete
            while (!isComplete && nextItem) {
                // Determine response
                let response: string | number = '[SKIPPED]';

                if (nextItem.item_type === 'mcq' && nextItem.options) {
                    // Pick random option
                    response = Math.floor(Math.random() * nextItem.options.length);
                }

                // Submit
                const result = await assessmentService.submitResponse({
                    session_id: sessionId!,
                    item_id: nextItem.id,
                    response,
                    response_time_ms: 500, // Fake rapid response
                });

                // Update progress
                updateTheta(result.theta_estimates);
                recordResponse();

                if (result.session_status === 'complete') {
                    isComplete = true;
                    setStatus(SessionStatus.COMPLETE);
                    setCurrentItem(null);
                    setItemsRemaining(null);
                } else if (result.next_item) {
                    nextItem = result.next_item as IRTItem;
                    // Dont strictly need to update store every step for speed, 
                    // but debugging might want to see progress. 
                    // We'll just update at the end or if loop breaks.
                }
            }
        } catch (err: any) {
            console.error('Debug fill error:', err);
            setError('Debug fill failed');
        } finally {
            setLoading(false);
        }
    };

    // Render help section with HelpChatbot
    const renderHelpSection = () => (
        <>
            {/* Need Help button */}
            {!showHelpChatbot && (
                <div style={{ marginTop: '24px' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={() => setShowHelpChatbot(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 16px'
                        }}
                    >
                        ❓ Need Help?
                    </button>
                </div>
            )}

            {/* Help Chatbot */}
            <HelpChatbot
                sessionId={sessionId}
                currentQuestion={currentItem?.prompt}
                isOpen={showHelpChatbot}
                onClose={() => setShowHelpChatbot(false)}
                onHelpSubmit={handleRequestHelp}
                isLoading={isLoading}
                accommodationApplied={accommodationApplied}
                simplificationLevel={simplificationLevel}
            />
        </>
    );

    // Render based on item type
    const renderItemUI = () => {
        if (!currentItem) return null;

        switch (currentItem.item_type) {
            case 'voice':
                return (
                    <div className="text-center">
                        <p className="text-lg mb-lg">{currentItem.prompt}</p>
                        {currentItem.instructions && (
                            <p className="text-secondary mb-lg">{currentItem.instructions}</p>
                        )}
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <button
                                className="btn btn-accent btn-lg"
                                onClick={() => setIsVoiceActive(true)}
                            >
                                🎤 Talk Now
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => handleSubmitResponse('[SKIPPED]')}
                                title="Skip this question (dev only)"
                            >
                                ⏭️ Skip
                            </button>
                        </div>
                        {renderHelpSection()}
                    </div>
                );

            case 'drawing':
                return (
                    <div>
                        <p className="text-lg mb-lg text-center">{currentItem.prompt}</p>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <button
                                className="btn btn-accent btn-lg"
                                onClick={() => setShowDrawingCanvas(true)}
                            >
                                ✏️ Open Drawing Canvas
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => handleSubmitResponse('[SKIPPED]')}
                                title="Skip this question (dev only)"
                            >
                                ⏭️ Skip
                            </button>
                        </div>
                        {renderHelpSection()}
                    </div>
                );

            case 'mcq':
            default:
                return (
                    <div>
                        <p className="text-lg mb-lg">{currentItem.prompt}</p>
                        {currentItem.options && (
                            <div className="flex flex-col gap-sm">
                                {currentItem.options.map((option, index) => (
                                    <button
                                        key={index}
                                        className={`p-md text-left rounded-lg border transition-all ${selectedAnswer === index
                                            ? 'border-primary bg-blue-50'
                                            : 'border-gray-200 hover:border-primary hover:bg-gray-50'
                                            }`}
                                        onClick={() => setSelectedAnswer(index)}
                                    >
                                        <span className="font-medium mr-sm">
                                            {String.fromCharCode(65 + index)}.
                                        </span>
                                        {option}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
                            <button
                                className="btn btn-primary btn-lg"
                                disabled={selectedAnswer === null || isLoading}
                                onClick={() => selectedAnswer !== null && handleSubmitResponse(selectedAnswer)}
                            >
                                {isLoading ? 'Submitting...' : 'Submit Answer'}
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => handleSubmitResponse('[SKIPPED]')}
                                title="Skip this question (dev only)"
                            >
                                ⏭️ Skip
                            </button>
                        </div>
                        {renderHelpSection()}
                    </div>
                );
        }
    };

    // Not started - show start form
    if (status === 'not_started') {
        return (
            <div className="container py-2xl">
                <div className="max-w-md mx-auto">
                    <div className="card p-lg">
                        <h2 className="text-2xl font-semibold mb-md text-center">
                            Start New Assessment
                        </h2>

                        <AIDisclaimer />

                        {error && (
                            <p className="text-danger text-sm mt-sm">{error}</p>
                        )}

                        <button
                            className="btn btn-primary btn-lg w-full mt-lg"
                            onClick={handleStartSession}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Starting...' : 'Begin Assessment'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Complete - show results link
    if (status === 'complete') {
        return (
            <div className="container py-2xl">
                <div className="max-w-md mx-auto text-center">
                    <div className="card p-lg">
                        <div className="w-16 h-16 rounded-full bg-success flex items-center justify-center mx-auto mb-lg">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-semibold mb-sm">Assessment Complete!</h2>
                        {/* <p className="text-secondary mb-lg">
                            {responsesCount} items administered
                        </p> */}

                        <Link to={`/dashboard/${sessionId}`} className="btn btn-primary btn-lg">
                            View Clinical Insight Report
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // In progress - show current item
    return (
        <div className="container py-xl">
            <div className="max-w-2xl mx-auto">
                {/* Progress header */}
                <div className="flex justify-between items-center mb-lg">
                    <div>
                        <span className="text-sm text-muted block">Session: {sessionId}</span>
                        {/* Debug Button */}
                        <button
                            onClick={handleDebugFill}
                            className="text-xs text-primary underline mt-xs hover:text-primary-dark"
                            title="Dev Tool: Randomly answer remaining items"
                        >
                            ⚡ Debug: Auto-Complete
                        </button>
                    </div>
                    <div className="flex items-center gap-md">
                        {/* <span className="text-sm text-muted">
                            Items: {responsesCount}{itemsRemaining !== null && ` / ~${responsesCount + itemsRemaining}`}
                        </span> */}
                        {currentItem && (
                            <span className="score-badge average">
                                {currentItem.item_type.toUpperCase()}
                            </span>
                        )}
                    </div>
                </div>

                {/* Theta display
                {thetaEstimates && (
                    <div className="flex gap-sm flex-wrap mb-lg">
                        {Object.entries(thetaEstimates).map(([domain, est]) => (
                            <div key={domain} className="text-xs bg-secondary px-sm py-xs rounded">
                                {domain.split('_')[0]}: θ={est.theta.toFixed(1)}
                            </div>
                        ))}
                    </div>
                )} */}

                {/* Current item */}
                <div className="card p-lg">
                    {error && (
                        <div className="bg-red-100 text-danger p-md rounded mb-md text-sm">
                            {error}
                        </div>
                    )}
                    {renderItemUI()}
                </div>

                <div className="mt-lg">
                    <AIDisclaimer variant="compact" />
                </div>
            </div>

            {/* Voice Assessment - Persistent Connection */}
            <VoiceAssessment
                sessionId={sessionId}
                currentQuestion={currentItem?.prompt}
                currentItemId={currentItem?.id}
                isListening={isVoiceActive}
                onTranscriptReady={handleVoiceComplete}
                onStopListening={() => setIsVoiceActive(false)}
            />

            {/* Drawing Canvas Modal */}
            {showDrawingCanvas && (
                <div className="modal-overlay" onClick={() => setShowDrawingCanvas(false)}>
                    <div className="modal-content p-lg" style={{ width: '90%', maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
                        <DrawingCanvas
                            prompt={currentItem?.prompt}
                            onSubmit={handleDrawingComplete}
                            onCancel={() => setShowDrawingCanvas(false)}
                            sessionId={sessionId || undefined}
                            itemId={currentItem?.id}
                            taskType={currentItem?.prompt?.toLowerCase().includes('clock') ? 'clock' : 'figure_copy'}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssessmentPage;

