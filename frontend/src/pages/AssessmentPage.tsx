/**
 * Assessment Page
 * 
 * Main assessment flow with adaptive questioning.
 */

import React, { useState, useCallback } from 'react';
import { useAssessmentStore } from '../stores/assessmentStore';
import { assessmentService } from '../services/api';
import { AIDisclaimer } from '../components/compliance/AIDisclaimer';
import { VoiceModal } from '../components/assessment/VoiceModal';
import { DrawingCanvas } from '../components/assessment/DrawingCanvas';
import { SessionStatus } from '../types';
import type { IRTItem } from '../types';

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

    // const [patientId, setPatientId] = useState(''); // Commented out - no longer needed
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showVoiceModal, setShowVoiceModal] = useState(false);
    const [showDrawingCanvas, setShowDrawingCanvas] = useState(false);

    // Start new session
    const handleStartSession = async () => {
        // No longer require patient ID - auto-generate from session
        // if (!patientId.trim()) {
        //     setError('Please enter a Patient ID');
        //     return;
        // }

        setLoading(true);
        setError(null);

        try {
            // Use a timestamp-based ID for now
            const autoPatientId = `patient_${Date.now()}`;
            const result = await assessmentService.startSession({ patient_id: autoPatientId });
            startSession(result.session_id, autoPatientId, null, result.first_item as IRTItem);
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

            if (result.session_status === 'complete') {
                setStatus(SessionStatus.COMPLETE);
                setCurrentItem(null);
            } else if (result.next_item) {
                setCurrentItem(result.next_item as IRTItem);
            }

            setSelectedAnswer(null);
        } catch (err) {
            setError('Failed to submit response');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [sessionId, currentItem, itemStartTime, recordResponse, updateTheta, setItemsRemaining, setStatus, setCurrentItem, setLoading, setError]);

    // Handle voice completion
    const handleVoiceComplete = (transcript: string) => {
        setShowVoiceModal(false);
        handleSubmitResponse(transcript);
    };

    // Handle drawing completion
    const handleDrawingComplete = (analysis: unknown) => {
        setShowDrawingCanvas(false);
        handleSubmitResponse(JSON.stringify(analysis));
    };

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
                        <button
                            className="btn btn-accent btn-lg"
                            onClick={() => setShowVoiceModal(true)}
                        >
                            🎤 Talk Now
                        </button>
                    </div>
                );

            case 'drawing':
                return (
                    <div>
                        <p className="text-lg mb-lg text-center">{currentItem.prompt}</p>
                        <button
                            className="btn btn-accent btn-lg mx-auto block"
                            onClick={() => setShowDrawingCanvas(true)}
                        >
                            ✏️ Open Drawing Canvas
                        </button>
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
                        <button
                            className="btn btn-primary btn-lg mt-lg w-full"
                            disabled={selectedAnswer === null || isLoading}
                            onClick={() => selectedAnswer !== null && handleSubmitResponse(selectedAnswer)}
                        >
                            {isLoading ? 'Submitting...' : 'Submit Answer'}
                        </button>
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

                        {/* Patient ID input - commented out for now */}
                        {/* <div className="mt-lg">
                            <label className="label">Patient ID</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="Enter patient identifier..."
                                value={patientId}
                                onChange={(e) => setPatientId(e.target.value)}
                            />
                        </div> */}

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
                        <p className="text-secondary mb-lg">
                            {responsesCount} items administered
                        </p>

                        <a href={`/dashboard/${sessionId}`} className="btn btn-primary btn-lg">
                            View Clinical Insight Report
                        </a>
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
                        <span className="text-sm text-muted">Session: {sessionId?.slice(0, 8)}...</span>
                    </div>
                    <div className="flex items-center gap-md">
                        <span className="text-sm text-muted">
                            Items: {responsesCount}{itemsRemaining !== null && ` / ~${responsesCount + itemsRemaining}`}
                        </span>
                        {currentItem && (
                            <span className="score-badge average">
                                {currentItem.item_type.toUpperCase()}
                            </span>
                        )}
                    </div>
                </div>

                {/* Theta display */}
                {thetaEstimates && (
                    <div className="flex gap-sm flex-wrap mb-lg">
                        {Object.entries(thetaEstimates).map(([domain, est]) => (
                            <div key={domain} className="text-xs bg-secondary px-sm py-xs rounded">
                                {domain.split('_')[0]}: θ={est.theta.toFixed(1)}
                            </div>
                        ))}
                    </div>
                )}

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

            {/* Voice Modal */}
            <VoiceModal
                isOpen={showVoiceModal}
                onClose={() => setShowVoiceModal(false)}
                onComplete={handleVoiceComplete}
                prompt={currentItem?.prompt}
                instructions={currentItem?.instructions}
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
