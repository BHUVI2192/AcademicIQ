# AcademicIQ Attendance System Redesign Plan

## 📋 Overview
Implement a proper attendance management workflow with approval stages, role-based access, and batch/class context.

---

## 🎯 Current Issues

### Database Schema Issues
1. ❌ No approval workflow - only `is_published` boolean
2. ❌ No faculty context - which class/section is being taught
3. ❌ No batch association in attendance table
4. ❌ Loose RLS policies - faculty can access any student's attendance
5. ❌ No audit trail for approvals

### Business Logic Issues
1. ❌ Faculty marks attendance → direct publish to parents (no admin review)
2. ❌ No pending/submitted status tracking
3. ❌ No rejection with remarks capability
4. ❌ No notification system to parents after publish
5. ❌ No tracking of who approved what

---

## ✅ Proposed Solution

### **Phase 1: Database Schema Enhancements**

#### Migration: `023_attendance_workflow.sql`

**Changes to `attendance` table:**
```sql
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS batch_id UUID 
  REFERENCES public.batches(id) ON DELETE CASCADE;
  
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS session_type TEXT 
  DEFAULT 'all' CHECK (session_type IN ('all', 'morning', 'afternoon', 'evening'));
  
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS approval_status TEXT 
  DEFAULT 'draft' CHECK (approval_status IN ('draft', 'submitted', 'approved', 'rejected'));
  
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS approved_by UUID 
  REFERENCES public.profiles(id) ON DELETE SET NULL;
  
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Drop existing UNIQUE constraint and recreate with approval_status awareness
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_student_id_attendance_date_session_key;

-- New indexes for performance
CREATE INDEX idx_attendance_batch_date ON attendance(batch_id, attendance_date);
CREATE INDEX idx_attendance_approval_status ON attendance(approval_status);
CREATE INDEX idx_attendance_submitted_at ON attendance(submitted_at);
CREATE INDEX idx_attendance_approved_by ON attendance(approved_by);
```

#### Create `attendance_approval_log` table for audit:
```sql
CREATE TABLE IF NOT EXISTS public.attendance_approval_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attendance_id UUID REFERENCES public.attendance(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT,
  changed_by UUID REFERENCES public.profiles(id),
  change_reason TEXT,
  changed_at TIMESTAMPTZ DEFAULT now()
);
```

### **Phase 2: RLS Policy Updates**

**New RLS Policies:**

1. **Faculty Can Draft & Submit** (for their assigned batches)
   - Can INSERT/UPDATE `draft` and `submitted` records only
   - Only for students in their assigned batches
   - Cannot modify `approved` or `rejected` records

2. **Admin Can Review & Approve** (all records)
   - Can see all pending records
   - Can UPDATE to `approved` or `rejected`
   - Can set `approved_by`, `approved_at`, `rejection_reason`
   - Can UPDATE `is_published` only after `approved`

3. **Parents Can View** (only approved & published records)
   - Can SELECT only where `approval_status = 'approved'` AND `is_published = true`

### **Phase 3: RPC Functions**

#### Function: `get_pending_attendance_for_admin()`
```sql
CREATE OR REPLACE FUNCTION public.get_pending_attendance_for_admin(
  p_status TEXT DEFAULT 'submitted',
  p_batch_id UUID DEFAULT NULL
)
RETURNS TABLE (...) AS $$
-- Returns all pending attendance grouped by batch/date
$$;
```

#### Function: `submit_batch_attendance()`
```sql
CREATE OR REPLACE FUNCTION public.submit_batch_attendance(
  p_batch_id UUID,
  p_date DATE,
  p_session TEXT,
  p_faculty_id UUID
)
RETURNS JSON AS $$
-- Changes all draft attendance for batch to 'submitted'
-- Returns success/error with count
$$;
```

#### Function: `approve_batch_attendance()`
```sql
CREATE OR REPLACE FUNCTION public.approve_batch_attendance(
  p_batch_id UUID,
  p_date DATE,
  p_session TEXT,
  p_admin_id UUID,
  p_remarks TEXT DEFAULT NULL
)
RETURNS JSON AS $$
-- Changes 'submitted' to 'approved' and logs approval
$$;
```

#### Function: `publish_batch_attendance()`
```sql
CREATE OR REPLACE FUNCTION public.publish_batch_attendance(
  p_batch_id UUID,
  p_date DATE,
  p_session TEXT,
  p_admin_id UUID
)
RETURNS JSON AS $$
-- Changes 'approved' to published (is_published = true, published_at = now())
-- Triggers parent notification
$$;
```

---

## 🎨 Frontend Changes

### **Phase 4: React Hooks Updates**

#### Update: `useAttendance.ts`

**New hooks to add:**
- `useSubmitAttendance()` - Faculty submits for review
- `usePendingAttendance()` - Admin views pending records
- `useApproveAttendance()` - Admin approves with remarks
- `useRejectAttendance()` - Admin rejects with reason
- `usePublishAttendance()` - Admin publishes to parents
- `useAttendanceApprovalLog()` - View approval history

### **Phase 5: UI Pages**

#### 1. **Faculty Attendance Page** (Update)
```
✅ Mark attendance (DRAFT)
📤 Submit for Review → changes status to SUBMITTED
⏳ View submission status (Draft/Submitted/Approved/Rejected)
👁️ Show admin remarks if rejected
📊 Statistics: Submitted, Approved, Rejected
```

#### 2. **New Admin Attendance Approval Page**
```
Page: /admin/attendance-approval

Features:
- Filter by: Batch, Date, Session, Status (Submitted/Approved/Rejected)
- Bulk actions: Approve All, Reject All
- Review panel showing:
  • Student list with attendance marks
  • Faculty who submitted
  • Submission timestamp
  • Approve/Reject buttons with remarks textarea
- Approval history log
- Publish option (only for approved records)
```

