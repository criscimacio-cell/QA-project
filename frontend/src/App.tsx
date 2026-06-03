import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
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
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="repositories" element={<Repositories />} />
        <Route path="files" element={<FileManager />} />
        <Route path="search" element={<SearchResults />} />
        <Route path="knowledge" element={<KnowledgeBase />} />
        <Route path="test-data" element={<TestDataLibrary />} />
        <Route path="approvals" element={<ApprovalWorkflow />} />
        <Route path="audit" element={<ProtectedRoute requireLead><AuditLog /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute requireLead><UserManagement /></ProtectedRoute>} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
