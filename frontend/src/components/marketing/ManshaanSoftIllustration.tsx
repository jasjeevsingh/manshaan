/**
 * Abstract SVG motif: gentle growth arc and soft nodes (care + development).
 * Used on auth brand panel and guest hero; no external assets.
 */

import React from 'react';

export interface ManshaanSoftIllustrationProps {
    className?: string;
    /** Visual size of the SVG box */
    size?: 'sm' | 'md' | 'lg';
}

const sizeMap = { sm: 120, md: 200, lg: 280 };

const ManshaanSoftIllustration: React.FC<ManshaanSoftIllustrationProps> = ({
    className = '',
    size = 'md',
}) => {
    const dim = sizeMap[size];
    return (
        <svg
            className={className}
            width={dim}
            height={Math.round(dim * 0.55)}
            viewBox="0 0 200 110"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
        >
            <path
                d="M8 88 C 45 20, 95 12, 192 28"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity="0.45"
            />
            <circle cx="38" cy="72" r="10" fill="currentColor" opacity="0.2" />
            <circle cx="98" cy="38" r="14" fill="currentColor" opacity="0.28" />
            <circle cx="158" cy="48" r="9" fill="currentColor" opacity="0.22" />
            <path
                d="M72 82 L88 58 L104 70 L130 44"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.35"
            />
        </svg>
    );
};

export default ManshaanSoftIllustration;
