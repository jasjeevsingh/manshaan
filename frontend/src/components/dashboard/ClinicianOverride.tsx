/**
 * Clinician Override Component
 * 
 * Manual override controls for clinicians to:
 * - Flag responses as invalid/outlier
 * - Override domain scores
 * - Add clinical notes
 */

import React, { useState } from 'react';
import { assessmentService } from '../../services/api';
import type { ResponseRecord } from '../../types';

interface ClinicianOverrideProps {
    sessionId: string;
    responses: ResponseRecord[];
    clinicianId: string;
    onOverrideApplied?: () => void;
}

export const ClinicianOverride: React.FC<ClinicianOverrideProps> = ({
    sessionId,
    responses,
    clinicianId,
    onOverrideApplied,
}) => {
    const [selectedResponse, setSelectedResponse] = useState<string | null>(null);
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleInvalidate = async () => {
        if (!selectedResponse || !reason.trim()) return;

        setIsSubmitting(true);
        try {
            await assessmentService.invalidateResponse(
                sessionId,
                selectedResponse,
                reason,
                clinicianId
            );
            setSuccessMessage('Response marked as invalid. θ recalculated.');
            setSelectedResponse(null);
            setReason('');
            onOverrideApplied?.();
        } catch (error) {
            console.error('Override error:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const validResponses = responses.filter((r) => !r.is_invalidated);
    const invalidatedResponses = responses.filter((r) => r.is_invalidated);

    return (
        <div className="card">
            <div className="card-header">
                <h4 className="text-lg font-semibold">Clinician Override</h4>
                <p className="text-sm text-muted mt-sm">
                    Flag responses as invalid to exclude them from θ calculation
                </p>
            </div>

            <div className="card-body">
                {successMessage && (
                    <div className="bg-green-100 text-green-800 p-md rounded-md mb-md text-sm">
                        ✓ {successMessage}
                    </div>
                )}

                {/* Response selector */}
                <div className="mb-md">
                    <label className="label">Select Response to Invalidate</label>
                    <select
                        className="input"
                        value={selectedResponse || ''}
                        onChange={(e) => setSelectedResponse(e.target.value || null)}
                    >
                        <option value="">-- Select a response --</option>
                        {validResponses.map((r) => (
                            <option key={r.id} value={r.id}>
                                Item {r.item_id} - {r.is_correct ? 'Correct' : 'Incorrect'} ({r.response_time_ms}ms)
                            </option>
                        ))}
                    </select>
                </div>

                {/* Reason input */}
                <div className="mb-md">
                    <label className="label">Reason for Invalidation</label>
                    <textarea
                        className="input"
                        rows={3}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g., Patient was distracted, Technical issue, Response not representative..."
                    />
                </div>

                {/* Submit button */}
                <button
                    className="btn btn-danger"
                    onClick={handleInvalidate}
                    disabled={!selectedResponse || !reason.trim() || isSubmitting}
                >
                    {isSubmitting ? 'Processing...' : 'Mark as Invalid & Recalculate θ'}
                </button>

                {/* Already invalidated */}
                {invalidatedResponses.length > 0 && (
                    <div className="mt-lg">
                        <h5 className="text-sm font-semibold mb-sm text-muted">
                            Previously Invalidated ({invalidatedResponses.length})
                        </h5>
                        <ul className="text-xs text-secondary">
                            {invalidatedResponses.map((r) => (
                                <li key={r.id} className="mb-sm">
                                    <span className="font-medium">Item {r.item_id}:</span>{' '}
                                    {r.invalidation_reason}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <div className="card-footer">
                <p className="text-xs text-muted">
                    ⚠️ All overrides are logged for audit purposes and will appear in the Clinical Report.
                </p>
            </div>
        </div>
    );
};

export default ClinicianOverride;
