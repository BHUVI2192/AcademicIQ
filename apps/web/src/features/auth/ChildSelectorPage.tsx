import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, ChevronRight, BookOpen } from 'lucide-react';
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
    <div className="flex min-h-screen items-center justify-center bg-white p-4 dark:bg-slate-950 font-outfit">
      <div className="w-full max-w-md">
        <div className="mb-12 flex flex-col items-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-none bg-black text-white shadow-2xl">
            <BookOpen className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">
            Select Student
          </h1>
          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
            Portal Access Required
          </p>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-black" />
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Synchronizing Nodes
              </div>
            </div>
          ) : (
            children?.map((c) => (
              <button
                key={c.student_id}
                onClick={() => handleSelect(c.student_id)}
                className="group relative flex w-full items-center justify-between overflow-hidden border border-slate-100 bg-slate-50/50 p-6 transition-all hover:border-black hover:bg-white dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-white dark:hover:bg-slate-900"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-none bg-white text-slate-900 shadow-sm transition-colors group-hover:bg-black group-hover:text-white dark:bg-slate-800 dark:text-slate-100 dark:group-hover:bg-white dark:group-hover:text-black">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">
                      {c.full_name}
                    </div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {c.roll_number} · {c.batch_name}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-black dark:group-hover:text-white" />
              </button>
            ))
          )}
        </div>

        <div className="mt-12 text-center">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em]">
            AcademeIQ Premium Editorial System
          </p>
        </div>
      </div>
    </div>
  );
}
