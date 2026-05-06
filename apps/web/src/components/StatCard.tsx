import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: string;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, trend, className }: StatCardProps) {
  return (
    <div className={cn('card transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 group', className)}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1">{label}</div>
          <div className="text-3xl font-medium tracking-tight text-slate-900 dark:text-white">{value}</div>
          {trend && (
            <div className="mt-1.5 text-xs text-slate-400 font-normal">{trend}</div>
          )}
        </div>
        {Icon && (
          <div className="rounded bg-slate-900 dark:bg-slate-100 p-2 text-white dark:text-slate-900">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  );
}

