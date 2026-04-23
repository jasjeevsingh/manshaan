/**
 * Home Page
 *
 * Pre-login: marketing hero with gradient (optional hero image slot).
 * Post-login: welcome hub with quick links and children summary.
 */

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

/** When you add a professional hero asset, import it and assign here, e.g.:
 * import heroBackground from '../logo/hero-background.jpg';
 * const HERO_BACKGROUND_URL: string | null = heroBackground;
 */
const HERO_BACKGROUND_URL: string | null = null;

const HomePage: React.FC = () => {
    const { user, children } = useAuthStore();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const displayName =
        (user?.user_metadata?.full_name as string | undefined)?.trim() ||
        user?.email?.split('@')[0] ||
        'there';

    if (user) {
        return (
            <div className="hero-gradient min-h-screen flex flex-col items-center px-4 py-8 md:py-12">
                <div className="container w-full max-w-4xl">
                    <div className="card p-lg md:p-xl mb-lg text-center md:text-left">
                        <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] mb-sm">
                            Welcome back, {displayName}
                        </h1>
                        <p className="text-secondary text-base md:text-lg">
                            Choose an action below to continue with Manshaan.
                        </p>
                    </div>

                    <div
                        className="grid gap-lg mb-lg"
                        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
                    >
                        <Link
                            to="/assessment"
                            className="card card-interactive p-lg no-underline flex flex-col items-start gap-sm"
                        >
                            <span className="text-primary font-semibold text-lg">Start Assessment</span>
                            <span className="text-secondary text-sm">
                                Begin or continue a neurodevelopmental screening session.
                            </span>
                        </Link>
                        <Link
                            to="/dashboard"
                            className="card card-interactive p-lg no-underline flex flex-col items-start gap-sm"
                        >
                            <span className="text-primary font-semibold text-lg">View Dashboard</span>
                            <span className="text-secondary text-sm">
                                Enter a session ID to review assessment results.
                            </span>
                        </Link>
                        <Link
                            to="/profile"
                            className="card card-interactive p-lg no-underline flex flex-col items-start gap-sm"
                        >
                            <span className="text-primary font-semibold text-lg">Manage Profile</span>
                            <span className="text-secondary text-sm">
                                Update your account and child profiles.
                            </span>
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
                                    Manage children in Profile
                                </Link>
                            </>
                        ) : (
                            <p className="text-secondary text-sm mb-md">
                                Add your child&apos;s profile to get started with assessments.
                            </p>
                        )}
                        {children.length === 0 && (
                            <Link to="/profile" className="btn btn-primary btn-sm">
                                Go to Profile
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen hero-gradient flex flex-col items-center justify-center px-4 py-12 md:py-16">
            {HERO_BACKGROUND_URL && (
                <div
                    className="absolute inset-0 z-0 bg-cover bg-center opacity-35 pointer-events-none"
                    style={{ backgroundImage: `url(${HERO_BACKGROUND_URL})` }}
                    aria-hidden
                />
            )}
            <div
                className="relative z-10 w-full max-w-3xl mx-auto backdrop-blur-sm bg-white/80 rounded-2xl text-center shadow-lg border border-[var(--color-border)] px-6 py-8 md:px-12 md:py-10"
            >
                <h1 className="font-bold mb-md md:mb-lg text-3xl sm:text-4xl md:text-5xl leading-tight text-[var(--color-text-primary)]">
                    Understand Your Child&apos;s Development
                    <br />
                    <span className="text-[var(--color-accent)]">with Confidence</span>
                </h1>

                <p className="text-base md:text-lg mb-xl md:mb-2xl text-secondary max-w-xl mx-auto leading-relaxed">
                    A comprehensive, research-backed screening tool for neurodevelopmental
                    conditions—guided by adaptive AI. Results support clinical discussion; they are
                    not a diagnosis on their own.
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
