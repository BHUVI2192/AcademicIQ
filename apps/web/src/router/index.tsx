import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { RequireAuth } from './RequireAuth';
import { RequireRole } from './RequireRole';

import { LandingPage } from '@/features/landing/LandingPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { OtpVerifyPage } from '@/features/auth/OtpVerifyPage';
import { PendingVerificationPage } from '@/features/auth/PendingVerificationPage';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { ChildSelectorPage } from '@/features/auth/ChildSelectorPage';

import { AdminDashboardPage } from '@/features/admin/pages/AdminDashboardPage';
import { CollegesPage } from '@/features/admin/pages/CollegesPage';
import { AcademicYearsPage } from '@/features/admin/pages/AcademicYearsPage';
import { DepartmentsPage } from '@/features/admin/pages/DepartmentsPage';
import { BatchesPage } from '@/features/admin/pages/BatchesPage';
import { FacultyPage } from '@/features/admin/pages/FacultyPage';
import { PermissionsPage } from '@/features/admin/pages/PermissionsPage';
import { ParentLinkingPage } from '@/features/admin/pages/ParentLinkingPage';
import { AuditLogPage } from '@/features/admin/pages/AuditLogPage';
import { AdminStudentsPage } from '@/features/admin/pages/AdminStudentsPage';
import { AdminTestsPage } from '@/features/admin/pages/AdminTestsPage';
import { AdminMarksEntryPage } from '@/features/admin/pages/AdminMarksEntryPage';
import { MarksApprovalPage } from '@/features/admin/pages/MarksApprovalPage';
import { AttendancePage } from '@/features/admin/pages/AttendancePage';
import { AdminAttendanceApprovalPage } from '@/features/admin/pages/AttendanceApprovalPage';
import { AdminFeesApprovalPage } from '@/features/admin/pages/AdminFeesApprovalPage';

import { FacultyDashboardPage } from '@/features/faculty/pages/FacultyDashboardPage';
import { StudentsPage } from '@/features/faculty/pages/StudentsPage';
import { TestsPage } from '@/features/faculty/pages/TestsPage';
import { MarksEntryPage } from '@/features/faculty/pages/MarksEntryPage';
import { RankingsPage } from '@/features/faculty/pages/RankingsPage';
import { FacultyAnalyticsPage } from '@/features/faculty/pages/FacultyAnalyticsPage';
import { FacultyFeesPage } from '@/features/faculty/pages/FacultyFeesPage';
import { FacultyAttendancePage } from '@/features/faculty/pages/FacultyAttendancePage';

import { ParentDashboardPage } from '@/features/parent/pages/ParentDashboardPage';
import { ParentProfilePage } from '@/features/parent/pages/ParentProfilePage';
import { TestDetailPage } from '@/features/parent/pages/TestDetailPage';
import { ProgressPage } from '@/features/parent/pages/ProgressPage';
import { ReportsPage } from '@/features/parent/pages/ReportsPage';
import { ParentFeesPage } from '@/features/parent/pages/ParentFeesPage';
import { ParentAttendancePage } from '@/features/parent/pages/ParentAttendancePage';

import { RequireFacultyPermission } from './RequireFacultyPermission';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify-otp" element={<OtpVerifyPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/analytics" element={<Navigate to="/faculty/analytics" replace />} />

      {/* Admin Login */}
      <Route path="/admin/login" element={<LoginPage isAdminView={true} />} />

      <Route
        path="/parent/pending"
        element={
          <RequireAuth>
            <RequireRole role="parent">
              <PendingVerificationPage />
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/parent/select-child"
        element={
          <RequireAuth>
            <RequireRole role="parent">
              <ChildSelectorPage />
            </RequireRole>
          </RequireAuth>
        }
      />

      {/* Admin Dashboard */}
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <RequireRole role="admin">
              <Layout />
            </RequireRole>
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="colleges" element={<CollegesPage />} />
        <Route path="academic-years" element={<AcademicYearsPage />} />
        <Route path="departments" element={<DepartmentsPage />} />
        <Route path="batches" element={<BatchesPage />} />
        <Route path="faculty" element={<FacultyPage />} />
        <Route path="permissions" element={<PermissionsPage />} />
        <Route path="parent-linking" element={<ParentLinkingPage />} />
        <Route path="students" element={<AdminStudentsPage />} />
        <Route path="tests" element={<AdminTestsPage />} />
        <Route path="marks-entry" element={<AdminMarksEntryPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="attendance-approval" element={<AdminAttendanceApprovalPage />} />
        <Route path="fees-approval" element={<AdminFeesApprovalPage />} />
        <Route path="tests/:id/marks" element={<MarksEntryPage />} />
        <Route path="tests/:id/rankings" element={<RankingsPage />} />
        <Route path="rankings" element={<RankingsPage />} />
        <Route path="marks-approval" element={<MarksApprovalPage />} />
        <Route path="audit" element={<AuditLogPage />} />
      </Route>

      {/* Faculty */}
      <Route
        path="/faculty"
        element={
          <RequireAuth>
            <RequireRole role="faculty">
              <Layout />
            </RequireRole>
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/faculty/dashboard" replace />} />
        <Route path="analytics" element={<FacultyAnalyticsPage />} />
        <Route path="dashboard" element={<FacultyDashboardPage />} />
        <Route
          path="students"
          element={
            <RequireFacultyPermission permission="can_add_students">
              <StudentsPage />
            </RequireFacultyPermission>
          }
        />
        <Route
          path="attendance"
          element={
            <RequireFacultyPermission permission="can_manage_attendance">
              <FacultyAttendancePage />
            </RequireFacultyPermission>
          }
        />
        <Route
          path="fees"
          element={
            <RequireFacultyPermission permission="can_manage_fees">
              <FacultyFeesPage />
            </RequireFacultyPermission>
          }
        />
        <Route path="tests" element={<TestsPage />} />
        <Route path="tests/:id/marks" element={<MarksEntryPage />} />
        <Route path="tests/:id/rankings" element={<RankingsPage />} />
        <Route path="rankings" element={<RankingsPage />} />
      </Route>

      {/* Parent */}
      <Route
        path="/parent"
        element={
          <RequireAuth>
            <RequireRole role="parent">
              <Layout />
            </RequireRole>
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/parent/dashboard" replace />} />
        <Route path="dashboard" element={<ParentDashboardPage />} />
        <Route path="profile" element={<ParentProfilePage />} />
        <Route path="tests/:testId" element={<TestDetailPage />} />
        <Route path="tests/:id/rankings" element={<RankingsPage />} />
        <Route path="rankings" element={<RankingsPage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="fees" element={<ParentFeesPage />} />
        <Route path="attendance" element={<ParentAttendancePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
