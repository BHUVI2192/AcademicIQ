import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Lock, Eye, EyeOff, ArrowLeft, ShieldCheck, Phone, User, Fingerprint, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';

export function ParentProfilePage() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword === 'Parent@123') {
      toast.error('Please choose a different password from the temporary one');
      return;
    }

    setSaving(true);
    try {
      const email = user?.email;
      if (!email) throw new Error('Session expired, please login again');

      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (verifyErr) {
        throw new Error('Current password is incorrect');
      }

      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateErr) throw updateErr;

      if (user?.id) {
        const { error: profileUpdateErr } = await supabase
          .from('profiles')
          .update({ temp_password_set: false })
          .eq('id', user.id);
        
        if (profileUpdateErr) {
          console.error('[Profile] Error updating temp_password_set flag:', profileUpdateErr);
        } else {
          await refreshProfile();
        }
      }

      toast.success('Security settings updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-12 animate-fade-in pb-12">
      {/* Header */}
      <div className="space-y-6">
        <button
          onClick={() => navigate('/parent/dashboard')}
          className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
          Return to Dashboard
        </button>

        <div className="space-y-1">
          <h1 className="text-4xl font-light tracking-tight text-slate-900 dark:text-white leading-tight">
            Security & Identity
          </h1>
          <p className="text-lg text-slate-500 font-light leading-relaxed">
            Manage your credentials and account verification settings.
          </p>
        </div>
      </div>

      <div className="grid gap-8">
        {/* Account Identity */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 ml-1">
            <Fingerprint className="h-4 w-4 text-slate-400" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Account Identity</h2>
          </div>
          
          <div className="card grid grid-cols-1 md:grid-cols-2 gap-6 p-8">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-slate-400">
                <Phone className="h-3.5 w-3.5" />
                <span className="text-[10px] font-medium uppercase tracking-widest">Phone Identifier</span>
              </div>
              <div className="text-sm font-medium text-slate-900 dark:text-white px-1">
                {/* @ts-ignore */}
                {user?.phone || user?.user_metadata?.phone || 'Identity Unlinked'}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-slate-400">
                <Mail className="h-3.5 w-3.5" />
                <span className="text-[10px] font-medium uppercase tracking-widest">Recovery Email</span>
              </div>
              <div className="text-sm font-medium text-slate-900 dark:text-white px-1">
                {user?.email?.includes('@parent.academeiq.internal')
                  ? <span className="text-slate-400 italic font-normal">Contact administration to link email</span>
                  : user?.email || 'Not Configured'}
              </div>
            </div>
          </div>
        </section>

        {/* Credential Update */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 ml-1">
            <ShieldCheck className="h-4 w-4 text-slate-400" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Update Credentials</h2>
          </div>

          <div className="card p-8">
            <form onSubmit={handleChangePassword} className="space-y-8 max-w-lg">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Current Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="input-premium w-full pl-12 pr-12"
                    placeholder="Verify existing password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900"
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">New Security Phrase</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-premium w-full pl-12 pr-12"
                    placeholder="Min. 8 characters"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {newPassword && (
                  <div className="px-1 pt-2 space-y-1.5">
                    <div className="flex gap-1 h-1">
                      <div className={`h-full flex-1 rounded-md ${newPassword.length >= 8 ? 'bg-emerald-400' : 'bg-slate-100'}`} />
                      <div className={`h-full flex-1 rounded-md ${newPassword.length >= 12 ? 'bg-emerald-400' : 'bg-slate-100'}`} />
                      <div className={`h-full flex-1 rounded-md ${newPassword.length >= 16 ? 'bg-emerald-400' : 'bg-slate-100'}`} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      Complexity: {newPassword.length < 8 ? 'Weak' : newPassword.length < 12 ? 'Moderate' : 'Strong'}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Confirm Identity Change</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-premium w-full pl-12 pr-12"
                    placeholder="Match new security phrase"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving || newPassword !== confirmPassword || newPassword.length < 8}
                className="btn btn-primary w-full py-4 shadow-xl shadow-slate-900/10"
              >
                {saving ? 'Processing Request...' : 'Update Credentials'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
