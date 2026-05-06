// ============================================================================
// AcademeIQ Platform — Shared Types
// ============================================================================
// Targeting: 11th & 12th Grade PUC / Junior College (Karnataka-context)
// Schema: supabase/migrations/001_schema.sql + 004_puc_school.sql
// ============================================================================

export type Role = 'admin' | 'faculty' | 'parent';

export type Stream = 'PCMB' | 'PCMC' | 'PCME' | 'Commerce' | 'Arts' | 'Other';
export type ClassLevel = 11 | 12;
export type ExamCategory = 'Board' | 'KCET' | 'NEET' | 'JEE_Mains' | 'JEE_Advanced' | 'Practice';

export const STREAMS: Stream[] = ['PCMB', 'PCMC', 'PCME', 'Commerce', 'Arts', 'Other'];
export const CLASS_LEVELS: ClassLevel[] = [11, 12];
export const EXAM_CATEGORIES: ExamCategory[] = ['Board', 'KCET', 'NEET', 'JEE_Mains', 'JEE_Advanced', 'Practice'];

export const EXAM_CATEGORY_LABELS: Record<ExamCategory, string> = {
  Board: 'Board Exam',
  KCET: 'KCET',
  NEET: 'NEET',
  JEE_Mains: 'JEE Mains',
  JEE_Advanced: 'JEE Advanced',
  Practice: 'Practice / Internal',
};

export const BOARD_SUB_TYPES = ['Mid-term', 'Final', 'Unit Test', 'Pre-Board', 'Revision Test'];
export const COMPETITIVE_SUB_TYPES = ['CET Mock', 'Full Syllabus', 'Chapter-wise', 'Grand Test', 'Previous Year'];

export interface College {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
}

