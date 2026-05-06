import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useVerifiedChildren } from '@/hooks/useChildResults';
import { useQueryClient } from '@tanstack/react-query';

export function PendingVerificationPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: children } = useVerifiedChildren(user?.id);

  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['verified-children', user?.id] });
    }, 30000);
    return () => clearInterval(interval);
  }, [queryClient, user?.id]);

  useEffect(() => {
    if (children && children.length > 0) {
      if (children.length === 1) {
        sessionStorage.setItem('aiq.selectedChildId', children[0].student_id);
        navigate('/parent/dashboard', { replace: true });
      } else {
        navigate('/parent/select-child', { replace: true });
      }
    }
  }, [children, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md">
        <div className="card text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
            <Clock className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-medium text-slate-900 dark:text-slate-100">
            Pending Verification
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Your account is awaiting verification by your college administrator. We will check
            again automatically every 30 seconds.
          </p>
          <button
            onClick={signOut}
            className="btn btn-ghost mt-6 inline-flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
