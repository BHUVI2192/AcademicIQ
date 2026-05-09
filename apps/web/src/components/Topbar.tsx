import { useState, useRef, useEffect } from 'react';
import { LogOut, User, Moon, Sun, Menu, GraduationCap, ChevronRight, ShieldCheck, Monitor } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useVerifiedChildren } from '@/hooks/useChildResults';

interface TopbarProps {
  onMobileMenuClick?: () => void;
}

export function Topbar({ onMobileMenuClick }: TopbarProps) {
  const { profile, signOut, user } = useAuth();
  const location = useLocation();
  const isParentRoute = location.pathname.startsWith('/parent');
  
  const isParentEligible = profile?.role === 'parent' || profile?.role === 'faculty' || profile?.role === 'admin';
  const { data: children } = useVerifiedChildren(isParentEligible ? user?.id : undefined);
  
  const selectedChildId = sessionStorage.getItem('aiq.selectedChildId');
  const selectedChild = children?.find(c => c.student_id === selectedChildId);

  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('aiq-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('aiq-theme', 'light');
    }
  };

  return (
    <header className="flex h-16 items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 relative z-50">
      {/* Left Context */}
      <div className="flex items-center gap-6">
        {onMobileMenuClick && (
          <button
            onClick={onMobileMenuClick}
            aria-label="Open menu"
            className="lg:hidden p-2 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div className="hidden sm:block">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            {isParentRoute && selectedChild ? 'Viewing Student' : 'System Node'}
          </div>
          <div className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
            {isParentRoute && selectedChild ? (
              <>
                <GraduationCap className="h-4 w-4 text-slate-400" />
                <span>{selectedChild.full_name}</span>
                {children && children.length > 1 && (
                  <Link 
                    to="/parent/select-child" 
                    className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 hover:text-indigo-600 transition-colors"
                  >
                    SWITCH <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </>
            ) : (
              profile?.full_name ?? 'User Account'
            )}
          </div>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Theme Toggle */}
        <button
          onClick={toggleDark}
          className="p-2 rounded-md border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
        >
          {dark ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-indigo-500" />}
        </button>

        {/* User Account */}
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 p-1 rounded-md border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group"
          >
            <div className="h-8 w-8 rounded bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900">
              <User className="h-4 w-4" />
            </div>
            <div className="hidden md:block pr-2 text-left">
              <div className="text-xs font-medium text-slate-900 dark:text-white leading-none">
                {profile?.role?.toUpperCase()}
              </div>
            </div>
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-2 z-50 w-56 card p-1 shadow-lg">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 mb-1">
                <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {profile?.full_name}
                </div>
                <div className="text-[10px] font-medium text-slate-400 mt-0.5">
                  {profile?.email}
                </div>
              </div>

              {isParentEligible && children && children.length > 0 && !isParentRoute && (
                <Link
                  to="/parent/select-child"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-3 rounded px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <GraduationCap className="h-4 w-4 text-indigo-500" />
                  Parent Portal
                </Link>
              )}

              {profile?.role === 'admin' && location.pathname.startsWith('/parent') && (
                <Link
                  to="/admin/dashboard"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-3 rounded px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <ShieldCheck className="h-4 w-4 text-slate-900 dark:text-white" />
                  Admin Dashboard
                </Link>
              )}

              {profile?.role === 'faculty' && location.pathname.startsWith('/parent') && (
                <Link
                  to="/faculty/dashboard"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-3 rounded px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Monitor className="h-4 w-4 text-slate-900 dark:text-white" />
                  Faculty Dashboard
                </Link>
              )}
              
              <button
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
                className="flex w-full items-center gap-3 rounded px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut className="h-4 w-4" /> 
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
