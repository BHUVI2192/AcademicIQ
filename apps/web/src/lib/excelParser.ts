import * as XLSX from 'xlsx';

export interface ExcelMarkRow {
  roll_number: string;
  subject: string;
  marks: number;
  num_attempted?: number;
  num_incorrect?: number;
  num_unanswered?: number;
  is_absent: boolean;
}

export function parseOMRExcel(file: File): Promise<ExcelMarkRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Read sheet as a 2D array of rows
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        // Find the row containing "CANDIDATE ID" (the main header row)
        let headerRowIndex = -1;
        for (let i = 0; i < rows.length; i++) {
          if (rows[i] && rows[i][0] && String(rows[i][0]).toUpperCase().includes('CANDIDATE ID')) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          throw new Error('Invalid sheet format: Could not find "CANDIDATE ID" header row.');
        }

        const headerRow = rows[headerRowIndex];
        const subHeaderRow = rows[headerRowIndex + 1] || [];

        // Build mapping of column index to subject and metric type
        interface ColumnMapping {
          subjectName: string;
          colType: 'R' | 'W' | 'UA' | 'TOT_MARKS';
          colIndex: number;
        }

        const mappings: ColumnMapping[] = [];
        let currentSubject = '';

        for (let c = 2; c < headerRow.length; c++) {
          const cellVal = headerRow[c] ? String(headerRow[c]).trim().toUpperCase() : '';
          
          // If we hit TOTAL or another summary column, we stop mapping subjects
          if (cellVal === 'TOTAL' || cellVal === 'TOTAL MARKS' || cellVal === 'FINAL RANK') {
            currentSubject = '';
            continue;
          }

          if (cellVal) {
            currentSubject = cellVal; // e.g. "PHYSICS", "CHEMISTRY", "BIOLOGY"
          }

          if (currentSubject) {
            const subCellVal = subHeaderRow[c] ? String(subHeaderRow[c]).trim().toUpperCase() : '';
            let colType: 'R' | 'W' | 'UA' | 'TOT_MARKS' | null = null;
            
            if (subCellVal === 'R') {
              colType = 'R';
            } else if (subCellVal === 'W') {
              colType = 'W';
            } else if (subCellVal === 'UA') {
              colType = 'UA';
            } else if (subCellVal === 'TOT. MARKS' || subCellVal === 'TOT MARKS' || subCellVal === 'MARKS') {
              colType = 'TOT_MARKS';
            }

            if (colType) {
              mappings.push({
                subjectName: currentSubject.toLowerCase().trim(),
                colType,
                colIndex: c,
              });
            }
          }
        }

        const results: ExcelMarkRow[] = [];

        // Parse student rows starting after the sub-header row
        for (let i = headerRowIndex + 2; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[0]) continue; // Skip empty rows

          const candidateId = String(row[0]).trim();
          if (!candidateId || candidateId.toUpperCase() === 'TOTAL' || candidateId.toUpperCase().includes('AVERAGE')) {
            continue; // Skip summary / average rows at the end
          }

          // Group scores by subject for this student row
          const subjectScores: Record<string, { R?: number; W?: number; UA?: number; tot?: number }> = {};

          for (const map of mappings) {
            if (!subjectScores[map.subjectName]) {
              subjectScores[map.subjectName] = {};
            }

            const rawVal = row[map.colIndex];
            const val = (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') 
              ? 0 
              : parseFloat(String(rawVal)) || 0;

            if (map.colType === 'R') subjectScores[map.subjectName].R = val;
            else if (map.colType === 'W') subjectScores[map.subjectName].W = val;
            else if (map.colType === 'UA') subjectScores[map.subjectName].UA = val;
            else if (map.colType === 'TOT_MARKS') subjectScores[map.subjectName].tot = val;
          }

          // Output a ParsedMarksRow-compatible structure for each subject
          for (const [subName, data] of Object.entries(subjectScores)) {
            const R = data.R ?? 0;
            const W = data.W ?? 0;
            const UA = data.UA ?? 0;
            const totMarks = data.tot ?? (R * 4 - W);

            // Determine if the student is absent for this subject:
            // If correct, incorrect, unattempted, and marks are all empty or zero, we flag it.
            // But we can check if they have any attempted questions or score.
            // Let's assume they are present if they scored any marks, or attempted any questions.
            const isAbsent = R === 0 && W === 0 && UA === 0 && totMarks === 0;

            results.push({
              roll_number: candidateId.toUpperCase(),
              subject: subName, // lowercase subject name
              marks: totMarks,
              num_attempted: R + W,
              num_incorrect: W,
              num_unanswered: UA,
              is_absent: isAbsent,
            });
          }
        }

        resolve(results);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
}
