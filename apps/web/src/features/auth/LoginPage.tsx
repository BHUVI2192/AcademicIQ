import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  Trophy, 
  Mail, 
  Lock, 
  Phone, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  KeyRound, 
  ArrowLeft,
  GraduationCap,
  Sparkles,
  Command
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { isEmail, isPhone, normalizePhone } from '@/lib/validators';

type Tab = 'faculty' | 'parent';
type ParentView = 'login' | 'forgot';

interface LoginPageProps {
  isAdminView?: boolean;
}

export function LoginPage({ isAdminView: isAdminProp }: LoginPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, loading: authLoading } = useAuth();
  const adminPath = isAdminProp || location.pathname.startsWith('/admin');
  const [tab, setTab] = useState<Tab>('faculty');
  const [parentView, setParentView] = useState<ParentView>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [parentPassword, setParentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showParentPassword, setShowParentPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && user && role) {
      if (role === 'admin') navigate('/admin/dashboard');
      else if (role === 'faculty') navigate('/faculty/dashboard');
      else if (role === 'parent') navigate('/parent/select-child');
    }
  }, [user, role, authLoading, navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmail(email)) { toast.error('Enter a valid email'); return; }
    if (!password || password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success('Identity Verified');
    } catch (err: any) {
      toast.error(err.message ?? 'Authentication failed');
      setSubmitting(false);
    }
  };

  const handleParentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPhone(phone)) { toast.error('Enter a valid phone number'); return; }
    if (!parentPassword || parentPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setSubmitting(true);
    try {
      const normalized = normalizePhone(phone);
      const { data: profile, error: profileErr } = await supabase
        .rpc('check_parent_login_allowed', { p_phone: normalized })
        .maybeSingle();

      if (profileErr) throw profileErr;
      if (!profile || !profile.has_linked_student || !profile.email) {
        throw new Error('No parent account found or no student linked.');
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: parentPassword,
      });
      
      if (error) {
        if (error.message.toLowerCase().includes('invalid login')) {
          throw new Error('Incorrect credentials. Please verify your access code.');
        }
        throw error;
      }
      toast.success('Welcome Back');
    } catch (err: any) {
      toast.error(err.message ?? 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPhone(phone)) { toast.error('Enter a valid phone number'); return; }
    setSubmitting(true);
    try {
      const normalized = normalizePhone(phone);
      const { data: profile, error: profileErr } = await supabase
        .rpc('check_parent_login_allowed', { p_phone: normalized })
        .maybeSingle();

      if (profileErr) throw profileErr;
      if (!profile || !profile.email) throw new Error('No account found for this phone number.');

      const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('Recovery instructions dispatched to linked email');
      setParentView('login');
    } catch (err: any) {
      toast.error(err.message ?? 'Reset failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
      <div className="w-full max-w-[440px] relative z-10 space-y-8 animate-fade-in">
        
        {/* Nav Back */}
        <div className="flex justify-center">
          <Link to="/" className="group inline-flex items-center gap-3 px-4 py-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all">
            <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
            Institutional Overview
          </Link>
        </div>

        {/* Brand */}
        <div className="text-center space-y-4">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-md bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 mx-auto">
            {adminPath ? <ShieldCheck className="h-7 w-7" /> : <GraduationCap className="h-7 w-7" />}
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-medium tracking-tight text-slate-900 dark:text-white">
              {adminPath ? 'Sovereign Console' : tab === 'faculty' ? 'Faculty Suite' : 'Guardian Portal'}
            </h1>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] font-medium">
              {adminPath ? 'Secure Access Node' : 'AcademeIQ Ecosystem'}
            </p>
          </div>
        </div>

        <div className="card p-10 shadow-lg dark:shadow-none border-slate-200 dark:border-slate-800">
          {/* Tab Switcher */}
          {!adminPath && (
            <div className="mb-8 flex p-1 bg-slate-100 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => { setTab('faculty'); setParentView('login'); }}
                className={`flex-1 py-2 text-[10px] font-medium uppercase tracking-widest rounded transition-all ${
                  tab === 'faculty' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'
                }`}
              >
                Education Staff
              </button>
              <button
                type="button"
                onClick={() => { setTab('parent'); setParentView('login'); }}
                className={`flex-1 py-2 text-[10px] font-medium uppercase tracking-widest rounded transition-all ${
                  tab === 'parent' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'
                }`}
              >
                Guardians
              </button>
            </div>
          )}

          {/* Forms */}
          {(adminPath || tab === 'faculty') && (
            <form onSubmit={handleEmailLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="label">Academic Email</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-premium w-full pl-12"
                    placeholder="identifier@institution.edu"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="label">Security Phrase</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-premium w-full pl-12 pr-12"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-900 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={submitting} className="btn btn-primary w-full py-4 text-[11px] font-medium uppercase tracking-[0.2em] mt-4">
                {submitting ? 'Verifying Identity...' : 'Authorize Session'}
              </button>
            </form>
          )}

          {/* Parent View */}
          {!adminPath && tab === 'parent' && parentView === 'login' && (
            <form onSubmit={handleParentLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="label">Registered Identifier</label>
                <div className="relative group">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input-premium w-full pl-12"
                    placeholder="+91 0000000000"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="label">Access Token</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                  <input
                    type={showParentPassword ? 'text' : 'password'}
                    value={parentPassword}
                    onChange={(e) => setParentPassword(e.target.value)}
                    className="input-premium w-full pl-12 pr-12"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowParentPassword(!showParentPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-900 transition-colors"
                  >
                    {showParentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={submitting} className="btn btn-primary w-full py-4 text-[11px] font-medium uppercase tracking-[0.2em]">
                {submitting ? 'Authenticating...' : 'Secure Access'}
              </button>
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setParentView('forgot')}
                  className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-colors"
                >
                  Request Recovery Token
                </button>
              </div>
            </form>
          )}

          {/* Recovery */}
          {!adminPath && tab === 'parent' && parentView === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-8">
              <div className="text-center space-y-2 mb-4">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-900 rounded flex items-center justify-center text-slate-900 dark:text-white mx-auto">
                   <KeyRound className="h-6 w-6" />
                </div>
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest leading-relaxed">
                   Recovery instructions will be dispatched <br /> to your linked academic account.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 ml-1">Phone Identifier</label>
                <div className="relative group">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input w-full pl-12"
                    placeholder="+91 0000000000"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setParentView('login')}
                  className="btn btn-secondary flex-1 py-3 text-[10px] font-medium uppercase tracking-widest"
                >
                  Return
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary flex-1 py-3 text-[10px] font-medium uppercase tracking-widest">
                  {submitting ? 'Sending...' : 'Recover'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="text-center space-y-6">
           <p className="text-[9px] font-medium uppercase tracking-[0.4em] text-slate-400">
             © 2026 AcademeIQ Systems Integrity
           </p>
           <div className="flex items-center justify-center gap-2 opacity-30 group cursor-default">
             <Command className="h-3 w-3" />
             <span className="text-[10px] font-medium uppercase tracking-[0.2em]">Zero-Trust Protocol Active</span>
           </div>
        </div>
      </div>
    </div>
  );
}
