/**
 * PDF Export Button Component
 * 
 * Generates and downloads Clinical Insight Report PDF.
 */

import React, { useState } from 'react';
import { assessmentService } from '../../services/api';

interface PDFExportProps {
    sessionId: string;
    disabled?: boolean;
}

export const PDFExport: React.FC<PDFExportProps> = ({ sessionId, disabled }) => {
    const [isGenerating, setIsGenerating] = useState(false);

    const handleExport = async () => {
        setIsGenerating(true);
        try {
            const blob = await assessmentService.getResultsPdf(sessionId);

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `clinical_report_${sessionId.slice(0, 8)}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('PDF export error:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={disabled || isGenerating}
        >
            {isGenerating ? (
                <>
                    <div className="spinner" style={{ width: 16, height: 16 }} />
                    Generating PDF...
                </>
            ) : (
                <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                    </svg>
                    Generate Clinical PDF
                </>
            )}
        </button>
    );
};

export default PDFExport;
