# Attendance System - Quick Reference Guide

## 🚀 Getting Started

### Dev Server Issue (FIXED)
**Problem:** `ERR_CONNECTION_RESET` on port 5173
**Solution:** Run dev server from correct directory:
```bash
cd apps/web
pnpm dev
```
✅ Server now runs at: http://localhost:5173/

---

## 📋 New Pages & Routes

### Admin
- **Attendance Tracking:** `/admin/attendance` - View & mark attendance
- **Attendance Approval:** `/admin/attendance-approval` ⭐ **NEW** - Review & approve

### Faculty
- **Attendance Management:** `/faculty/attendance` - Mark & submit

### Parent
- **Attendance Records:** `/parent/attendance` - View published only

---

## 🎯 User Workflows

### Faculty: Mark & Submit Attendance
```
1. Go to /faculty/attendance
2. Select: Class, Date, Session
3. Mark: Present/Absent for each student
4. Click: "Submit for Review"
5. Status: Changes from Draft → Submitted
6. Wait: Admin approval
```

### Admin: Review & Approve
```
1. Go to /admin/attendance-approval
2. See: Pending, Approved, Rejected tabs
3. Click: Row to expand details
4. Click: "Approve" button
5. Optional: Add remarks in textarea
6. Confirm: Attendance status → Approved
7. Click: "Publish" to send to parents
```

### Parent: View Published Records
```
1. Go to /parent/attendance
2. Select: Child, Date Range
3. View: Published attendance only
4. See: Present/Absent breakdown & percentage
5. Period: Week/Month/Semester options
```

---

## 🗄️ Database Changes

### Migration File
📂 `supabase/migrations/023_attendance_workflow.sql`

### Key Additions
- **New Columns:** approval_status, submitted_at, approved_by, published_at
- **New Table:** attendance_approval_log
- **New Functions:** 7 RPC functions (query + action)
- **New Indexes:** 9 performance indexes

### Apply Migration
```bash
cd supabase
supabase db push
```

---

## 🪝 React Hooks

### File
📂 `apps/web/src/hooks/useAttendance.ts`

### New Hooks (for admin flow)
```typescript
// Queries
usePendingAttendanceForAdmin()      // Get pending submissions
useBatchAttendanceForApproval()     // Get batch details
useAttendanceStats()                 // Get status counts
useAttendanceApprovalLog()           // Get approval history

// Mutations
useSubmitAttendance()                // Faculty: submit
useApproveAttendance()               // Admin: approve
useRejectAttendance()                // Admin: reject
usePublishAttendance()               // Admin: publish
```

### Usage Example
```typescript
const { data: pending } = usePendingAttendanceForAdmin('submitted');
const submitAttendance = useSubmitAttendance();

// Submit
await submitAttendance.mutateAsync({
  batchId: batch.id,
  date: '2024-01-15',
  session: 'morning',
  facultyId: user.id
});
```

---

## 🔐 Access Control

| User | Can Do | Status |
|------|--------|--------|
| Faculty | Mark, Submit | Draft → Submitted |
| Admin | Review, Approve, Reject, Publish | All statuses |
| Parent | View published only | Published only |

---

## 📊 Attendance Status States

```
┌─────────────────┐
│     DRAFT       │  ← Faculty marking
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   SUBMITTED     │  ← Waiting for admin review
└────┬────────┬───┘
     │        │
   ✅ │        │ ❌
     ↓        ↓
 ┌────────┐ ┌─────────┐
 │APPROVED│ │REJECTED │  ← Faculty resubmits
 └───┬────┘ └─────────┘
     │
     ↓
 ┌─────────────────┐
 │   PUBLISHED     │  ← Parents can see
 └─────────────────┘
```

---

## 🧪 Quick Test Checklist

### Setup
- [ ] Run `pnpm install`
- [ ] Run migration: `supabase db push`
- [ ] Start dev server: `cd apps/web && pnpm dev`

