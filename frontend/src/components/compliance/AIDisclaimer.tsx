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
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="#fbbf24"
            />
        </svg>
    );

    // if (variant === 'compact') {
    //     return (
    //         <div className="flex items-center gap-2 text-xs text-danger">
    //             <WarningIcon />
    //             <span>AI-generated. Not a diagnosis.</span>
    //         </div>
    //     );
    // }

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
                <strong style={{ fontSize: '1rem', display: 'block', marginBottom: '0.5rem' }}>
                    AI-Generated Content
                </strong>
                <p style={{ margin: 0 }}>
                    This is an AI-generated <strong>Clinical Insight Report</strong>. This is{' '}
                    <strong>NOT a diagnosis</strong>. Please consult a licensed healthcare provider
                    for medical advice.
                </p>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8125rem' }}>
                    Contact: <strong>{phoneNumber}</strong>
                </p>
            </div>
        </div>
    );
};

export default AIDisclaimer;
