import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Lock,
  Send,
  Upload,
  Download,
  Trophy,
  CheckCircle2,
  AlertCircle,
  Info,
  BookOpen,
  ShieldCheck,
  Users,
  Clock,
} from 'lucide-react';
import { useTest, usePublishTest, useLockTest, useApproveMarks, usePublishMarksToParents } from '@/hooks/useTests';
import { useStudents } from '@/hooks/useStudents';
import { useBatch } from '@/hooks/useBatches';
import { useMarks, useDebouncedMarkSave, useBulkMarksUpload } from '@/hooks/useMarks';
import { useAuth } from '@/hooks/useAuth';
import { CardSkeleton } from '@/components/LoadingSkeleton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Modal } from '@/components/Modal';
import { parseMarksCsv, downloadMarksTemplate } from '@/lib/csvParser';
import { parseOMRExcel } from '@/lib/excelParser';
import { supabase } from '@/lib/supabaseClient';
import { useQueryClient } from '@tanstack/react-query';
import {
  TestSubject,
  ExamCategory,
  Mark,
} from '@shared';

// ─── Calculation Helper ──────────────────────────────────────────────────────
const calculateMarks = (
  att: number,
  inc: number,
  tq: number,
  max: number,
  cat: ExamCategory
): number => {
  if (tq <= 0) return Number(Math.max(0, att).toFixed(2));
  const cor = att - inc;
  if (cor < 0) return 0;
  const marksPerCorrect = max / tq;
  let marks = cor * marksPerCorrect;
  if (['JEE_Mains', 'JEE_Advanced', 'NEET'].includes(cat)) {
    marks -= inc * 1; 
  }
  return Number(Math.max(0, marks).toFixed(2));
};

// ─── MarkCell Component ──────────────────────────────────────────────────────
interface MarkCellProps {
  studentId: string;
  subject: TestSubject;
  testCategory: ExamCategory;
  existing?: Mark;
  disabled: boolean;
  onChange: (data: {
    marks_obtained: number;
    num_attempted: number | null;
    num_unanswered: number | null;
    num_incorrect: number | null;
  }) => void;
  onAbsentToggle: (absent: boolean) => void;
}

