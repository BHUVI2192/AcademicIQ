# AcademicIQ Platform - System Architecture & Data Flow

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      WEB BROWSER                                │
│  Landing Page / Admin Portal / Faculty Portal / Parent Portal   │
└────────────────┬────────────────────────────────────────────────┘
                 │ HTTPS
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│           REACT APPLICATION (Vite + TypeScript)                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Router (Role-based routing)                            │   │
│  │  ├── /admin → Admin Portal                              │   │
│  │  ├── /faculty → Faculty Portal                          │   │
│  │  ├── /parent → Parent Portal                            │   │
│  │  └── /login → Auth UI                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Features (UI Components)                               │   │
│  │  ├── features/admin/pages/*.tsx                          │   │
│  │  ├── features/faculty/pages/*.tsx                        │   │
│  │  ├── features/parent/pages/*.tsx                         │   │
│  │  └── features/auth/*.tsx                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  State Management                                       │   │
│  │  ├── React Query (TanStack Query) - Data caching        │   │
│  │  ├── Context API - Auth state                           │   │
│  │  └── SessionStorage - Child selector                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  API Layer                                              │   │
│  │  ├── hooks/useSupabase*.ts - Supabase client calls      │   │
│  │  ├── hooks/useAuth.ts - Auth logic                      │   │
│  │  └── lib/supabase.ts - Supabase initialization          │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────┬─────────────────────────────────────────────────────┘
             │
             │ REST / PostgREST / RPC
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE (Backend as a Service)              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Authentication (auth.users)                            │   │
│  │  ├── Email + Password (Admin, Faculty)                  │   │
│  │  ├── Phone OTP (Parent)                                 │   │
│  │  └── JWT token management                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  PostgREST API (Auto-generated)                         │   │
│  │  ├── GET /colleges                                      │   │
│  │  ├── GET /batches                                       │   │
│  │  ├── GET /students                                      │   │
│  │  ├── GET /tests, POST /marks, PATCH /marks/*           │   │
│  │  └── All other CRUD endpoints                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  RPC Functions (Business Logic)                         │   │
│  │  ├── approve_marks_for_test()                           │   │
│  │  ├── reject_marks_for_test()                            │   │
│  │  ├── publish_marks_for_test()                           │   │
│  │  ├── calculate_rankings()                               │   │
│  │  └── Other workflow functions                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Row Level Security (RLS) Policies                      │   │
│  │  ├── Admin can see only their college data              │   │
│  │  ├── Faculty see assigned batches only                  │   │
│  │  ├── Parent sees ONLY published marks                   │   │
│  │  └── Audit log: append-only (no DELETE)                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────┬─────────────────────────────────────────────────────┘
             │
             │ SQL Queries (with RLS filtering)
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Core Tables (College Hierarchy)                        │   │
│  │  ├── colleges                                           │   │
│  │  ├── academic_years                                     │   │
│  │  ├── departments                                        │   │
│  │  └── batches                                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  User & Access Tables                                  │   │
│  │  ├── profiles (extends auth.users)                      │   │
│  │  ├── faculty_batch_assignments                          │   │
│  │  └── parent_student_linking                             │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Academic Data Tables                                   │   │
│  │  ├── students                                           │   │
│  │  ├── tests                                              │   │
│  │  ├── marks (with approval_status)                       │   │
│  │  ├── attendance                                         │   │
│  │  └── fees                                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Audit & Compliance                                     │   │
│  │  └── audit_log (immutable, append-only)                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow - Marks Approval Workflow

```
FACULTY SIDE                    ADMIN SIDE                   PARENT SIDE
────────────────────────────────────────────────────────────────────

1. Faculty creates test
   ├── Test created
   └── Status: DRAFT

2. Faculty enters marks
   ├── Mark entry form
   ├── Can edit/delete
   └── Status: DRAFT

3. Faculty submits marks
   ├── Triggers update
   ├── Status: SUBMITTED
   └── Cannot edit anymore
                                ▼
                    4. Admin sees pending marks
                       ├── List of submitted marks
                       ├── Faculty name visible
                       └── Status: SUBMITTED

                    5. Admin reviews & approves
                       ├── Bulk approve all marks
                       ├── Add remarks (optional)
                       └── Status: APPROVED
                                    ▼
                                    │
                    6. Admin publishes marks
                       ├── Make visible to parents
                       ├── Status: PUBLISHED
                       └── Audit log entry
                                    ▼
                                    │                   ▼
                                    │        7. Parent logs in & sees marks
                                    │           ├── Only published marks visible
                                    │           ├── Shows: Score, Rank, Percentile
                                    │           ├── Cannot see: admin_remarks
                                    │           └── Status: PUBLISHED


Alternative Path: ADMIN REJECTS MARKS
────────────────────────────────────────────────────────────────────

                    5b. Admin reviews & rejects
                        ├── Finds errors in marks
                        ├── Add remarks (required)
                        └── Status: REJECTED
                            ▼
        Faculty sees rejection:
        ├── Status: REJECTED (red badge)
        ├── Shows admin remarks
        └── Can re-enter marks
            ├── Edit marks again
            ├── Submit again
            └── Goes back to SUBMITTED status
```

---

## 🔐 Multi-Tenancy & Data Isolation

```
SUPABASE ACCOUNT
│
├── COLLEGE A (college_id = uuid_a)
│   ├── Departments
│   │   ├── Batches
│   │   │   ├── Students (isolated)
│   │   │   ├── Tests (isolated)
│   │   │   ├── Marks (isolated, RLS filtered)
│   │   │   ├── Attendance (isolated)
│   │   │   └── Fees (isolated)
│   ├── Faculty (can only see their batches)
│   ├── Parents (can only see their children)
│   └── Audit Log (for College A only)
│
├── COLLEGE B (college_id = uuid_b)
│   ├── Departments
│   │   ├── Batches
│   │   │   ├── Students (isolated)
│   │   │   ├── Tests (isolated)
│   │   │   ├── Marks (isolated, RLS filtered)
│   │   │   ├── Attendance (isolated)
│   │   │   └── Fees (isolated)
│   ├── Faculty (can only see their batches)
│   ├── Parents (can only see their children)
│   └── Audit Log (for College B only)
│
└── ADMIN ACCOUNT
    ├── Can see multiple colleges (if super-admin)
    └── Cannot see marks data (goes through RLS)


RLS SECURITY RULES:
─────────────────────────────────────────────────────

College Isolation:
  SELECT * FROM students 
  WHERE college_id = auth.user().college_id ✅ (Admin sees only their college)

Faculty Access Control:
  SELECT * FROM students
  WHERE batch_id IN (
    SELECT batch_id FROM faculty_batch_assignments 
    WHERE faculty_id = auth.uid()
  ) ✅ (Faculty sees only assigned batches)

Parent Data Protection:
  SELECT * FROM marks_published_view
  WHERE student_id IN (
    SELECT student_id FROM parent_student_linking 
    WHERE parent_id = auth.uid()
  ) ✅ (Parent sees only published marks for their children)

Immutable Audit Log:
  INSERT INTO audit_log ✅ (Can add entries)
  UPDATE audit_log ❌ (Cannot modify)
  DELETE audit_log ❌ (Cannot delete)
```

---

## 📊 User Authentication & Session Flow

```
ADMIN / FACULTY FLOW (Email + Password)
─────────────────────────────────────────────────

User: admin@academeiq.com
Password: Admin@123
         │
         ▼
    Supabase Auth
    ├── Match email in auth.users
    ├── Verify password hash
    └── Generate JWT token
         │
         ▼
    Store JWT in browser (localStorage/session)
         │
         ▼
    Include JWT in requests:
    Authorization: Bearer {jwt}
         │
         ▼
    RLS Policy checks JWT:
    ├── Get user ID from JWT
    ├── Look up profile
    ├── Get college_id
    └── Filter data by college_id
         │
         ▼
    Redirect to role dashboard:
    ├── role='admin' → /admin/dashboard
    └── role='faculty' → /faculty/dashboard


PARENT FLOW (Phone OTP)
─────────────────────────────────────────────────

User enters: +91-9876543210
         │
         ▼
    Supabase Auth
    ├── Find profile with phone
    ├── Generate OTP (6 digits)
    └── Send SMS (Twilio in production)
         │
         ▼
    User receives SMS:
    "Your AcademicIQ OTP: 123456"
         │
         ▼
    User enters OTP
    ├── Verify OTP validity
    ├── Generate JWT token
    └── Check parent_student_linking status
         │
         ▼
    Status check:
    ├── If PENDING → Redirect to /parent/pending
    │   └── Wait for admin approval
    └── If VERIFIED → Redirect to /parent/select-child or /parent/dashboard
         │
         ▼
    Parent logs in each time:
    ├── Session persistence (JWT)
    └── Can access portal for 30 days (or configured timeout)
```

---

## 🔄 Test Creation to Ranking Workflow

```
Timeline of Test Lifecycle:
─────────────────────────────

Day 1:
┌─────────────────┐
│ Faculty creates │
│ test (DRAFT)    │
└────────┬────────┘
         │
         ▼
    Test can be edited,
    deleted, or submitted

Day 1-2:
┌─────────────────┐
│ Faculty enters  │
│ student marks   │
│ (DRAFT status)  │
└────────┬────────┘
         │
         ▼
    Marks can be:
    ├── Edited
    ├── Bulk uploaded
    ├── Marked absent
    └── Saved as draft

Day 2:
┌──────────────────┐
│ Faculty submits  │
│ marks for        │
│ approval         │
│ (SUBMITTED)      │
└────────┬─────────┘
         │
         ▼
    Cannot edit marks after submission
    Waiting for admin approval

Day 3:
┌──────────────────┐
│ Admin reviews    │
│ marks (either    │
│ approve/reject)  │
└────────┬─────────┘
         │
    ┌────┴─────┐
    │           │
    ▼           ▼
┌─────────┐ ┌────────────┐
│APPROVED │ │ REJECTED   │
│(status) │ │ with notes │
└────┬────┘ └────┬───────┘
     │           │
     │      Faculty sees rejection
     │      and can re-enter marks
     │
     ▼
┌──────────────────┐
│ Admin publishes  │
│ marks (PUBLISHED)│
└────────┬─────────┘
         │
         ▼
    Calculate rankings:
    ├── Sort marks (highest first)
    ├── Assign rank (1, 2, 3...)
    ├── Calculate percentile
    └── Update ranking view

Day 4:
┌──────────────────┐
│ Parent logs in   │
│ and sees:        │
├──────────────────┤
│ Score: 92        │
│ Rank: 5 out of 30│
│ Percentile: 85th │
│ Subject: Physics │
│ Status: Published│
└──────────────────┘


Visibility Timeline:
───────────────────

Status          Faculty  Admin    Parent
─────────────────────────────────────────
DRAFT           ✓ (edit)  ✓       ✗
SUBMITTED       ✓ (view)  ✓       ✗
APPROVED        ✓ (view)  ✓       ✗
PUBLISHED       ✓ (view)  ✓       ✓ (read-only)

✓ = Can see
✗ = Cannot see (RLS blocks access)
```

---

## 📱 User Interface Organization

```
SINGLE REACT APPLICATION
│
├── PUBLIC PAGES
│   ├── / (Landing Page)
│   ├── /login (Faculty/Parent login)
│   └── /admin/login (Admin login)
│
├── ADMIN PORTAL (/admin/*)
│   ├── /admin/dashboard (KPIs, stats)
│   ├── /admin/colleges
│   ├── /admin/academic-years
│   ├── /admin/departments
│   ├── /admin/batches
│   ├── /admin/faculty
│   ├── /admin/students
│   ├── /admin/tests
│   ├── /admin/marks-entry
│   ├── /admin/marks-approval
│   ├── /admin/attendance
│   ├── /admin/attendance-approval
│   ├── /admin/parent-linking
│   ├── /admin/parents
│   └── /admin/audit
│
├── FACULTY PORTAL (/faculty/*)
│   ├── /faculty/dashboard
│   ├── /faculty/students
│   ├── /faculty/tests
│   ├── /faculty/tests/:id/marks
│   ├── /faculty/tests/:id/rankings
│   ├── /faculty/attendance
│   ├── /faculty/fees
│   ├── /faculty/analytics
│   └── ... (8 pages)
│
├── PARENT PORTAL (/parent/*)
│   ├── /parent/login (OTP)
│   ├── /parent/pending (awaiting verification)
│   ├── /parent/select-child
│   ├── /parent/dashboard
│   ├── /parent/tests/:testId
│   ├── /parent/progress
│   ├── /parent/attendance
│   ├── /parent/fees
│   ├── /parent/reports
│   ├── /parent/profile
│   └── ... (7 pages)
│
└── SHARED COMPONENTS
    ├── Layout (header, sidebar, footer)
    ├── ErrorBoundary
    ├── RequireAuth (route guard)
    ├── RequireRole (role check)
    └── UI components (modal, table, form, etc.)
```

---

## 📊 Key Metrics & Calculations

### Attendance Percentage
```
Attendance % = (Present Days / Total Days) × 100

Example:
├── Total Classes: 60
├── Present: 57
├── Absent: 3
└── Attendance %: (57 / 60) × 100 = 95%
```

### Mark Scoring by Exam Type

**JEE Mains Formula**:
```
Total Score = (Correct × 4) - (Wrong × 1)

Example:
├── Correct: 60 questions
├── Wrong: 10 questions
├── Unanswered: 30 questions
└── Score = (60 × 4) - (10 × 1) = 240 - 10 = 230
```

**NEET Formula**:
```
Total Score = (Correct × 4) - (Wrong × 1)

Example:
├── Correct: 170
├── Wrong: 20
├── Unanswered: 10
└── Score = (170 × 4) - (20 × 1) = 680 - 20 = 660
```

**Percentile Calculation**:
```
Percentile = ((Rank - 1) / Total Students) × 100

Example:
├── Rank: 5 out of 30 students
├── Percentile = ((5 - 1) / 30) × 100 = (4 / 30) × 100 = 13.33th percentile
└── Higher rank = higher percentile (Top student = ~100th percentile)
```

---

## 🗂️ File Structure Map

```
academeiq-platform/
│
├── apps/web/
│   ├── src/
│   │   ├── features/
│   │   │   ├── admin/pages/          ← 13 admin pages
│   │   │   ├── faculty/pages/        ← 8 faculty pages
│   │   │   ├── parent/pages/         ← 7 parent pages
│   │   │   ├── auth/                 ← Login, OTP, reset password
│   │   │   └── landing/              ← Public landing page
│   │   ├── hooks/                    ← Custom hooks for API calls
│   │   ├── context/                  ← Auth & Directory context
│   │   ├── router/                   ← Route definitions
│   │   ├── components/               ← Shared UI components
│   │   ├── App.tsx                   ← Root component
│   │   └── main.tsx                  ← Entry point
│   ├── package.json
│   └── vite.config.ts
│
├── packages/shared/
│   ├── types/                        ← Shared TypeScript types
│   └── lib/                          ← Utilities
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_schema.sql            ← Core tables
│   │   ├── 002_rls.sql               ← Security policies
│   │   ├── 003_functions_triggers.sql
│   │   ├── ... (004-027 enhancements)
│   │   ├── 028_new_attendance_system.sql
│   │   └── 029_attendance_views.sql
│   ├── functions/                    ← Edge Functions (if any)
│   ├── seed.sql                      ← Test data
│   └── config.toml
│
├── COMPREHENSIVE_FEATURE_ANALYSIS.md ← Features by user role
├── IMPLEMENTATION_CHECKLIST.md        ← Detailed checklist
├── QUICK_START_TESTING_GUIDE.md      ← Step-by-step testing
├── PROJECT_SUMMARY.md                ← Project overview
└── package.json                      ← Monorepo config
```

---

## 🔑 Key Components & Their Roles

| Component | Purpose | Examples |
|-----------|---------|----------|
| **Pages** | Feature-specific UI | AdminDashboard, FacultyMarksEntry, ParentProgress |
| **Hooks** | API calls & logic | useStudents(), useMarks(), useAuth() |
| **Context** | Global state | AuthProvider, DirectoryProvider |
| **Router** | Route definitions | RequireAuth, RequireRole |
| **Components** | Reusable UI | Modal, Table, Form, Button |
| **Types** | TypeScript interfaces | Student, Test, Marks, User |
| **Utils** | Helper functions | date formatting, calculations |

---

## ✅ Verification Points

- [ ] Admin can see ONLY their college data
- [ ] Faculty can see ONLY their assigned batches
- [ ] Parent can see ONLY published marks for their children
- [ ] Parent CANNOT access raw marks table
- [ ] Marks workflow: Draft → Submitted → Approved → Published → Visible
- [ ] Audit log shows all actions (immutable)
- [ ] RLS policies block unauthorized access
- [ ] Multi-college isolation works (if applicable)

---

**Last Updated**: 2026-06-21
**Platform**: AcademicIQ
**Version**: 1.0.0 (MVP)
