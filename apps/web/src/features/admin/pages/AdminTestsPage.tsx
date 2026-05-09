import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  ClipboardList, Search, CheckCircle2, Lock, FileText, Plus, 
  Calendar, BookOpen, Trash2, Trophy, Eye, ArrowRight,
  Filter, ChevronDown, Layers, Target, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useDirectory } from '@/context/DirectoryContext';
import { useBatches } from '@/hooks/useBatches';
import { supabase } from '@/lib/supabaseClient';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/Badge';
import { Modal } from '@/components/Modal';
import { formatDate } from '@/lib/utils';
import { EXAM_CATEGORY_LABELS } from '@shared';
import type { ExamCategory } from '@shared';
import { useAuth } from '@/hooks/useAuth';
import { useColleges } from '@/hooks/useColleges';

function useAdminTests(collegeId?: string | null, batchId?: string, search?: string) {
  return useQuery({
    queryKey: ['admin-tests', collegeId, batchId, search],
    queryFn: async () => {
      let q = supabase
        .from('tests')
        .select('id, title, test_date, exam_category, exam_sub_type, is_published, is_locked, created_at, batch:batches(id, name)')
        .order('created_at', { ascending: false });

      if (collegeId) q = q.eq('college_id', collegeId);
      if (batchId) q = q.eq('batch_id', batchId);
      if (search) q = q.ilike('title', `%${search}%`);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function AdminTestsPage() {
  const { user } = useAuth();
  const { selectedCollegeId, isGlobalMode } = useDirectory();
  const { data: colleges } = useColleges();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published' | 'locked'>('all');

  const { data: tests, isLoading } = useAdminTests(selectedCollegeId, batchFilter || undefined, search || undefined);
  const { data: batches } = useBatches(selectedCollegeId ?? undefined);

  // Creation State
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [testDate, setTestDate] = useState('');
  const [category, setCategory] = useState<ExamCategory>('Practice');
  const [subType, setSubType] = useState('');
  const [targetCollegeId, setTargetCollegeId] = useState<string>('');
  const [targetBatchId, setTargetBatchId] = useState('');
  const [subjects, setSubjects] = useState<{ name: string; maxMarks: number; numQuestions: number }[]>([
    { name: '', maxMarks: 100, numQuestions: 0 }
  ]);
  const [creating, setCreating] = useState(false);

  // Filter batches for the selected college in the modal
  const { data: modalBatches } = useBatches(targetCollegeId || selectedCollegeId || undefined);

  useEffect(() => {
    if (createOpen && selectedCollegeId) {
      setTargetCollegeId(selectedCollegeId);
    } else if (createOpen && !selectedCollegeId) {
      setTargetCollegeId('');
    }
  }, [createOpen, selectedCollegeId]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this test? This will also delete all associated marks.')) return;
    try {
      const { error } = await supabase.from('tests').delete().eq('id', id);
      if (error) throw error;
      toast.success('Test deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-tests'] });
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to delete test');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const collegeId = targetCollegeId || selectedCollegeId;
    if (!collegeId || !user) {
      toast.error('Please select a college');
      return;
    }
    if (!title || !testDate || !targetBatchId || subjects.some(s => !s.name)) {
      toast.error('Fill all fields and add at least one subject');
      return;
    }

    setCreating(true);
    try {
      const { data: test, error: testErr } = await supabase
        .from('tests')
        .insert({
          college_id: collegeId,
          batch_id: targetBatchId,
          created_by: user.id,
          title: title.trim(),
          test_date: testDate,
          exam_category: category,
          exam_sub_type: subType.trim() || null,
        })
        .select()
        .single();

      if (testErr) throw testErr;

      const { error: subErr } = await supabase
        .from('test_subjects')
        .insert(subjects.map((s, idx) => ({
          test_id: test.id,
          subject_name: s.name.trim(),
          max_marks: s.maxMarks,
          num_questions: s.numQuestions || 0,
          display_order: idx,
        })));

      if (subErr) throw subErr;

      toast.success('Test created successfully');
      setCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['admin-tests'] });
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create test');
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setTestDate('');
    setCategory('Practice');
    setSubType('');
    setTargetBatchId('');
    setSubjects([{ name: '', maxMarks: 100, numQuestions: 0 }]);
  };

  const filtered = (tests ?? []).filter((t: any) => {
    if (statusFilter === 'locked') return t.is_locked;
    if (statusFilter === 'published') return t.is_published && !t.is_locked;
    if (statusFilter === 'draft') return !t.is_published;
    return true;
  });

  return (
    <div className="max-w-[1600px] mx-auto space-y-12 animate-fade-in pb-12">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10">
            <ClipboardList className="h-3 w-3 text-slate-900 dark:text-white" />
            <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-900 dark:text-white">
              Assessment Engine
            </span>
          </div>
          <div className="space-y-1">
            <h1 className="text-5xl font-light tracking-tight text-slate-900 dark:text-white leading-tight">
              Examinations
            </h1>
            <p className="max-w-xl text-lg text-slate-500 font-light leading-relaxed">
              Design, manage, and distribute academic assessments across all cohorts.
            </p>
          </div>
        </div>

        <button onClick={() => setCreateOpen(true)} className="btn btn-primary px-8">
          <Plus className="h-4 w-4" /> Create Assessment
        </button>
      </div>

      {/* Control Bar */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[300px] relative group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-slate-900 dark:group-focus-within:text-white transition-colors" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assessments by title or category…"
            className="input-premium w-full pl-14 pr-6 py-4"
          />
        </div>
        
        <div className="flex items-center gap-2 bg-white dark:bg-slate-950 p-1.5 rounded-md border border-slate-100 dark:border-slate-800 shadow-sm">
          <button 
            onClick={() => setStatusFilter('all')}
            className={`px-6 py-2.5 rounded-md text-[10px] font-normal uppercase tracking-widest transition-all ${statusFilter === 'all' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            All
          </button>
          <button 
            onClick={() => setStatusFilter('draft')}
            className={`px-6 py-2.5 rounded-md text-[10px] font-normal uppercase tracking-widest transition-all ${statusFilter === 'draft' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            Drafts
          </button>
          <button 
            onClick={() => setStatusFilter('published')}
            className={`px-6 py-2.5 rounded-md text-[10px] font-normal uppercase tracking-widest transition-all ${statusFilter === 'published' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            Live
          </button>
          <button 
            onClick={() => setStatusFilter('locked')}
            className={`px-6 py-2.5 rounded-md text-[10px] font-normal uppercase tracking-widest transition-all ${statusFilter === 'locked' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            Locked
          </button>
        </div>

        <div className="relative">
          <Layers className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
            className="input-premium pl-12 pr-10 py-4 appearance-none min-w-[200px]"
          >
            <option value="">All Batches</option>
            {(batches ?? []).map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Table Area */}
      <div className="card overflow-hidden border-none shadow-sm">
        {isLoading ? (
          <div className="p-12"><TableSkeleton rows={10} cols={6} /></div>
        ) : filtered.length === 0 ? (
          <div className="p-20">
            <EmptyState
              icon={ClipboardList}
              title="No assessments found"
              description="Deploy a new test to begin recording student metrics."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky top-0 bg-white dark:bg-slate-950/80 px-8 py-6 border-b border-slate-100 dark:border-slate-800 text-left">
                    <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400">Assessment Title</span>
                  </th>
                  <th className="sticky top-0 bg-white dark:bg-slate-950/80 px-8 py-6 border-b border-slate-100 dark:border-slate-800 text-left">
                    <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400">Framework</span>
                  </th>
                  <th className="sticky top-0 bg-white dark:bg-slate-950/80 px-8 py-6 border-b border-slate-100 dark:border-slate-800 text-left">
                    <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400">Target Cohort</span>
                  </th>
                  <th className="sticky top-0 bg-white dark:bg-slate-950/80 backdrop-blur-xl px-8 py-6 border-b border-slate-100 dark:border-slate-800 text-center">
                    <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400">Execution Date</span>
                  </th>
                  <th className="sticky top-0 bg-white dark:bg-slate-950/80 backdrop-blur-xl px-8 py-6 border-b border-slate-100 dark:border-slate-800 text-center">
                    <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400">Status</span>
                  </th>
                  <th className="sticky top-0 bg-white dark:bg-slate-950/80 backdrop-blur-xl px-8 py-6 border-b border-slate-100 dark:border-slate-800 text-right">
                    <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-900/50">
                {filtered.map((t: any) => (
                  <tr key={t.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-normal text-slate-900 dark:text-white group-hover:text-slate-600 transition-colors">{t.title}</span>
                        <span className="text-[9px] font-normal text-slate-400 uppercase tracking-widest mt-0.5">ID: {t.id.split('-')[0]}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-normal text-slate-600 dark:text-slate-300 uppercase tracking-wider">{EXAM_CATEGORY_LABELS[t.exam_category as ExamCategory] || t.exam_category}</span>
                        {t.exam_sub_type && <span className="text-[10px] text-slate-400 font-normal">{t.exam_sub_type}</span>}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                       <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-normal text-slate-600 dark:text-slate-400 uppercase tracking-widest">
                         {t.batch?.name ?? 'Unassigned'}
                       </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                       <span className="text-xs font-normal text-slate-500">{t.test_date ? formatDate(t.test_date) : '—'}</span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      {t.is_locked ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[9px] font-normal uppercase tracking-widest border border-indigo-500/20">
                          <Lock className="h-3 w-3" /> Locked
                        </div>
                      ) : t.is_published ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-normal uppercase tracking-widest border border-emerald-500/20">
                          <div className="w-1 h-1 rounded-md bg-emerald-500 animate-pulse" /> Live
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 text-[9px] font-normal uppercase tracking-widest border border-transparent">
                          Draft
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        <Link to={`/admin/tests/${t.id}/marks`} className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-slate-900 transition-all shadow-sm">
                          <Eye className="h-4 w-4" />
                        </Link>
                        {t.is_locked && (
                          <Link to={`/admin/tests/${t.id}/rankings`} className="p-2 rounded-md bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white transition-all shadow-sm">
                            <Trophy className="h-4 w-4" />
                          </Link>
                        )}
                        <button onClick={() => handleDelete(t.id)} className="p-2 rounded-md bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Design New Assessment" size="xl">
        <form onSubmit={handleCreate} className="space-y-8 p-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {isGlobalMode && (
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400 ml-1">Academic Entity</label>
                <select 
                  value={targetCollegeId} 
                  onChange={(e) => {
                    setTargetCollegeId(e.target.value);
                    setTargetBatchId('');
                  }} 
                  className="input-premium w-full" 
                  required
                >
                  <option value="">Select institution…</option>
                  {colleges?.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400 ml-1">Assessment Designation</label>
              <input 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                className="input-premium w-full text-lg font-normal" 
                placeholder="e.g. KCET Preparatory - Mathematics Segment I" 
                required 
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400 ml-1">Target Cohort</label>
              <div className="relative">
                <Layers className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <select value={targetBatchId} onChange={(e) => setTargetBatchId(e.target.value)} className="input-premium w-full pl-12" required>
                  <option value="">Select framework…</option>
                  {modalBatches?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400 ml-1">Assessment Date</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} className="input-premium w-full pl-12" required />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400 ml-1">Examination Category</label>
              <div className="relative">
                <Target className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <select value={category} onChange={(e) => setCategory(e.target.value as any)} className="input-premium w-full pl-12">
                  <option value="Practice">Practice / Internal Assessment</option>
                  <option value="Board">Term Exam (Board)</option>
                  <option value="KCET">KCET Preparatory</option>
                  <option value="NEET">NEET Mock</option>
                  <option value="JEE_Mains">JEE Mains</option>
                  <option value="JEE_Advanced">JEE Advanced</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400 ml-1">Sub-type Descriptor</label>
              <div className="relative">
                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input value={subType} onChange={(e) => setSubType(e.target.value)} className="input-premium w-full pl-12" placeholder="e.g. Monthly, Revision" />
              </div>
            </div>
          </div>

          <div className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <label className="text-base font-normal text-slate-900 dark:text-white">Segment Architecture</label>
                <p className="text-[10px] font-normal uppercase tracking-widest text-slate-400">Define subjects, marks, and question volume</p>
              </div>
              <button type="button" onClick={() => setSubjects([...subjects, { name: '', maxMarks: 100, numQuestions: 0 }])} className="btn btn-secondary px-6 text-xs">
                <Plus className="h-3 w-3" /> Add Segment
              </button>
            </div>
            
            <div className="grid gap-4">
              {subjects.map((s, idx) => (
                <div key={idx} className="flex gap-4 items-end animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-[9px] font-normal uppercase tracking-widest text-slate-400 ml-1">Subject Name</label>
                    <div className="relative">
                      <BookOpen className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input value={s.name} onChange={(e) => {
                        const news = [...subjects];
                        news[idx].name = e.target.value;
                        setSubjects(news);
                      }} className="input-premium w-full pl-12" placeholder="e.g. Physics" required />
                    </div>
                  </div>
                  <div className="w-28 space-y-1.5">
                    <label className="text-[9px] font-normal uppercase tracking-widest text-slate-400 ml-1">Max Marks</label>
                    <input type="number" value={s.maxMarks} onChange={(e) => {
                      const news = [...subjects];
                      news[idx].maxMarks = parseInt(e.target.value);
                      setSubjects(news);
                    }} className="input-premium w-full text-center font-normal" placeholder="100" required />
                  </div>
                  <div className="w-28 space-y-1.5">
                    <label className="text-[9px] font-normal uppercase tracking-widest text-slate-400 ml-1">Questions</label>
                    <div className="relative">
                       <Clock className="absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
                       <input type="number" value={s.numQuestions} onChange={(e) => {
                         const news = [...subjects];
                         news[idx].numQuestions = parseInt(e.target.value);
                         setSubjects(news);
                       }} className="input-premium w-full text-center pl-8 font-normal" placeholder="60" required />
                    </div>
                  </div>
                  {subjects.length > 1 && (
                    <button type="button" onClick={() => setSubjects(subjects.filter((_, i) => i !== idx))} className="btn btn-ghost p-4 text-red-500 hover:bg-red-50 rounded-md mb-1">
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={() => setCreateOpen(false)} className="btn btn-secondary px-8">Discard</button>
            <button type="submit" disabled={creating} className="btn btn-primary px-12">
              {creating ? 'Processing...' : 'Deploy Assessment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
