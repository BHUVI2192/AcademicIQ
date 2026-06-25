// ============================================================================
// CSV Parser & Generator
// ============================================================================

import Papa from 'papaparse';

export interface ParsedStudentRow {
  roll_number: string;
  full_name: string;
  date_of_birth?: string;
  batch_code?: string;
  exam_wing?: 'NEET' | 'KCET' | null;
  parent_name?: string;
  parent_phone?: string;
  parent_email?: string;
  parent_relationship?: string;
  _row: number;
}

export interface ParsedMarksRow {
  roll_number: string;
  subject?: string;
  subject_name?: string;
  marks?: string | number;
  is_absent?: string;
  [key: string]: string | number | undefined;
}

export function parseStudentsCsv(file: File): Promise<ParsedStudentRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
      complete: (result) => {
        if (result.errors.length > 0) {
          reject(new Error(result.errors[0]?.message ?? 'CSV parse error'));
          return;
        }
        const rows: ParsedStudentRow[] = result.data.map((r, i) => ({
          roll_number: (r.roll_number ?? r.rollno ?? '').trim().toUpperCase(),
          full_name: (r.full_name ?? r.name ?? '').trim(),
          date_of_birth: (r.date_of_birth ?? r.dob ?? '').trim() || undefined,
          batch_code: (r.batch_code ?? r.batch ?? '').trim() || undefined,
          exam_wing: (r.exam_wing ?? r.wing ?? '').trim().toUpperCase() as any || undefined,
          parent_name: (r.parent_name ?? r.guardian_name ?? r.parent_full_name ?? '').trim() || undefined,
          parent_phone: (r.parent_phone ?? r.guardian_phone ?? r.parent_mobile ?? '').trim() || undefined,
          parent_email: (r.parent_email ?? r.guardian_email ?? '').trim() || undefined,
          parent_relationship: (r.parent_relationship ?? r.relationship ?? '').trim() || undefined,
          _row: i + 2,
        }));
        resolve(rows);
      },
      error: (err) => reject(err),
    });
  });
}

export function parseMarksCsv(file: File): Promise<ParsedMarksRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
      complete: (result) => {
        if (result.errors.length > 0) {
          reject(new Error(result.errors[0]?.message ?? 'CSV parse error'));
          return;
        }
        // Normalize roll_number if user provided 'usn' column header instead of 'roll_number'
        const rows = result.data.map((r) => {
          return {
            ...r,
            roll_number: (r.roll_number ?? r.rollno ?? r.usn ?? '').trim().toUpperCase(),
          };
        }) as ParsedMarksRow[];
        resolve(rows);
      },
      error: (err) => reject(err),
    });
  });
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]): void {
  if (rows.length === 0) return;
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadStudentTemplate(): void {
  downloadCsv('student-template.csv', [
    { 
      roll_number: 'PUC-24-001', 
      full_name: 'Sample Student', 
      date_of_birth: '2008-04-15', 
      exam_wing: 'NEET',
      parent_name: 'Robert Smith',
      parent_phone: '9876543210',
      parent_email: 'robert@example.com',
      parent_relationship: 'Father'
    },
    { 
      roll_number: 'PUC-24-002', 
      full_name: 'Another Student', 
      date_of_birth: '', 
      exam_wing: 'KCET',
      parent_name: 'Mary Doe',
      parent_phone: '9876543211',
      parent_email: '',
      parent_relationship: 'Mother'
    },
  ]);
}

export function downloadMarksTemplate(subjectNames: string[]): void {
  const rows: Record<string, string>[] = [];
  for (const subj of subjectNames) {
    rows.push({
      roll_number: 'PUC-24-001',
      subject: subj,
      marks: '85',
      is_absent: 'false',
    });
  }
  if (rows.length === 0) {
    rows.push({ roll_number: 'PUC-24-001', subject: 'Mathematics', marks: '85', is_absent: 'false' });
  }
  downloadCsv('marks-template.csv', rows);
}
