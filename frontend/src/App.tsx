/**
 * Main App Component
 *
 * Entry point for Manshaan platform frontend.
 * Sets up routing and providers.
 */

import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import ProtectedRoute from './components/auth/ProtectedRoute';
import logoImage from './logo/manshaan-logo.jpeg';

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

/** Remounts on route change so mobile menu state resets without setState-in-effect. */
const NavigationShell: React.FC = () => {
  const { pathname } = useLocation();
  return <Navigation key={pathname} />;
};

const Navigation: React.FC = () => {
  const { user } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  const linkClassLoggedInPrimary =
    'btn btn-sm w-full md:w-auto text-center justify-center';
  const linkClassLoggedInGhost =
    'btn btn-sm w-full md:w-auto text-center justify-center';
  const linkClassGuestTransparent =
    'btn btn-sm w-full md:w-auto text-center justify-center';
  const linkClassGuestOutline =
    'btn btn-sm w-full md:w-auto text-center justify-center';

  return (
    <nav className="sticky top-0 z-40 nav-app-bar shadow-sm">
      <div className="container flex items-center justify-between py-md gap-md">
        <Link
          to="/"
          className="flex items-center gap-sm font-bold text-xl shrink-0 min-w-0"
          style={{ color: 'white' }}
          onClick={closeMenu}
        >
          <img
            src={logoImage}
            alt="Manshaan Logo"
            style={{ height: '40px', width: 'auto', borderRadius: '8px' }}
          />
          <span className="truncate">Manshaan</span>
        </Link>

        <button
          type="button"
          className="md:hidden flex flex-col justify-center gap-1.5 p-2 rounded-md border border-white/40 text-white hover:bg-white/10 transition"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="block w-6 h-0.5 bg-white rounded-full" />
          <span className="block w-6 h-0.5 bg-white rounded-full" />
          <span className="block w-6 h-0.5 bg-white rounded-full" />
        </button>

        <div className="hidden md:flex items-center gap-md flex-wrap justify-end">
          {user ? (
            <>
              <Link
                to="/assessment"
                className="btn btn-sm"
                style={{ background: 'white', color: 'var(--color-primary)' }}
              >
                Start Assessment
              </Link>
              <Link
                to="/dashboard"
                className="btn btn-sm"
                style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.5)' }}
              >
                Dashboard
              </Link>
              <Link
                to="/profile"
                className="btn btn-sm"
                style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.5)' }}
              >
                Profile
              </Link>
            </>
          ) : (
            <>
              <Link to="/about" className="btn btn-sm" style={{ background: 'transparent', color: 'white' }}>
                About
              </Link>
              <Link
                to="/simulation"
                className="btn btn-sm"
                style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.5)' }}
              >
                See a Demo
              </Link>
              <Link
                to="/login"
                className="btn btn-sm"
                style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.5)' }}
              >
                Sign In
              </Link>
              <Link to="/register" className="btn btn-sm" style={{ background: 'white', color: 'var(--color-primary)' }}>
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-white/20 nav-mobile-panel">
          <div className="container flex flex-col gap-sm py-md">
            {user ? (
              <>
                <Link
                  to="/assessment"
                  className={linkClassLoggedInPrimary}
                  style={{ background: 'white', color: 'var(--color-primary)' }}
                  onClick={closeMenu}
                >
                  Start Assessment
                </Link>
                <Link
                  to="/dashboard"
                  className={linkClassLoggedInGhost}
                  style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.5)' }}
                  onClick={closeMenu}
                >
                  Dashboard
                </Link>
                <Link
                  to="/profile"
                  className={linkClassLoggedInGhost}
                  style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.5)' }}
                  onClick={closeMenu}
                >
                  Profile
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/about"
                  className={linkClassGuestTransparent}
                  style={{ background: 'transparent', color: 'white' }}
                  onClick={closeMenu}
                >
                  About
                </Link>
                <Link
                  to="/simulation"
                  className={linkClassGuestOutline}
                  style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.5)' }}
                  onClick={closeMenu}
                >
                  See a Demo
                </Link>
                <Link
                  to="/login"
                  className={linkClassGuestOutline}
                  style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.5)' }}
                  onClick={closeMenu}
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className={linkClassGuestTransparent}
                  style={{ background: 'white', color: 'var(--color-primary)' }}
                  onClick={closeMenu}
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

const Footer: React.FC = () => (
  <footer className="py-lg mt-2xl" style={{ background: 'var(--color-primary)' }}>
    <div className="container">
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
        <NavigationShell />

        <main className="flex-1">
          <React.Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/simulation" element={<SimulationPage />} />

              {/* Protected Routes */}
              <Route
                path="/assessment"
                element={
                  <ProtectedRoute>
                    <AssessmentPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/:sessionId"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </React.Suspense>
        </main>

        <Footer />
      </div>
    </BrowserRouter>
  );
};

export default App;
