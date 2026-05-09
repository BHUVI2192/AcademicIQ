import { useColleges } from '@/hooks/useColleges';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { useDirectory } from '@/context/DirectoryContext';
import { Building2, ChevronDown, Calendar } from 'lucide-react';
import { useEffect } from 'react';

export function CollegeSelector() {
  const { 
    selectedCollegeId, 
    setSelectedCollegeId, 
    selectedAcademicYearId, 
    setSelectedAcademicYearId,
    isGlobalMode 
  } = useDirectory();
  const { data: colleges } = useColleges();
  const { data: years } = useAcademicYears(selectedCollegeId);

  // Auto-select current year if none selected
  useEffect(() => {
    if (years && years.length > 0 && !selectedAcademicYearId) {
      const current = years.find(y => y.is_current);
      if (current) setSelectedAcademicYearId(current.id);
    }
  }, [years, selectedAcademicYearId, setSelectedAcademicYearId]);

  if (!isGlobalMode) return null;

  return (
    <div className="mb-6 space-y-4 px-4">
      {/* College Selector */}
      <div>
        <label className="mb-1 block text-[10px] font-normal uppercase tracking-wider text-slate-400">
          Active Institution
        </label>
        <div className="group relative">
          <select
            value={selectedCollegeId || ''}
            onChange={(e) => {
              setSelectedCollegeId(e.target.value || null);
              setSelectedAcademicYearId(null); // Reset year when college changes
            }}
            className="w-full cursor-pointer appearance-none rounded-md border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm font-normal text-slate-700 shadow-sm transition-all hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="">Select College...</option>
            {colleges?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-slate-900">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Academic Year Selector (only if college selected) */}
      {selectedCollegeId && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
          <label className="mb-1 block text-[10px] font-normal uppercase tracking-wider text-slate-400">
            Academic Session
          </label>
          <div className="group relative">
            <select
              value={selectedAcademicYearId || ''}
              onChange={(e) => setSelectedAcademicYearId(e.target.value || null)}
              className="w-full cursor-pointer appearance-none rounded-md border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm font-normal text-slate-700 shadow-sm transition-all hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="">Select Year...</option>
              {years?.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label} {y.is_current ? '(Current)' : ''}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-slate-900">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              <ChevronDown className="h-4 w-4" />
            </div>
          </div>
        </div>
      )}

      {!selectedCollegeId && (
        <p className="mt-1 animate-pulse text-[10px] font-normal text-amber-500">
          Please select a college to manage data
        </p>
      )}
    </div>
  );
}
