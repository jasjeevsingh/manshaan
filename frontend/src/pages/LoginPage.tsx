/**
 * Login Page
 *
 * User authentication with email/password and Google OAuth.
 * Manshaan – image-free, calm diagnostic UI
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import logoImage from '../logo/manshaan-logo.jpeg';

import { useAuthStore } from '../stores/authStore';

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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sign in with Google');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2" style={{ background: 'linear-gradient(135deg, #eef2ff, #f5f3ff, #fff7ed)' }}>

      {/* LEFT — LOGIN FORM */}
      <div className="flex items-center justify-center px-8">
        <div className="w-full max-w-md">

          {/* Replace logo.svg later if you want */}
          <h1 className="text-4xl font-bold tracking-tight mb-1" style={{ color: '#000000' }}>
            Manshaan
          </h1>

          <h2 className="text-2xl font-semibold mt-6 mb-2" style={{ color: '#000000' }}>
            Welcome Back
          </h2>

          <p className="mb-8" style={{ color: '#000000' }}>
            Access your child's assessment history
          </p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium" style={{ color: '#000000' }}>
                Email
              </label>
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none"
                style={{ color: '#000000' }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium" style={{ color: '#000000' }}>
                Password
              </label>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none"
                style={{ color: '#000000' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-gradient-to-r from-indigo-500 via-purple-500 to-orange-400 py-2.5 font-medium hover:opacity-90 transition text-white"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-gray-200" />
            <span className="mx-3 text-sm" style={{ color: '#000000' }}>or</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-lg border border-gray-300 py-2.5 hover:bg-gray-50 transition"
            style={{ color: '#000000' }}
          >
            <img
              src="https://www.svgrepo.com/show/475656/google-color.svg"
              alt="Google"
              className="h-5"
            />
            Continue with Google
          </button>

          <p className="mt-8 text-center text-sm" style={{ color: '#000000' }}>
            Don't have an account?{' '}
            <Link to="/register" className="text-indigo-600 font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* RIGHT — LOGO */}
      <div className="hidden lg:flex items-center justify-center">
        <img
          src={logoImage}
          alt="Manshaan Logo"
          style={{
            maxWidth: '80%',
            maxHeight: '80%',
            objectFit: 'contain',
            borderRadius: '1rem',
          }}
        />
      </div>
    </div>
  );
};

export default LoginPage;
