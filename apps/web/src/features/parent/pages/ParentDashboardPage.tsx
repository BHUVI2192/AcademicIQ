import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Trophy, TrendingUp, ChevronRight, GraduationCap, Users,
  FolderOpen, BookOpen, Atom, FlaskConical, Calculator,
  ArrowLeft, BarChart2, Star, Settings, Lock, ArrowRight,
  Calendar, DollarSign, Zap, Check
} from 'lucide-react';
import { useParentNotifications, useMarkNotificationRead } from '@/hooks/useNotifications';
import { Card } from '@/components/Card';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { useVerifiedChildren, useChildRankings } from '@/hooks/useChildResults';
import { StatCard } from '@/components/StatCard';
import { CardSkeleton } from '@/components/LoadingSkeleton';
import { formatDate } from '@/lib/utils';
import type { ChildRanking } from '@/hooks/useChildResults';

// ─── Exam Category Config ───────────────────────────────────────────────────
interface ExamFolder {
  key: string;
  label: string;
  color: string;
  bgColor: string;
  icon: React.ElementType;
  matchFn: (r: ChildRanking) => boolean;
}

const EXAM_FOLDERS: ExamFolder[] = [
  {
    key: 'kcet',
    label: 'KCET',
    color: 'text-violet-500',
    bgColor: 'bg-violet-500/5 border-violet-500/10 dark:bg-violet-500/10 dark:border-violet-500/20',
    icon: BookOpen,
    matchFn: (r) => r.test?.exam_category === 'KCET',
  },
  {
    key: 'jee_mains',
    label: 'JEE Mains',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/5 border-blue-500/10 dark:bg-blue-500/10 dark:border-blue-500/20',
    icon: Calculator,
    matchFn: (r) => r.test?.exam_category === 'JEE' && r.test?.exam_sub_type?.toLowerCase().includes('main') === true,
  },
  {
    key: 'jee_advanced',
    label: 'JEE Advanced',
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/5 border-indigo-500/10 dark:bg-indigo-500/10 dark:border-indigo-500/20',
    icon: Atom,
    matchFn: (r) => r.test?.exam_category === 'JEE' && r.test?.exam_sub_type?.toLowerCase().includes('adv') === true,
  },
  {
    key: 'neet',
    label: 'NEET',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/5 border-emerald-500/10 dark:bg-emerald-500/10 dark:border-emerald-500/20',
    icon: FlaskConical,
    matchFn: (r) => r.test?.exam_category === 'NEET',
  },
  {
    key: 'board',
    label: 'Board Exams',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/5 border-amber-500/10 dark:bg-amber-500/10 dark:border-amber-500/20',
    icon: BookOpen,
    matchFn: (r) => r.test?.exam_category === 'Board Exam',
  },
  {
    key: 'practice',
    label: 'Practice Tests',
    color: 'text-slate-500',
    bgColor: 'bg-slate-500/5 border-slate-500/10 dark:bg-slate-500/10 dark:border-slate-500/20',
    icon: FolderOpen,
    matchFn: (r) =>
      !['KCET', 'JEE', 'NEET', 'Board Exam'].includes(r.test?.exam_category ?? ''),
  },
];

const COMPETITIVE_KEYS = ['kcet', 'jee_mains', 'jee_advanced', 'neet'];

