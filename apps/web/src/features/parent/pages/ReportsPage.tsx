import { ClipboardList, TrendingUp, Calendar } from 'lucide-react';

export function ReportsPage() {
  return (
    <div className="space-y-10 pb-20">
      <div className="space-y-2">
        <h1 className="text-4xl font-light tracking-tight text-slate-900 dark:text-white">Academic Reports</h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-xl">Comprehensive performance analysis and term-wise progress reports.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="card p-8 space-y-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded-md flex items-center justify-center">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-medium text-slate-900 dark:text-slate-100">Term End Report</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Full breakdown of semester performance and attendance.</p>
          </div>
          <button className="btn btn-secondary w-full text-xs uppercase tracking-widest font-black">View Report</button>
        </div>

        <div className="card p-8 space-y-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-md flex items-center justify-center">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-medium text-slate-900 dark:text-slate-100">Progress Analysis</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Monthly trend analysis of subject-wise performance.</p>
          </div>
          <button className="btn btn-secondary w-full text-xs uppercase tracking-widest font-black">Open Analysis</button>
        </div>

        <div className="card p-8 space-y-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 rounded-md flex items-center justify-center">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-medium text-slate-900 dark:text-slate-100">Weekly Summary</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Snapshot of the last 7 days of academic activity.</p>
          </div>
          <button className="btn btn-secondary w-full text-xs uppercase tracking-widest font-black">Get Summary</button>
        </div>
      </div>

      <div className="card border-none bg-slate-50 dark:bg-slate-900/50 p-20 text-center">
         <div className="max-w-md mx-auto space-y-4">
            <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-md shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center mx-auto">
               <ClipboardList className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            </div>
            <h2 className="text-xl font-medium text-slate-900 dark:text-slate-100">No New Reports</h2>
            <p className="text-slate-500 dark:text-slate-400">Official term reports will be published here once finalized by the administration.</p>
         </div>
      </div>
    </div>
  );
}
