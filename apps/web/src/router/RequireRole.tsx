import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { Role } from '@shared';
import { useAuth } from '@/hooks/useAuth';

interface RequireRoleProps {
  role: Role | Role[];
  children: ReactNode;
}

export function RequireRole({ role, children }: RequireRoleProps) {
  const { role: userRole, loading, profile, user } = useAuth();
  
  if (loading || (user && !profile)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-md border-2 border-slate-200 border-t-slate-900 dark:border-slate-800 dark:border-t-slate-100" />
      </div>
    );
  }

  const allowed = Array.isArray(role) ? role : [role];
  
  // Special handling: Allow faculty and admins to access parent routes if they are also parents.
  // The specific child-data checks are handled within the parent pages themselves.
  let isAuthorized = userRole && allowed.includes(userRole);
  if (!isAuthorized && allowed.includes('parent' as Role) && (userRole === 'faculty' || userRole === 'admin')) {
    isAuthorized = true;
  }
  
  if (!isAuthorized) {
    console.warn('[RequireRole] Unauthorized access attempt:', { userRole, allowed });
    if (userRole === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (userRole === 'faculty') return <Navigate to="/faculty/dashboard" replace />;
    if (userRole === 'parent') return <Navigate to="/parent/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }
  if (profile && profile.is_active === false) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
