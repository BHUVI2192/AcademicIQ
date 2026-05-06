import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { Plus, ClipboardList, Trash2, ArrowRight, Zap, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTests, useCreateTest } from '@/hooks/useTests';
import { useFacultyAssignedBatches, useBatches } from '@/hooks/useBatches';
import { Modal } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { isDateIso } from '@/lib/validators';
import { formatDate } from '@/lib/utils';
import { EXAM_CATEGORIES, EXAM_CATEGORY_LABELS, BOARD_SUB_TYPES, COMPETITIVE_SUB_TYPES } from '@shared';
import type { ExamCategory } from '@shared';

interface SubjectRow {
  subject_name: string;
  max_marks: number;
  weightage: number;
  num_questions: number;
}

// ─── Exam Templates ──────────────────────────────────────────────────────────
interface ExamTemplate {
  label: string;
  category: ExamCategory;
  subType: string;
  subjects: SubjectRow[];
  description: string;
}

const EXAM_TEMPLATES: ExamTemplate[] = [
  {
    label: 'KCET',
    category: 'KCET',
    subType: 'KCET',
    description: 'Physics 60, Chemistry 60, Maths 60, Biology 60',
    subjects: [
      { subject_name: 'Physics', max_marks: 60, weightage: 1, num_questions: 60 },
      { subject_name: 'Chemistry', max_marks: 60, weightage: 1, num_questions: 60 },
      { subject_name: 'Mathematics', max_marks: 60, weightage: 1, num_questions: 60 },
      { subject_name: 'Biology', max_marks: 60, weightage: 1, num_questions: 60 },
    ],
  },
  {
    label: 'JEE Main',
    category: 'JEE_Mains',
    subType: 'JEE Main',
    description: 'Physics 25Q, Chemistry 25Q, Maths 25Q (4 marks each, -1 negative)',
    subjects: [
      { subject_name: 'Physics', max_marks: 100, weightage: 1, num_questions: 25 },
      { subject_name: 'Chemistry', max_marks: 100, weightage: 1, num_questions: 25 },
      { subject_name: 'Mathematics', max_marks: 100, weightage: 1, num_questions: 25 },
    ],
  },
  {
    label: 'JEE Advanced',
    category: 'JEE_Advanced',
    subType: 'JEE Advanced',
    description: 'Physics, Chemistry, Maths — flexible marking',
    subjects: [
      { subject_name: 'Physics', max_marks: 60, weightage: 1, num_questions: 20 },
      { subject_name: 'Chemistry', max_marks: 60, weightage: 1, num_questions: 20 },
      { subject_name: 'Mathematics', max_marks: 60, weightage: 1, num_questions: 20 },
    ],
  },
  {
    label: 'NEET',
    category: 'NEET',
    subType: 'NEET',
    description: 'Physics 50Q, Chemistry 50Q, Biology 100Q (4 marks, -1 negative)',
    subjects: [
      { subject_name: 'Physics', max_marks: 180, weightage: 1, num_questions: 45 },
      { subject_name: 'Chemistry', max_marks: 180, weightage: 1, num_questions: 45 },
      { subject_name: 'Botany', max_marks: 180, weightage: 1, num_questions: 45 },
      { subject_name: 'Zoology', max_marks: 180, weightage: 1, num_questions: 45 },
    ],
  },
  {
    label: 'Board Exam',
    category: 'Board',
    subType: '',
    description: 'Fully flexible — add any subjects with custom marks',
    subjects: [
      { subject_name: '', max_marks: 100, weightage: 1, num_questions: 0 },
    ],
  },
];

const TEMPLATE_COLORS: Record<string, string> = {
  KCET: 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-slate-900/40 dark:border-slate-800 dark:text-slate-300',
  'JEE Main': 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-slate-900/40 dark:border-slate-800 dark:text-slate-300',
  'JEE Advanced': 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-slate-900/40 dark:border-slate-800 dark:text-slate-300',
  NEET: 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-slate-900/40 dark:border-slate-800 dark:text-slate-300',
  'Board Exam': 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-slate-900/40 dark:border-slate-800 dark:text-slate-300',
};

