import { Modal } from './Modal';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'destructive' | 'warning';
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  loading = false,
}: ConfirmDialogProps) {
  const isDestructive = variant === 'destructive';
  const isWarning = variant === 'warning';
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex gap-3">
        <div className="shrink-0">
          <AlertTriangle
            className={isDestructive ? 'h-6 w-6 text-red-500' : isWarning ? 'h-6 w-6 text-amber-500' : 'h-6 w-6 text-blue-500'}
          />
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-300">{message}</p>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} disabled={loading} className="btn btn-ghost">
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={isDestructive ? 'btn btn-danger' : 'btn btn-primary'}
        >
          {loading ? 'Working...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
