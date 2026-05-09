import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

export interface BatchAnalytics {
  batchId: string;
  batchName: string;
  averageScore: number;
  testCount: number;
  recentTrends: { testTitle: string; averageScore: number }[];
}

export interface StudentPerformance {
  studentId: string;
  studentName: string;
  rollNumber: string;
  averageScore: number;
  testsTaken: number;
}

export function useFacultyAnalytics(facultyId: string | undefined) {
  return useQuery({
    queryKey: ['faculty-analytics', facultyId],
    queryFn: async () => {
      if (!facultyId) return null;

      // 1. Get batches assigned to faculty
      const { data: assignments, error: assignErr } = await supabase
        .from('faculty_batch_assignments')
        .select('batch_id, batches(name)')
        .eq('faculty_id', facultyId);
      if (assignErr) throw assignErr;

      const batchIds = (assignments ?? []).map((a: any) => a.batch_id);
      if (batchIds.length === 0) return { batches: [], topStudents: [] };

      // 2. Get all tests for these batches
      const { data: tests, error: testsErr } = await supabase
        .from('tests')
        .select('*')
        .in('batch_id', batchIds)
        .eq('is_published', true)
        .order('test_date', { ascending: true });
      if (testsErr) throw testsErr;

      const testIds = (tests ?? []).map((t) => t.id);
      if (testIds.length === 0) return { batches: [], topStudents: [] };

      // 3. Get all rankings (they have total_score and percentage)
      const { data: rankings, error: rankErr } = await supabase
        .from('rankings')
        .select('*, student:students(full_name, roll_number)')
        .in('test_id', testIds);
      if (rankErr) throw rankErr;

      const typedRankings = (rankings ?? []) as any[];

      // 4. Process Batch Analytics
      const batchAnalytics: BatchAnalytics[] = (assignments ?? []).map((a: any) => {
        const batchTests = (tests ?? []).filter((t) => t.batch_id === a.batch_id);
        const batchTestIds = batchTests.map((t) => t.id);
        const batchRankings = typedRankings.filter((r) => batchTestIds.includes(r.test_id));
        
        const totalPercentage = batchRankings.reduce((sum, r) => sum + (r.percentage || 0), 0);
        const averageScore = batchRankings.length > 0 ? totalPercentage / batchRankings.length : 0;

        const recentTrends = batchTests.slice(-5).map(t => {
          const tRanks = typedRankings.filter(r => r.test_id === t.id);
          const tAvg = tRanks.length > 0 ? tRanks.reduce((s, r) => s + (r.percentage || 0), 0) / tRanks.length : 0;
          return { testTitle: t.title, averageScore: tAvg };
        });

        return {
          batchId: a.batch_id,
          batchName: a.batches?.name || 'Unknown',
          averageScore,
          testCount: batchTests.length,
          recentTrends
        };
      });

      // 5. Process Top Students
      const studentMap = new Map<string, { name: string; roll: string; totalPct: number; count: number }>();
      typedRankings.forEach(r => {
        const existing = studentMap.get(r.student_id) || { name: r.student?.full_name || 'Unknown', roll: r.student?.roll_number || '', totalPct: 0, count: 0 };
        existing.totalPct += (r.percentage || 0);
        existing.count += 1;
        studentMap.set(r.student_id, existing);
      });

      const topStudents: StudentPerformance[] = Array.from(studentMap.entries())
        .map(([id, data]) => ({
          studentId: id,
          studentName: data.name,
          rollNumber: data.roll,
          averageScore: data.totalPct / data.count,
          testsTaken: data.count
        }))
        .sort((a, b) => b.averageScore - a.averageScore)
        .slice(0, 10);

      return { batches: batchAnalytics, topStudents };
    },
    enabled: !!facultyId,
  });
}
