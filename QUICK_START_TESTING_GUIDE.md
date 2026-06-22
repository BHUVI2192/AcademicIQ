# AcademicIQ Platform - Quick Start Testing Guide

## 🎯 Overview

This guide will help you test all three user roles (Admin, Faculty, Parent) on the AcademicIQ platform running on http://localhost:5173.

---

## 🚀 Getting Started

### Prerequisites
- ✅ Dev server running (`pnpm dev`)
- ✅ Supabase local environment setup
- ✅ Database migrations applied
- ✅ Test data seeded

### Access URLs
- **Landing Page**: http://localhost:5173/
- **Admin Login**: http://localhost:5173/admin/login
- **Faculty/Parent Login**: http://localhost:5173/login

---

## 👨‍💼 ADMIN FLOW - Step by Step

### Step 1: Admin Login
1. Navigate to http://localhost:5173/admin/login
2. **Email**: `admin@academeiq.com`
3. **Password**: `Admin@123` (or your test credentials)
4. Click "Sign In"
5. **Expected**: Redirect to `/admin/dashboard`

### Step 2: Explore Dashboard
- View statistics: Faculty count, batches, students, tests, parents
- Check quick-action panels
- Review metrics

### Step 3: Create College (if needed)
1. Navigate to **Admin** → **Colleges**
2. Click **"New College"**
3. **College Name**: "Test Engineering College"
4. **College Code**: "TEC001"
5. Click **Save**
6. **Expected**: College appears in list

### Step 4: Create Academic Year
1. Go to **Admin** → **Academic Years**
2. Click **"New Academic Year"**
3. **Label**: "2024-2025"
4. **Start Date**: 2024-06-01
5. **End Date**: 2025-05-31
6. **Mark as Current**: ✓ (only one per college)
7. Click **Save**

### Step 5: Create Department
1. Go to **Admin** → **Departments**
2. Click **"New Department"**
3. **Name**: "Engineering - PCM"
4. **College**: Select "Test Engineering College"
5. **Code**: "PCM"
6. Click **Save**

### Step 6: Create Batch
1. Go to **Admin** → **Batches**
2. Click **"New Batch"**
3. **Batch Name**: "Class 11 PCM - A"
4. **Batch Code**: "11A"
5. **Semester**: 1
6. **College**: "Test Engineering College"
7. **Department**: "Engineering - PCM"
8. **Academic Year**: "2024-2025"
9. Click **Save**

### Step 7: Create Faculty
1. Go to **Admin** → **Faculty**
2. Click **"New Faculty"**
3. **Full Name**: "Dr. Rajesh Kumar"
4. **Email**: `rajesh@academeiq.com`
5. **College**: "Test Engineering College"
6. Click **Save**
7. **Expected**: Faculty gets auto-generated password (show message)
8. **Note**: Check if email notification sent

### Step 8: Assign Faculty to Batch
1. Still in **Faculty** page
2. Find "Dr. Rajesh Kumar"
3. Click **"Manage Batches"**
4. Select **"Class 11 PCM - A"**
5. Click **Save**
6. **Expected**: Faculty now visible in batch details

### Step 9: Grant Permissions
1. Go to **Admin** → **Permissions**
2. Find "Dr. Rajesh Kumar"
3. Toggle permissions:
   - ✓ Can Add Students
   - ✓ Can Manage Attendance
   - ✓ Can Manage Fees
4. Click **Save**
5. **Expected**: Permissions updated

### Step 10: Create Students
1. Go to **Admin** → **Students**
2. Click **"New Student"**
3. **Roll Number**: "001"
4. **Full Name**: "Aditya Sharma"
5. **Date of Birth**: 2007-06-15
6. **Exam Wing**: "JEE Mains"
7. **Batch**: "Class 11 PCM - A"
8. Click **Save**
9. **Repeat 2-3 times** to create more students

### Step 11: Bulk Import Students (Optional)
1. Go to **Admin** → **Students**
2. Click **"Bulk Import"**
3. Download template (CSV)
4. Fill in student data:
   ```
   Roll Number, Full Name, Date of Birth, Exam Wing, Batch
   001, Aditya Sharma, 2007-06-15, JEE Mains, Class 11 PCM - A
   002, Priya Singh, 2007-07-20, JEE Advanced, Class 11 PCM - A
   003, Rohan Kumar, 2007-05-10, NEET, Class 11 PCM - A
   ```
5. Upload CSV
6. Click **Import**
7. **Expected**: Students imported, duplicates handled

