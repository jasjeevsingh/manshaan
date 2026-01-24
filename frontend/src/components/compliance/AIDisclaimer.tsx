/**
 * AI Disclaimer Component
 * 
 * AB 3030 + Cures Act compliant banner.
 * Displays on all AI-generated content.
 */

import React from 'react';

interface AIDisclaimerProps {
    phoneNumber?: string;
    variant?: 'banner' | 'inline' | 'compact';
}

export const AIDisclaimer: React.FC<AIDisclaimerProps> = ({
    phoneNumber = '1-800-MANSHAAN',
    variant = 'banner',
}) => {
    const WarningIcon = () => (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                fill="currentColor"
            />
        </svg>
    );

    if (variant === 'compact') {
        return (
            <div className="flex items-center gap-2 text-xs text-danger">
                <WarningIcon />
                <span>AI-generated. Not a diagnosis.</span>
            </div>
        );
    }

    if (variant === 'inline') {
        return (
            <p className="text-sm text-danger mt-md">
                ⚠️ This is an AI-generated Clinical Insight Report. This is NOT a diagnosis.
                Please consult a licensed healthcare provider at{' '}
                <strong>{phoneNumber}</strong>.
            </p>
        );
    }

    return (
        <div className="disclaimer-banner">
            <WarningIcon />
            <div>
                <strong>AI-Generated Content</strong>
                <p style={{ margin: 0, marginTop: '0.25rem' }}>
                    This is an AI-generated <strong>Clinical Insight Report</strong>. This is{' '}
                    <strong>NOT a diagnosis</strong>. Please consult a licensed healthcare provider
                    for medical advice. Contact: <strong>{phoneNumber}</strong>
                </p>
            </div>
        </div>
    );
};

export default AIDisclaimer;
