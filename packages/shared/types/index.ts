// ============================================================================
// AcademeIQ Platform — Shared Types
// ============================================================================
// Targeting: 11th & 12th Grade PUC / Junior College (Karnataka-context)
// Schema: supabase/migrations/001_schema.sql + 011_custom_erp_changes.sql
// ============================================================================

export type Role = 'admin' | 'faculty' | 'parent';

export type Stream = 'PCMB' | 'PCMC' | 'PCME' | 'Commerce' | 'Arts' | 'Other';
export type ClassLevel = 11 | 12;
export type ExamCategory = 'KCET' | 'JEE' | 'NEET' | 'Board Exam' | 'Daily Test';
export type ExamWing = 'NEET' | 'KCET';
export type MarksStatus = 'draft' | 'submitted' | 'approved' | 'published';
export type ApprovalStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type NotificationType = 'fees_due' | 'attendance_absent' | 'marks_published' | 'fees_completed';

export const STREAMS: Stream[] = ['PCMB', 'PCMC', 'PCME', 'Commerce', 'Arts', 'Other'];
export const CLASS_LEVELS: ClassLevel[] = [11, 12];
export const EXAM_CATEGORIES: ExamCategory[] = ['KCET', 'JEE', 'NEET', 'Board Exam', 'Daily Test'];
export const EXAM_WINGS: ExamWing[] = ['NEET', 'KCET'];
export const APPROVAL_STATUSES: ApprovalStatus[] = ['draft', 'submitted', 'approved', 'rejected'];

export const EXAM_CATEGORY_LABELS: Record<ExamCategory, string> = {
  KCET: 'KCET',
  JEE: 'JEE',
  NEET: 'NEET',
  'Board Exam': 'Board Exam',
  'Daily Test': 'Daily Test',
};

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
  subject: string | null;              // Added in 011
  can_add_students: boolean;           // Added in 011
  can_manage_fees: boolean;            // Added in 016 (marks approval)
  can_manage_attendance: boolean;      // Added in 016 (marks approval)
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
  roll_number: string;
  full_name: string;
  date_of_birth: string | null;
  exam_wing: ExamWing | null;        // Added in 011
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

/** Test — with workflow fields and specific categories */
export interface Test {
  id: string;
  college_id: string;
  batch_id: string;
  created_by: string;
  title: string;
  description: string | null;
  chapter_name: string | null;       // Added in 011
  test_date: string;
  exam_category: ExamCategory;
  exam_sub_type: string | null;
  assigned_faculty_id: string | null; // Added in 011
  marks_status: MarksStatus;          // Added in 011
  admin_remarks: string | null;       // Added in 011
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
  num_questions: number;
  weightage: number;
  display_order: number;
  assigned_faculty_id?: string | null;
  created_at: string;
}

export interface Mark {
  id: string;
  test_id: string;
  student_id: string;
  subject_id: string;
  marks_obtained: number | null;
  num_attempted: number | null;
  num_unanswered: number | null;
  num_incorrect: number | null;
  is_absent: boolean;
  entered_by: string;
  entered_at: string;
  updated_at: string;
  approval_status: ApprovalStatus;     // Added in 015 (marks approval)
  approved_by: string | null;          // Added in 015 (marks approval)
  approved_at: string | null;          // Added in 015 (marks approval)
  admin_remarks: string | null;        // Added in 015 (marks approval)
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

export interface Fee {
  id: string;
  student_id: string;
  amount_due: number;
  due_date: string | null;
  status: 'pending' | 'paid';
  assigned_faculty_id: string | null;
  is_published: boolean;               // Added in 017 (fees enhancements)
  published_at: string | null;         // Added in 017 (fees enhancements)
  completion_date: string | null;      // Added in 017 (fees enhancements)
  remarks: string | null;              // Added in 017 (fees enhancements)
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  student_id: string;
  attendance_date: string;
  session: 'morning' | 'evening';
  status: 'present' | 'absent';
  assigned_faculty_id: string | null;
  is_published: boolean;
  marked_by: string | null;            // Added in 017 (attendance enhancements)
  parent_notified: boolean;            // Added in 017 (attendance enhancements)
  notified_at: string | null;          // Added in 017 (attendance enhancements)
  created_at: string;
  updated_at: string;
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

export interface NotificationLog {
  id: string;
  recipient_email: string;
  recipient_id: string | null;
  notification_type: NotificationType;
  related_entity_type: string | null;
  related_entity_id: string | null;
  sent_at: string;
  status: 'sent' | 'failed' | 'bounced';
  error_message: string | null;
}

// ============================================================================
// VIEW / DERIVED TYPES
// ============================================================================

export interface VerifiedChild {
  student_id: string;
  full_name: string;
  roll_number: string;
  batch_id: string;
  batch_name: string;
  class_level: ClassLevel | null;
  stream: Stream | null;
  exam_wing: ExamWing | null;
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
      fees:                     { Row: Fee;                   Insert: Partial<Fee>;                   Update: Partial<Fee>;                   Relationships: [] };
      attendance:               { Row: Attendance;            Insert: Partial<Attendance>;            Update: Partial<Attendance>;            Relationships: [] };
      audit_log:                { Row: AuditLogEntry;         Insert: Partial<AuditLogEntry>;         Update: Partial<AuditLogEntry>;         Relationships: [] };
      notification_logs:        { Row: NotificationLog;       Insert: Partial<NotificationLog>;       Update: Partial<NotificationLog>;       Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      recalculate_rankings:          { Args: { p_test_id: string }; Returns: number };
      get_my_college_id:             { Args: Record<string, never>; Returns: string };
      get_my_role:                   { Args: Record<string, never>; Returns: string };
      approve_marks_for_test:        { Args: { p_test_id: string; p_admin_id: string; p_remarks?: string | null }; Returns: { success: boolean; message: string; marks_count: number; test_status: string }[] };
      reject_marks_for_test:         { Args: { p_test_id: string; p_admin_id: string; p_remarks: string }; Returns: { success: boolean; message: string; marks_count: number; test_status: string }[] };
      publish_test_marks:            { Args: { p_test_id: string; p_admin_id: string }; Returns: { success: boolean; message: string; rankings_count: number }[] };
      submit_marks_for_test:         { Args: { p_test_id: string; p_faculty_id: string }; Returns: { success: boolean; message: string; marks_count: number }[] };
      get_student_visible_tests:     { Args: { p_student_id: string; p_batch_id?: string | null }; Returns: { test_id: string; title: string; exam_category: string; test_date: string; is_published: boolean; marks_status: string }[] };
      get_pending_marks_approvals:   { Args: { p_college_id: string }; Returns: { test_id: string; test_title: string; batch_name: string; exam_category: string; submitted_by_name: string; submitted_by_email: string; marks_count: number; submitted_at: string; marks_status: string }[] };
      log_notification:              { Args: { p_recipient_id?: string | null; p_recipient_email: string; p_notification_type: string; p_entity_type?: string | null; p_entity_id?: string | null; p_status?: string }; Returns: { success: boolean; notification_id: string }[] };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

