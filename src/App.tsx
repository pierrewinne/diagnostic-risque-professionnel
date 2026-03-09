import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewDiagnostic from './pages/NewDiagnostic'
import Questionnaire from './pages/Questionnaire'
import ScoringResults from './pages/ScoringResults'
import DiagnosticDetail from './pages/DiagnosticDetail'
import Companies from './pages/Companies'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }
  return session ? <>{children}</> : <Navigate to="/login" />
}

function AppRoutes() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" /> : <Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/diagnostic/new" element={<NewDiagnostic />} />
        <Route path="/diagnostic/:id/questionnaire" element={<Questionnaire />} />
        <Route path="/diagnostic/:id/scoring" element={<ScoringResults />} />
        <Route path="/diagnostic/:id" element={<DiagnosticDetail />} />
        <Route path="/companies" element={<Companies />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
