import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export function OtpVerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const phone = (location.state as { phone?: string } | null)?.phone;
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!phone) {
      navigate('/login', { replace: true });
      return;
    }
    inputRef.current?.focus();
  }, [phone, navigate]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;
    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      toast.error('Enter the 6-digit OTP');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' });
      if (error) throw error;
      toast.success('Verified');
    } catch (err: any) {
      toast.error(err.message ?? 'Verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!phone || secondsLeft > 0) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;
      toast.success('OTP resent');
      setSecondsLeft(60);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to resend');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md">
        <button
          onClick={() => navigate('/login')}
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" /> Back to login
        </button>
        <div className="card">
          <div className="mb-4 flex flex-col items-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-medium text-slate-900 dark:text-slate-100">Verify OTP</h2>
            <p className="mt-1 text-sm text-slate-500">
              We sent a 6-digit code to {phone}
            </p>
          </div>
          <form onSubmit={handleVerify} className="space-y-6">
            <div>
              <label className="label" htmlFor="otp">
                One-time password
              </label>
              <input
                id="otp"
                ref={inputRef}
                inputMode="numeric"
                maxLength={6}
                pattern="\d{6}"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="input text-center font-mono text-2xl tracking-[0.5em]"
                placeholder="000000"
                required
              />
            </div>
            <button type="submit" disabled={submitting} className="btn btn-primary w-full">
              {submitting ? 'Verifying...' : 'Verify'}
            </button>
            <div className="text-center">
              {secondsLeft > 0 ? (
                <p className="text-xs text-slate-500">Resend in {secondsLeft}s</p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="text-xs text-slate-900 dark:text-white font-medium hover:underline"
                >
                  {resending ? 'Sending...' : 'Resend code'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
