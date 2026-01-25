/**
 * Main App Component
 * 
 * Entry point for Manshaan platform frontend.
 * Sets up routing and providers.
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import ProtectedRoute from './components/auth/ProtectedRoute';
import logoImage from './logo/WhatsApp Image 2026-01-24 at 12.04.53.jpeg';

// Lazy load pages for code splitting
const HomePage = React.lazy(() => import('./pages/HomePage'));
const AboutPage = React.lazy(() => import('./pages/AboutPage'));
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
  const { user } = useAuthStore();

  return (
    <nav className="sticky top-0 z-40" style={{ background: 'var(--color-primary)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <div className="container flex items-center justify-between py-md">
        <Link to="/" className="flex items-center gap-sm font-bold text-xl" style={{ color: 'white' }}>
          <img
            src={logoImage}
            alt="Manshaan Logo"
            style={{ height: '40px', width: 'auto', borderRadius: '8px' }}
          />
          Manshaan
        </Link>

        <div className="flex items-center gap-md">
          {user ? (
            <>
              <Link to="/assessment" className="btn btn-sm" style={{ background: 'white', color: 'var(--color-primary)' }}>
                Start Assessment
              </Link>
              <Link to="/dashboard" className="btn btn-sm" style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.5)' }}>
                Dashboard
              </Link>
              <Link to="/profile" className="btn btn-sm" style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.5)' }}>
                Profile
              </Link>
            </>
          ) : (
            <>
              <Link to="/about" className="btn btn-sm" style={{ background: 'transparent', color: 'white' }}>
                About
              </Link>
              <Link to="/simulation" className="btn btn-sm" style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.5)' }}>
                IRT Demo
              </Link>
              <Link to="/login" className="btn btn-sm" style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.5)' }}>
                Sign In
              </Link>
              <Link to="/register" className="btn btn-sm" style={{ background: 'white', color: 'var(--color-primary)' }}>
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
  <footer className="py-lg mt-2xl" style={{ background: 'var(--color-primary)' }}>
    <div className="container">
      {/* <p className="text-sm mt-md text-center" style={{ color: 'rgba(255,255,255,0.9)' }}>
        AI-Generated Content - This is NOT a diagnosis. Please consult a licensed healthcare provider.
      </p> */}
      <p className="text-xs mt-md text-center" style={{ color: 'rgba(255,255,255,0.7)' }}>
        © 2026 Manshaan AI. For research and clinical screening purposes only.
        <br />
        Results must be interpreted by a licensed healthcare provider to make an official diagnosis.
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
              <Route path="/about" element={<AboutPage />} />
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
