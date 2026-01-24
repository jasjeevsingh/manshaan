/**
 * Evidence Dropdown Component
 * 
 * Collapsible panel showing raw evidence for AI transparency.
 * Satisfies Cures Act Non-Device CDS requirements.
 */

import React, { useState } from 'react';

interface EvidenceDropdownProps {
    title: string;
    content: string;
    type?: 'transcript' | 'irt' | 'clinical' | 'raw';
}

export const EvidenceDropdown: React.FC<EvidenceDropdownProps> = ({
    title,
    content,
    type = 'raw',
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const typeIcons = {
        transcript: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
            </svg>
        ),
        irt: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z" />
            </svg>
        ),
        clinical: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
            </svg>
        ),
        raw: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
            </svg>
        ),
    };

    return (
        <div className="evidence-dropdown">
            <div
                className="evidence-dropdown-header"
                onClick={() => setIsOpen(!isOpen)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-sm">
                    {typeIcons[type]}
                    <span>Show Evidence: {title}</span>
                </div>
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    style={{
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                    }}
                >
                    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                </svg>
            </div>

            {isOpen && (
                <div className="evidence-dropdown-content">
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {content}
                    </pre>
                </div>
            )}
        </div>
    );
};

export default EvidenceDropdown;