export function TestsPage() {
  const { user, collegeId } = useAuth();
  const { data: batches } = useFacultyAssignedBatches(user?.id);
  const { data: allBatches } = useBatches();

  const batchIds = useMemo(() => (batches ?? []).map((b) => b.id), [batches]);
  const { data: tests, isLoading } = useTests(undefined, batchIds.length > 0 ? batchIds : undefined);
  const create = useCreateTest();

  const batchNameMap = new Map((allBatches ?? []).map((b) => [b.id, b.name]));

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [batchId, setBatchId] = useState('');
  const [testDate, setTestDate] = useState('');
  const [examCategory, setExamCategory] = useState<ExamCategory>('Practice');
  const [examSubType, setExamSubType] = useState('');
  const [subjects, setSubjects] = useState<SubjectRow[]>([
    { subject_name: '', max_marks: 100, weightage: 1, num_questions: 0 },
  ]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | undefined>(undefined);

  const applyTemplate = (tpl: ExamTemplate) => {
    setExamCategory(tpl.category);
    setExamSubType(tpl.subType);
    setSubjects(tpl.subjects.map(s => ({ ...s })));
    setSelectedTemplate(tpl.label);
    if (!title) setTitle(tpl.label);
  };

  const reset = () => {
    setOpen(false);
    setTitle('');
    setDescription('');
    setBatchId('');
    setTestDate('');
    setExamCategory('Practice');
    setExamSubType('');
    setSubjects([{ subject_name: '', max_marks: 100, weightage: 1, num_questions: 0 }]);
    setSelectedTemplate(undefined);
  };

  const addSubject = () =>
    setSubjects((s) => [...s, { subject_name: '', max_marks: 100, weightage: 1, num_questions: 0 }]);
  const removeSubject = (i: number) =>
    setSubjects((s) => (s.length > 1 ? s.filter((_, idx) => idx !== i) : s));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collegeId || !user) return;
    if (!title.trim() || !batchId || !isDateIso(testDate)) {
      toast.error('Fill all required fields');
      return;
    }
    if (subjects.length === 0) { toast.error('Add at least one subject'); return; }
    for (const s of subjects) {
      if (!s.subject_name.trim()) { toast.error('All subjects need a name'); return; }
      if (s.max_marks <= 0 || s.weightage <= 0) { toast.error('Max marks and weightage must be positive'); return; }
    }
    try {
      await create.mutateAsync({
        college_id: collegeId,
        batch_id: batchId,
        created_by: user.id,
        title: title.trim(),
        description: description.trim() || undefined,
        test_date: testDate,
        exam_category: examCategory,
        exam_sub_type: examSubType.trim() || undefined,
        subjects: subjects.map((s, i) => ({
          subject_name: s.subject_name.trim(),
          max_marks: s.max_marks,
          weightage: s.weightage,
          num_questions: s.num_questions,
          display_order: i,
        })),
      });
      toast.success('Test created successfully!');
      reset();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create test');
    }
  };

  const getCategoryLabel = (cat: string, subType?: string) => {
    if (subType) return subType;
    return EXAM_CATEGORY_LABELS[cat as ExamCategory] || cat;
  };

  const getCategoryBadge = (cat: string) => {
    const badges: Record<string, string> = {
      JEE_Mains: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      JEE_Advanced: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
      NEET: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      Competitive: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
      Board: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      Practice: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    };
    return badges[cat] || badges.Practice;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-slate-900 dark:text-slate-100">Tests</h1>
          <p className="text-sm text-slate-500">Create tests with exam templates, enter marks, publish results</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Test
        </button>
      </div>

      <div className="card p-0">
        {isLoading ? (
          <div className="p-6"><TableSkeleton rows={5} cols={5} /></div>
        ) : !tests || tests.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No tests yet"
            description="Create a test with an exam template, add marks, then publish to parents"
            action={{ label: 'Create test', onClick: () => setOpen(true) }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Exam</th>
                  <th>Date</th>
                  <th>Batch</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tests.map((t) => (
                  <tr key={t.id}>
                    <td className="font-medium">{t.title}</td>
                    <td>
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${getCategoryBadge(t.exam_category)}`}
                      >
                        {getCategoryLabel(t.exam_category, t.exam_sub_type ?? undefined)}
                      </span>
                    </td>
                    <td>{formatDate(t.test_date)}</td>
                    <td>{batchNameMap.get(t.batch_id) ?? '—'}</td>
                    <td>
                      {t.is_locked ? (
                        <Badge variant="info">Locked</Badge>
                      ) : t.is_published ? (
                        <Badge variant="success">Published</Badge>
                      ) : (
                        <Badge>Draft</Badge>
                      )}
                    </td>
                    <td>
                      <Link
                        to={`/faculty/tests/${t.id}/marks`}
                        className="btn btn-ghost inline-flex items-center gap-1 text-xs"
                      >
                        Open <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Test Modal */}
      <Modal open={open} onClose={reset} title="Create New Test" size="lg">
        <form onSubmit={handleCreate} className="space-y-5">
          {/* ─── Template Picker ─── */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-slate-500" />
              <label className="label mb-0 text-sm font-medium">Choose a Template</label>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 lg:grid-cols-5">
              {EXAM_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className={`rounded-md border px-3 py-2 text-left text-xs font-medium transition-all ${
                    selectedTemplate === tpl.label
                      ? 'ring-2 ring-slate-900 ring-offset-1 dark:ring-slate-100'
                      : ''
                  } ${TEMPLATE_COLORS[tpl.label] ?? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                  title={tpl.description}
                >
                  <div className="font-medium">{tpl.label}</div>
                  <div className="mt-0.5 text-[10px] opacity-75 leading-tight">{tpl.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Test Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input"
                  placeholder="e.g. JEE Main Mock Test 1"
                  required
                />
              </div>
              <div>
                <label className="label">Exam Category</label>
                <select
                  value={examCategory}
                  onChange={(e) => {
                    setExamCategory(e.target.value as ExamCategory);
                    setExamSubType('');
                  }}
                  className="input"
                  required
                >
                  {EXAM_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{EXAM_CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Sub-type</label>
                <input
                  value={examSubType}
                  onChange={(e) => setExamSubType(e.target.value)}
                  className="input"
                  placeholder="e.g. KCET, JEE Main..."
                />
              </div>
              <div>
                <label className="label">Batch</label>
                <select
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Select…</option>
                  {batches?.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Test Date</label>
                <input
                  type="date"
                  value={testDate}
                  onChange={(e) => setTestDate(e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="label">Description (optional)</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input"
                  placeholder="Optional notes about this test"
                />
              </div>
            </div>
          </div>

          {/* ─── Subject Editor ─── */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="label mb-0 text-sm font-medium">Subjects & Marks</label>
              <button type="button" onClick={addSubject} className="btn btn-ghost text-xs gap-1">
                <Plus className="h-3 w-3" /> Add subject
              </button>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="grid grid-cols-12 gap-0 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-xs font-medium text-slate-500">
                <div className="col-span-5">Subject Name</div>
                <div className="col-span-2 text-center">Max Marks</div>
                <div className="col-span-2 text-center">Questions</div>
                <div className="col-span-2 text-center">Weight</div>
                <div className="col-span-1"></div>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {subjects.map((s, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center px-3 py-2">
                    <input
                      placeholder="e.g. Physics"
                      value={s.subject_name}
                      onChange={(e) => {
                        const next = [...subjects];
                        next[i] = { ...next[i], subject_name: e.target.value };
                        setSubjects(next);
                      }}
                      className="input col-span-5 py-1.5 text-sm"
                      required
                    />
                    <input
                      type="number"
                      min={1}
                      value={s.max_marks}
                      onChange={(e) => {
                        const next = [...subjects];
                        next[i] = { ...next[i], max_marks: Number(e.target.value) };
                        setSubjects(next);
                      }}
                      className="input col-span-2 py-1.5 text-sm text-center"
                      required
                    />
                    <input
                      type="number"
                      placeholder="0"
                      min={0}
                      value={s.num_questions}
                      onChange={(e) => {
                        const next = [...subjects];
                        next[i] = { ...next[i], num_questions: Number(e.target.value) };
                        setSubjects(next);
                      }}
                      className="input col-span-2 py-1.5 text-sm text-center"
                      title="Number of questions (enables per-question scoring)"
                    />
                    <input
                      type="number"
                      placeholder="1"
                      min={0.1}
                      step={0.1}
                      value={s.weightage}
                      onChange={(e) => {
                        const next = [...subjects];
                        next[i] = { ...next[i], weightage: Number(e.target.value) };
                        setSubjects(next);
                      }}
                      className="input col-span-2 py-1.5 text-sm text-center"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => removeSubject(i)}
                      disabled={subjects.length === 1}
                      className="col-span-1 flex items-center justify-center text-slate-400 hover:text-red-600 disabled:opacity-30 transition-colors"
                      aria-label="Remove subject"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {examCategory === 'JEE_Mains' && (
              <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                💡 JEE Main scoring: +4 per correct, −1 per incorrect. Enter question counts above.
              </p>
            )}
            {examCategory === 'NEET' && (
              <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                💡 NEET scoring: +4 per correct, −1 per incorrect. Enter question counts above.
              </p>
            )}
            {examCategory === 'KCET' || examSubType?.toUpperCase() === 'KCET' ? (
              <p className="mt-2 text-xs text-violet-600 dark:text-violet-400">
                💡 KCET scoring: 1 mark per correct, no negative marking.
              </p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={reset} className="btn btn-ghost">Cancel</button>
            <button type="submit" disabled={create.isPending} className="btn btn-primary">
              {create.isPending ? 'Creating...' : 'Create Test'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
