# New Attendance System - Clean Implementation

## Overview
Completely rebuilt attendance system with focus on simplicity, avoiding RLS recursion issues, and clear 3-tier approval workflow.

## Architecture

### Database (Migration 028)
- **Table**: `attendance` - Stores batch attendance records
- **Schema**:
  - `batch_id` - Which batch
  - `attendance_date` - Date of attendance  
  - `session` - morning/evening
  - `students_attendance` - JSONB: `{"student_id": "present" | "absent"}`
  - `marked_by` - Faculty who marked
  - `approval_status` - draft | submitted | approved | published
  - `admin_remarks` - For admin notes

### RPC Functions (No Profiles Queries)
All RPC functions **take `user_role` as parameter** to avoid RLS recursion issues:

1. **get_pending_attendance_for_review(user_role)**
   - Returns pending submissions for admin
   - Accepts role as parameter (prevents RLS recursion)

2. **get_batch_attendance_details(batch_id, date, session)**
   - Returns student-level attendance records

3. **approve_attendance(id, user_id, user_role, remarks)**
   - Admin approves submission

4. **reject_attendance(id, user_id, user_role, remarks)**
   - Admin sends back to faculty

5. **publish_attendance(id, user_id, user_role)**
   - Admin publishes to parents

### RLS Policies (Minimal)
- Faculty can INSERT/UPDATE only their own draft/submitted records
- RPC functions with SECURITY DEFINER bypass RLS
- No queries to profiles table (prevents recursion)

## Frontend

### Hook: useAttendance.ts
Provides React Query hooks for:
- `usePendingAttendanceForReview()` - Admin view pending records
- `useGetBatchAttendanceDetails()` - Get student details
- `useSaveAttendance()` - Faculty saves draft
- `useSubmitAttendance()` - Faculty submits for review
- `useApproveAttendance()` - Admin approves
- `useRejectAttendance()` - Admin rejects
- `usePublishAttendance()` - Admin publishes

All hooks pass `user_role` from useAuth to avoid permission checks at RPC level.

### Pages

#### 1. FacultyAttendancePage.tsx
**Location**: `apps/web/src/features/faculty/pages/FacultyAttendancePage.tsx`

Faculty marks attendance:
1. Select batch from assigned batches
2. Pick date and session (morning/evening)
3. Toggle students between Present/Absent
4. Save (as draft) - Can edit anytime
5. Submit (for admin review) - Cannot edit after submission

**Features**:
- Live count of Present/Absent
- Color-coded row highlighting
- Confirmation modal before submit
- Simple toggle buttons (no selection headaches)

#### 2. AttendanceApprovalPage.tsx
**Location**: `apps/web/src/features/admin/pages/AttendanceApprovalPage.tsx`

Admin reviews and approves:
1. View pending submissions from faculty
2. Search by batch or faculty name
3. Expand record to see details
4. Approve (with optional remarks)
5. Reject (sends back to faculty with remarks)
6. Publish (makes visible to parents)

**Features**:
- Search/filter functionality
- Expandable records
- Clear status badges
- Step-by-step workflow (Submit → Approve → Publish)

## Workflow

```
Faculty                          Admin                    Parents
├─ Mark attendance     ────────────────────────────────────┐
├─ Save (draft)                                             │
├─ Can edit anytime    ────────────────────────────────────┐
├─ Submit              ──→ Pending in queue                │
│                       ├─ Review details                  │
│                       ├─ Approve or Reject               │
│                       │  ├─ If Approve → Approved        │
│                       │  └─ If Reject → Back to Draft    │
│                       ├─ Publish        ──→ Can now see attendance
└────────────────────────────────────────────────────────────┘

Status Flow: draft → submitted → approved → published
```

## Key Improvements Over Previous Implementation

| Aspect | Old | New |
|--------|-----|-----|
| **RLS Recursion** | ❌ Functions queried profiles, causing timeouts | ✅ Role passed as parameter, no recursion |
| **400 Errors** | ❌ GROUP BY syntax errors in RPC functions | ✅ Simple table queries without aggregation issues |
| **Profile Timeout** | ❌ Circular RLS policies (15s timeout) | ✅ Minimal RLS, no circular dependencies |
| **Batch Dropdown** | ❌ Wouldn't load (college_id access issues) | ✅ Frontend handles permissions, no RLS blocking |
| **Attendance Model** | ❌ Row per student (complex) | ✅ Batch-based with JSONB (simple) |
| **Permission Checks** | ❌ RPC level via profiles | ✅ Frontend via useAuth hook |
| **Workflow** | ❌ Unclear states | ✅ Clear: draft → submitted → approved → published |

## Testing Checklist

- [ ] Faculty can select batch and mark attendance
- [ ] Faculty can save draft multiple times
- [ ] Faculty can submit for review
- [ ] Admin sees pending submissions
- [ ] Admin can approve with remarks
- [ ] Admin can reject (sends back to draft)
- [ ] Admin can publish approved records
- [ ] No 400 errors in console
- [ ] No profile timeout errors
- [ ] Batch dropdown shows all batches
- [ ] Role-based access control works (only faculty/admin can see pages)

## Files Created/Modified

1. `supabase/migrations/028_new_attendance_system.sql` - Database
2. `apps/web/src/hooks/useAttendance.ts` - React hooks
3. `apps/web/src/features/faculty/pages/FacultyAttendancePage.tsx` - Faculty UI
4. `apps/web/src/features/admin/pages/AttendanceApprovalPage.tsx` - Admin UI

## Design Principles Applied

✅ **No RLS Recursion** - RPC functions accept role as parameter  
✅ **No Profile Queries in RPC** - All permission checks handled by role parameter  
✅ **Minimal RLS Policies** - Only basic INSERT/UPDATE/SELECT checks  
✅ **Frontend Permission Checks** - useAuth hook used for UI access control  
✅ **Simple Data Model** - Batch-based with JSONB, not row-per-student  
✅ **Clear Workflow** - Status values explicitly defined and validated  
✅ **No Circular Dependencies** - RPC functions use SECURITY DEFINER, not RLS policies

## Next Steps

1. Test the frontend pages in browser
2. Verify each RPC function works
3. Check console for any errors
4. Test complete workflow: Faculty → Submit → Admin Approve/Reject → Publish
5. Test permissions (ensure only faculty/admin can access pages)
