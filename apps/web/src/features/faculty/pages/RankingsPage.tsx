import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Download, Send, RefreshCw, Star, Award, Target, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTest } from '@/hooks/useTests';
import { useBatch, useFacultyAssignedBatches } from '@/hooks/useBatches';
import { useRankings, useSubjectRankings } from '@/hooks/useRankings';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { downloadCsv } from '@/lib/csvParser';
import { supabase } from '@/lib/supabaseClient';
import { formatDate } from '@/lib/utils';
import { useState, useEffect, useMemo } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useVerifiedChildren, useChildRankings } from '@/hooks/useChildResults';

export function RankingsPage() {
  const { id: routeTestId } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  
  // Test selection state
  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const effectiveTestId = routeTestId || selectedTestId;

  // Sync test ID from route if present
  useEffect(() => {
    if (routeTestId) {
      setSelectedTestId(routeTestId);
    }
  }, [routeTestId]);

  // Parent child selection
  const { data: children } = useVerifiedChildren(role === 'parent' ? user?.id : undefined);
  const [selectedChildId, setSelectedChildId] = useState<string>(() => {
    return sessionStorage.getItem('aiq.selectedChildId') || '';
  });

  useEffect(() => {
    if (role === 'parent' && children && children.length > 0) {
      if (!selectedChildId || !children.find((c) => c.student_id === selectedChildId)) {
        const defaultId = children[0].student_id;
        setSelectedChildId(defaultId);
        sessionStorage.setItem('aiq.selectedChildId', defaultId);
      }
    }
  }, [children, role, selectedChildId]);

  const handleChildChange = (studentId: string) => {
    setSelectedChildId(studentId);
    sessionStorage.setItem('aiq.selectedChildId', studentId);
    setSelectedTestId('');
  };

  // Faculty batches
  const { data: facultyBatches } = useFacultyAssignedBatches(role === 'faculty' ? user?.id : undefined);
  const facultyBatchIds = useMemo(() => (facultyBatches ?? []).map((b) => b.id), [facultyBatches]);

  // Load available tests with rankings for the selector
  const { data: availableTests, isLoading: lsAvailableTests } = useQuery({
    queryKey: ['available-rankings-tests', role, user?.id, selectedChildId, facultyBatchIds],
    queryFn: async () => {
      if (!role) return [];
      
      if (role === 'admin') {
        const { data, error } = await supabase
          .from('tests')
          .select('*')
          .or('is_locked.eq.true,is_published.eq.true')
          .order('test_date', { ascending: false });
        if (error) throw error;
        return data;
      }
      
      if (role === 'faculty') {
        if (!facultyBatchIds || facultyBatchIds.length === 0) return [];
        const { data, error } = await supabase
          .from('tests')
          .select('*')
          .in('batch_id', facultyBatchIds)
          .or('is_locked.eq.true,is_published.eq.true')
          .order('test_date', { ascending: false });
        if (error) throw error;
        return data;
      }
      
      if (role === 'parent') {
        if (!selectedChildId) return [];
        const { data, error } = await supabase
          .from('rankings')
          .select('*, test:tests(*)')
          .eq('student_id', selectedChildId)
          .order('computed_at', { ascending: false });
        if (error) throw error;
        return (data ?? [])
          .map((r: any) => r.test)
          .filter((t: any) => t && t.is_published);
      }
      
      return [];
    },
    enabled: !!role && (role !== 'parent' || !!selectedChildId) && (role !== 'faculty' || facultyBatchIds.length > 0),
  });

  // Auto-select first test if none selected
  useEffect(() => {
    if (!routeTestId && availableTests && availableTests.length > 0 && !selectedTestId) {
      setSelectedTestId(availableTests[0].id);
    }
  }, [routeTestId, availableTests, selectedTestId]);

  const { data: test, isLoading: lsTest } = useTest(effectiveTestId || undefined);
  const { data: batch } = useBatch(test?.batch_id);
  
  const [activeTab, setActiveTab] = useState<'overall' | string>('overall');
  const selectedSubjectId = activeTab === 'overall' ? undefined : activeTab;
  
  const { data: rankings, isLoading: lsRanks } = useRankings(effectiveTestId || undefined);
  const { data: subjectRankings, isLoading: lsSubRanks } = useSubjectRankings(effectiveTestId || undefined, selectedSubjectId);
  
  const [notifying, setNotifying] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const queryClient = useQueryClient();

  const handleExport = () => {
    if (activeTab === 'overall') {
      if (!rankings || rankings.length === 0) return;
      const rows = rankings.map((r) => ({
        rank: r.rank,
        roll_number: r.student?.roll_number ?? '',
        name: r.student?.full_name ?? '',
        total_marks: r.total_marks,
        max_marks: r.max_marks,
        percentage: Number(r.percentage).toFixed(2),
      }));
      downloadCsv(`rankings-${test?.title ?? effectiveTestId}.csv`, rows);
    } else {
      if (!subjectRankings || subjectRankings.length === 0) return;
      const subjectName = test?.subjects?.find((s) => s.id === activeTab)?.subject_name ?? 'subject';
      const rows = subjectRankings.map((r) => ({
        rank: r.rank,
        roll_number: r.student?.roll_number ?? '',
        name: r.student?.full_name ?? '',
        marks_obtained: r.is_absent ? 'Absent' : (r.marks_obtained ?? ''),
        total_students: r.total_students,
      }));
      downloadCsv(`rankings-${test?.title ?? effectiveTestId}-${subjectName}.csv`, rows);
    }
  };

  const handleNotify = async () => {
    if (!effectiveTestId) return;
    setNotifying(true);
    try {
      const { error } = await supabase.functions.invoke('send-notification', {
        body: { test_id: effectiveTestId },
      });
      if (error) throw error;
      toast.success('Parents notified');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to send notifications');
    } finally {
      setNotifying(false);
    }
  };

  const handleRecalculate = async () => {
    if (!effectiveTestId) return;
    setRecalculating(true);
    try {
      const { data, error } = await supabase.rpc('recalculate_rankings', { p_test_id: effectiveTestId });
      if (error) throw error;
      toast.success(`Rankings recalculated — ${data} students ranked`);
      queryClient.invalidateQueries({ queryKey: ['rankings', effectiveTestId] });
      queryClient.invalidateQueries({ queryKey: ['subject-rankings', effectiveTestId] });
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to recalculate');
    } finally {
      setRecalculating(false);
    }
  };

  const isInitialLoading = lsAvailableTests || (role === 'parent' && !selectedChildId);
  const isDataLoading = effectiveTestId ? (lsTest || lsRanks) : false;

  if (isInitialLoading) return (
    <div className="p-12 space-y-8 max-w-[1600px] mx-auto">
      <TableSkeleton rows={10} cols={5} />
    </div>
  );

  if (!availableTests || availableTests.length === 0) {
    return (
      <div className="max-w-[1600px] mx-auto space-y-12 p-12">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10">
            <Trophy className="h-3 w-3 text-slate-900 dark:text-white" />
            <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-900 dark:text-white">
              Competitive Rankings
            </span>
          </div>
          <h1 className="text-5xl font-light tracking-tight text-slate-900 dark:text-white leading-tight">
            Leaderboard
          </h1>
        </div>

        {role === 'parent' && children && children.length > 1 && (
          <div className="flex flex-col gap-1.5 min-w-[200px] max-w-[240px]">
            <label className="text-[10px] font-normal uppercase tracking-widest text-slate-400">Select Student</label>
            <div className="relative w-full">
              <select
                value={selectedChildId}
                onChange={(e) => handleChildChange(e.target.value)}
                className="input-premium pl-4 pr-10 py-2.5 appearance-none w-full text-xs"
              >
                {children.map((c) => (
                  <option key={c.student_id} value={c.student_id}>
                    {c.full_name} ({c.roll_number})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>
        )}

        <div className="card p-20 text-center">
          <EmptyState
            icon={Trophy}
            title="No competitive rankings found"
            description={role === 'parent' ? "No results have been published for your student yet." : "Lock marks on a test or publish to parents to generate leaderboard indices."}
          />
        </div>
      </div>
    );
  }

  if (isDataLoading) return (
    <div className="p-12 space-y-8 max-w-[1600px] mx-auto">
      <TableSkeleton rows={10} cols={5} />
    </div>
  );

  if (!test) return <div className="p-20 text-center text-slate-500 font-light">Assessment not found in institutional records.</div>;

  const isLoadingRanks = activeTab === 'overall' ? lsRanks : lsSubRanks;
  const currentList = activeTab === 'overall' ? rankings : subjectRankings;

  return (
    <div className="max-w-[1600px] mx-auto space-y-12 animate-fade-in pb-12">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-6">
          {routeTestId && (
            <Link 
              to={
                role === 'admin' 
                  ? '/admin/tests' 
                  : role === 'faculty' 
                    ? '/faculty/tests' 
                    : `/parent/tests/${effectiveTestId}`
              } 
              className="group inline-flex items-center gap-2 text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
              {role === 'parent' ? 'Return to Result Details' : 'Assessments Archive'}
            </Link>
          )}

          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10">
              <Trophy className="h-3 w-3 text-slate-900 dark:text-white" />
              <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-900 dark:text-white">
                Competitive Rankings
              </span>
            </div>
            <div className="space-y-1">
              <h1 className="text-5xl font-light tracking-tight text-slate-900 dark:text-white leading-tight">
                {test.title}
              </h1>
              <p className="max-w-xl text-lg text-slate-500 font-light leading-relaxed">
                Metric distribution for cohort <span className="text-slate-900 dark:text-white font-normal">{batch?.name || "unassigned"}</span>.
              </p>
            </div>
          </div>

          {!routeTestId && (
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center pt-2">
              {role === 'parent' && children && children.length > 1 && (
                <div className="flex flex-col gap-1.5 min-w-[200px]">
                  <label className="text-[10px] font-normal uppercase tracking-widest text-slate-400">Select Student</label>
                  <div className="relative w-full">
                    <select
                      value={selectedChildId}
                      onChange={(e) => handleChildChange(e.target.value)}
                      className="input-premium pl-4 pr-10 py-2.5 appearance-none w-full text-xs"
                    >
                      {children.map((c) => (
                        <option key={c.student_id} value={c.student_id}>
                          {c.full_name} ({c.roll_number})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}
              {availableTests && availableTests.length > 0 && (
                <div className="flex flex-col gap-1.5 min-w-[240px]">
                  <label className="text-[10px] font-normal uppercase tracking-widest text-slate-400">Select Assessment</label>
                  <div className="relative w-full">
                    <select
                      value={selectedTestId}
                      onChange={(e) => setSelectedTestId(e.target.value)}
                      className="input-premium pl-4 pr-10 py-2.5 appearance-none w-full text-xs font-medium"
                    >
                      {availableTests.map((t: any) => (
                        <option key={t.id} value={t.id}>
                          {t.title} ({formatDate(t.test_date)})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {role !== 'parent' && (
            <button
              onClick={handleRecalculate}
              disabled={recalculating || !test?.is_locked}
              className="btn btn-secondary px-6 shadow-sm flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} />
              <span className="text-xs">Recalculate Indices</span>
            </button>
          )}
          <button
            onClick={handleExport}
            disabled={!currentList || currentList.length === 0}
            className="btn btn-secondary px-6 shadow-sm flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            <span className="text-xs">Export CSV</span>
          </button>
          {test.is_published && role !== 'parent' && (
            <button
              onClick={handleNotify}
              disabled={notifying}
              className="btn btn-primary px-8 shadow-xl shadow-slate-900/10 flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              <span className="text-xs uppercase tracking-widest font-normal">Notify Guardians</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 dark:border-slate-800 gap-6 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('overall')}
          className={`pb-4 text-sm font-medium tracking-tight border-b-2 transition-colors px-1 whitespace-nowrap ${
            activeTab === 'overall'
              ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          Overall Class Leaderboard
        </button>
        {test?.subjects?.map((sub) => (
          <button
            key={sub.id}
            onClick={() => setActiveTab(sub.id)}
            className={`pb-4 text-sm font-medium tracking-tight border-b-2 transition-colors px-1 whitespace-nowrap ${
              activeTab === sub.id
                ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            {sub.subject_name}
          </button>
        ))}
      </div>

      {/* Rankings Table */}
      <div className="card overflow-hidden">
        {isLoadingRanks ? (
          <div className="p-12"><TableSkeleton rows={10} cols={5} /></div>
        ) : !currentList || currentList.length === 0 ? (
          <div className="p-20">
            <EmptyState
              icon={Trophy}
              title="No competitive data"
              description="Finalize and lock the assessment marks to generate performance indices."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 text-left">
                    <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400">Competitive Rank</span>
                  </th>
                  <th className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 text-left">
                    <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400">Student Identity</span>
                  </th>
                  <th className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 text-right">
                    <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400">
                      {activeTab === 'overall' ? 'Raw Score' : 'Subject Score'}
                    </span>
                  </th>
                  {activeTab === 'overall' && (
                    <th className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 text-right">
                      <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400">Performance Index</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-900/50">
                {currentList.map((r: any) => {
                  const maxMarks = activeTab === 'overall' 
                    ? r.max_marks 
                    : (test?.subjects?.find((s) => s.id === activeTab)?.max_marks ?? 100);
                  const displayScore = activeTab === 'overall' 
                    ? Number(r.total_marks).toFixed(2) 
                    : (r.is_absent ? 'Absent' : (r.marks_obtained != null ? Number(r.marks_obtained).toFixed(2) : '—'));

                  const isMyChild = role === 'parent' && r.student_id === selectedChildId;

                  return (
                    <tr 
                      key={r.id} 
                      className={`group transition-colors ${
                        isMyChild 
                          ? 'bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 border-l-2 border-indigo-600' 
                          : 'hover:bg-slate-50/50'
                      }`}
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          {r.rank === 1 ? (
                            <div className="w-8 h-8 rounded-md bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-500 shadow-sm border border-amber-200 dark:border-amber-900/30">
                              <Star className="h-4 w-4 fill-current" />
                            </div>
                          ) : r.rank === 2 ? (
                            <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 shadow-sm border border-slate-200 dark:border-slate-700">
                              <Award className="h-4 w-4" />
                            </div>
                          ) : r.rank === 3 ? (
                            <div className="w-8 h-8 rounded-md bg-orange-50 dark:bg-orange-900/10 flex items-center justify-center text-orange-600 dark:text-orange-500 shadow-sm border border-orange-100 dark:border-orange-900/20">
                              <Award className="h-4 w-4" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 flex items-center justify-center">
                              <span className="text-xs font-normal text-slate-300">#{r.rank}</span>
                            </div>
                          )}
                          <span className={`text-sm font-normal tracking-tight ${r.rank <= 3 ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                            {r.rank === 1 ? 'Elite I' : r.rank === 2 ? 'Elite II' : r.rank === 3 ? 'Elite III' : `Rank ${r.rank}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-normal text-slate-900 dark:text-white">{r.student?.full_name ?? 'Anonymous Student'}</span>
                            <span className="text-[10px] font-normal text-slate-400 uppercase tracking-widest mt-0.5">Roll: {r.student?.roll_number ?? '—'}</span>
                          </div>
                          {isMyChild && (
                            <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-indigo-600 text-white dark:bg-white dark:text-indigo-900">
                              Your Child
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="inline-flex items-center gap-2">
                           <span className="text-xs font-normal tabular-nums text-slate-900 dark:text-white">
                             {displayScore}
                           </span>
                           {(!r.is_absent || activeTab === 'overall') && (
                             <span className="text-[10px] font-normal text-slate-300 uppercase tracking-widest">/ {Number(maxMarks).toFixed(0)}</span>
                           )}
                        </div>
                      </td>
                      {activeTab === 'overall' && (
                        <td className="px-8 py-5 text-right">
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                            <Target className="h-3 w-3" />
                            <span className="text-xs font-normal tabular-nums">{Number(r.percentage).toFixed(2)}%</span>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
