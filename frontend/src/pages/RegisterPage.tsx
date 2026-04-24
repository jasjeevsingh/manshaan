/**
 * Register Page
 *
 * New user registration with email/password and Google OAuth.
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import AuthBrandPanel from '../components/auth/AuthBrandPanel';
import GoogleIcon from '../components/auth/GoogleIcon';

const RegisterPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleEmailRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: name,
                    },
                },
            });

            if (signUpError) throw signUpError;

            if (data.user) {
                const { error: profileError } = await supabase.from('profiles').insert([
                    {
                        id: data.user.id,
                        email: data.user.email,
                        name: name,
                        role: 'parent',
                        provider: 'email',
                    },
                ]);

                if (profileError) throw profileError;

                navigate('/');
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to create account');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleRegister = async () => {
        setError('');
        setLoading(true);

        try {
            const { error: oauthError } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/`,
                },
            });

            if (oauthError) throw oauthError;
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to sign up with Google');
            setLoading(false);
        }
    };

    return (
        <div className="auth-page-shell grid grid-cols-1 lg:grid-cols-2 min-h-screen">
            <div className="flex items-center justify-center px-8 py-12">
                <div className="w-full max-w-md">
                    <h1 className="text-4xl font-bold tracking-tight mb-1 text-[var(--color-text-primary)]">
                        Manshaan
                    </h1>

                    <h2 className="text-2xl font-semibold mt-6 mb-2 text-[var(--color-text-primary)]">
                        Create your account
                    </h2>

                    <p className="text-secondary mb-8">
                        Start tracking your child&apos;s developmental progress with structured screening.
                    </p>

                    {error && (
                        <div className="disclaimer-banner mb-md max-w-none">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleEmailRegister} className="flex flex-col gap-md">
                        <div>
                            <label className="label" htmlFor="register-name">
                                Full name
                            </label>
                            <input
                                id="register-name"
                                type="text"
                                className="input"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                disabled={loading}
                                placeholder="Jane Doe"
                                autoComplete="name"
                            />
                        </div>

                        <div>
                            <label className="label" htmlFor="register-email">
                                Email
                            </label>
                            <input
                                id="register-email"
                                type="email"
                                className="input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={loading}
                                placeholder="parent@example.com"
                                autoComplete="email"
                            />
                        </div>

                        <div>
                            <label className="label" htmlFor="register-password">
                                Password
                            </label>
                            <input
                                id="register-password"
                                type="password"
                                className="input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={8}
                                disabled={loading}
                                placeholder="••••••••"
                                autoComplete="new-password"
                            />
                            <p className="text-xs text-muted mt-sm">At least 8 characters</p>
                        </div>

                        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
                            {loading ? 'Creating account…' : 'Create account'}
                        </button>
                    </form>

                    <div className="flex items-center gap-md my-md">
                        <div className="flex-1 border-t" style={{ borderColor: 'var(--color-border)' }} />
                        <span className="text-muted text-sm">or</span>
                        <div className="flex-1 border-t" style={{ borderColor: 'var(--color-border)' }} />
                    </div>

                    <button
                        type="button"
                        onClick={handleGoogleRegister}
                        className="btn btn-secondary btn-lg w-full flex items-center justify-center gap-sm"
                        disabled={loading}
                    >
                        <GoogleIcon />
                        Continue with Google
                    </button>

                    <p className="mt-8 text-center text-sm text-secondary">
                        Already have an account?{' '}
                        <Link to="/login" className="text-primary font-medium">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>

            <AuthBrandPanel />
        </div>
    );
};

export default RegisterPage;
