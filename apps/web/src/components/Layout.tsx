import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ErrorBoundary } from './ErrorBoundary';
import { useAuth } from '@/hooks/useAuth';

export function Layout() {
  const { role } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!role) return null;
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar
        role={role}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onMobileMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6 sm:p-8">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

