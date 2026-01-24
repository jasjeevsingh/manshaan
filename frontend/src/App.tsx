/**
 * Main App Component
 * 
 * Entry point for Manshaan platform frontend.
 * Sets up routing and providers.
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AIDisclaimer } from './components/compliance/AIDisclaimer';
import { useAuthStore } from './stores/authStore';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Lazy load pages for code splitting
const HomePage = React.lazy(() => import('./pages/HomePage'));
const AssessmentPage = React.lazy(() => import('./pages/AssessmentPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const SimulationPage = React.lazy(() => import('./pages/SimulationPage'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));

const LoadingSpinner: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="spinner" />
  </div>
);

const Navigation: React.FC = () => {
  const { user, signOut } = useAuthStore();

  return (
    <nav className="bg-card shadow-sm border-b sticky top-0 z-40">
      <div className="container flex items-center justify-between py-md">
        <Link to="/" className="flex items-center gap-sm text-primary font-bold text-xl">
          <svg width="32" height="32" viewBox="0 0 100 100" fill="currentColor">
            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" />
            <path d="M30 50 L45 65 L70 35" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="50" cy="25" r="6" />
            <circle cx="75" cy="50" r="6" />
            <circle cx="50" cy="75" r="6" />
            <circle cx="25" cy="50" r="6" />
          </svg>
          Manshaan
        </Link>

        <div className="flex items-center gap-md">
          {user ? (
            <>
              <Link to="/assessment" className="btn btn-primary btn-sm">
                Start Assessment
              </Link>
              <Link to="/dashboard" className="btn btn-secondary btn-sm">
                Dashboard
              </Link>
              <Link to="/profile" className="btn btn-secondary btn-sm">
                Profile
              </Link>
            </>
          ) : (
            <>
              <Link to="/simulation" className="btn btn-secondary btn-sm">
                IRT Demo
              </Link>
              <Link to="/login" className="btn btn-secondary btn-sm">
                Sign In
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

const Footer: React.FC = () => (
  <footer className="bg-secondary py-lg mt-2xl">
    <div className="container">
      <AIDisclaimer variant="inline" />
      <p className="text-xs text-muted mt-md text-center">
        © 2026 Manshaan Platform. For research and clinical screening purposes only.
        <br />
        Not a diagnostic tool. Results must be interpreted by licensed healthcare providers.
      </p>
    </div>
  </footer>
);

const App: React.FC = () => {
  const { initialize, initialized } = useAuthStore();

  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialize, initialized]);

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Navigation />

        <main className="flex-1">
          <React.Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/simulation" element={<SimulationPage />} />

              {/* Protected Routes */}
              <Route path="/assessment" element={
                <ProtectedRoute>
                  <AssessmentPage />
                </ProtectedRoute>
              } />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              } />
              <Route path="/dashboard/:sessionId" element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              } />
            </Routes>
          </React.Suspense>
        </main>

        <Footer />
      </div>
    </BrowserRouter>
  );
};

export default App;
