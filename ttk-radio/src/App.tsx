import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { NavBar } from './components/shared/NavBar'
import { PrivateRoute } from './guards/PrivateRoute'
import { ToastContainer } from './components/shared/Toast'
import { ErrorBoundary } from './components/shared/ErrorBoundary'

/* Lazy-loaded pages for code splitting */
const AuthPage   = lazy(() => import('./pages/auth/AuthPage').then(m => ({ default: m.AuthPage })))
const PlayerPage = lazy(() => import('./pages/player/PlayerPage').then(m => ({ default: m.PlayerPage })))
const HostPage   = lazy(() => import('./pages/host/HostPage').then(m => ({ default: m.HostPage })))
const AdminPage   = lazy(() => import('./pages/admin/AdminPage').then(m => ({ default: m.AdminPage })))
const HistoryPage        = lazy(() => import('./pages/history/HistoryPage').then(m => ({ default: m.HistoryPage })))
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage  = lazy(() => import('./pages/auth/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })))

function PageLoader() {
  return (
    <div style={{
      minHeight: 'calc(100vh - 52px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ animation: 'spin 0.9s linear infinite' }}>
          <circle cx="16" cy="16" r="13" stroke="#E0E0E0" strokeWidth="3"/>
          <path d="M16 3a13 13 0 0 1 13 13" stroke="#E3001B" strokeWidth="3" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize: 13, color: '#6B6B6B', fontFamily: 'var(--font-narrow)', letterSpacing: '0.06em' }}>
          ЗАГРУЗКА...
        </span>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}

export default function App() {
  const { user } = useAuthStore()

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <NavBar />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route
              path="/auth"
              element={user ? <Navigate to="/" replace /> : <AuthPage />}
            />
            <Route
              path="/"
              element={
                <PrivateRoute roles={['user', 'host', 'admin']}>
                  <ErrorBoundary><PlayerPage /></ErrorBoundary>
                </PrivateRoute>
              }
            />
            <Route
              path="/host"
              element={
                <PrivateRoute roles={['host', 'admin']}>
                  <ErrorBoundary><HostPage /></ErrorBoundary>
                </PrivateRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <PrivateRoute roles={['admin']}>
                  <ErrorBoundary><AdminPage /></ErrorBoundary>
                </PrivateRoute>
              }
            />
            <Route
              path="/history"
              element={
                <PrivateRoute roles={['host', 'admin']}>
                  <ErrorBoundary><HistoryPage /></ErrorBoundary>
                </PrivateRoute>
              }
            />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password"  element={<ResetPasswordPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <ToastContainer />
      </ErrorBoundary>
    </BrowserRouter>
  )
}
