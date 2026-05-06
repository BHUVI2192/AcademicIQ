import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, ChevronRight, Trophy } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useVerifiedChildren } from '@/hooks/useChildResults';

export function ChildSelectorPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: children, isLoading } = useVerifiedChildren(user?.id);

  useEffect(() => {
    if (!isLoading && (!children || children.length === 0)) {
      navigate('/parent/pending', { replace: true });
    } else if (!isLoading && children && children.length === 1) {
      sessionStorage.setItem('aiq.selectedChildId', children[0].student_id);
      navigate('/parent/dashboard', { replace: true });
    }
  }, [children, isLoading, navigate]);

  const handleSelect = (studentId: string) => {
    sessionStorage.setItem('aiq.selectedChildId', studentId);
    navigate('/parent/dashboard');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-slate-900 text-white shadow-lg shadow-slate-900/10">
            <Trophy className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-medium text-slate-900 dark:text-slate-100">Select Child</h1>
          <p className="text-sm text-slate-500">Choose whose results to view</p>
        </div>
        <div className="card space-y-3">
          {isLoading && (
            <div className="py-8 text-center text-sm text-slate-500">Loading...</div>
          )}
          {children?.map((c) => (
            <button
              key={c.student_id}
              onClick={() => handleSelect(c.student_id)}
              className="flex w-full items-center justify-between rounded-md border border-slate-200 px-4 py-4 text-left transition-colors hover:border-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {c.full_name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {c.roll_number} · {c.batch_name}
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