### Faculty Test
- [ ] Login as faculty
- [ ] Mark attendance for today
- [ ] Click "Submit for Review"
- [ ] Verify status changed to "Submitted"

### Admin Test
- [ ] Login as admin
- [ ] Go to `/admin/attendance-approval`
- [ ] See pending submissions
- [ ] Click expand to see details
- [ ] Click "Approve" or "Reject"
- [ ] For approved: Click "Publish"

### Parent Test
- [ ] Login as parent
- [ ] Go to `/parent/attendance`
- [ ] Verify only published records show
- [ ] Check present/absent count

---

## 🐛 Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Cannot see approval page | No admin role | Check profiles.role = 'admin' |
| Cannot submit attendance | Faculty not assigned to batch | Add in batch assignments |
| Parents see no data | Not published | Admin needs to publish |
| Approval buttons disabled | Wrong status | Check approval_status value |
| Migration fails | Constraint conflict | Backup data, then apply |

---

## 📁 File Structure

```
apps/web/src/
├── features/
│   ├── admin/
│   │   └── pages/
│   │       ├── AttendancePage.tsx (existing - mark)
│   │       └── AttendanceApprovalPage.tsx ⭐ NEW
│   ├── faculty/
│   │   └── pages/
│   │       └── FacultyAttendancePage.tsx (updated)
│   └── parent/
│       └── pages/
│           └── ParentAttendancePage.tsx (updated)
├── hooks/
│   └── useAttendance.ts (updated - added 8 new hooks)
├── router/
│   └── index.tsx (updated - added route)
└── components/
    └── Sidebar.tsx (updated - added nav item)

supabase/
└── migrations/
    └── 023_attendance_workflow.sql ⭐ NEW
```

---

## 🔗 Important Links

- **Full Implementation Plan:** `ATTENDANCE_SYSTEM_PLAN.md`
- **Implementation Summary:** `ATTENDANCE_IMPLEMENTATION_SUMMARY.md`
- **Database Migration:** `supabase/migrations/023_attendance_workflow.sql`
- **Approval Page:** `apps/web/src/features/admin/pages/AttendanceApprovalPage.tsx`

---

## ⏱️ Time Estimates (if you need to estimate further work)

| Task | Hours |
|------|-------|
| Database migration | 1-2 |
| Hook implementation | 2-3 |
| Admin approval page | 3-4 |
| Component updates | 2-3 |
| Testing | 3-4 |
| Bug fixes | 2-3 |
| Documentation | 1-2 |
| **Total** | **15-22** |

---

## 🎓 Learning Resources

- Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security
- React Query: https://tanstack.com/query/latest
- TypeScript: https://www.typescriptlang.org/docs/

---

## ✅ Implementation Status

- ✅ Database schema & migration
- ✅ RLS policies
- ✅ RPC functions
- ✅ React hooks (8 new)
- ✅ Admin approval page
- ✅ Faculty submit feature
- ✅ Parent visibility filter
- ✅ Router & navigation
- ✅ Type safety

**Overall Progress: 100%**

**Ready for:** Testing → UAT → Production

---

## 🎯 Next Steps

1. **Apply Migration**
   ```bash
   supabase db push
   ```

2. **Test Workflow**
   - Faculty: Mark & submit
   - Admin: Review & approve
   - Parent: Verify visibility

3. **Deploy to Production**
   - Set environment variables
   - Run migration on prod database
   - Monitor logs

4. **User Training**
   - Share workflows with faculty/admin/parents
   - Provide access to support

---

## 📞 Support

For issues, refer to:
1. Check the troubleshooting section above
2. Review `ATTENDANCE_IMPLEMENTATION_SUMMARY.md` for detailed info
3. Check RLS policies in the migration file
4. Verify RPC function results in Supabase dashboard

---

**Version:** 1.0  
**Last Updated:** May 2026  
**Status:** ✅ Ready for Production
