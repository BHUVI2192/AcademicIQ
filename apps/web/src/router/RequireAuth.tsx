import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-md border-2 border-slate-200 border-t-slate-900 dark:border-slate-800 dark:border-t-slate-100" />
      </div>
    );
  }
  if (!user) {
    const isUnderAdmin = location.pathname.startsWith('/admin');
    const loginPath = isUnderAdmin ? '/admin/login' : '/login';
    return <Navigate to={loginPath} state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}