export interface AcademicYear {
  id: string;
  college_id: string;
  label: string;
  is_current: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

/** @deprecated Departments not used in PUC context — kept for backward compat */
export interface Department {
  id: string;
  college_id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  college_id: string | null;
  role: Role;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  temp_password_set: boolean;
  created_at: string;
  updated_at: string;
}

/** PUC Batch — represents a section in a class (e.g. "11-PCMB-A 2024-25") */
export interface Batch {
  id: string;
  college_id: string;
  department_id: string | null;   // nullable — not used in PUC context
  academic_year_id: string;
  name: string;
  code: string;
  class_level: ClassLevel | null;  // 11 or 12
  stream: Stream | null;           // PCMB, PCMC, etc.
  is_active: boolean;
  created_at: string;
}

export interface FacultyBatchAssignment {
  id: string;
  faculty_id: string;
  batch_id: string;
  assigned_at: string;
}

/** Student in a PUC batch — identified by roll_number (not USN) */
export interface Student {
  id: string;
  college_id: string;
  batch_id: string;
  roll_number: string;   // replaces usn
  full_name: string;
  date_of_birth: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ParentStudentMap {
  id: string;
  parent_id: string;
  student_id: string;
  relationship: string;
  is_verified: boolean;
  mapped_at: string;
  verified_at: string | null;
}

/** Test — with exam_category for KCET/NEET/JEE/Board */
export interface Test {
  id: string;
  college_id: string;
  batch_id: string;
  created_by: string;
  title: string;
  description: string | null;
  test_date: string;
  exam_category: ExamCategory;        // Board | KCET | NEET | JEE_Mains | JEE_Advanced | Practice
  exam_sub_type: string | null;       // Mid-term | Final | CET Mock | etc.
  is_published: boolean;
  is_locked: boolean;
  published_at: string | null;
  locked_at: string | null;
  created_at: string;
}

export interface TestSubject {
  id: string;
  test_id: string;
  subject_name: string;
  max_marks: number;
  num_questions: number;      // Added for KCET/JEE/NEET
  weightage: number;
  display_order: number;
  created_at: string;
}

export interface Mark {
  id: string;
  test_id: string;
  student_id: string;
  subject_id: string;
  marks_obtained: number | null;
  num_attempted: number | null;   // Added for auto-calculation
  num_unanswered: number | null;  // Added for auto-calculation
  num_incorrect: number | null;   // Added for auto-calculation
  is_absent: boolean;
  entered_by: string;
  entered_at: string;
  updated_at: string;
}

export interface Ranking {
  id: string;
  test_id: string;
  student_id: string;
  total_marks: number;
  max_marks: number;
  percentage: number;
  rank: number;
  batch_rank: number;
  total_students: number;
  computed_at: string;
}

/** Subject-wise ranking — per test per subject per student */
export interface SubjectRanking {
  id: string;
  test_id: string;
  subject_id: string;
  student_id: string;
  marks_obtained: number | null;
  is_absent: boolean;
  rank: number;
  total_students: number;
  computed_at: string;
}

export interface AuditLogEntry {
  id: number;
  college_id: string;
  actor_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ============================================================================
// VIEW / DERIVED TYPES
// ============================================================================

export interface VerifiedChild {
  student_id: string;
  full_name: string;
  roll_number: string;   // was usn
  batch_id: string;
  batch_name: string;
  class_level: ClassLevel | null;
  stream: Stream | null;
}

export interface RankingWithStudent extends Ranking {
  student: Pick<Student, 'id' | 'roll_number' | 'full_name'>;
}

export interface SubjectRankingWithStudent extends SubjectRanking {
  student: Pick<Student, 'id' | 'roll_number' | 'full_name'>;
  subject: Pick<TestSubject, 'id' | 'subject_name' | 'max_marks'>;
}

export interface TestWithSubjects extends Test {
  subjects: TestSubject[];
}

export interface BatchWithDetails extends Batch {
  academic_year: Pick<AcademicYear, 'id' | 'label'>;
}

// ============================================================================
// DATABASE TYPE (for Supabase typed client)
// ============================================================================

export type Database = {
  public: {
    Tables: {
      colleges:                 { Row: College;               Insert: Partial<College>;               Update: Partial<College>;               Relationships: [] };
      academic_years:           { Row: AcademicYear;          Insert: Partial<AcademicYear>;          Update: Partial<AcademicYear>;          Relationships: [] };
      departments:              { Row: Department;             Insert: Partial<Department>;             Update: Partial<Department>;             Relationships: [] };
      profiles:                 { Row: Profile;               Insert: Partial<Profile>;               Update: Partial<Profile>;               Relationships: [] };
      batches:                  { Row: Batch;                  Insert: Partial<Batch>;                  Update: Partial<Batch>;                  Relationships: [] };
      faculty_batch_assignments:{ Row: FacultyBatchAssignment; Insert: Partial<FacultyBatchAssignment>; Update: Partial<FacultyBatchAssignment>; Relationships: [] };
      students:                 { Row: Student;               Insert: Partial<Student>;               Update: Partial<Student>;               Relationships: [] };
      parent_student_map:       { Row: ParentStudentMap;      Insert: Partial<ParentStudentMap>;      Update: Partial<ParentStudentMap>;      Relationships: [] };
      tests:                    { Row: Test;                  Insert: Partial<Test>;                  Update: Partial<Test>;                  Relationships: [] };
      test_subjects:            { Row: TestSubject;           Insert: Partial<TestSubject>;           Update: Partial<TestSubject>;           Relationships: [] };
      marks:                    { Row: Mark;                  Insert: Partial<Mark>;                  Update: Partial<Mark>;                  Relationships: [] };
      rankings:                 { Row: Ranking;               Insert: Partial<Ranking>;               Update: Partial<Ranking>;               Relationships: [] };
      subject_rankings:         { Row: SubjectRanking;        Insert: Partial<SubjectRanking>;        Update: Partial<SubjectRanking>;        Relationships: [] };
      audit_log:                { Row: AuditLogEntry;         Insert: Partial<AuditLogEntry>;         Update: Partial<AuditLogEntry>;         Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      recalculate_rankings: { Args: { p_test_id: string }; Returns: number };
      get_my_college_id:    { Args: Record<string, never>; Returns: string };
      get_my_role:          { Args: Record<string, never>; Returns: string };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
