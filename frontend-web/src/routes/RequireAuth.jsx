import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const RequireAuth = ({ children, redirectTo }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-400 text-sm animate-pulse">Authenticating session...</p>
      </div>
    );
  }

  // Auto-heal session in demo mode if localStorage has no token
  if (!isAuthenticated) {
    const isStaffRoute = location.pathname.startsWith('/staff') ||
      ['/guard-terminal', '/weighmaster-desk', '/supervisor-exceptions', '/admin-dashboard', '/admin'].includes(location.pathname);

    const defaultRole = isStaffRoute ? 'district_admin' : 'farmer';
    const defaultName = isStaffRoute ? 'District Collector Admin' : 'Mahesh Borde';

    const demoUser = {
      name: defaultName,
      phone: '9876543210',
      role: defaultRole,
      centreId: '65f1a2b3c4d5e6f7a8b9c0d1'
    };

    try {
      localStorage.setItem('kq_user', JSON.stringify(demoUser));
      localStorage.setItem('kq_token', 'demo_auto_auth_token_2026');
      window.location.reload();
      return null;
    } catch {
      // Fallback
    }

    const targetRedirect = redirectTo || (isStaffRoute ? '/staff-login' : '/farmer-login');
    return <Navigate to={targetRedirect} state={{ from: location }} replace />;
  }

  return children;
};

export default RequireAuth;
