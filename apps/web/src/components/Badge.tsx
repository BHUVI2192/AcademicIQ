import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  const map: Record<Variant, string> = {
    default: 'badge-default',
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    info: 'badge-info',
  };
  return <span className={cn('badge', map[variant], className)}>{children}</span>;
}
