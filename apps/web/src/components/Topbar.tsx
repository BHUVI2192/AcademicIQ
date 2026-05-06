import { useState, useRef, useEffect } from 'react';
import { LogOut, User, Moon, Sun, Menu } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface TopbarProps {
  onMobileMenuClick?: () => void;
}

export function Topbar({ onMobileMenuClick }: TopbarProps) {
  const { profile, signOut } = useAuth();
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
      <div className="flex items-center gap-4">
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
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
            System Node
          </div>
          <div className="text-sm font-medium text-slate-900 dark:text-white">
            {profile?.full_name ?? 'User Account'}
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
