'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { getLocalDateString } from '@/lib/date-utils';
import {
  Users,
  UserCheck,
  UserX,
  IndianRupee,
  Plus,
  CalendarCheck,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Edit2,
  Trash2,
  AlertCircle,
  Building2,
  Phone,
  Shield,
  Briefcase,
  ChevronRight,
  LogOut,
  LogIn,
} from 'lucide-react';
import {
  StaffMemberDto,
  StaffAttendanceDto,
  StaffSummaryDto,
  StaffAttendanceStatus,
} from '@propertyos/types';

interface PropertyOption {
  id: string;
  name: string;
}

export default function StaffManagementPage() {
  const [activeTab, setActiveTab] = useState<'DIRECTORY' | 'ATTENDANCE'>('DIRECTORY');

  // Staff Directory State
  const [staffList, setStaffList] = useState<StaffMemberDto[]>([]);
  const [summary, setSummary] = useState<StaffSummaryDto | null>(null);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState('');
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('all');

  // Attendance State
  const [attendanceRecords, setAttendanceRecords] = useState<StaffAttendanceDto[]>([]);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [attendanceDateFilter, setAttendanceDateFilter] = useState(() => {
    return getLocalDateString();
  });
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<string>('all');

  // Modals
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [isEditStaffOpen, setIsEditStaffOpen] = useState(false);
  const [isLogAttendanceOpen, setIsLogAttendanceOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMemberDto | null>(null);

  // Form States
  const [staffForm, setStaffForm] = useState({
    name: '',
    roleTitle: '',
    phone: '',
    salaryMonthly: '',
    joinedDate: getLocalDateString(),
    propertyId: '',
    isActive: true,
  });

  const [attendanceForm, setAttendanceForm] = useState({
    staffMemberId: '',
    date: getLocalDateString(),
    status: StaffAttendanceStatus.PRESENT,
    checkInTime: '',
    checkOutTime: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch Summary
  const fetchSummary = useCallback(async () => {
    setIsLoadingSummary(true);
    try {
      const res = await fetch('/api/v1/staff/summary');
      if (res.ok) {
        const json = await res.json();
        setSummary(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch staff summary', err);
    } finally {
      setIsLoadingSummary(false);
    }
  }, []);

  // Fetch Properties
  const fetchProperties = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/properties');
      if (res.ok) {
        const json = await res.json();
        const data = Array.isArray(json.data) ? json.data : json.data?.data || [];
        setProperties(data.map((p: any) => ({ id: p.id, name: p.name })));
      }
    } catch (err) {
      console.error('Failed to fetch properties', err);
    }
  }, []);

  // Fetch Staff
  const fetchStaff = useCallback(async () => {
    setIsLoadingStaff(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (selectedPropertyFilter) params.set('propertyId', selectedPropertyFilter);
      if (activeStatusFilter !== 'all') {
        params.set('isActive', activeStatusFilter === 'active' ? 'true' : 'false');
      }

      const res = await fetch(`/api/v1/staff?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json.data) ? json.data : json.data?.data || [];
        setStaffList(list);
      }
    } catch (err) {
      console.error('Failed to fetch staff list', err);
    } finally {
      setIsLoadingStaff(false);
    }
  }, [searchQuery, selectedPropertyFilter, activeStatusFilter]);

  // Fetch Attendance
  const fetchAttendance = useCallback(async () => {
    setIsLoadingAttendance(true);
    try {
      const params = new URLSearchParams();
      if (attendanceDateFilter) params.set('date', attendanceDateFilter);
      if (selectedPropertyFilter) params.set('propertyId', selectedPropertyFilter);
      if (attendanceStatusFilter !== 'all') params.set('status', attendanceStatusFilter);

      const res = await fetch(`/api/v1/staff/attendance/records?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        const records = Array.isArray(json.data) ? json.data : json.data?.data || [];
        setAttendanceRecords(records);
      }
    } catch (err) {
      console.error('Failed to fetch attendance records', err);
    } finally {
      setIsLoadingAttendance(false);
    }
  }, [attendanceDateFilter, selectedPropertyFilter, attendanceStatusFilter]);

  useEffect(() => {
    fetchSummary();
    fetchProperties();
  }, [fetchSummary, fetchProperties]);

  useEffect(() => {
    if (activeTab === 'DIRECTORY') {
      fetchStaff();
    } else {
      fetchAttendance();
    }
  }, [activeTab, fetchStaff, fetchAttendance]);

  // Handle Staff Creation
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const payload: any = {
        name: staffForm.name,
        roleTitle: staffForm.roleTitle,
        phone: staffForm.phone,
        salaryMonthly: Number(staffForm.salaryMonthly) || 0,
        joinedDate: staffForm.joinedDate,
        isActive: staffForm.isActive,
      };
      if (staffForm.propertyId) payload.propertyId = staffForm.propertyId;

      const res = await fetch('/api/v1/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to create staff member');
      }

      setSuccessMessage('Staff member added successfully!');
      setIsAddStaffOpen(false);
      setStaffForm({
        name: '',
        roleTitle: '',
        phone: '',
        salaryMonthly: '',
        joinedDate: getLocalDateString(),
        propertyId: '',
        isActive: true,
      });
      fetchStaff();
      fetchSummary();
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Staff Edit
  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const payload: any = {
        name: staffForm.name,
        roleTitle: staffForm.roleTitle,
        phone: staffForm.phone,
        salaryMonthly: Number(staffForm.salaryMonthly) || 0,
        joinedDate: staffForm.joinedDate,
        isActive: staffForm.isActive,
        propertyId: staffForm.propertyId || null,
      };

      const res = await fetch(`/api/v1/staff/${selectedStaff.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to update staff member');
      }

      setSuccessMessage('Staff member updated successfully!');
      setIsEditStaffOpen(false);
      setSelectedStaff(null);
      fetchStaff();
      fetchSummary();
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Safe Deactivation
  const handleDeactivateStaff = async (staff: StaffMemberDto) => {
    if (!confirm(`Are you sure you want to deactivate ${staff.name}? Their attendance history will be preserved.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/staff/${staff.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSuccessMessage(`${staff.name} deactivated successfully.`);
        fetchStaff();
        fetchSummary();
      } else {
        const json = await res.json();
        alert(json.message || 'Failed to deactivate staff member');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Quick Check-In
  const handleQuickCheckIn = async (staffId: string) => {
    try {
      const res = await fetch('/api/v1/staff/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffMemberId: staffId,
          date: getLocalDateString(),
          status: StaffAttendanceStatus.PRESENT,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setSuccessMessage('Check-in recorded!');
        fetchSummary();
        if (activeTab === 'ATTENDANCE') fetchAttendance();
      } else {
        alert(json.message || 'Failed to check in');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Quick Check-Out
  const handleQuickCheckOut = async (staffId: string) => {
    try {
      const res = await fetch('/api/v1/staff/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffMemberId: staffId,
          date: getLocalDateString(),
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setSuccessMessage('Check-out recorded!');
        fetchSummary();
        if (activeTab === 'ATTENDANCE') fetchAttendance();
      } else {
        alert(json.message || 'Failed to check out');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Manual Attendance Submit
  const handleRecordAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const payload: any = {
        staffMemberId: attendanceForm.staffMemberId,
        date: attendanceForm.date,
        status: attendanceForm.status,
      };
      if (attendanceForm.checkInTime) {
        payload.checkInTime = `${attendanceForm.date}T${attendanceForm.checkInTime}:00Z`;
      }
      if (attendanceForm.checkOutTime) {
        payload.checkOutTime = `${attendanceForm.date}T${attendanceForm.checkOutTime}:00Z`;
      }

      const res = await fetch('/api/v1/staff/attendance/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to record attendance');
      }

      setSuccessMessage('Attendance recorded successfully!');
      setIsLogAttendanceOpen(false);
      fetchAttendance();
      fetchSummary();
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (staff: StaffMemberDto) => {
    setSelectedStaff(staff);
    setStaffForm({
      name: staff.name,
      roleTitle: staff.roleTitle,
      phone: staff.phone,
      salaryMonthly: String(staff.salaryMonthly),
      joinedDate: staff.joinedDate ? staff.joinedDate.split('T')[0] : '',
      propertyId: staff.propertyId || '',
      isActive: staff.isActive,
    });
    setIsEditStaffOpen(true);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Staff & Attendance Management"
          subtitle="Manage operational staff directory, property assignments, daily check-in/out, and monthly payroll."
          showBack={true}
          backHref="/"
          backLabel="Back to Dashboard"
          actions={
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setAttendanceForm({
                    staffMemberId: staffList[0]?.id || '',
                    date: getLocalDateString(),
                    status: StaffAttendanceStatus.PRESENT,
                    checkInTime: '09:00',
                    checkOutTime: '18:00',
                  });
                  setIsLogAttendanceOpen(true);
                }}
              >
                <CalendarCheck className="w-4 h-4 mr-2" />
                Log Attendance
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setStaffForm({
                    name: '',
                    roleTitle: '',
                    phone: '',
                    salaryMonthly: '',
                    joinedDate: getLocalDateString(),
                    propertyId: '',
                    isActive: true,
                  });
                  setIsAddStaffOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Staff Member
              </Button>
            </div>
          }
        />

        {/* Notifications */}
        {successMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-600 hover:text-emerald-800 font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Staff"
            value={isLoadingSummary ? '...' : String(summary?.totalStaff ?? 0)}
            subtext={`${summary?.activeStaff ?? 0} active, ${summary?.inactiveStaff ?? 0} inactive`}
            icon={Users}
            variant="default"
          />
          <StatCard
            label="Present Today"
            value={isLoadingSummary ? '...' : String(summary?.presentToday ?? 0)}
            subtext="Checked-in for duty today"
            icon={UserCheck}
            variant="emerald"
          />
          <StatCard
            label="Leave / Absent"
            value={
              isLoadingSummary
                ? '...'
                : String((summary?.onLeaveToday ?? 0) + (summary?.absentToday ?? 0))
            }
            subtext={`${summary?.onLeaveToday ?? 0} on leave, ${summary?.absentToday ?? 0} absent`}
            icon={UserX}
            variant="amber"
          />
          <StatCard
            label="Monthly Payroll"
            value={
              isLoadingSummary
                ? '...'
                : `₹${Number(summary?.totalMonthlyPayroll ?? 0).toLocaleString('en-IN')}`
            }
            subtext="Active staff salary commitment"
            icon={IndianRupee}
            variant="blue"
          />
        </div>

        {/* View Tabs */}
        <div className="border-b border-slate-200">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('DIRECTORY')}
              className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'DIRECTORY'
                  ? 'border-brand-teal text-brand-teal'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              Staff Directory ({staffList.length})
            </button>
            <button
              onClick={() => setActiveTab('ATTENDANCE')}
              className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'ATTENDANCE'
                  ? 'border-brand-teal text-brand-teal'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <CalendarCheck className="w-4 h-4" />
              Daily Attendance Roster
            </button>
          </div>
        </div>

        {/* TAB 1: STAFF DIRECTORY */}
        {activeTab === 'DIRECTORY' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex flex-1 items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by name, role, or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                  />
                </div>
                <select
                  value={selectedPropertyFilter}
                  onChange={(e) => setSelectedPropertyFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                >
                  <option value="">All Properties</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  value={activeStatusFilter}
                  onChange={(e) => setActiveStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>
            </div>

            {/* Staff Table */}
            {isLoadingStaff ? (
              <div className="p-12 text-center text-slate-500">Loading staff roster...</div>
            ) : staffList.length === 0 ? (
              <EmptyState
                title="No staff members found"
                description="Get started by registering your operational staff like wardens, security guards, cleaners, or cooks."
                icon={Users}
                actionLabel="Add Staff Member"
                onAction={() => setIsAddStaffOpen(true)}
              />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-3.5 px-4">Staff Member</th>
                        <th className="py-3.5 px-4">Role Title</th>
                        <th className="py-3.5 px-4">Assigned Property</th>
                        <th className="py-3.5 px-4">Phone</th>
                        <th className="py-3.5 px-4">Monthly Salary</th>
                        <th className="py-3.5 px-4">Joined Date</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {staffList.map((staff) => (
                        <tr key={staff.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">{staff.name}</div>
                            {staff.userEmail && (
                              <div className="text-xs text-slate-500">{staff.userEmail}</div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                              {staff.roleTitle}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {staff.propertyName ? (
                              <span className="flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                {staff.propertyName}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Organization-Wide</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            <span className="flex items-center gap-1.5 font-mono text-xs">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {staff.phone}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            ₹{Number(staff.salaryMonthly).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 text-xs">
                            {staff.joinedDate ? new Date(staff.joinedDate).toLocaleDateString('en-IN') : '-'}
                          </td>
                          <td className="py-3.5 px-4">
                            {staff.isActive ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {staff.isActive && (
                                <>
                                  <button
                                    onClick={() => handleQuickCheckIn(staff.id)}
                                    title="Quick Check-In Today"
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                  >
                                    <LogIn className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleQuickCheckOut(staff.id)}
                                    title="Quick Check-Out Today"
                                    className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                  >
                                    <LogOut className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => openEditModal(staff)}
                                title="Edit Staff Member"
                                className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {staff.isActive && (
                                <button
                                  onClick={() => handleDeactivateStaff(staff)}
                                  title="Deactivate Staff Member"
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DAILY ATTENDANCE ROSTER */}
        {activeTab === 'ATTENDANCE' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                  <input
                    type="date"
                    value={attendanceDateFilter}
                    onChange={(e) => setAttendanceDateFilter(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Property</label>
                  <select
                    value={selectedPropertyFilter}
                    onChange={(e) => setSelectedPropertyFilter(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                  >
                    <option value="">All Properties</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                  <select
                    value={attendanceStatusFilter}
                    onChange={(e) => setAttendanceStatusFilter(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                  >
                    <option value="all">All Statuses</option>
                    <option value={StaffAttendanceStatus.PRESENT}>Present</option>
                    <option value={StaffAttendanceStatus.HALF_DAY}>Half Day</option>
                    <option value={StaffAttendanceStatus.ABSENT}>Absent</option>
                    <option value={StaffAttendanceStatus.LEAVE}>On Leave</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Attendance Table */}
            {isLoadingAttendance ? (
              <div className="p-12 text-center text-slate-500">Loading attendance logs...</div>
            ) : attendanceRecords.length === 0 ? (
              <EmptyState
                title="No attendance records for this date"
                description="Record check-ins or log daily attendance for your operational staff."
                icon={CalendarCheck}
                actionLabel="Log Attendance"
                onAction={() => {
                  setAttendanceForm({
                    staffMemberId: staffList[0]?.id || '',
                    date: attendanceDateFilter,
                    status: StaffAttendanceStatus.PRESENT,
                    checkInTime: '09:00',
                    checkOutTime: '18:00',
                  });
                  setIsLogAttendanceOpen(true);
                }}
              />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-3.5 px-4">Staff Member</th>
                        <th className="py-3.5 px-4">Role</th>
                        <th className="py-3.5 px-4">Property</th>
                        <th className="py-3.5 px-4">Date</th>
                        <th className="py-3.5 px-4">Check-In</th>
                        <th className="py-3.5 px-4">Check-Out</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {attendanceRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            {record.staffName}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {record.roleTitle}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {record.propertyName || <span className="text-slate-400 italic">Org-Wide</span>}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 text-xs font-mono">
                            {new Date(record.date).toLocaleDateString('en-IN')}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 text-xs font-mono">
                            {record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 text-xs font-mono">
                            {record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </td>
                          <td className="py-3.5 px-4">
                            {record.status === StaffAttendanceStatus.PRESENT && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Present
                              </span>
                            )}
                            {record.status === StaffAttendanceStatus.HALF_DAY && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                Half Day
                              </span>
                            )}
                            {record.status === StaffAttendanceStatus.LEAVE && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                On Leave
                              </span>
                            )}
                            {record.status === StaffAttendanceStatus.ABSENT && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                                Absent
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {!record.checkOutTime && record.status === StaffAttendanceStatus.PRESENT && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleQuickCheckOut(record.staffMemberId)}
                              >
                                Check Out
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODAL: ADD STAFF */}
        <Modal
          isOpen={isAddStaffOpen}
          onClose={() => setIsAddStaffOpen(false)}
          title="Add Operational Staff Member"
        >
          <form onSubmit={handleCreateStaff} className="space-y-4">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={staffForm.name}
                onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                placeholder="e.g. Ramesh Kumar"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Role Title *
                </label>
                <input
                  type="text"
                  required
                  value={staffForm.roleTitle}
                  onChange={(e) => setStaffForm({ ...staffForm, roleTitle: e.target.value })}
                  placeholder="e.g. Warden, Security Guard"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={staffForm.phone}
                  onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                  placeholder="10-digit phone"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Monthly Salary (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={staffForm.salaryMonthly}
                  onChange={(e) => setStaffForm({ ...staffForm, salaryMonthly: e.target.value })}
                  placeholder="e.g. 20000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Joined Date *
                </label>
                <input
                  type="date"
                  required
                  value={staffForm.joinedDate}
                  onChange={(e) => setStaffForm({ ...staffForm, joinedDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Property Assignment
              </label>
              <select
                value={staffForm.propertyId}
                onChange={(e) => setStaffForm({ ...staffForm, propertyId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
              >
                <option value="">Organization-Wide (Unassigned)</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setIsAddStaffOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Registering...' : 'Register Staff'}
              </Button>
            </div>
          </form>
        </Modal>

        {/* MODAL: EDIT STAFF */}
        <Modal
          isOpen={isEditStaffOpen}
          onClose={() => {
            setIsEditStaffOpen(false);
            setSelectedStaff(null);
          }}
          title="Edit Staff Member"
        >
          <form onSubmit={handleUpdateStaff} className="space-y-4">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={staffForm.name}
                onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Role Title *
                </label>
                <input
                  type="text"
                  required
                  value={staffForm.roleTitle}
                  onChange={(e) => setStaffForm({ ...staffForm, roleTitle: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={staffForm.phone}
                  onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Monthly Salary (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={staffForm.salaryMonthly}
                  onChange={(e) => setStaffForm({ ...staffForm, salaryMonthly: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Joined Date *
                </label>
                <input
                  type="date"
                  required
                  value={staffForm.joinedDate}
                  onChange={(e) => setStaffForm({ ...staffForm, joinedDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Property Assignment
              </label>
              <select
                value={staffForm.propertyId}
                onChange={(e) => setStaffForm({ ...staffForm, propertyId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
              >
                <option value="">Organization-Wide (Unassigned)</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="editIsActive"
                checked={staffForm.isActive}
                onChange={(e) => setStaffForm({ ...staffForm, isActive: e.target.checked })}
                className="w-4 h-4 text-brand-teal rounded focus:ring-brand-teal"
              />
              <label htmlFor="editIsActive" className="text-sm font-medium text-slate-700">
                Staff member is active
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setIsEditStaffOpen(false);
                  setSelectedStaff(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Modal>

        {/* MODAL: LOG ATTENDANCE */}
        <Modal
          isOpen={isLogAttendanceOpen}
          onClose={() => setIsLogAttendanceOpen(false)}
          title="Log Staff Attendance"
        >
          <form onSubmit={handleRecordAttendance} className="space-y-4">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Staff Member *
              </label>
              <select
                required
                value={attendanceForm.staffMemberId}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, staffMemberId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
              >
                <option value="" disabled>Select Staff Member</option>
                {staffList.filter(s => s.isActive).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.roleTitle})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={attendanceForm.date}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Status *
                </label>
                <select
                  value={attendanceForm.status}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, status: e.target.value as StaffAttendanceStatus })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                >
                  <option value={StaffAttendanceStatus.PRESENT}>Present</option>
                  <option value={StaffAttendanceStatus.HALF_DAY}>Half Day</option>
                  <option value={StaffAttendanceStatus.LEAVE}>On Leave</option>
                  <option value={StaffAttendanceStatus.ABSENT}>Absent</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Check-In Time
                </label>
                <input
                  type="time"
                  value={attendanceForm.checkInTime}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, checkInTime: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Check-Out Time
                </label>
                <input
                  type="time"
                  value={attendanceForm.checkOutTime}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, checkOutTime: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setIsLogAttendanceOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Attendance'}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </AppShell>
  );
}
