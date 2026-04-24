/**
 * Right-column brand panel for login/register (lg+).
 */

import React from 'react';
import ManshaanSoftIllustration from '../marketing/ManshaanSoftIllustration';

const AuthBrandPanel: React.FC = () => {
    return (
        <div className="auth-brand-panel hidden lg:flex min-h-screen flex-col justify-center px-10 xl:px-14 text-white">
            <div className="max-w-md mx-auto w-full">
                <div className="text-white/90 mb-6">
                    <ManshaanSoftIllustration size="lg" className="text-white" />
                </div>
                <h2 className="text-2xl xl:text-3xl font-bold tracking-tight mb-4 text-balance">
                    Screening built for clarity—not labels alone
                </h2>
                <ul className="space-y-3 text-base text-white/88 leading-relaxed list-none p-0 m-0">
                    <li className="flex gap-3">
                        <span className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-white/70" aria-hidden />
                        <span>Research-backed adaptive tasks across cognitive domains.</span>
                    </li>
                    <li className="flex gap-3">
                        <span className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-white/70" aria-hidden />
                        <span>Results are meant to support discussion with a licensed clinician.</span>
                    </li>
                    <li className="flex gap-3">
                        <span className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-white/70" aria-hidden />
                        <span>Not a diagnosis on their own—just clearer signal for your care team.</span>
                    </li>
                </ul>
            </div>
        </div>
    );
};

export default AuthBrandPanel;
