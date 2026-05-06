import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Lock, Eye, EyeOff, Trophy } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  // Supabase sends a recovery token in the URL hash
  // The onAuthStateChange listener handles it automatically
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password reset successfully! You can now login.');
      navigate('/login');
    } catch (err: any) {
      toast.error(err.message ?? 'Reset failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-md bg-slate-900 text-white shadow-lg shadow-slate-900/10">
            <Trophy className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-medium text-slate-900 dark:text-slate-100">Reset Password</h1>
          <p className="text-sm text-slate-500">Set your new password below</p>
        </div>

        <div className="card">
          {!ready ? (
            <div className="py-8 text-center text-sm text-slate-500">
              <div className="animate-spin h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-md mx-auto mb-3" />
              Processing your reset link…
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-6">
              <div>
                <label className="label" htmlFor="reset-new">New Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="reset-new"
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input pl-10 pr-10"
                    placeholder="Minimum 8 characters"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="reset-confirm">Confirm Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="reset-confirm"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input pl-10 pr-10"
                    placeholder="Re-enter new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
                )}
              </div>
              <button
                type="submit"
                disabled={saving || newPassword !== confirmPassword || newPassword.length < 8}
                className="btn btn-primary w-full"
              >
                {saving ? 'Updating...' : 'Set New Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
