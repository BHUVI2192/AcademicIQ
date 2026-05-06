import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-3 rounded-md bg-slate-100 p-4 dark:bg-slate-800">
        <Icon className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
      )}
      {action && (
        <button onClick={action.onClick} className="btn btn-primary mt-4">
          {action.label}
        </button>
      )}
    </div>
  );
}