#### 3. **Admin Attendance Dashboard** (Update)
```
- Pending submissions count
- Quick stats: Drafts, Submitted, Approved, Published
- Recent activity log
- Drill-down to see batch-wise status
```

#### 4. **Parent Attendance Page** (Update)
```
✅ Only shows APPROVED + PUBLISHED records
- Attendance percentage (only from published)
- Date range filter
- No draft/submitted records visible
- Show publish date
```

---

## 📊 Data Flow Diagram

```
1. FACULTY MARKS ATTENDANCE
   └─ Status: DRAFT
   └─ Stored with: student_id, date, session, status
   
2. FACULTY REVIEWS & SUBMITS
   └─ Status: SUBMITTED
   └─ Updates: submitted_at = now()
   └─ Mark: marked_by = faculty_id
   
3. ADMIN RECEIVES NOTIFICATION
   └─ Shows in: Pending Attendance Approval page
   └─ Can: Review, Approve, Reject
   
4a. ADMIN APPROVES
    └─ Status: APPROVED
    └─ Updates: approved_by = admin_id, approved_at = now()
    └─ Logs: Entry in attendance_approval_log
    
4b. ADMIN REJECTS
    └─ Status: REJECTED
    └─ Updates: rejection_reason = text
    └─ Faculty sees reject reason & resubmits
    
5. ADMIN PUBLISHES
   └─ Status: APPROVED + is_published = true
   └─ Updates: published_at = now()
   
6. PARENT RECEIVES
   └─ Sees: Only approved + published records
   └─ Shows: With publish timestamp
```

---

## 📝 Implementation Order

### Week 1: Database & Backend
- [ ] Create migration `023_attendance_workflow.sql`
- [ ] Update RLS policies
- [ ] Create RPC functions
- [ ] Create approval_log table

### Week 2: Frontend Hooks & Admin Page
- [ ] Update `useAttendance.ts` with new hooks
- [ ] Create `AttendanceApprovalPage.tsx`
- [ ] Update admin dashboard with approval stats

### Week 3: UI Updates
- [ ] Update `FacultyAttendancePage.tsx` with submit button
- [ ] Update `ParentAttendancePage.tsx` to show only approved
- [ ] Add status indicators & remarks display

### Week 4: Testing & Refinement
- [ ] Integration testing
- [ ] User acceptance testing
- [ ] Bug fixes & optimization

---

## 🔒 Security Checklist

- ✅ RLS policies enforce role-based access
- ✅ Faculty cannot modify approved records
- ✅ Parents cannot see unpublished data
- ✅ All actions logged in approval_log
- ✅ Admin approval required before parent visibility
- ✅ Batch/class validation for faculty access

---

## 📱 Component Tree

```
Admin Portal
├── AttendanceApprovalPage
│   ├── PendingAttendanceList
│   │   ├── BatchFilter
│   │   ├── DateFilter
│   │   ├── SessionFilter
│   │   └── StatusFilter
│   ├── AttendanceReviewPanel
│   │   ├── StudentList
│   │   ├── StatusChanges
│   │   ├── ApprovalRemarks (textarea)
│   │   ├── ApproveButton
│   │   └── RejectButton
│   ├── ApprovalHistoryLog
│   └── BulkActions

Faculty Portal
├── FacultyAttendancePage (Updated)
│   ├── BatchSelector
│   ├── DateSelector
│   ├── SessionSelector
│   ├── AttendanceGrid
│   │   └── Toggle Present/Absent
│   ├── SaveButton
│   ├── ✨ SubmitButton (NEW)
│   └── StatusIndicator (NEW)

Parent Portal
├── ParentAttendancePage (Updated)
│   ├── ChildSelector
│   ├── DateRangeFilter
│   ├── AttendanceStats
│   └── AttendanceHistory (Only approved + published)
```

---

## 🧪 Test Scenarios

1. Faculty marks attendance → Status should be DRAFT
2. Faculty submits → Status should be SUBMITTED
3. Admin approves → Status should be APPROVED + log created
4. Admin publishes → is_published = true
5. Parent views → Only sees APPROVED + PUBLISHED
6. Rejection flow → Faculty can resubmit after rejection
7. RLS enforcement → Faculty cannot see other batches' attendance

---

## 📞 API Endpoints to Add

| Endpoint | Method | Role | Purpose |
|----------|--------|------|---------|
| `/api/attendance/submit` | POST | Faculty | Submit batch attendance for review |
| `/api/attendance/pending` | GET | Admin | List pending attendance for approval |
| `/api/attendance/approve` | PATCH | Admin | Approve attendance batch |
| `/api/attendance/reject` | PATCH | Admin | Reject with reason |
| `/api/attendance/publish` | PATCH | Admin | Publish to parents |
| `/api/attendance/approval-log` | GET | Admin | View approval history |

---

## ⏱️ Estimated Timeline: 2-3 weeks

- Database: 2-3 days
- Backend RPC: 2-3 days
- Frontend hooks: 3-4 days
- UI development: 4-5 days
- Testing & refinement: 3-4 days

**Total: 15-20 days with 1-2 developers**

---

## 📚 Related Documentation
- Database schema: `supabase/migrations/011_custom_erp_changes.sql`
- Current implementation: `apps/web/src/features/faculty/pages/FacultyAttendancePage.tsx`
- Parent view: `apps/web/src/features/parent/pages/ParentAttendancePage.tsx`
- Admin view: `apps/web/src/features/admin/pages/AttendancePage.tsx`