### Step 12: Create Test
1. Go to **Admin** → **Tests**
2. Click **"New Test"**
3. **Test Name**: "Daily Test - Physics"
4. **Exam Type**: "Daily Test"
5. **Date**: Today
6. **Duration**: 60 minutes
7. **Max Marks**: 100
8. **Batch**: "Class 11 PCM - A"
9. Click **Save**
10. **Expected**: Test created, status = "Draft"

### Step 13: Enter Marks (Admin)
1. Still in **Tests** page
2. Click on test created above
3. Click **"Enter Marks"**
4. For each student, enter marks:
   - Aditya Sharma: 78
   - Priya Singh: 85
   - Rohan Kumar: 92
5. Click **Save**
6. **Note**: Marks status = "Draft"

### Step 14: Submit for Approval
1. Still in marks entry
2. Click **"Submit for Approval"**
3. **Expected**: Status changes to "Submitted"

### Step 15: Approve Marks
1. Go to **Admin** → **Marks Approval**
2. View pending marks submissions
3. Click on the test submission
4. Click **"Approve All Marks"**
5. Add optional remarks: "Verified and approved"
6. Click **Confirm**
7. **Expected**: Status changes to "Approved"

### Step 16: Publish Marks
1. Still in marks approval
2. Click **"Publish Marks"**
3. **Expected**: Parents can now see marks
4. Check notification (if implemented)

### Step 17: Mark Attendance
1. Go to **Admin** → **Attendance**
2. **Select Batch**: "Class 11 PCM - A"
3. **Select Date**: Today
4. Mark attendance:
   - ✓ Aditya Sharma - Present
   - ✓ Priya Singh - Present
   - ✗ Rohan Kumar - Absent
5. Click **Save**

### Step 18: Approve Attendance
1. Go to **Admin** → **Attendance Approval**
2. Review pending attendance records
3. Click **"Approve"**
4. Click **"Publish Attendance"**
5. **Expected**: Parents can view attendance

### Step 19: Create Parent & Link Student
1. Go to **Admin** → **Parent Linking**
2. Click **"Create & Link Parent"**
3. **Parent Name**: "Mrs. Sharma"
4. **Email**: `mother_aditya@email.com`
5. **Phone**: +91-9876543210
6. **Select Student**: Aditya Sharma
7. Click **Send Linking Request**
8. **Expected**: Parent gets phone OTP link
9. **Status**: Pending Verification

### Step 20: Audit Log
1. Go to **Admin** → **Audit Log**
2. View all activities:
   - Create student
   - Marks submitted
   - Marks approved
   - Attendance marked
3. Filter by date range
4. Filter by action type
5. **Expected**: Immutable log of all actions

---

## 👨‍🏫 FACULTY FLOW - Step by Step

### Step 1: Faculty Login
1. Navigate to http://localhost:5173/login
2. **Email**: `rajesh@academeiq.com`
3. **Password**: (use auto-generated password from admin)
4. Click "Sign In"
5. **Expected**: Redirect to `/faculty/dashboard`

### Step 2: Explore Dashboard
- View assigned batches
- View student count
- View recent tests
- Quick links to manage batches

### Step 3: View Students
1. Navigate to **Faculty** → **Students**
2. **Select Batch**: "Class 11 PCM - A"
3. View student list:
   - Aditya Sharma
   - Priya Singh
   - Rohan Kumar
4. Click on a student to view details
5. **Expected**: Cannot see marks (RLS protection)

### Step 4: Create Test
1. Navigate to **Faculty** → **Tests**
2. Click **"New Test"**
3. **Test Name**: "Chemistry Mock Test"
4. **Exam Type**: "JEE Mains"
5. **Date**: 2024-06-25
6. **Duration**: 90 minutes
7. **Max Marks**: 300
8. **Batch**: "Class 11 PCM - A"
9. Click **Save**
10. **Expected**: Test created with status = "Draft"

### Step 5: Enter Marks (Faculty)
1. Still in **Tests**
2. Click on test just created
3. Click **"Enter Marks"**
4. Enter marks for students:
   - Manual entry (validate ≤ max marks)
   - Aditya: 245 marks
   - Priya: 280 marks
   - Rohan: 220 marks
5. **Note**: System auto-calculates percentages
6. Click **Save as Draft**

### Step 6: Upload Marks via CSV (Optional)
1. Still in marks entry
2. Click **"Upload CSV"**
3. Download template
4. Fill in marks and upload
5. **Expected**: Marks bulk imported

### Step 7: Mark Absent
1. Still in marks entry
2. For a student (e.g., Rohan)
3. Check **"Absent"** checkbox
4. Click **Save**
5. **Expected**: Mark shows as "Absent", no score

