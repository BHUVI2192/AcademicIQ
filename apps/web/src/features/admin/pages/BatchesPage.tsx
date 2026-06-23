import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, GraduationCap, Folder, FolderOpen, ChevronRight, ChevronDown, LayoutGrid, List } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useDirectory } from '@/context/DirectoryContext';
import { useBatches, useCreateBatch } from '@/hooks/useBatches';
import { useColleges } from '@/hooks/useColleges';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { Modal } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { STREAMS, CLASS_LEVELS, type Stream, type ClassLevel } from '@shared';

export function BatchesPage() {
  const { role } = useAuth();
  const { selectedCollegeId, selectedAcademicYearId, isGlobalMode } = useDirectory();
  const effectiveCollegeId = selectedCollegeId;

  const { data: batches, isLoading } = useBatches(effectiveCollegeId, selectedAcademicYearId);
  const { data: colleges } = useColleges();
  
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [classLevel, setClassLevel] = useState<ClassLevel>(11);
  const [stream, setStream] = useState<Stream>('PCMB');
  const [academicYearId, setAcademicYearId] = useState('');
  const [targetCollegeId, setTargetCollegeId] = useState<string>('');

  const [viewMode, setViewMode] = useState<'folder' | 'table'>('folder');
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});

  const togglePath = (path: string) => {
    setExpandedPaths(prev => ({ ...prev, [path]: !prev[path] }));
  };

  useEffect(() => {
    if (batches && batches.length > 0) {
      const initialExpanded: Record<string, boolean> = {};
      batches.forEach(b => {
        if (b.academic_year?.label) {
          initialExpanded[b.academic_year.label] = true;
        }
      });
      setExpandedPaths(prev => ({ ...initialExpanded, ...prev }));
    }
  }, [batches]);

  const { data: years } = useAcademicYears(targetCollegeId || effectiveCollegeId);
  const create = useCreateBatch();

  useEffect(() => {
    if (open) {
      if (selectedCollegeId) setTargetCollegeId(selectedCollegeId);
      if (selectedAcademicYearId) setAcademicYearId(selectedAcademicYearId);
    }
  }, [open, selectedCollegeId, selectedAcademicYearId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCollegeId) {
      toast.error('Please select a college');
      return;
    }
    if (!name.trim() || !code.trim() || !academicYearId) {
      toast.error('Fill all fields including batch code');
      return;
    }
    
    try {
      await create.mutateAsync({
        college_id: targetCollegeId,
        academic_year_id: academicYearId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        class_level: classLevel,
        stream,
      });
      toast.success('Batch created');
      setOpen(false);
      setName('');
      setCode('');
      setClassLevel(11);
      setStream('PCMB');
      setAcademicYearId('');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed');
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-12 animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-academic-blue/10 border border-academic-blue/20">
            <GraduationCap className="h-3.5 w-3.5 text-academic-blue" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-academic-blue">
              Section Management
            </span>
          </div>
          <div className="space-y-1">
            <h1 className="text-5xl font-bold tracking-tight text-academic-navy leading-tight">Classes & Batches</h1>
            <p className="max-w-xl text-lg text-muted-foreground font-medium leading-relaxed">
              Manage and organize 11th and 12th grade academic cohorts and class sections.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
            <button
              onClick={() => setViewMode('folder')}
              className={`p-2 rounded-md transition-all ${viewMode === 'folder' ? 'bg-white dark:bg-slate-900 text-academic-blue shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              title="Folder Directory View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-900 text-academic-blue shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              title="Flat Table View"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <button onClick={() => setOpen(true)} className="btn-premium btn-primary px-8">
            <Plus className="h-4 w-4 mr-2" /> New Class
          </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden border-none shadow-2xl shadow-academic-navy/5 p-0">
        {isLoading ? (
          <div className="p-12">
            <TableSkeleton rows={6} cols={5} />
          </div>
        ) : !batches || batches.length === 0 ? (
          <div className="py-24">
            <EmptyState
              icon={GraduationCap}
              title="No classes defined"
              description="Create your first academic cohort to start organizing students and curriculum."
              action={{ label: 'Create Class', onClick: () => setOpen(true) }}
            />
          </div>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0">
              <thead className="bg-academic-navy/[0.03]">
                <tr>
                  <th className="px-8 py-6 text-left border-b border-academic-navy/5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-academic-navy/60">Section / Identification</span>
                  </th>
                  <th className="px-8 py-6 text-left border-b border-academic-navy/5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-academic-navy/60">Class Level</span>
                  </th>
                  <th className="px-8 py-6 text-left border-b border-academic-navy/5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-academic-navy/60">Academic Stream</span>
                  </th>
                  <th className="px-8 py-6 text-left border-b border-academic-navy/5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-academic-navy/60">Calendar Year</span>
                  </th>
                  <th className="px-8 py-6 text-center border-b border-academic-navy/5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-academic-navy/60">Status</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-academic-navy/5">
                {batches.map((b) => (
                  <tr key={b.id} className="group hover:bg-academic-navy/[0.01] transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-academic-blue/10 flex items-center justify-center text-academic-blue">
                          <Folder className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-bold text-academic-navy mb-0.5 group-hover:text-academic-blue transition-colors text-lg">{b.name}</div>
                          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{b.code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-sm font-bold text-academic-navy/70">
                        {b.class_level ? `Grade ${b.class_level}` : '—'}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <Badge className="bg-academic-blue/5 text-academic-blue border-academic-blue/10 font-bold uppercase text-[10px] px-3 py-1">
                        {b.stream ?? 'GENERAL'}
                      </Badge>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-sm font-semibold text-academic-navy/60">{b.academic_year?.label ?? '—'}</div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      {b.is_active ? (
                        <Badge variant="success" className="bg-emerald-100 text-emerald-700 border-emerald-200 font-bold uppercase text-[10px] px-4 py-1.5 rounded-full">Active</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-500 border-slate-200 font-bold uppercase text-[10px] px-4 py-1.5 rounded-full">Inactive</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 space-y-4 bg-white dark:bg-slate-950/40">
            <div className="text-sm font-semibold text-academic-navy/60 mb-6 border-b border-academic-navy/5 pb-4">
              Directory Navigation
            </div>
            
            <div className="space-y-3 pl-1">
              {Object.entries(
                (batches ?? []).reduce((acc, b) => {
                  const yearLabel = b.academic_year?.label || 'Unknown Academic Year';
                  const classLabel = b.class_level ? `Grade ${b.class_level}` : 'General';
                  const streamName = b.stream || 'GENERAL';

                  if (!acc[yearLabel]) acc[yearLabel] = {};
                  if (!acc[yearLabel][classLabel]) acc[yearLabel][classLabel] = {};
                  if (!acc[yearLabel][classLabel][streamName]) acc[yearLabel][classLabel][streamName] = [];
                  
                  acc[yearLabel][classLabel][streamName].push(b);
                  return acc;
                }, {} as Record<string, Record<string, Record<string, typeof batches>>>)
              ).map(([yearLabel, grades]) => {
                const yearPath = yearLabel;
                const isYearExpanded = expandedPaths[yearPath];
                
                return (
                  <div key={yearLabel} className="space-y-1.5">
                    {/* Year Folder row */}
                    <div 
                      onClick={() => togglePath(yearPath)}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-academic-navy/[0.02] cursor-pointer transition-colors border border-transparent hover:border-academic-navy/5"
                    >
                      <button className="text-academic-navy/40">
                        {isYearExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      {isYearExpanded ? (
                        <FolderOpen className="h-5 w-5 text-academic-blue" />
                      ) : (
                        <Folder className="h-5 w-5 text-academic-blue/80" />
                      )}
                      <span className="font-bold text-academic-navy text-base">{yearLabel}</span>
                      <span className="text-xs text-muted-foreground bg-academic-navy/5 px-2 py-0.5 rounded-full font-bold">
                        {Object.values(grades).reduce((acc, streams) => acc + Object.values(streams).reduce((a, b) => a + b.length, 0), 0)} Classes
                      </span>
                    </div>

                    {/* Year Expanded Content */}
                    {isYearExpanded && (
                      <div className="pl-6 ml-5 border-l border-academic-navy/10 space-y-1.5">
                        {Object.entries(grades).map(([classLabel, streams]) => {
                          const gradePath = `${yearPath}/${classLabel}`;
                          const isGradeExpanded = expandedPaths[gradePath];
                          
                          return (
                            <div key={classLabel} className="space-y-1.5">
                              {/* Grade Folder row */}
                              <div 
                                onClick={() => togglePath(gradePath)}
                                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-academic-navy/[0.02] cursor-pointer transition-colors border border-transparent hover:border-academic-navy/5"
                              >
                                <button className="text-academic-navy/40">
                                  {isGradeExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                </button>
                                {isGradeExpanded ? (
                                  <FolderOpen className="h-4.5 w-4.5 text-indigo-500" />
                                ) : (
                                  <Folder className="h-4.5 w-4.5 text-indigo-400" />
                                )}
                                <span className="font-semibold text-academic-navy/90 text-sm">{classLabel}</span>
                                <span className="text-[10px] text-muted-foreground bg-indigo-50 dark:bg-indigo-950/20 px-1.5 py-0.5 rounded font-semibold text-indigo-600 dark:text-indigo-400">
                                  {Object.values(streams).reduce((a, b) => a + b.length, 0)} Streams
                                </span>
                              </div>

                              {/* Grade Expanded Content */}
                              {isGradeExpanded && (
                                <div className="pl-6 ml-5 border-l border-academic-navy/10 space-y-1.5">
                                  {Object.entries(streams).map(([streamName, batchList]) => {
                                    const streamPath = `${gradePath}/${streamName}`;
                                    const isStreamExpanded = expandedPaths[streamPath];
                                    
                                    return (
                                      <div key={streamName} className="space-y-1.5">
                                        {/* Stream Folder row */}
                                        <div 
                                          onClick={() => togglePath(streamPath)}
                                          className="flex items-center gap-3 p-2 rounded-md hover:bg-academic-navy/[0.02] cursor-pointer transition-colors border border-transparent hover:border-academic-navy/5"
                                        >
                                          <button className="text-academic-navy/40">
                                            {isStreamExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                          </button>
                                          {isStreamExpanded ? (
                                            <FolderOpen className="h-4 w-4 text-emerald-500" />
                                          ) : (
                                            <Folder className="h-4 w-4 text-emerald-400" />
                                          )}
                                          <span className="font-medium text-academic-navy/80 text-xs tracking-wide uppercase">{streamName}</span>
                                          <span className="text-[9px] text-muted-foreground bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded font-bold text-emerald-600 dark:text-emerald-400">
                                            {batchList.length} Sections
                                          </span>
                                        </div>

                                        {/* Stream Expanded Content (Leaf Batches) */}
                                        {isStreamExpanded && (
                                          <div className="pl-6 ml-5 border-l border-academic-navy/10 space-y-1.5">
                                            {batchList.map((b) => (
                                              <div 
                                                key={b.id} 
                                                className="flex items-center justify-between p-3 rounded-lg bg-slate-50/50 dark:bg-slate-900/20 hover:bg-slate-50 dark:hover:bg-slate-900/40 border border-slate-100 dark:border-slate-800 transition-colors shadow-sm"
                                              >
                                                <div className="flex items-center gap-3">
                                                  <div className="h-8 w-8 rounded bg-academic-blue/10 flex items-center justify-center text-academic-blue">
                                                    <GraduationCap className="h-4.5 w-4.5" />
                                                  </div>
                                                  <div>
                                                    <div className="font-bold text-sm text-academic-navy">{b.name}</div>
                                                    <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{b.code}</div>
                                                  </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-3">
                                                  {b.is_active ? (
                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/30">Active</span>
                                                  ) : (
                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">Inactive</span>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Modal 
        open={open} 
        onClose={() => setOpen(false)} 
        title="Institutional Class Creation"
        size="md"
      >
        <form onSubmit={handleCreate} className="space-y-6 py-4">
          {isGlobalMode && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Affiliated Institution</label>
              <select
                value={targetCollegeId}
                onChange={(e) => {
                  setTargetCollegeId(e.target.value);
                  setAcademicYearId('');
                }}
                className="input-premium w-full"
                required
              >
                <option value="">Select Institution...</option>
                {colleges?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Section Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-premium w-full"
                placeholder="e.g. 11-PCMB-A"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Unique Section Code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="input-premium w-full font-mono font-bold"
                placeholder="11-PCMB-A-24"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Grade Level</label>
              <select
                value={classLevel}
                onChange={(e) => setClassLevel(Number(e.target.value) as ClassLevel)}
                className="input-premium w-full"
                required
              >
                {CLASS_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    Grade {level}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Academic Stream</label>
              <select
                value={stream}
                onChange={(e) => setStream(e.target.value as Stream)}
                className="input-premium w-full"
                required
              >
                {STREAMS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Academic Calendar Cycle</label>
            <select
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
              className="input-premium w-full"
              required
            >
              <option value="">Select Academic Year…</option>
              {years?.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label} {y.is_current ? '(Current)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-6">
            <button type="button" onClick={() => setOpen(false)} className="px-6 py-2.5 text-sm font-bold text-muted-foreground hover:text-academic-navy transition-colors">
              Discard
            </button>
            <button type="submit" disabled={create.isPending} className="btn-premium btn-primary px-10">
              {create.isPending ? 'Registering...' : 'Confirm Registration'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
