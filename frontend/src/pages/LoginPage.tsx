/**
 * Login Page
 *
 * User authentication with email/password and Google OAuth.
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../stores/authStore';
import AuthBrandPanel from '../components/auth/AuthBrandPanel';
import GoogleIcon from '../components/auth/GoogleIcon';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { setSession, setUser } = useAuthStore();

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) throw signInError;

            if (data.session) {
                setSession(data.session);
                setUser(data.user);
                console.log('Login success - session set manually');
            } else {
                console.warn('Login success but no session returned');
            }

            navigate('/');
        } catch (err: unknown) {
            console.error('Login error:', err);
            setError(err instanceof Error ? err.message : 'Failed to sign in');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError('');
        setLoading(true);

        try {
            const { error: oauthError } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: `${window.location.origin}/` },
            });
            if (oauthError) throw oauthError;
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to sign in with Google');
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
                        Welcome back
                    </h2>

                    <p className="text-secondary mb-8">Access your child&apos;s assessment history.</p>

                    {error && (
                        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 border border-red-100">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleEmailLogin} className="flex flex-col gap-lg">
                        <div>
                            <label className="label" htmlFor="login-email">
                                Email
                            </label>
                            <input
                                id="login-email"
                                type="email"
                                className="input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={loading}
                                autoComplete="email"
                            />
                        </div>

                        <div>
                            <label className="label" htmlFor="login-password">
                                Password
                            </label>
                            <input
                                id="login-password"
                                type="password"
                                className="input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={loading}
                                autoComplete="current-password"
                            />
                        </div>

                        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
                            {loading ? 'Signing in…' : 'Sign in'}
                        </button>
                    </form>

                    <div className="flex items-center gap-md my-md">
                        <div className="flex-1 border-t" style={{ borderColor: 'var(--color-border)' }} />
                        <span className="text-muted text-sm">or</span>
                        <div className="flex-1 border-t" style={{ borderColor: 'var(--color-border)' }} />
                    </div>

                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="btn btn-secondary btn-lg w-full flex items-center justify-center gap-sm"
                    >
                        <GoogleIcon />
                        Continue with Google
                    </button>

                    <p className="mt-8 text-center text-sm text-secondary">
                        Don&apos;t have an account?{' '}
                        <Link to="/register" className="text-primary font-medium">
                            Sign up
                        </Link>
                    </p>
                </div>
            </div>

            <AuthBrandPanel />
        </div>
    );
};

export default LoginPage;