### Step 8: Submit Marks
1. Still in marks entry
2. Click **"Submit for Approval"**
3. **Expected**: Status changes to "Submitted for Admin Approval"
4. Cannot edit marks after submission

### Step 9: View Submission Status
1. Go to **Faculty** → **Tests**
2. View test status: "Submitted" (orange badge)
3. Click test to see approval status
4. **Note**: Wait for admin approval

### Step 10: View Rejection (if rejected)
1. If admin rejects marks
2. Marks entry shows **"Rejected"** status
3. Display admin remarks
4. Click **"Re-submit Marks"** to fix and resubmit

### Step 11: Track Attendance
1. Navigate to **Faculty** → **Attendance**
2. **Select Batch**: "Class 11 PCM - A"
3. **Select Date**: Today
4. Mark attendance
5. Click **Save**
6. **Expected**: Pending admin approval

### Step 12: View Rankings
1. Navigate to **Faculty** → **Tests**
2. Click on a published test
3. Click **"View Rankings"**
4. See student rankings by score
5. Percentile and rank display

### Step 13: View Analytics
1. Navigate to **Faculty** → **Analytics**
2. View test performance metrics
3. See student performance trends
4. Compare across tests

---

## 👨‍👩‍👧 PARENT FLOW - Step by Step

### Step 1: Parent Phone OTP Verification
1. Navigate to http://localhost:5173/login (not `/admin/login`)
2. Choose **"Parent Login"**
3. **Phone Number**: +91-9876543210 (from earlier)
4. Click **"Send OTP"**
5. **Expected**: OTP sent (in dev, check Supabase logs)
6. Enter OTP (dev mode usually shows 000000 or check console)
7. Click **"Verify"**

### Step 2: Pending Verification
1. After OTP verification
2. **Expected**: Redirect to **"/parent/pending"**
3. Display message: "Account pending verification by college admin"
4. **Note**: Parent cannot proceed until admin verifies

### Step 3: Admin Approves Parent (Back to Admin)
1. Go back to **Admin** → **Parent Linking**
2. Find "Mrs. Sharma" with status "Pending Verification"
3. Click **"Approve"**
4. **Expected**: Parent linking approved

### Step 4: Parent Login Again
1. Navigate to http://localhost:5173/login
2. **Phone Number**: +91-9876543210
3. **Send OTP** → Verify
4. **Expected**: Redirect to **"/parent/select-child"** or **"/parent/dashboard"**

### Step 5: Select Child (if multiple)
1. If multiple children linked
2. See dropdown: Select child
3. Choose **"Aditya Sharma"**
4. Click **"View Dashboard"**
5. **Expected**: Redirect to **"/parent/dashboard"** for Aditya

### Step 6: Parent Dashboard
1. View child's information:
   - Name: Aditya Sharma
   - Attendance percentage: (calculated from records)
   - Recent scores
   - Fees status
   - Rankings
2. View quick action cards

### Step 7: View Progress/Performance Trends
1. Navigate to **Parent** → **Progress**
2. See line chart of scores over tests
3. Filter by exam type (JEE, NEET, KCET, Daily)
4. Hover over data points to see scores
5. Analyze trends (improvement/decline)

### Step 8: View Test Details
1. Navigate to **Parent** → **Dashboard**
2. Click on a recent test result
3. **Expected**: Redirect to **"/parent/tests/{testId}"**
4. View:
   - Score obtained
   - Max marks
   - Percentage
   - Rank in class
   - Percentile
   - Subject-wise breakdown (if available)

### Step 9: View Rankings/Comparison
1. On test detail page
2. Scroll down to see rankings
3. View child's rank among classmates
4. Percentile score
5. **Important**: Parent sees ONLY published marks (RLS enforced)

### Step 10: View Attendance
1. Navigate to **Parent** → **Attendance**
2. View attendance percentage: "Present in X out of Y classes"
3. See daily attendance records (grid or calendar)
4. Filter by date range
5. Visual representation (present/absent)

### Step 11: View Fees
1. Navigate to **Parent** → **Fees**
2. View all fees due:
   - Amount: ₹50,000
   - Status: "Pending"
   - Due Date: 2024-07-31
3. Click on fee to see details
4. **Note**: Payment button (if integrated with Razorpay/Stripe)

### Step 12: Download Report
1. Navigate to **Parent** → **Reports**
2. Click **"Generate Report"**
3. Select data to include:
   - Scores
   - Attendance
   - Fees
   - Remarks
