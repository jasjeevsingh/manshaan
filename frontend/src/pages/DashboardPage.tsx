/**
 * Dashboard Page
 * 
 * Clinician dashboard showing assessment results.
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { assessmentService, emotionService } from '../services/api';
import { DomainScores } from '../components/dashboard/DomainScores';
import { EmotionTimeline } from '../components/dashboard/EmotionTimeline';
import { EvidenceDropdown } from '../components/dashboard/EvidenceDropdown';
import { ClinicianOverride } from '../components/dashboard/ClinicianOverride';
import { PDFExport } from '../components/dashboard/PDFExport';
import { AIDisclaimer } from '../components/compliance/AIDisclaimer';
import type { ClinicalInsightReport, EmotionTimeline as EmotionTimelineType } from '../types';

const DashboardPage: React.FC = () => {
    const { sessionId } = useParams<{ sessionId: string }>();
    const [report, setReport] = useState<ClinicalInsightReport | null>(null);
    const [emotionData, setEmotionData] = useState<EmotionTimelineType | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [inputSessionId, setInputSessionId] = useState('');

    // Fetch data
    useEffect(() => {
        if (!sessionId) {
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const [reportData, emotionDataResult] = await Promise.all([
                    assessmentService.getResults(sessionId),
                    emotionService.getTimeline(sessionId),
                ]);

                setReport(reportData);
                setEmotionData(emotionDataResult);
            } catch (err) {
                console.error(err);
                setError('Failed to load results. Make sure the session is complete.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [sessionId]);

    // Session ID input screen
    if (!sessionId) {
        return (
            <div className="container py-2xl">
                <div className="max-w-md mx-auto">
                    <div className="card p-lg">
                        <h2 className="text-2xl font-semibold mb-md text-center">
                            View Assessment Results
                        </h2>
                        <div>
                            <label className="label">Session ID</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="Enter session ID..."
                                value={inputSessionId}
                                onChange={(e) => setInputSessionId(e.target.value)}
                            />
                        </div>
                        <a
                            href={`/dashboard/${inputSessionId}`}
                            className={`btn btn-primary w-full mt-lg ${!inputSessionId ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                            View Results
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    // Loading
    if (isLoading) {
        return (
            <div className="container py-2xl flex justify-center items-center">
                <div className="spinner" />
            </div>
        );
    }

    // Error
    if (error || !report) {
        return (
            <div className="container py-2xl">
                <div className="max-w-md mx-auto text-center">
                    <div className="card p-lg">
                        <h2 className="text-xl font-semibold mb-md text-danger">Error</h2>
                        <p className="text-secondary">{error || 'Report not found'}</p>
                        <a href="/dashboard" className="btn btn-secondary mt-lg">
                            Try Another Session
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container py-xl">
            {/* Header */}
            <div className="page-header flex justify-between items-start flex-wrap gap-md">
                <div>
                    <h1 className="text-2xl font-bold">Clinical Insight Report</h1>
                    <p className="text-secondary text-sm mt-sm">
                        Session: {sessionId?.slice(0, 8)}... | Generated: {new Date(report.generated_at).toLocaleString()}
                    </p>
                </div>
                <div className="flex gap-sm">
                    <PDFExport sessionId={sessionId} />
                </div>
            </div>

            {/* Disclaimer */}
            <AIDisclaimer />

            {/* Main content grid */}
            <div className="grid gap-lg mt-xl" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>
                {/* Domain Scores */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-lg font-semibold">Cognitive Domain Scores</h3>
                    </div>
                    <div className="card-body">
                        <DomainScores scores={report.domain_scores} variant="radar" />
                        <div className="mt-md">
                            <DomainScores scores={report.domain_scores} variant="bar" />
                        </div>
                    </div>
                </div>

                {/* Differential Insight */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-lg font-semibold">Differential Insight</h3>
                    </div>
                    <div className="card-body">
                        <div className="mb-md">
                            <p className="font-medium text-primary mb-sm">Primary Pattern</p>
                            <p className="text-secondary">{report.differential.primary_pattern}</p>
                        </div>

                        <div className="grid gap-md" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                            <div>
                                <p className="text-sm font-medium text-danger mb-sm">ASD Indicators</p>
                                <ul className="text-sm text-secondary">
                                    {report.differential.asd_indicators.map((ind, i) => (
                                        <li key={i} className="mb-xs">• {ind}</li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-warning mb-sm">ID Indicators</p>
                                <ul className="text-sm text-secondary">
                                    {report.differential.id_indicators.map((ind, i) => (
                                        <li key={i} className="mb-xs">• {ind}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <div className="mt-md p-md bg-secondary rounded-lg">
                            <p className="text-sm">
                                <strong>Confidence:</strong> {(report.differential.differential_confidence * 100).toFixed(0)}%
                            </p>
                        </div>

                        {report.differential.clinical_notes && (
                            <div className="mt-md">
                                <p className="text-sm font-medium mb-sm">Clinical Notes</p>
                                <p className="text-sm text-secondary">{report.differential.clinical_notes}</p>
                            </div>
                        )}

                        {/* Recommendations Section */}
                        {report.differential.recommendations && report.differential.recommendations.length > 0 && (
                            <div className="mt-md p-md bg-success-light rounded-lg" style={{ backgroundColor: '#e6f7e6', border: '1px solid #52c41a' }}>
                                <p className="text-sm font-medium mb-sm" style={{ color: '#389e0d' }}>
                                    📋 Recommended Next Steps
                                </p>
                                <ul className="text-sm text-secondary">
                                    {report.differential.recommendations.map((rec: string, i: number) => (
                                        <li key={i} className="mb-xs">✓ {rec}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Emotion Timeline */}
            {emotionData && emotionData.timeline.length > 0 && (
                <div className="mt-lg">
                    <EmotionTimeline data={emotionData} />
                </div>
            )}

            {/* Evidence Section */}
            <div className="mt-lg card">
                <div className="card-header">
                    <h3 className="text-lg font-semibold">Evidence & Transparency</h3>
                    <p className="text-sm text-muted">Cures Act Non-Device CDS compliance</p>
                </div>
                <div className="card-body">
                    {report.irt_calculation_log && (
                        <EvidenceDropdown
                            title="IRT Calculation Log"
                            content={report.irt_calculation_log}
                            type="irt"
                        />
                    )}
                    <EvidenceDropdown
                        title="Evidence Summary"
                        content={report.differential.evidence_summary}
                        type="clinical"
                    />
                </div>
            </div>

            {/* Clinician Override */}
            <div className="mt-lg">
                <ClinicianOverride
                    sessionId={sessionId}
                    responses={[]}
                    clinicianId="demo-clinician"
                    onOverrideApplied={() => window.location.reload()}
                />
            </div>
        </div>
    );
};

export default DashboardPage;
