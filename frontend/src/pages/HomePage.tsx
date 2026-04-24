/**
 * Home Page
 *
 * Pre-login: marketing hero with gradient (optional hero image slot).
 * Post-login: welcome hub with quick links and children summary.
 */

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import heroBackground from '../logo/manshaan-hero-background.jpg';
import ManshaanSoftIllustration from '../components/marketing/ManshaanSoftIllustration';

const HERO_BACKGROUND_URL: string = heroBackground;

function HubIconBox({
    className,
    children,
}: {
    className: string;
    children: React.ReactNode;
}) {
    return (
        <div
            className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${className}`}
            aria-hidden
        >
            {children}
        </div>
    );
}

const HomePage: React.FC = () => {
    const { user, children } = useAuthStore();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const displayName =
        (user?.user_metadata?.full_name as string | undefined)?.trim() ||
        user?.email?.split('@')[0] ||
        'there';

    const firstChildName = children[0]?.name;

    if (user) {
        const hasChildProfile = children.length > 0;

        return (
            <div className="hero-gradient min-h-screen flex flex-col items-center px-4 py-8 md:py-12">
                <div className="container w-full max-w-4xl">
                    <div className="card p-lg md:p-xl mb-lg text-center md:text-left">
                        <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] mb-sm">
                            Welcome back, {displayName}
                        </h1>
                        <p className="text-secondary text-base md:text-lg mb-sm">
                            Choose an action below to continue with Manshaan.
                        </p>
                        <p className="text-secondary text-sm md:text-base leading-relaxed max-w-2xl">
                            Take your time. Screening is meant to support a conversation with your
                            clinician, not replace it.
                            {firstChildName ? (
                                <>
                                    {' '}
                                    When you&apos;re ready, you can use the steps below for{' '}
                                    <span className="text-[var(--color-text-primary)] font-medium">
                                        {firstChildName}
                                    </span>
                                    .
                                </>
                            ) : null}
                        </p>
                    </div>

                    <div className="card p-lg mb-lg">
                        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-md">
                            Getting started
                        </h2>
                        <ol className="list-none p-0 m-0 space-y-md">
                            <li className="flex gap-md items-start">
                                <span
                                    className={`shrink-0 mt-0.5 h-7 w-7 rounded-full flex items-center justify-center text-sm font-bold ${
                                        hasChildProfile
                                            ? 'bg-[var(--color-success)] text-white'
                                            : 'bg-[var(--color-primary-100)] text-[var(--color-primary)]'
                                    }`}
                                    aria-hidden
                                >
                                    {hasChildProfile ? '✓' : '1'}
                                </span>
                                <div className="min-w-0">
                                    <p className="font-medium text-[var(--color-text-primary)]">
                                        Add a child profile
                                    </p>
                                    <p className="text-secondary text-sm mt-sm">
                                        {hasChildProfile
                                            ? 'At least one child is on file. You can add or edit profiles anytime.'
                                            : 'Add your child so assessments stay tied to the right context.'}
                                    </p>
                                    {!hasChildProfile && (
                                        <Link to="/profile" className="btn btn-primary btn-sm mt-sm inline-flex">
                                            Go to profile
                                        </Link>
                                    )}
                                </div>
                            </li>
                            <li className="flex gap-md items-start">
                                <span
                                    className="shrink-0 mt-0.5 h-7 w-7 rounded-full flex items-center justify-center text-sm font-bold bg-[var(--color-primary-100)] text-[var(--color-primary)]"
                                    aria-hidden
                                >
                                    2
                                </span>
                                <div className="min-w-0">
                                    <p className="font-medium text-[var(--color-text-primary)]">
                                        Start an assessment
                                    </p>
                                    <p className="text-secondary text-sm mt-sm">
                                        Begin a new screening session when you have a calm window of time.
                                    </p>
                                    <Link to="/assessment" className="btn btn-secondary btn-sm mt-sm inline-flex">
                                        Start assessment
                                    </Link>
                                </div>
                            </li>
                            <li className="flex gap-md items-start">
                                <span
                                    className="shrink-0 mt-0.5 h-7 w-7 rounded-full flex items-center justify-center text-sm font-bold bg-[var(--color-primary-100)] text-[var(--color-primary)]"
                                    aria-hidden
                                >
                                    3
                                </span>
                                <div className="min-w-0">
                                    <p className="font-medium text-[var(--color-text-primary)]">
                                        Review results on the dashboard
                                    </p>
                                    <p className="text-secondary text-sm mt-sm">
                                        After a session completes, open Dashboard and enter your session ID to
                                        view the clinical insight report.
                                    </p>
                                    <Link to="/dashboard" className="btn btn-secondary btn-sm mt-sm inline-flex">
                                        Open dashboard
                                    </Link>
                                </div>
                            </li>
                        </ol>
                    </div>

                    <div
                        className="grid gap-lg mb-lg"
                        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
                    >
                        <Link
                            to="/assessment"
                            className="card card-interactive p-lg no-underline flex flex-row items-start gap-md"
                        >
                            <HubIconBox className="bg-domain-memory">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                                    <path
                                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                                        stroke="white"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </HubIconBox>
                            <div className="flex flex-col items-start gap-sm min-w-0">
                                <span className="text-primary font-semibold text-lg">Start assessment</span>
                                <span className="text-secondary text-sm">
                                    Begin or continue a neurodevelopmental screening session.
                                </span>
                            </div>
                        </Link>
                        <Link
                            to="/dashboard"
                            className="card card-interactive p-lg no-underline flex flex-row items-start gap-md"
                        >
                            <HubIconBox className="bg-domain-executive">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                                    <path
                                        d="M18 20V10M12 20V4M6 20v-6"
                                        stroke="white"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            </HubIconBox>
                            <div className="flex flex-col items-start gap-sm min-w-0">
                                <span className="text-primary font-semibold text-lg">View dashboard</span>
                                <span className="text-secondary text-sm">
                                    Enter a session ID to review assessment results.
                                </span>
                            </div>
                        </Link>
                        <Link
                            to="/profile"
                            className="card card-interactive p-lg no-underline flex flex-row items-start gap-md"
                        >
                            <HubIconBox className="bg-domain-working">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                                    <path
                                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                        stroke="white"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </HubIconBox>
                            <div className="flex flex-col items-start gap-sm min-w-0">
                                <span className="text-primary font-semibold text-lg">Manage profile</span>
                                <span className="text-secondary text-sm">
                                    Update your account and child profiles.
                                </span>
                            </div>
                        </Link>
                    </div>

                    <div className="card p-lg">
                        <h2 className="text-lg font-semibold mb-md">Children</h2>
                        {children.length > 0 ? (
                            <>
                                <ul className="list-none p-0 m-0 mb-md">
                                    {children.map((c) => (
                                        <li key={c.id} className="text-secondary py-1">
                                            {c.name}
                                        </li>
                                    ))}
                                </ul>
                                <Link to="/profile" className="btn btn-secondary btn-sm">
                                    Manage children in profile
                                </Link>
                            </>
                        ) : (
                            <>
                                <p className="text-secondary text-sm mb-md">
                                    Add your child&apos;s profile to get started with assessments.
                                </p>
                                <Link to="/profile" className="btn btn-primary btn-sm">
                                    Go to profile
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen hero-gradient flex flex-col items-center justify-center px-4 py-12 md:py-16">
            <div
                className="absolute inset-0 z-0 bg-cover bg-center opacity-45 pointer-events-none"
                style={{ backgroundImage: `url(${HERO_BACKGROUND_URL})` }}
                aria-hidden
            />
            <div className="hero-light-card hero-light-card-warm relative z-10 w-full max-w-3xl mx-auto backdrop-blur-sm bg-white/80 rounded-2xl text-center shadow-lg border px-6 py-8 md:px-12 md:py-10">
                <div className="flex flex-col items-center gap-sm mb-md">
                    <div className="hero-card-top-accent" aria-hidden />
                    <ManshaanSoftIllustration size="md" className="text-[var(--color-primary)] opacity-90" />
                </div>
                <h1 className="hero-light-title font-bold mb-md md:mb-lg text-3xl sm:text-4xl md:text-5xl leading-tight">
                    Understand Your Child&apos;s Development
                    <br />
                    <span className="text-[var(--color-accent)]">with Confidence</span>
                </h1>

                <p className="hero-light-lead text-base md:text-lg mb-xl md:mb-2xl max-w-xl mx-auto leading-relaxed">
                    A comprehensive, research-backed screening tool for idiopathic neurodevelopmental
                    conditions. Results support clinical discussion; they are not a diagnosis on their own.
                </p>

                <div className="flex flex-col sm:flex-row gap-md justify-center items-stretch sm:items-center">
                    <Link to="/assessment" className="btn btn-primary btn-lg w-full sm:w-auto">
                        Start Assessment
                    </Link>
                    <Link to="/about" className="btn btn-secondary btn-lg w-full sm:w-auto">
                        Learn More
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