export function ParentDashboardPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { data: children, isLoading: lsChildren } = useVerifiedChildren(user?.id);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => sessionStorage.getItem('aiq.selectedChildId')
  );
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [activeSubFolder, setActiveSubFolder] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'board' | 'competitive' | 'attendance' | 'fees'>('board');

  // Notifications Queries & Mutations
  const { data: notifications, isLoading: lsNotifications } = useParentNotifications(profile?.id);
  const markRead = useMarkNotificationRead();

  useEffect(() => {
    if (lsChildren) return;
    if (!children || children.length === 0) {
      navigate('/parent/pending', { replace: true });
      return;
    }
    if (!selectedId || !children.find((c) => c.student_id === selectedId)) {
      if (children.length === 1) {
        sessionStorage.setItem('aiq.selectedChildId', children[0].student_id);
        setSelectedId(children[0].student_id);
      } else {
        navigate('/parent/select-child', { replace: true });
      }
    }
  }, [children, lsChildren, selectedId, navigate]);

  const child = children?.find((c) => c.student_id === selectedId) ?? null;
  const { data: rankings, isLoading: lsRanks } = useChildRankings(child?.student_id);

  const switchChild = () => {
    sessionStorage.removeItem('aiq.selectedChildId');
    navigate('/parent/select-child');
  };

  const folderGroups = useMemo(() => {
    if (!rankings) return {};
    const groups: Record<string, ChildRanking[]> = {};
    for (const folder of EXAM_FOLDERS) {
      const matched = rankings.filter(folder.matchFn);
      if (matched.length > 0) {
        groups[folder.key] = matched;
      }
    }
    return groups;
  }, [rankings]);

  // Filter exams based on student's exam_wing
  const filteredFolderGroups = useMemo(() => {
    const filtered: Record<string, ChildRanking[]> = {};
    
    if (!child?.exam_wing || (child.exam_wing as string) === 'NONE') {
      // Show all exams
      return folderGroups;
    }
    
    // Filter by wing - determine which competitive exams to show
    for (const [key, rankings] of Object.entries(folderGroups)) {
      let shouldInclude = false;
      
      if (child.exam_wing === 'NEET') {
        // NEET wing: Show NEET, JEE Mains, JEE Advanced, KCET, and Daily tests
        shouldInclude = ['neet', 'jee_mains', 'jee_advanced', 'kcet', 'practice'].includes(key);
      } else if (child.exam_wing === 'KCET') {
        // KCET wing: Show KCET and Daily tests
        shouldInclude = ['kcet', 'practice'].includes(key);
      }
      
      // Always include board exams for all wings
      if (key === 'board') {
        shouldInclude = true;
      }
      
      if (shouldInclude) {
        filtered[key] = rankings;
      }
    }
    return filtered;
  }, [folderGroups, child?.exam_wing]);

  const activeFolderData = EXAM_FOLDERS.find(f => f.key === (activeSubFolder || activeFolder));
  const activeFolderRankings = (activeSubFolder || activeFolder) ? (filteredFolderGroups[activeSubFolder || activeFolder!] ?? []) : [];

  const competitiveCount = COMPETITIVE_KEYS.reduce((acc, key) => acc + (filteredFolderGroups[key]?.length ?? 0), 0);
  const boardCount = filteredFolderGroups['board']?.length ?? 0;
  const practiceCount = filteredFolderGroups['practice']?.length ?? 0;

  const latest = rankings?.[0];
  const avgPct =
    rankings && rankings.length > 0
      ? rankings.reduce((acc, r) => acc + Number(r.percentage), 0) / rankings.length
      : 0;
  const bestRank =
    rankings && rankings.length > 0 ? Math.min(...rankings.map((r) => r.rank)) : 0;

  if (lsChildren) return <CardSkeleton />;
  if (!child) return null;

  return (
    <div className="max-w-[1400px] mx-auto animate-fade-in space-y-12 py-8 pb-20">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10">
            <div className="w-1.5 h-1.5 rounded-md bg-slate-900 dark:bg-white animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white">
              Parent Analytics
            </span>
          </div>
          <div className="space-y-1">
            <h1 className="text-5xl font-light tracking-tight text-slate-900 dark:text-white leading-tight">
              Greetings, <span className="font-medium text-slate-900 dark:text-white">{profile?.full_name?.split(' ')[0] ?? 'Parent'}</span>
            </h1>
            <p className="max-w-xl text-lg text-slate-500 font-light leading-relaxed">
              Monitoring academic excellence and trajectory for <span className="text-slate-900 dark:text-white font-medium underline decoration-slate-200 underline-offset-4">{child.full_name}</span>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {(children?.length ?? 0) > 1 && (
            <button
              onClick={switchChild}
              className="group flex items-center gap-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-6 py-3 text-xs font-medium uppercase tracking-widest text-slate-600 dark:text-slate-400 transition-all hover:border-slate-900 dark:hover:border-white hover:text-slate-900 dark:hover:text-white hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none"
            >
              <Users className="h-4 w-4 transition-transform group-hover:scale-110" />
              Switch Profile
            </button>
          )}
          <Link
            to="/parent/profile"
            className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-900 text-white shadow-sm shadow-slate-900/20 transition-all hover:scale-110 active:scale-95 dark:bg-white dark:text-slate-900 dark:shadow-none"
          >
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Security Alert */}
      {user && profile?.temp_password_set && (
        <div className="card bg-amber-50/50 border-amber-200/50 dark:bg-amber-900/5 dark:border-amber-900/20 p-8 flex flex-col md:flex-row items-center gap-6 animate-pulse-subtle">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-900/40">
            <Lock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 text-center md:text-left space-y-1">
            <h3 className="text-lg font-medium text-amber-900 dark:text-amber-200">Security Update Recommended</h3>
            <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed font-normal">
              You're currently using a generated password. For complete privacy, please set a unique password in your profile settings.
            </p>
          </div>
          <Link
            to="/parent/profile"
            className="btn btn-primary bg-amber-600 hover:bg-amber-700 border-none shadow-lg shadow-amber-600/20 whitespace-nowrap"
          >
            Update Password
          </Link>
        </div>
      )}

      {/* Notifications Panel */}
      {notifications && notifications.length > 0 && (
        <Card className="p-6 border-none shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">
              Recent Activity & Notifications
            </h3>
            {notifications.some(n => !n.is_read) && (
              <button
                onClick={async () => {
                  const unread = notifications.filter(n => !n.is_read);
                  for (const n of unread) {
                    await markRead.mutateAsync(n.id);
                  }
                  toast.success('All notifications marked as read');
                }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
            {notifications.map(n => (
              <div
                key={n.id}
                className={`p-3 rounded-lg border flex items-start justify-between gap-4 transition-all ${
                  n.is_read
                    ? 'bg-slate-50/50 border-slate-100 dark:bg-slate-900/10 dark:border-slate-800/50 dark:border-slate-800'
                    : 'bg-blue-50/30 border-blue-100 dark:bg-blue-900/5 dark:border-blue-900/20 shadow-sm'
                }`}
              >
                <div className="flex gap-3">
                  <div className="mt-1">
                    {!n.is_read && (
                      <span className="flex h-2 w-2 rounded-full bg-blue-600" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {n.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {n.message}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-2 block">
                      {formatDate(n.created_at)}
                    </span>
                  </div>
                </div>
                {!n.is_read && (
                  <button
                    onClick={() => markRead.mutate(n.id)}
                    className="p-1 rounded-md hover:bg-blue-100/50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                    title="Mark as read"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto -mx-8 px-8">
        <button
          onClick={() => {
            setActiveTab('board');
            setActiveFolder(null);
            setActiveSubFolder(null);
          }}
          className={`px-4 py-3 text-sm font-medium uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'board'
              ? 'border-b-slate-900 dark:border-b-white text-slate-900 dark:text-white'
              : 'border-b-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <BookOpen className="inline h-4 w-4 mr-2" /> Board Exams
        </button>
        <button
          onClick={() => {
            setActiveTab('competitive');
            setActiveFolder(null);
            setActiveSubFolder(null);
          }}
          className={`px-4 py-3 text-sm font-medium uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'competitive'
              ? 'border-b-slate-900 dark:border-b-white text-slate-900 dark:text-white'
              : 'border-b-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Zap className="inline h-4 w-4 mr-2" /> Competitive
        </button>
        <button
          onClick={() => navigate('/parent/attendance')}
          className={`px-4 py-3 text-sm font-medium uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'attendance'
              ? 'border-b-slate-900 dark:border-b-white text-slate-900 dark:text-white'
              : 'border-b-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Calendar className="inline h-4 w-4 mr-2" /> Attendance
        </button>
        <button
          onClick={() => navigate('/parent/fees')}
          className={`px-4 py-3 text-sm font-medium uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'fees'
              ? 'border-b-slate-900 dark:border-b-white text-slate-900 dark:text-white'
              : 'border-b-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <DollarSign className="inline h-4 w-4 mr-2" /> Fees
        </button>
      </div>

      {/* Conditional Content Based on Tab */}
      {/* Summary Cards - Always visible */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {lsRanks ? (
          <><CardSkeleton /><CardSkeleton /><CardSkeleton /></>
        ) : (
          <>
            <button
              onClick={() => {
                setActiveTab('competitive');
                setActiveFolder(null);
                setActiveSubFolder(null);
              }}
              className="card p-6 border-none shadow-sm shadow-slate-200/50 dark:shadow-none transition-all hover:shadow-md hover:shadow-slate-200/70 hover:-translate-y-1 cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Competitive Exams</span>
                <div className="p-2 rounded-md bg-violet-100 dark:bg-violet-900/30">
                  <Zap className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
              </div>
              <p className="text-3xl font-light text-slate-900 dark:text-white">{competitiveCount}</p>
              <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">Tests taken</div>
            </button>

            <button
              onClick={() => {
                setActiveTab('board');
                setActiveFolder(null);
                setActiveSubFolder(null);
              }}
              className="card p-6 border-none shadow-sm shadow-slate-200/50 dark:shadow-none transition-all hover:shadow-md hover:shadow-slate-200/70 hover:-translate-y-1 cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Board Exams</span>
                <div className="p-2 rounded-md bg-amber-100 dark:bg-amber-900/30">
                  <BookOpen className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <p className="text-3xl font-light text-slate-900 dark:text-white">{boardCount}</p>
              <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">Tests taken</div>
            </button>

            <Link
              to="/parent/attendance"
              className="card p-6 border-none shadow-sm shadow-slate-200/50 dark:shadow-none transition-all hover:shadow-md hover:shadow-slate-200/70 hover:-translate-y-1"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Attendance</span>
                <div className="p-2 rounded-md bg-emerald-100 dark:bg-emerald-900/30">
                  <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <p className="text-3xl font-light text-slate-900 dark:text-white">View</p>
              <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">Attendance record</div>
            </Link>
          </>
        )}
      </div>

      {/* Conditional Content Based on Tab */}
      {activeTab === 'board' ? (
      <>
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
        {lsRanks ? (
          <><CardSkeleton /><CardSkeleton /><CardSkeleton /></>
        ) : (
          <>
            <div className="card p-8 border-none shadow-sm shadow-slate-200/50 dark:shadow-none transition-transform hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Assessments</span>
                <div className="p-2 rounded-md bg-slate-100 dark:bg-slate-800">
                  <Trophy className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                </div>
              </div>
              <p className="text-4xl font-light text-slate-900 dark:text-white">{rankings?.length ?? 0}</p>
              <div className="mt-4 flex items-center gap-2 text-[10px] font-medium text-emerald-600 uppercase tracking-wider">
                <TrendingUp className="h-3 w-3" />
                Active Participation
              </div>
            </div>

            <div className="card p-8 border-none shadow-sm shadow-slate-200/50 dark:shadow-none transition-transform hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Mean Performance</span>
                <div className="p-2 rounded-md bg-slate-100 dark:bg-slate-800">
                  <BarChart2 className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                </div>
              </div>
              <p className="text-4xl font-light text-slate-900 dark:text-white">{avgPct.toFixed(1)}%</p>
              <div className="mt-4 flex items-center gap-2 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                Batch Average: 72.4%
              </div>
            </div>

            <div className="card p-8 border-none shadow-none transition-transform hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Peak Ranking</span>
                <div className="p-2 rounded-md bg-slate-900 text-white shadow-lg shadow-slate-900/10 dark:bg-white dark:text-slate-900 dark:shadow-none">
                  <Star className="h-4 w-4" />
                </div>
              </div>
              <p className="text-4xl font-light text-slate-900 dark:text-white">{bestRank > 0 ? `#${bestRank}` : '—'}</p>
              <div className="mt-4 flex items-center gap-2 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                Across all categories
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
        {/* Child Details Card */}
        <div className="lg:col-span-4">
          <div className="card p-8 border-none shadow-sm shadow-slate-200/50 dark:shadow-none sticky top-24">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8">Student Profile</div>
            
            <div className="flex items-center gap-6 mb-10">
              <div className="flex h-20 w-20 items-center justify-center rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm shadow-slate-900/20">
                <GraduationCap className="h-10 w-10" />
              </div>
              <div>
                <h3 className="text-2xl font-medium text-slate-900 dark:text-white leading-tight">{child.full_name}</h3>
                <p className="text-sm font-mono font-medium text-slate-400 mt-1 uppercase tracking-widest">{child.roll_number}</p>
              </div>
            </div>
            
            <div className="space-y-6 pt-8 border-t border-slate-100 dark:border-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Current Cohort</div>
                  <div className="text-base font-medium text-slate-900 dark:text-white mt-1">{child.batch_name}</div>
                </div>
                <div className="px-3 py-1 rounded-md bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">
                  Section A
                </div>
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Institution</div>
                <div className="text-base font-medium text-slate-900 dark:text-white mt-1">PES Institute of Technology</div>
              </div>
              <div className="pt-4">
                <Link to="/parent/progress" className="group flex items-center justify-between w-full p-4 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-slate-900/10">
                  <span className="text-xs font-medium uppercase tracking-[0.1em]">Detailed Progress</span>
                  <TrendingUp className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Categories & Results View */}
        <div className="lg:col-span-8 space-y-12">
          {!activeFolder ? (
            <div className="space-y-8">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-3xl font-light tracking-tight text-slate-900 dark:text-white">Academic Segments</h2>
                  <p className="text-sm text-slate-500 mt-2 font-normal">Analytical breakdown by examination framework</p>
                </div>
                <div className="hidden md:block">
                   <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                     <span className="w-2 h-2 rounded-md bg-slate-400" /> Live Data Stream
                   </div>
                </div>
              </div>

              {lsRanks ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[1, 2].map((i) => <div key={i} className="h-48 w-full animate-pulse rounded-md bg-slate-100 dark:bg-white/5" />)}
                </div>
              ) : Object.keys(folderGroups).length === 0 ? (
                <div className="card p-20 flex flex-col items-center justify-center text-center border-dashed border-2 border-slate-200 dark:border-slate-800">
                  <div className="rounded-md bg-slate-50 dark:bg-white/5 p-8 mb-6">
                    <FolderOpen className="h-12 w-12 text-slate-200" />
                  </div>
                  <h3 className="text-xl font-medium text-slate-900 dark:text-white">Awaiting Assessments</h3>
                  <p className="text-sm text-slate-500 mt-3 max-w-[280px] font-light leading-relaxed">
                    Performance analytics will generate automatically once the faculty publishes examination results.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Board Exams Folder */}
                  <button
                    onClick={() => setActiveFolder('board')}
                    className="group relative flex flex-col justify-between rounded-md border-0 p-10 transition-all hover:scale-[1.02] active:scale-[0.98] bg-amber-500/5 border-amber-500/10 dark:bg-amber-500/10 dark:border-amber-500/20 hover:shadow-2xl hover:shadow-amber-500/10"
                  >
                    <div className="flex items-center justify-between mb-12">
                      <div className="p-5 rounded-md bg-white dark:bg-black/20 shadow-sm transition-transform group-hover:scale-110">
                        <BookOpen className="h-8 w-8 text-amber-500" />
                      </div>
                      <div className="text-right">
                         <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Status</span>
                         <span className="text-sm font-medium text-amber-600">
                           {boardCount} Records
                         </span>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-3xl font-light text-slate-900 dark:text-white mb-2">Board Exams</h3>
                      <p className="text-sm text-slate-500 font-light mb-6">Official secondary and higher secondary certification results</p>
                      <div className="flex items-center justify-between pt-6 border-t border-amber-500/10">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">View Folder</span>
                        <ArrowRight className="h-5 w-5 text-amber-500 transition-transform group-hover:translate-x-2" />
                      </div>
                    </div>
                  </button>

                  {/* Competitive Exams Folder */}
                  <button
                    onClick={() => setActiveFolder('competitive')}
                    className="group relative flex flex-col justify-between rounded-md border-0 p-10 transition-all hover:scale-[1.02] active:scale-[0.98] bg-blue-500/5 border-blue-500/10 dark:bg-blue-500/10 dark:border-blue-500/20 hover:shadow-2xl hover:shadow-blue-500/10"
                  >
                    <div className="flex items-center justify-between mb-12">
                      <div className="p-5 rounded-md bg-white dark:bg-black/20 shadow-sm transition-transform group-hover:scale-110">
                        <GraduationCap className="h-8 w-8 text-blue-500" />
                      </div>
                      <div className="text-right">
                         <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Entrance</span>
                         <span className="text-sm font-medium text-blue-600">
                           {competitiveCount} Records
                         </span>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-3xl font-light text-slate-900 dark:text-white mb-2">Competitive Exams</h3>
                      <p className="text-sm text-slate-500 font-light mb-6">National and state-level entrance assessments (JEE, NEET, KCET)</p>
                      <div className="flex items-center justify-between pt-6 border-t border-blue-500/10">
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Explore Categories</span>
                        <div className="flex -space-x-2">
                           <div className="w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/30 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] font-black text-blue-600">JEE</div>
                           <div className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-900/30 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] font-black text-emerald-600">NEET</div>
                           <div className="w-6 h-6 rounded-md bg-violet-100 dark:bg-violet-900/30 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] font-black text-violet-600">KCET</div>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Practice Tests (Optional/Subtle) */}
                  {practiceCount > 0 && (
                    <button
                      onClick={() => setActiveFolder('practice')}
                      className="md:col-span-2 group flex items-center justify-between p-6 rounded-md bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 transition-all hover:bg-slate-100 dark:hover:bg-white/10"
                    >
                      <div className="flex items-center gap-4">
                        <FolderOpen className="h-5 w-5 text-slate-400" />
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400 uppercase tracking-widest">General Practice Assessments</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-mono text-slate-400">{practiceCount} items</span>
                        <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-1" />
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ─── Folder Detail View ─── */
            /* ─── Folder Navigation (Competitive or Results) ─── */
            <div className="space-y-10">
              <div className="flex items-center justify-between">
                <div className="space-y-4">
                  <button
                    onClick={() => {
                      if (activeSubFolder) setActiveSubFolder(null);
                      else setActiveFolder(null);
                    }}
                    className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 transition-colors hover:text-slate-900 dark:hover:text-white"
                  >
                    <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" /> 
                    {activeSubFolder ? 'Competitive Segments' : 'Back to Dashboard'}
                  </button>
                  <div>
                    <h2 className="text-4xl font-light tracking-tight text-slate-900 dark:text-white leading-none">
                      {activeSubFolder 
                        ? EXAM_FOLDERS.find(f => f.key === activeSubFolder)?.label 
                        : activeFolder === 'competitive' ? 'Competitive Exams' : activeFolderData?.label}
                    </h2>
                    <p className="text-sm text-slate-500 mt-2 font-light">
                      {activeFolder === 'competitive' && !activeSubFolder 
                        ? 'Select an entrance examination category to view specific results' 
                        : 'Historical performance records and trends'}
                    </p>
                  </div>
                </div>
                <div className={`p-6 rounded-md ${activeFolderData?.bgColor || 'bg-blue-500/5'} border-0 shadow-sm`}>
                  {activeSubFolder ? (
                    (() => {
                      const Icon = EXAM_FOLDERS.find(f => f.key === activeSubFolder)?.icon || FolderOpen;
                      return <Icon className={`h-8 w-8 ${EXAM_FOLDERS.find(f => f.key === activeSubFolder)?.color}`} />;
                    })()
                  ) : activeFolder === 'competitive' ? (
                    <GraduationCap className="h-8 w-8 text-blue-500" />
                  ) : (
                    activeFolderData && <activeFolderData.icon className={`h-8 w-8 ${activeFolderData.color}`} />
                  )}
                </div>
              </div>

              {activeFolder === 'competitive' && !activeSubFolder ? (
                /* Sub-folders for Competitive Exams */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {EXAM_FOLDERS.filter(f => COMPETITIVE_KEYS.includes(f.key)).map((folder) => {
                    const folderRankings = folderGroups[folder.key] ?? [];
                    const FolderIcon = folder.icon;
                    const hasResults = folderRankings.length > 0;
                    
                    return (
                      <button
                        key={folder.key}
                        disabled={!hasResults}
                        onClick={() => setActiveSubFolder(folder.key)}
                        className={`group flex items-center justify-between rounded-md border p-8 transition-all ${
                          hasResults 
                            ? `${folder.bgColor} hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg` 
                            : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/5 opacity-60 grayscale'
                        }`}
                      >
                        <div className="flex items-center gap-6">
                          <div className={`p-4 rounded-md bg-white dark:bg-black/20 shadow-sm transition-transform ${hasResults && 'group-hover:scale-110'}`}>
                            <FolderIcon className={`h-6 w-6 ${folder.color}`} />
                          </div>
                          <div className="text-left">
                            <div className="text-xl font-medium text-slate-900 dark:text-white">
                              {folder.label}
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                              {hasResults ? `${folderRankings.length} Assessment Records` : 'No Records Published'}
                            </div>
                          </div>
                        </div>
                        {hasResults && (
                          <div className={`p-2 rounded-md ${folder.color} bg-white dark:bg-black/20 transition-all group-hover:translate-x-1`}>
                            <ArrowRight className="h-4 w-4" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* ─── Result List View ─── */
                <div className="grid gap-4">
                  {activeFolderRankings.length > 0 ? (
                    activeFolderRankings.map((r) => (
                      <Link
                        key={r.id}
                        to={`/parent/tests/${r.test_id}`}
                        className="card group flex items-center justify-between p-6 transition-all hover:bg-slate-900 dark:hover:bg-white hover:border-transparent hover:-translate-y-1 hover:shadow-sm hover:shadow-slate-900/10"
                      >
                        <div className="flex items-center gap-6">
                          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 group-hover:bg-white/10 dark:group-hover:bg-slate-900/10 transition-colors">
                            <BookOpen className="h-5 w-5 text-slate-500 group-hover:text-white dark:group-hover:text-slate-900" />
                          </div>
                          <div className="flex flex-col">
                            <div className="text-lg font-medium text-slate-900 dark:text-white group-hover:text-white dark:group-hover:text-slate-900 transition-colors">
                              {r.test?.title}
                            </div>
                            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] group-hover:text-white/60 dark:group-hover:text-slate-900/60 transition-colors">
                              {formatDate(r.test?.test_date)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="text-right">
                            <div className="text-2xl font-light text-slate-900 dark:text-white group-hover:text-white dark:group-hover:text-slate-900">
                              {Number(r.percentage).toFixed(1)}%
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 group-hover:text-white/60 dark:group-hover:text-slate-900/60">
                              Rank #{r.rank}
                            </div>
                          </div>
                          <ArrowRight className="h-5 w-5 text-slate-300 transition-transform group-hover:translate-x-2 group-hover:text-white dark:group-hover:text-slate-900" />
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="p-12 text-center bg-slate-50 dark:bg-white/5 rounded-md border border-dashed border-slate-200 dark:border-white/10">
                      <p className="text-slate-400 font-light">No assessment data available for this category yet.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Latest Assessment Quick View (only if no active folder) */}
          {latest && !activeFolder && (
            <div className="space-y-6">
               <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Recent Milestone</div>
               <div className="card p-10 border-l-[12px] border-l-slate-900 dark:border-l-white overflow-hidden relative">
                 <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Trophy className="h-32 w-32 text-slate-900 dark:text-white" />
                 </div>
                 
                 <div className="flex items-center justify-between mb-10 relative z-10">
                   <div className="space-y-1">
                     <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                       Highest Recent Performance
                     </div>
                     <h3 className="text-3xl font-light tracking-tight text-slate-900 dark:text-white">{latest.test?.title}</h3>
                   </div>
                   <Link
                     to={`/parent/tests/${latest.test_id}`}
                     className="flex h-14 w-14 items-center justify-center rounded-md bg-slate-900 text-white transition-all hover:scale-110 active:scale-95 dark:bg-white dark:text-slate-900 shadow-xl shadow-slate-900/20"
                   >
                     <ArrowRight className="h-6 w-6" />
                   </Link>
                 </div>
                 
                 <div className="flex items-end justify-between relative z-10">
                   <div className="flex gap-12">
                     <div>
                       <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Percentage Score</div>
                       <div className="text-5xl font-light tracking-tighter text-slate-900 dark:text-white">{Number(latest.percentage).toFixed(1)}%</div>
                     </div>
                     <div>
                       <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cohort Rank</div>
                       <div className="text-5xl font-light tracking-tighter text-slate-900 dark:text-white">#{latest.rank}</div>
                     </div>
                   </div>
                   <div className="text-sm font-medium text-slate-400">
                     Assessed on {formatDate(latest.test?.test_date)}
                   </div>
                 </div>
               </div>
            </div>
          )}
        </div>
      </div>
      </> 
      ) : activeTab === 'competitive' ? (
      <>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
        {/* Child Details Card */}
        <div className="lg:col-span-4">
          <div className="card p-8 border-none shadow-sm shadow-slate-200/50 dark:shadow-none sticky top-24">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8">Student Profile</div>
            
            <div className="flex items-center gap-6 mb-10">
              <div className="flex h-20 w-20 items-center justify-center rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm shadow-slate-900/20">
                <GraduationCap className="h-10 w-10" />
              </div>
              <div>
                <h3 className="text-2xl font-medium text-slate-900 dark:text-white leading-tight">{child?.full_name}</h3>
                <p className="text-sm font-mono font-medium text-slate-400 mt-1 uppercase tracking-widest">{child?.roll_number}</p>
              </div>
            </div>
            
            <div className="space-y-6 pt-8 border-t border-slate-100 dark:border-white/5">
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Competitive Divisions</div>
                <div className="text-base font-medium text-slate-900 dark:text-white mt-2 space-y-1">
                  <div className="flex items-center gap-2"><Zap className="h-3 w-3 text-blue-500" /> JEE Mains</div>
                  <div className="flex items-center gap-2"><Zap className="h-3 w-3 text-indigo-500" /> JEE Advanced</div>
                  <div className="flex items-center gap-2"><Zap className="h-3 w-3 text-emerald-500" /> NEET</div>
                  <div className="flex items-center gap-2"><Zap className="h-3 w-3 text-violet-500" /> KCET</div>
                </div>
              </div>
              <div className="pt-4">
                <Link to="/parent/progress" className="group flex items-center justify-between w-full p-4 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-slate-900/10">
                  <span className="text-xs font-medium uppercase tracking-[0.1em]">View All Rankings</span>
                  <TrendingUp className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Competitive Results View */}
        <div className="lg:col-span-8 space-y-12">
          <div className="space-y-8">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-3xl font-light tracking-tight text-slate-900 dark:text-white">Competitive Divisions</h2>
                <p className="text-sm text-slate-500 mt-2 font-normal">Performance across entrance examinations</p>
              </div>
            </div>

            {lsRanks ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2].map((i) => <div key={i} className="h-48 w-full animate-pulse rounded-md bg-slate-100 dark:bg-white/5" />)}
              </div>
            ) : competitiveCount === 0 ? (
              <div className="card p-20 flex flex-col items-center justify-center text-center border-dashed border-2 border-slate-200 dark:border-slate-800">
                <div className="rounded-md bg-slate-50 dark:bg-white/5 p-8 mb-6">
                  <Zap className="h-12 w-12 text-slate-200" />
                </div>
                <h3 className="text-xl font-medium text-slate-900 dark:text-white">No Competitive Results</h3>
                <p className="text-sm text-slate-500 mt-3 max-w-[280px] font-light leading-relaxed">
                  Competitive exam results will appear here once published by faculty.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {EXAM_FOLDERS.filter(f => COMPETITIVE_KEYS.includes(f.key)).map((folder) => {
                  const folderRankings = folderGroups[folder.key] ?? [];
                  const FolderIcon = folder.icon;
                  const hasResults = folderRankings.length > 0;
                  
                  return (
                    <button
                      key={folder.key}
                      disabled={!hasResults}
                      onClick={() => setActiveSubFolder(folder.key)}
                      className={`group flex items-center justify-between rounded-md border p-8 transition-all ${
                        hasResults 
                          ? `${folder.bgColor} hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg` 
                          : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/5 opacity-60 grayscale'
                      }`}
                    >
                      <div className="flex items-center gap-6">
                        <div className={`p-4 rounded-md bg-white dark:bg-black/20 shadow-sm transition-transform ${hasResults && 'group-hover:scale-110'}`}>
                          <FolderIcon className={`h-6 w-6 ${folder.color}`} />
                        </div>
                        <div className="text-left">
                          <div className="text-xl font-medium text-slate-900 dark:text-white">
                            {folder.label}
                          </div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                            {hasResults ? `${folderRankings.length} Assessment Records` : 'No Records Published'}
                          </div>
                        </div>
                      </div>
                      {hasResults && (
                        <div className={`p-2 rounded-md ${folder.color} bg-white dark:bg-black/20 transition-all group-hover:translate-x-1`}>
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Competitive Exam Details */}
          {activeSubFolder && (
            <div className="space-y-10">
              <div className="flex items-center justify-between">
                <div className="space-y-4">
                  <button
                    onClick={() => setActiveSubFolder(null)}
                    className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 transition-colors hover:text-slate-900 dark:hover:text-white"
                  >
                    <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" /> 
                    Back to Competitive Exams
                  </button>
                  <div>
                    <h2 className="text-4xl font-light tracking-tight text-slate-900 dark:text-white leading-none">
                      {EXAM_FOLDERS.find(f => f.key === activeSubFolder)?.label}
                    </h2>
                    <p className="text-sm text-slate-500 mt-2 font-light">
                      Historical performance records and trends
                    </p>
                  </div>
                </div>
                <div className={`p-6 rounded-md ${EXAM_FOLDERS.find(f => f.key === activeSubFolder)?.bgColor || 'bg-blue-500/5'} border-0 shadow-sm`}>
                  {(() => {
                    const Icon = EXAM_FOLDERS.find(f => f.key === activeSubFolder)?.icon || FolderOpen;
                    return <Icon className={`h-8 w-8 ${EXAM_FOLDERS.find(f => f.key === activeSubFolder)?.color}`} />;
                  })()}
                </div>
              </div>

              <div className="grid gap-4">
                {(folderGroups[activeSubFolder] ?? []).length > 0 ? (
                  (folderGroups[activeSubFolder] ?? []).map((r) => (
                    <Link
                      key={r.id}
                      to={`/parent/tests/${r.test_id}`}
                      className="card group flex items-center justify-between p-6 transition-all hover:bg-slate-900 dark:hover:bg-white hover:border-transparent hover:-translate-y-1 hover:shadow-sm hover:shadow-slate-900/10"
                    >
                      <div className="flex items-center gap-6">
                        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 group-hover:bg-white/10 dark:group-hover:bg-slate-900/10 transition-colors">
                          <BookOpen className="h-5 w-5 text-slate-500 group-hover:text-white dark:group-hover:text-slate-900" />
                        </div>
                        <div className="flex flex-col">
                          <div className="text-lg font-medium text-slate-900 dark:text-white group-hover:text-white dark:group-hover:text-slate-900 transition-colors">
                            {r.test?.title}
                          </div>
                          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] group-hover:text-white/60 dark:group-hover:text-slate-900/60 transition-colors">
                            {formatDate(r.test?.test_date)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="text-right">
                          <div className="text-2xl font-light text-slate-900 dark:text-white group-hover:text-white dark:group-hover:text-slate-900">
                            {Number(r.percentage).toFixed(1)}%
                          </div>
                          <div className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 group-hover:text-white/60 dark:group-hover:text-slate-900/60">
                            Rank #{r.rank}
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-slate-300 transition-transform group-hover:translate-x-2 group-hover:text-white dark:group-hover:text-slate-900" />
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="p-12 text-center bg-slate-50 dark:bg-white/5 rounded-md border border-dashed border-slate-200 dark:border-white/10">
                    <p className="text-slate-400 font-light">No assessment data available for this category yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      </>
      ) : null}
    </div>
  );
}
