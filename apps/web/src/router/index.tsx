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
import { ParentsPage } from '@/features/admin/pages/ParentsPage';
import { AuditLogPage } from '@/features/admin/pages/AuditLogPage';
import { AdminStudentsPage } from '@/features/admin/pages/AdminStudentsPage';
import { AdminTestsPage } from '@/features/admin/pages/AdminTestsPage';

import { FacultyDashboardPage } from '@/features/faculty/pages/FacultyDashboardPage';
import { StudentsPage } from '@/features/faculty/pages/StudentsPage';
import { TestsPage } from '@/features/faculty/pages/TestsPage';
import { MarksEntryPage } from '@/features/faculty/pages/MarksEntryPage';
import { RankingsPage } from '@/features/faculty/pages/RankingsPage';
import { FacultyAnalyticsPage } from '@/features/faculty/pages/FacultyAnalyticsPage';

import { ParentDashboardPage } from '@/features/parent/pages/ParentDashboardPage';
import { ParentProfilePage } from '@/features/parent/pages/ParentProfilePage';
import { TestDetailPage } from '@/features/parent/pages/TestDetailPage';
import { ProgressPage } from '@/features/parent/pages/ProgressPage';
import { ReportsPage } from '@/features/parent/pages/ReportsPage';

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
        <Route path="students" element={<AdminStudentsPage />} />
        <Route path="tests" element={<AdminTestsPage />} />
        <Route path="tests/:id/marks" element={<MarksEntryPage />} />
        <Route path="tests/:id/rankings" element={<RankingsPage />} />
        <Route path="parents" element={<ParentsPage />} />
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
        <Route path="students" element={<StudentsPage />} />
        <Route path="tests" element={<TestsPage />} />
        <Route path="tests/:id/marks" element={<MarksEntryPage />} />
        <Route path="tests/:id/rankings" element={<RankingsPage />} />
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
        <Route path="progress" element={<ProgressPage />} />
        <Route path="reports" element={<ReportsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
