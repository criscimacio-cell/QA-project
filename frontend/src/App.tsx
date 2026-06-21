import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Component, ReactNode } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PermissionsProvider } from './context/PermissionsContext';

/* ── Error Boundary ── */
interface ErrorBoundaryState { hasError: boolean; }
class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 p-8">
          <div className="text-5xl">⚠️</div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Something went wrong</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-md">
            An unexpected error occurred. Please reload the page to continue.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-colors"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import { ThemeProvider } from './context/ThemeContext';
import { LogoutProvider } from './context/LogoutContext';
import AppLayout from './components/Layout/AppLayout';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Repositories from './pages/Repositories';
import FileManager from './pages/FileManager';
import KnowledgeBase from './pages/KnowledgeBase';
import TestDataLibrary from './pages/TestDataLibrary';
import SearchResults from './pages/SearchResults';
import ApprovalWorkflow from './pages/ApprovalWorkflow';
import AuditLog from './pages/AuditLog';
import UserManagement from './pages/UserManagement';
import Settings from './pages/Settings';
import Archive from './pages/Archive';
import OrgSettings from './pages/OrgSettings';
import Register from './pages/Register';
import { BackofficeAuthProvider } from './context/BackofficeAuthContext';
import BackofficeLayout from './pages/backoffice/BackofficeLayout';
import BackofficeDashboard from './pages/backoffice/BackofficeDashboard';
import BackofficeOrganizations from './pages/backoffice/BackofficeOrganizations';
import BackofficeOrgDetail from './pages/backoffice/BackofficeOrgDetail';
import BackofficeUsers from './pages/backoffice/BackofficeUsers';

function ProtectedRoute({ children, requireAdmin = false, requireLead = false }: { children: React.ReactNode; requireAdmin?: boolean; requireLead?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="animate-spin w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (requireAdmin && user.role !== 'admin') return <Navigate to="/" replace />;
  if (requireLead && !['admin', 'lead'].includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="repositories" element={<Repositories />} />
        <Route path="files" element={<FileManager />} />
        <Route path="search" element={<SearchResults />} />
        <Route path="knowledge" element={<KnowledgeBase />} />
        <Route path="test-data" element={<TestDataLibrary />} />
        <Route path="approvals" element={<ProtectedRoute requireLead><ApprovalWorkflow /></ProtectedRoute>} />
        <Route path="archive" element={<ProtectedRoute requireAdmin><Archive /></ProtectedRoute>} />
        <Route path="audit" element={<ProtectedRoute requireAdmin><AuditLog /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute requireAdmin><UserManagement /></ProtectedRoute>} />
        <Route path="settings" element={<Settings />} />
        <Route path="org-settings" element={<ProtectedRoute requireAdmin><OrgSettings /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />

      {/* Backoffice — completely separate auth context */}
      <Route path="/backoffice/*" element={
        <BackofficeAuthProvider>
          <Routes>
            <Route path="login" element={<Navigate to="/login" replace />} />
            <Route element={<BackofficeLayout />}>
              <Route index element={<BackofficeDashboard />} />
              <Route path="organizations" element={<BackofficeOrganizations />} />
              <Route path="organizations/:id" element={<BackofficeOrgDetail />} />
              <Route path="users" element={<BackofficeUsers />} />
            </Route>
          </Routes>
        </BackofficeAuthProvider>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <PermissionsProvider>
            <BrowserRouter>
              <LogoutProvider>
                <AppRoutes />
              </LogoutProvider>
            </BrowserRouter>
          </PermissionsProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
