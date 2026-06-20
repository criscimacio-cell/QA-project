import { NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, Users, LogOut, Shield } from 'lucide-react';
import { useBackofficeAuth } from '../../context/BackofficeAuthContext';
import { toast } from 'sonner';

const navItems = [
  { to: '/backoffice', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/backoffice/organizations', label: 'Organizations', icon: Building2, end: false },
  { to: '/backoffice/users', label: 'Users', icon: Users, end: false },
];

export default function BackofficeLayout() {
  const { admin, loading, isAuthenticated, logout } = useBackofficeAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      toast.error('Logout failed');
    }
  };
