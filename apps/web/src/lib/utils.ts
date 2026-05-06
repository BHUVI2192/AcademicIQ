import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function formatDate(date: string | Date | null | undefined, fallback = '—'): string {
  if (!date) return fallback;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(date: string | Date | null | undefined, fallback = '—'): string {
  if (!date) return fallback;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function debounce<F extends (...args: unknown[]) => void>(fn: F, ms: number): F {
  let t: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<F>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...(args as Parameters<F>)), ms);
  }) as F;
}