const MarkCell = ({
  subject,
  testCategory,
  existing,
  disabled,
  onChange,
  onAbsentToggle,
}: MarkCellProps) => {
  const tq = subject.num_questions || 0;
  const isOMRStyle = testCategory !== 'Board Exam' && tq > 0;

  const [att, setAtt] = useState<string>(
    isOMRStyle
      ? (existing?.num_attempted?.toString() ?? '')
      : (existing?.marks_obtained?.toString() ?? '')
  );
  const [inc, setInc] = useState<string>(existing?.num_incorrect?.toString() ?? '');

  const isAbsent = !!existing?.is_absent;

  useEffect(() => {
    if (existing) {
      setAtt(
        isOMRStyle
          ? (existing.num_attempted?.toString() ?? '')
          : (existing.marks_obtained?.toString() ?? '')
      );
      setInc(existing.num_incorrect?.toString() ?? '');
    }
  }, [existing, isOMRStyle]);

  const handleBlur = () => {
    if (disabled || isAbsent) return;

    if (isOMRStyle) {
      const a = parseInt(att) || 0;
      const i = parseInt(inc) || 0;
      const u = Math.max(0, tq - a);
      if (a > tq) {
        toast.error(`Attempted (${a}) > Total (${tq})`);
        return;
      }
      if (i > a) {
        toast.error(`Incorrect (${i}) > Attempted (${a})`);
        return;
      }
      const calculatedMarks = calculateMarks(a, i, tq, subject.max_marks, testCategory);
      onChange({
        marks_obtained: calculatedMarks,
        num_attempted: a,
        num_unanswered: u,
        num_incorrect: i,
      });
    } else {
      const marks = parseFloat(att) || 0;
      if (marks > subject.max_marks) {
        toast.error(`Max is ${subject.max_marks}`);
        return;
      }
      onChange({
        marks_obtained: marks,
        num_attempted: null,
        num_unanswered: null,
        num_incorrect: null,
      });
    }
  };

  if (isOMRStyle) {
    return (
      <div className={`relative p-4 transition-all duration-300 ${isAbsent ? 'bg-red-500/5' : ''}`}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <span className={`text-[8px] font-black uppercase tracking-widest mb-1 block leading-none ${isAbsent ? 'text-slate-300' : 'text-slate-400'}`}>
                Att
              </span>
              <input
                type="number"
                value={att}
                onChange={(e) => setAtt(e.target.value)}
                onBlur={handleBlur}
                disabled={disabled || isAbsent}
                className="w-full bg-slate-500/5 border-transparent rounded-lg px-2 py-1.5 text-xs font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-slate-200 dark:focus:ring-slate-800 transition-all outline-none text-center"
                placeholder="0"
              />
            </div>
            <div className="flex-1">
              <span className={`text-[8px] font-black uppercase tracking-widest mb-1 block leading-none ${isAbsent ? 'text-slate-300' : 'text-red-500'}`}>
                Inc
              </span>
              <input
                type="number"
                value={inc}
                onChange={(e) => setInc(e.target.value)}
                onBlur={handleBlur}
                disabled={disabled || isAbsent}
                className="w-full bg-slate-500/5 border-transparent rounded-lg px-2 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-slate-200 dark:focus:ring-slate-800 transition-all outline-none text-center"
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => onAbsentToggle(!isAbsent)}
              disabled={disabled}
              className={`flex-1 px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-[0.1em] transition-all ${
                isAbsent
                  ? 'bg-red-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-red-500/10 hover:text-red-500'
              }`}
            >
              {isAbsent ? 'Absent' : 'Mark ABS'}
            </button>
            <div className={`px-3 py-1.5 rounded-md font-black text-xs min-w-[45px] text-center ${
              isAbsent
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                : (existing?.marks_obtained ?? 0) > 0
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
            }`}>
              {isAbsent ? '0.0' : (existing?.marks_obtained ?? '0.0')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative p-4 transition-all duration-300 ${isAbsent ? 'bg-red-500/5' : ''}`}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative flex items-center">
            <input
              type="number"
              step="0.5"
              value={att}
              onChange={(e) => setAtt(e.target.value)}
              onBlur={handleBlur}
              disabled={disabled || isAbsent}
              className="w-full bg-slate-500/5 border-transparent rounded-lg pl-3 pr-12 py-1.5 text-xs font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-slate-200 dark:focus:ring-slate-800 transition-all outline-none text-center"
              placeholder="0.0"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 select-none">
              /{subject.max_marks}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => onAbsentToggle(!isAbsent)}
            disabled={disabled}
            className={`flex-1 px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-[0.1em] transition-all ${
              isAbsent
                ? 'bg-red-500 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-red-500/10 hover:text-red-500'
            }`}
          >
            {isAbsent ? 'Absent' : 'Mark ABS'}
          </button>
          <div className={`px-3 py-1.5 rounded-md font-black text-xs min-w-[45px] text-center ${
            isAbsent
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
              : (existing?.marks_obtained ?? 0) > 0
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
          }`}>
            {isAbsent ? '0.0' : (existing?.marks_obtained ?? '0.0')}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────
export function MarksEntryPage() {
  const { id: testId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const { data: testData, isLoading: lsTest } = useTest(testId);
  const { data: marks, isLoading: lsMarks } = useMarks(testId);
  const { data: students, isLoading: lsStudents } = useStudents({
    batchId: testData?.batch_id,
  });
  const { data: batch } = useBatch(testData?.batch_id);
  const debounced = useDebouncedMarkSave(500);
  const publishMut = usePublishTest();
  const lockMut = useLockTest();
  const approveMarksMut = useApproveMarks();
  const publishMarksMut = usePublishMarksToParents();
  const bulk = useBulkMarksUpload();
  const [rtConnected, setRtConnected] = useState(false);

  useEffect(() => {
    if (!testId) return;
    const channel = supabase
      .channel(`marks:test_id=eq.${testId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'marks', filter: `test_id=eq.${testId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['marks', testId] });
        }
      )
      .subscribe((status) => {
        setRtConnected(status === 'SUBSCRIBED');
      });
    return () => { supabase.removeChannel(channel); };
  }, [testId, queryClient]);

  const test = testData;
  const subjects = testData?.subjects ?? [];
  const isLocked = !!test?.is_locked;
  // marks_status drives the workflow: draft → submitted → approved → published
  const marksStatus = (test as any)?.marks_status ?? 'draft';
  // isPublished = faculty has submitted to admin (marks_status != 'draft')
  const isSubmittedToAdmin = marksStatus !== 'draft';
  // For backward compat with old isPublished checks
  const isPublished = !!test?.is_published;

  const canEditSubjectMarks = useCallback((subject: TestSubject) => {
    if (!user || !role || !test) return false;
    if (role === 'admin') return true;
    if (role === 'faculty') {
      if (test.exam_category === 'Board Exam') {
        return subject.assigned_faculty_id === user.id;
      }
      return test.assigned_faculty_id === user.id;
    }
    return false;
  }, [user, role, test]);

  const canEditMarks = useMemo(() => {
    if (!user || !role || !test) return false;
    if (role === 'admin') return true;
    if (role === 'faculty') {
      if (test.exam_category === 'Board Exam') {
        return subjects.some((sub) => sub.assigned_faculty_id === user.id);
      }
      return test.assigned_faculty_id === user.id;
    }
    return false;
  }, [user, role, test, subjects]);

  const marksMap = useMemo(() => {
    const m = new Map<string, Mark>();
    (marks ?? []).forEach((row) => m.set(`${row.student_id}:${row.subject_id}`, row));
    return m;
  }, [marks]);

  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [parsedMarks, setParsedMarks] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [savingIndicator, setSavingIndicator] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    if (debounced.status === 'pending') {
      setSavingIndicator('saving');
    } else if (debounced.status === 'success') {
      setSavingIndicator('saved');
      const t = setTimeout(() => setSavingIndicator('idle'), 1500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [debounced.status]);

  // For Board Exams, count only subjects this faculty can edit
  const editableSubjects = subjects.filter((s) => canEditSubjectMarks(s));
  const editableSubjectIds = new Set(editableSubjects.map((s) => s.id));
  const effectiveSubjects = editableSubjects.length > 0 ? editableSubjects : subjects;
  const effectiveSubjectIds = editableSubjects.length > 0 ? editableSubjectIds : new Set(subjects.map((s) => s.id));

  const totalCells = (students?.length ?? 0) * effectiveSubjects.length;
  const filledCells = (marks ?? []).filter(
    (m) => effectiveSubjectIds.has(m.subject_id) && (m.marks_obtained != null || m.is_absent)
  ).length;
  const completionPct = totalCells === 0 ? 0 : Math.round((filledCells / totalCells) * 100);

  const handleMarkChange = (
    studentId: string,
    subjectId: string,
    data: {
      marks_obtained?: number;
      num_attempted?: number | null;
      num_unanswered?: number | null;
      num_incorrect?: number | null;
      is_absent?: boolean;
    }
  ) => {
    const sub = subjects.find((s) => s.id === subjectId);
    if (!sub || isLocked || !canEditSubjectMarks(sub) || !user || !testId) return;
    debounced.save({
      test_id: testId!,
      student_id: studentId,
      subject_id: subjectId,
      marks_obtained: data.marks_obtained ?? 0,
      num_attempted: data.num_attempted ?? null,
      num_unanswered: data.num_unanswered ?? null,
      num_incorrect: data.num_incorrect ?? null,
      is_absent: data.is_absent ?? false,
      entered_by: user.id,
    });
  };

  const handleAbsentToggle = (studentId: string, subjectId: string, absent: boolean) => {
    handleMarkChange(studentId, subjectId, { is_absent: absent, marks_obtained: 0 });
  };

  const handlePublish = async () => {
    if (!testId || !canEditMarks || !user) return;
    try {
      const { data, error } = await supabase
        .rpc('submit_marks_for_test', {
          p_test_id: testId,
          p_faculty_id: user.id,
        });

      if (error) {
        console.error('Error submitting marks:', error);
        toast.error(error.message || 'Failed to submit marks');
        return;
      }

      const res = Array.isArray(data) ? data[0] : data as any;
      if (!res?.success) {
        toast.error(res?.message || 'Failed to submit marks');
        return;
      }

      toast.success('✓ Marks forwarded to admin for approval');
      setConfirmPublish(false);
      queryClient.invalidateQueries({ queryKey: ['test', testId] });
    } catch (err: any) {
      toast.error(err.message ?? 'Submit failed');
    }
  };

  const handleLock = async () => {
    if (!testId || !canEditMarks) return;
    try {
      await lockMut.mutateAsync(testId);
      toast.success('Test locked & rankings computed');
      navigate(`/${role}/tests/${testId}/rankings`);
    } catch (err: any) {
      toast.error(err.message ?? 'Lock failed');
    } finally {
      setConfirmLock(false);
    }
  };

  const handleApproveMarks = async () => {
    if (!testId || !user || role !== 'admin') return;
    try {
      await approveMarksMut.mutateAsync({ testId, adminId: user.id });
      toast.success('Marks approved successfully');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to approve marks');
    }
  };

  const handlePublishMarksToParents = async () => {
    if (!testId || !user || role !== 'admin') return;
    try {
      await publishMarksMut.mutateAsync({ testId, adminId: user.id });
      toast.success('Marks published to parents & rankings computed!');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to publish marks');
    }
  };

  const handleFile = async (file: File) => {
    try {
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      const rows = isExcel ? await parseOMRExcel(file) : await parseMarksCsv(file);
      const rollMap = new Map(students?.map((s) => [s.roll_number.toUpperCase(), s.id]) ?? []);
      const subjectMap = new Map(subjects.map((s) => [s.subject_name.toLowerCase().trim(), s]));
      
      const parsed = rows.map((r: any) => {
        const errs: string[] = [];
        const roll = (r.roll_number ?? '').toUpperCase();
        const subjName = (r.subject ?? r.subject_name ?? '').toLowerCase().trim();
        const studentId = rollMap.get(roll);
        const sub = subjectMap.get(subjName);

        if (!studentId) errs.push('Unknown Roll No.');
        if (!sub) {
          errs.push('Unknown subject');
        } else if (!canEditSubjectMarks(sub)) {
          errs.push('Not authorized');
        }

        const absent = String(r.is_absent ?? '').toLowerCase() === 'true' || r.is_absent === true;
        let marks = 0;
        let att = 0, inc = 0, una = 0;

        if (!absent) {
          if (sub && sub.num_questions > 0 && !isExcel) {
            att = parseInt(String(r.num_attempted ?? r.attempted ?? 0));
            inc = parseInt(String(r.num_incorrect ?? r.incorrect ?? 0));
            una = sub.num_questions - att;
            marks = calculateMarks(att, inc, sub.num_questions, sub.max_marks, test!.exam_category);
          } else {
            marks = Number(r.marks ?? r.marks_obtained ?? 0);
            att = parseInt(String(r.num_attempted ?? r.attempted ?? 0));
            inc = parseInt(String(r.num_incorrect ?? r.incorrect ?? 0));
            una = parseInt(String(r.num_unanswered ?? r.unanswered ?? 0));
            if (sub && marks > sub.max_marks) errs.push(`>max(${sub.max_marks})`);
          }
        }

        return {
          roll_number: roll,
          subject_name: subjName,
          student_id: studentId,
          subject_id: sub?.id,
          marks_obtained: marks,
          num_attempted: att,
          num_incorrect: inc,
          num_unanswered: una,
          is_absent: absent,
          __error: errs.length ? errs.join('; ') : undefined,
        };
      });
      setParsedMarks(parsed);
    } catch (err: any) {
      toast.error(err.message ?? 'Parse failed');
    }
  };

  const handleBulkUpload = async () => {
    if (!testId || !user) return;
    const valid = parsedMarks.filter((p) => !p.__error);
    if (valid.length === 0) { toast.error('No valid rows'); return; }
    
    const authorizedValid = valid.filter((p) => {
      const sub = subjects.find((s) => s.id === p.subject_id);
      return sub ? canEditSubjectMarks(sub) : false;
    });

    if (authorizedValid.length === 0) {
      toast.error('No authorized rows to upload');
      return;
    }
    
    setUploading(true);
    try {
      await bulk.mutateAsync({
        test_id: testId,
        marks: authorizedValid.map((p) => ({
          test_id: testId,
          student_id: p.student_id,
          subject_id: p.subject_id,
          marks_obtained: p.marks_obtained,
          num_attempted: p.num_attempted || null,
          num_incorrect: p.num_incorrect || null,
          num_unanswered: p.num_unanswered || null,
          is_absent: p.is_absent,
          entered_by: user.id,
        })),
      });
      toast.success(`${authorizedValid.length} marks uploaded`);
      setImportOpen(false);
      setParsedMarks([]);
    } catch (err: any) {
      toast.error(err.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (lsTest || lsMarks || lsStudents) return <CardSkeleton />;
  if (!test) return <p className="text-sm text-slate-500">Test not found</p>;

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 animate-fade-in">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link 
            to={role === 'admin' ? '/admin/tests' : '/faculty/tests'} 
            className="group inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
          >
            <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 group-hover:scale-110 transition-transform">
              <ArrowLeft className="h-3 w-3" />
            </div>
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            {marksStatus === 'submitted' && role === 'faculty' && (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-md text-[10px] font-medium uppercase tracking-wider border border-amber-500/20">
                <Clock className="h-3 w-3" /> Awaiting Admin Review
              </div>
            )}
            {marksStatus === 'approved' && role === 'faculty' && (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-md text-[10px] font-medium uppercase tracking-wider border border-green-500/20">
                <CheckCircle2 className="h-3 w-3" /> Approved by Admin
              </div>
            )}
            {test.chapter_name && (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-md text-[10px] font-medium uppercase tracking-wider border border-indigo-500/20">
                <BookOpen className="h-3 w-3" /> {test.chapter_name}
              </div>
            )}
            {rtConnected && !isLocked && (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md text-[10px] font-medium uppercase tracking-wider border border-emerald-500/20">
                <div className="w-1.5 h-1.5 rounded-md bg-emerald-500 animate-pulse" />
                Live Sync
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-light tracking-tight text-slate-900 dark:text-white">
                {test.title}
              </h1>
              <span className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${
                isLocked 
                  ? 'bg-slate-900 text-white border-transparent'
                  : marksStatus === 'published'
                    ? 'bg-emerald-500 text-white border-transparent'
                    : marksStatus === 'approved'
                      ? 'bg-green-500 text-white border-transparent'
                      : marksStatus === 'submitted'
                        ? 'bg-amber-500 text-white border-transparent'
                        : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800'
              }`}>
                {isLocked ? 'Finalized' : marksStatus === 'published' ? 'Published' : marksStatus === 'approved' ? 'Approved' : marksStatus === 'submitted' ? 'Submitted' : 'Draft'}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <span className="font-medium text-slate-600 dark:text-slate-300">{batch?.name ?? '—'}</span>
              <span className="w-1 h-1 rounded-md bg-slate-300" />
              <span className="uppercase tracking-widest text-[10px] font-medium">
                {test.exam_category} {test.exam_sub_type ? `· ${test.exam_sub_type}` : ''}
              </span>
              {test.assigned_faculty_id && (
                <>
                  <span className="w-1 h-1 rounded-md bg-slate-300" />
                  <span className="text-[10px] font-medium text-slate-400">ASSIGNED TO FACULTY</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setImportOpen(true)} disabled={isLocked || !canEditMarks} className="btn btn-secondary">
              <Upload className="h-4 w-4" /> Import CSV/Excel
            </button>

            {/* ── Faculty buttons ── */}
            {role === 'faculty' && !isLocked && marksStatus === 'draft' && (
              <button
                onClick={() => setConfirmPublish(true)}
                disabled={!canEditMarks || filledCells < totalCells}
                className="btn btn-primary"
              >
                <Send className="h-4 w-4" /> Forward to Admin
              </button>
            )}

            {/* ── Admin buttons ── */}
            {role === 'admin' && !isLocked && marksStatus === 'submitted' && (
              <button
                onClick={handleApproveMarks}
                disabled={approveMarksMut.isPending}
                className="btn btn-secondary flex items-center gap-2"
              >
                <ShieldCheck className="h-4 w-4 text-green-500" />
                {approveMarksMut.isPending ? 'Approving...' : 'Approve Marks'}
              </button>
            )}
            {role === 'admin' && !isLocked && (marksStatus === 'approved' || (marksStatus === 'published' && !test?.is_published)) && (
              <button
                onClick={handlePublishMarksToParents}
                disabled={publishMarksMut.isPending}
                className="btn btn-primary flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                {publishMarksMut.isPending ? 'Publishing...' : 'Publish to Parents'}
              </button>
            )}
            {role === 'admin' && (marksStatus === 'published' || isLocked) && (
              <Link to={`/admin/tests/${test.id}/rankings`} className="btn btn-primary">
                <Trophy className="h-4 w-4" /> View Rankings
              </Link>
            )}

            {/* ── Analytics (faculty after lock) ── */}
            {isLocked && role === 'faculty' && (
              <Link to={`/faculty/tests/${test.id}/rankings`} className="btn btn-primary">
                <Trophy className="h-4 w-4" /> Analytics
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="card p-8 border-none shadow-none">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg className="w-full h-full -rotate-90">
              <circle cx="48" cy="48" r="44" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-slate-800" />
              <circle cx="48" cy="48" r="44" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={2 * Math.PI * 44} strokeDashoffset={2 * Math.PI * 44 * (1 - completionPct / 100)} strokeLinecap="round" className="text-slate-900 dark:text-white transition-all duration-1000 ease-out" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-medium text-slate-900 dark:text-white">{completionPct}%</span>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Entries</span>
              <p className="text-2xl font-light text-slate-900 dark:text-white">{totalCells}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Completed</span>
              <p className="text-2xl font-light text-slate-900 dark:text-white">{filledCells}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Remaining</span>
              <p className="text-2xl font-light text-slate-900 dark:text-white">{totalCells - filledCells}</p>
            </div>
            <div className="flex flex-col justify-end items-end gap-2 text-right">
              {savingIndicator === 'saving' && (
                <span className="flex items-center gap-2 text-slate-900 dark:text-white font-medium animate-pulse">
                  <div className="w-1.5 h-1.5 rounded-md bg-slate-900 dark:bg-white" />
                  Saving Changes
                </span>
              )}
              {savingIndicator === 'saved' && (
                <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="h-4 w-4" /> Synced
                </span>
              )}
              {savingIndicator === 'idle' && <span className="text-xs text-slate-400 font-medium">All changes saved</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden border-none shadow-none">
        {!students || students.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-md flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-10 w-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-white">No students found</h3>
            <p className="text-slate-500 mt-1">Please add students to this batch first.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[80vh] custom-scrollbar">
            <table className="w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-20">
                <tr>
                  <th className="sticky left-0 z-30 bg-white dark:bg-slate-950/80 backdrop-blur-2xl px-8 py-6 border-b border-r border-slate-100 dark:border-slate-800 text-left min-w-[120px]">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Roll No.</span>
                  </th>
                  <th className="sticky left-[120px] z-30 bg-white dark:bg-slate-950/80 backdrop-blur-2xl px-8 py-6 border-b border-r border-slate-100 dark:border-slate-800 text-left min-w-[200px]">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Student Name</span>
                  </th>
                  <th className="sticky left-[320px] z-30 bg-white dark:bg-slate-950/80 backdrop-blur-2xl px-8 py-6 border-b border-r border-slate-100 dark:border-slate-800 text-left min-w-[100px]">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Wing</span>
                  </th>
                  {subjects.map((s) => (
                    <th key={s.id} className="bg-white dark:bg-slate-950/80 backdrop-blur-2xl px-8 py-6 border-b border-slate-100 dark:border-slate-800 text-center min-w-[200px]">
                      <div className="space-y-1">
                        <span className="text-sm font-medium text-slate-900 dark:text-white block">{s.subject_name}</span>
                        {(s as any).chapter_name && (
                          <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 block truncate max-w-[180px] mx-auto" title={(s as any).chapter_name}>
                            {(s as any).chapter_name}
                          </span>
                        )}
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">{s.max_marks} Marks</span>
                          {s.num_questions > 0 && (
                            <>
                              <span className="w-1 h-1 rounded-md bg-slate-200" />
                              <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">{s.num_questions} Qs</span>
                            </>
                          )}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-900/50">
                {students.map((stu) => (
                  <tr key={stu.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                    <td className="sticky left-0 z-10 bg-white dark:bg-slate-950 px-8 py-4 border-r border-slate-50 dark:border-slate-900 font-mono text-[11px] font-medium text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                      {stu.roll_number}
                    </td>
                    <td className="sticky left-[120px] z-10 bg-white dark:bg-slate-950 px-8 py-4 border-r border-slate-50 dark:border-slate-900">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors truncate block max-w-[160px]">
                        {stu.full_name}
                      </span>
                    </td>
                    <td className="sticky left-[320px] z-10 bg-white dark:bg-slate-950 px-8 py-4 border-r border-slate-50 dark:border-slate-900">
                      {stu.exam_wing ? (
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${
                          stu.exam_wing === 'NEET' 
                            ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' 
                            : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                        }`}>
                          {stu.exam_wing}
                        </span>
                      ) : (
                        <span className="text-[8px] text-slate-300 font-black uppercase tracking-tighter">None</span>
                      )}
                    </td>
                    {subjects.map((sub) => {
                      const cellKey = `${stu.id}:${sub.id}`;
                      const existing = marksMap.get(cellKey);
                      return (
                        <td key={sub.id} className="p-0 transition-colors focus-within:bg-slate-100/50 dark:focus-within:bg-slate-800/50">
                          <MarkCell studentId={stu.id} subject={sub} testCategory={test!.exam_category as any} existing={existing} disabled={isLocked || !canEditSubjectMarks(sub)} onChange={(data) => handleMarkChange(stu.id, sub.id, data)} onAbsentToggle={(absent) => handleAbsentToggle(stu.id, sub.id, absent)} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog open={confirmPublish} onClose={() => setConfirmPublish(false)} onConfirm={handlePublish} title="Forward marks to admin?" message="Your marks will be submitted for admin review and approval. You cannot edit them until admin reviews and sends changes. Admin can add remarks if corrections are needed." confirmLabel="Forward Now" loading={false} />
      <ConfirmDialog open={confirmLock} onClose={() => setConfirmLock(false)} onConfirm={handleLock} title="Lock marks and generate rankings?" message="Locking is permanent. It makes all marks read-only and triggers the ranking algorithms for the entire batch. This action cannot be undone." confirmLabel="Lock & Rank" variant="destructive" loading={lockMut.isPending} />
      <Modal open={importOpen} onClose={() => { setImportOpen(false); setParsedMarks([]); }} title="Bulk Upload Marks" size="xl">
        <div className="space-y-6 p-2">
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-6 rounded-md border border-slate-100 dark:border-slate-800">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-900 dark:text-white">Upload CSV or Excel File</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                Supports standard CSV template or scanned OMR NEET/JEE Excel sheets.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => downloadMarksTemplate(subjects.map((s) => s.subject_name))} className="btn btn-secondary py-2"><Download className="h-4 w-4" /> Template</button>
              <label className="btn btn-primary py-2 cursor-pointer"><Upload className="h-4 w-4" /> Select File<input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} className="hidden" /></label>
            </div>
          </div>
          {parsedMarks.length > 0 && (
            <div className="card overflow-hidden border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Import Preview</span>
                <div className="flex gap-2">
                  <div className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium uppercase tracking-wider border border-emerald-500/20">{parsedMarks.filter((r) => !r.__error).length} Valid</div>
                  {parsedMarks.some(r => r.__error) && <div className="px-2.5 py-1 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-medium uppercase tracking-wider border border-red-500/20">{parsedMarks.filter(r => r.__error).length} Errors</div>}
                </div>
              </div>
              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">Roll No.</th>
                      <th className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">Subject</th>
                      <th className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Marks</th>
                      <th className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {parsedMarks.map((r, i) => (
                      <tr key={i} className={`group transition-colors ${r.__error ? 'bg-red-500/5' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}>
                        <td className="px-6 py-3 font-mono font-medium text-xs text-slate-400">{r.roll_number}</td>
                        <td className="px-6 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">{r.subject_name}</td>
                        <td className="px-6 py-3 text-center"><span className="inline-block px-3 py-1 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black">{r.marks_obtained}</span></td>
                        <td className="px-6 py-3">{r.__error ? <span className="text-[10px] font-medium text-red-500 uppercase tracking-wider">{r.__error}</span> : <span className="text-[10px] font-medium text-emerald-500 uppercase tracking-wider">Ready</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setImportOpen(false); setParsedMarks([]); }} className="btn btn-secondary px-8">Cancel</button>
            <button onClick={handleBulkUpload} disabled={uploading || parsedMarks.filter((r) => !r.__error).length === 0} className="btn btn-primary px-8">{uploading ? 'Processing...' : `Confirm Upload`}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

