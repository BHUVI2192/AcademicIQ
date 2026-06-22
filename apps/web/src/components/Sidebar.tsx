import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  ClipboardList,
  Building2,
  Calendar,
  ScrollText,
  UserCog,
  TrendingUp,
  FileText,
  X,
  Menu,
  BookOpen,
  BarChart3,
  LineChart,
  User,
  UserCheck,
  Shield,
  PenTool,
  DollarSign,
} from 'lucide-react';
import type { Role } from '@shared';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const ADMIN_NAV: NavItem[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/colleges', label: 'Colleges', icon: Building2 },
  { to: '/admin/academic-years', label: 'Academic Years', icon: Calendar },
  { to: '/admin/batches', label: 'Batches', icon: GraduationCap },
  { to: '/admin/faculty', label: 'Faculty', icon: UserCog },
  { to: '/admin/permissions', label: 'Permissions', icon: Shield },
  { to: '/admin/students', label: 'Students', icon: Users },
  { to: '/admin/attendance', label: 'Attendance', icon: UserCheck },
  { to: '/admin/attendance-approval', label: 'Attendance Approval', icon: ClipboardList },
  { to: '/admin/fees-approval', label: 'Fees Approval', icon: DollarSign },
  { to: '/admin/tests', label: 'Tests', icon: ClipboardList },
  { to: '/admin/marks-entry', label: 'Marks Entry', icon: PenTool },
  { to: '/admin/parents', label: 'Parents', icon: BookOpen },
  { to: '/admin/audit', label: 'Audit Log', icon: ScrollText },
];

const FACULTY_NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/faculty/dashboard' },
  { label: 'Analytics', icon: BarChart3, to: '/faculty/analytics' },
  { label: 'Students', icon: Users, to: '/faculty/students' },
  { label: 'Attendance', icon: UserCheck, to: '/faculty/attendance' },
  { label: 'Fees', icon: DollarSign, to: '/faculty/fees' },
  { label: 'Tests', icon: BookOpen, to: '/faculty/tests' },
];

const PARENT_NAV = [
  { label: 'Overview', icon: LayoutDashboard, to: '/parent/dashboard' },
  { label: 'Performance', icon: LineChart, to: '/parent/progress' },
  { label: 'Attendance', icon: UserCheck, to: '/parent/attendance' },
  { label: 'Fees', icon: DollarSign, to: '/parent/fees' },
  { label: 'Reports', icon: ClipboardList, to: '/parent/reports' },
  { label: 'Profile', icon: User, to: '/parent/profile' },
];

interface SidebarProps {
  role: Role;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function SidebarContent({ role, onClose }: { role: Role; onClose?: () => void }) {
  const items =
    role === 'admin' ? ADMIN_NAV : role === 'faculty' ? FACULTY_NAV : PARENT_NAV;

  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div>
            <div className="text-base font-medium tracking-tight text-slate-900 dark:text-white">
              AcademeIQ
            </div>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>



      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-medium'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* System Status */}
      <div className="mt-auto px-6 py-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-md bg-emerald-500" />
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">System Secure</span>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ role, mobileOpen, onMobileClose }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <SidebarContent role={role} />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/20 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 transition-transform duration-300 ease-in-out lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarContent role={role} onClose={onMobileClose} />
      </aside>
    </>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Open menu"
      className="p-2 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 lg:hidden"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
