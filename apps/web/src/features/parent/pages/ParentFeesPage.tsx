import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useVerifiedChildren } from '@/hooks/useChildResults';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, DollarSign, AlertCircle, CheckCircle2, Clock, ChevronDown,
  Calendar, TrendingUp
} from 'lucide-react';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { Fee } from '@shared';

interface StudentFeeData {
  student_id: string;
  student_name: string;
  roll_number: string;
  batch_name: string;
  fees: Array<Fee & { id: string }>;
}

export function ParentFeesPage() {
  const { user } = useAuth();
  const { data: children, isLoading: childrenLoading } = useVerifiedChildren(user?.id);
  const [selectedChildId, setSelectedChildId] = useState<string>('');

  useEffect(() => {
    if (children && children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].student_id);
    }
  }, [children, selectedChildId]);

  const { data: studentFees, isLoading: feesLoading } = useQuery({
    queryKey: ['parent-student-fees', selectedChildId],
    queryFn: async () => {
      if (!selectedChildId) return null;

      const { data: fees, error } = await supabase
        .from('fees')
        .select(
          `
          id,
          amount_due,
          due_date,
          status,
          is_published,
          published_at,
          completion_date,
          remarks,
          student:students(
            id,
            full_name,
            roll_number,
            batch:batches(id, name)
          )
        `
        )
        .eq('student_id', selectedChildId);

      if (error) throw error;

      if (!fees || fees.length === 0) return null;

      const firstFee = fees[0];
      return {
        student_id: selectedChildId,
        student_name: (firstFee.student as any)?.full_name || '',
        roll_number: (firstFee.student as any)?.roll_number || '',
        batch_name: (firstFee.student as any)?.batch?.name || '',
        fees: fees as any[],
      };
    },
    enabled: !!selectedChildId,
  });

  const selectedChild = children?.find(c => c.student_id === selectedChildId);
  const totalDue = studentFees?.fees.reduce((sum, f) => sum + (f.amount_due || 0), 0) ?? 0;
  const paidCount = studentFees?.fees.filter(f => f.status === 'paid').length ?? 0;
  const publishedCount = studentFees?.fees.filter(f => f.is_published).length ?? 0;
  const completedCount = studentFees?.fees.filter(f => f.completion_date).length ?? 0;

  const getStatusColor = (fee: Fee) => {
    if (fee.completion_date) {
      return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Completed' };
    }
    if (fee.is_published && fee.status === 'pending') {
      return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Due' };
    }
    if (fee.status === 'paid') {
      return { bg: 'bg-green-100', text: 'text-green-700', label: 'Paid' };
    }
    return { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Not Published' };
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-12 animate-fade-in">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link
            to="/parent/dashboard"
            className="group inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
          >
            <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 group-hover:scale-110 transition-transform">
              <ArrowLeft className="h-3 w-3" />
            </div>
            Parent Portal
          </Link>
        </div>

        <div className="space-y-1">
          <h1 className="text-4xl font-light tracking-tight text-slate-900 dark:text-white">
            Fees & Payments
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            View and track fees for your ward(s)
          </p>
        </div>
      </div>

      {/* Child Selector */}
      {children && children.length > 0 && (
        <Card className="p-6">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 block">
            Select Ward
          </label>
          <div className="relative">
            <select
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className="input-premium w-full pl-4 pr-10 py-3"
            >
              {children.map(child => (
                <option key={child.student_id} value={child.student_id}>
                  {child.full_name} (Roll: {child.roll_number})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
        </Card>
      )}

      {/* Stats Cards */}
      {!feesLoading && studentFees && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Total Due
                </span>
                <DollarSign className="h-4 w-4 text-slate-400" />
              </div>
              <p className="text-2xl font-light text-slate-900 dark:text-white">
                ₹{totalDue.toLocaleString('en-IN')}
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Completed
                </span>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-light text-slate-900 dark:text-white">
                {completedCount}/{studentFees.fees.length}
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Published
                </span>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-2xl font-light text-slate-900 dark:text-white">
                {publishedCount}/{studentFees.fees.length}
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Pending
                </span>
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-2xl font-light text-slate-900 dark:text-white">
                {studentFees.fees.filter(f => f.status === 'pending' && f.is_published).length}
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Fees Table */}
      {selectedChildId && (
        <Card className="p-6 border-none shadow-sm">
          {feesLoading ? (
            <TableSkeleton rows={8} cols={6} />
          ) : !studentFees || studentFees.fees.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={AlertCircle}
                title="No fees found"
                description="Fees information will appear here once your institution publishes them"
              />
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                  {studentFees.student_name}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Roll No: {studentFees.roll_number} | {studentFees.batch_name}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Date Generated
                      </th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Amount
                      </th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Due Date
                      </th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Published
                      </th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-900/50">
                    {studentFees.fees.map((fee) => {
                      const statusInfo = getStatusColor(fee);
                      return (
                        <tr key={fee.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                          <td className="px-6 py-5">
                            <span className="text-sm text-slate-900 dark:text-white font-medium">
                              {formatDate(fee.created_at)}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                              ₹{(fee.amount_due || 0).toLocaleString('en-IN')}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {fee.due_date ? formatDate(fee.due_date) : '—'}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <Badge
                              className={`${statusInfo.bg} ${statusInfo.text} border-none font-bold uppercase text-[9px] px-3 py-1.5 rounded-full`}
                            >
                              {statusInfo.label}
                            </Badge>
                          </td>
                          <td className="px-6 py-5">
                            {fee.is_published ? (
                              <Badge variant="success" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[9px] px-2 py-0.5 w-fit">
                                ✓ Published
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200 text-[9px] px-2 py-0.5 w-fit">
                                Not Published
                              </Badge>
                            )}
                          </td>
                          <td className="px-6 py-5">
                            {fee.completion_date && (
                              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">
                                Completed on {formatDate(fee.completion_date)}
                              </span>
                            )}
                            {fee.remarks && (
                              <span className="text-[9px] text-slate-500 dark:text-slate-400 block">
                                {fee.remarks}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Help Section */}
      <Card className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50">
        <div className="flex gap-4">
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-1">About Fees</h4>
            <p className="text-sm text-blue-800 dark:text-blue-400">
              Fees are published by your institution's administration. Once published, you'll see the amount due and payment status here. 
              Contact your institution if you have any questions about fees.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
