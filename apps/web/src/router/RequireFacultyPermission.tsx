import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface RequireFacultyPermissionProps {
  permission: 'can_add_students' | 'can_manage_fees' | 'can_manage_attendance';
  children: ReactNode;
}

export function RequireFacultyPermission({ permission, children }: RequireFacultyPermissionProps) {
  const { profile, loading, role } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-md border-2 border-slate-200 border-t-slate-900 dark:border-slate-800 dark:border-t-slate-100" />
      </div>
    );
  }

  // If not faculty or doesn't have the permission, redirect to dashboard
  if (role !== 'faculty' || !profile || !profile[permission]) {
    console.warn(`[RequireFacultyPermission] Unauthorized access for permission: ${permission}`);
    return <Navigate to="/faculty/dashboard" replace />;
  }

  return <>{children}</>;
}