4. Click **"Download as PDF"**
5. **Expected**: PDF with comprehensive report

### Step 13: Change Password
1. Navigate to **Parent** → **Profile**
2. Click **"Change Password"**
3. **Current Password**: (temporary password)
4. **New Password**: Enter strong password
5. **Confirm Password**: Repeat password
6. Click **"Change"**
7. **Expected**: Password updated, re-login required

### Step 14: Logout
1. Click **"Logout"** (top right)
2. **Expected**: Clear session, redirect to login

---

## ✅ VERIFICATION CHECKLIST

### Security Checks
- [ ] Admin cannot see faculty marks entry interface
- [ ] Faculty cannot access parent data
- [ ] Parent sees ONLY published marks (not submitted/draft)
- [ ] Parent attendance data matches marked attendance
- [ ] Audit log shows all actions

### Data Integrity Checks
- [ ] Marks ≤ max marks validation works
- [ ] Duplicate student roll numbers prevented
- [ ] Batch cannot be deleted if students exist
- [ ] Test date validation (cannot create past tests)
- [ ] Attendance marks (0-1 or Present/Absent)

### Workflow Checks
- [ ] Marks: Draft → Submitted → Approved → Published
- [ ] Attendance: Marked → Submitted → Approved → Published
- [ ] Parent: Created → Pending → Approved → Verified
- [ ] Faculty assignment persists across sessions

### Performance Checks
- [ ] Dashboard loads in < 2 seconds
- [ ] Bulk import processes 1000 students
- [ ] Marks entry smooth for 100+ students
- [ ] Charts render without lag

### Browser Checks
- [ ] Test on Chrome
- [ ] Test on Firefox
- [ ] Test on Safari (if Mac)
- [ ] Responsive design (mobile view with DevTools)

---

## 🐛 COMMON ISSUES & FIXES

| Issue | Cause | Solution |
|-------|-------|----------|
| Parent cannot login | Not approved by admin | Go to Admin → Parent Linking → Approve |
| Faculty cannot see batches | Not assigned to batch | Go to Admin → Faculty → Assign batches |
| Marks not submitting | Status already submitted | Refresh page, check for validation errors |
| Attendance not saving | RLS policy blocking | Verify college_id is set in session |
| Charts not loading | Missing data | Ensure at least 3 tests with marks submitted |
| CSV import fails | Format mismatch | Use downloaded template, check column headers |

---

## 📞 TEST DATA CREDENTIALS

```
Admin:
  Email: admin@academeiq.com
  Password: Admin@123

Faculty:
  Email: rajesh@academeiq.com
  Password: (auto-generated, shown after creation)

Parent (Phone OTP):
  Phone: +91-9876543210
  OTP: (check Supabase logs or use test value)
```

---

## 🎯 TEST SCENARIOS

### Scenario 1: Full Workflow (Admin → Faculty → Parent)
1. Admin creates college/batch
2. Admin creates faculty & assigns to batch
3. Admin creates students
4. Admin creates test
5. Faculty enters marks → Submits
6. Admin approves marks
7. Parent views published marks

**Expected Result**: ✅ Parent sees ranks, no raw marks

### Scenario 2: Marks Rejection
1. Faculty submits marks
2. Admin rejects with remarks
3. Faculty fixes and resubmits
4. Admin approves

**Expected Result**: ✅ Audit log shows both submissions

### Scenario 3: Multi-child Parent
1. Admin creates 2 students for same parent
2. Parent links both children
3. Parent selects child A → views marks
4. Parent switches to child B → views different marks

**Expected Result**: ✅ Data correctly isolated per child

### Scenario 4: Attendance Workflow
1. Faculty marks attendance
2. Admin reviews and publishes
3. Parent views attendance %

**Expected Result**: ✅ Attendance % calculates correctly

---

## 📊 EXPECTED RESULTS BY ROLE

### Admin Dashboard Stats
- Total Faculty: 1+
- Total Batches: 1+
- Total Students: 3+
- Published Tests: 1+ (after publish)
- Active Parents: 1+ (after approval)

### Faculty Dashboard
- Assigned Batches: 1+
- Total Students: 3+
- Recent Tests: 1+ (created in last session)

### Parent Dashboard
- Child Selected: 1 (Aditya Sharma)
- Attendance %: 67% (2 present out of 3)
- Recent Scores: 2+ (from published tests)
- Fees Status: Pending (if created)

---

**Test Date**: 2026-06-21
**Platform**: AcademicIQ v1.0
**Status**: MVP Testing Guide
