'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/lib/auth-context';
import { TenantDto, TenantStatus } from '@propertyos/types';
import {
  Users,
  UserPlus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck2,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  Building,
  GraduationCap,
  Briefcase,
  X,
  Loader2,
} from 'lucide-react';

export default function TenantsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tenants, setTenants] = useState<TenantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    permanentAddress: '',
    permanentCity: '',
    permanentState: '',
    permanentPostalCode: '',
    occupation: '',
    employerOrCollege: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
  });

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const res = await fetch(`/api/v1/tenants?${params.toString()}`, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const json = await res.json();
        setTenants(json.data || []);
      } else {
        // Fallback for dev / unauthenticated
        setTenants([]);
      }
    } catch (err) {
      console.error('Failed to load tenants:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        ...formData,
        email: formData.email.trim() ? formData.email.trim() : null,
        dateOfBirth: formData.dateOfBirth ? new Date(formData.dateOfBirth).toISOString() : null,
        occupation: formData.occupation.trim() ? formData.occupation.trim() : null,
        employerOrCollege: formData.employerOrCollege.trim() ? formData.employerOrCollege.trim() : null,
      };

      const res = await fetch('/api/v1/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || 'Failed to create tenant profile');
      }

      setShowAddModal(false);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        dateOfBirth: '',
        permanentAddress: '',
        permanentCity: '',
        permanentState: '',
        permanentPostalCode: '',
        occupation: '',
        employerOrCollege: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        emergencyContactRelation: '',
      });
      fetchTenants();
      if (json.data?.id) {
        router.push(`/tenants/${json.data.id}`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred while saving tenant profile');
    } finally {
      setSubmitting(false);
    }
  };

  // Metrics
  const totalTenants = tenants.length;
  const activeTenants = tenants.filter((t) => t.status === TenantStatus.ACTIVE).length;
  const noticeTenants = tenants.filter((t) => t.status === TenantStatus.NOTICE).length;
  const prospectTenants = tenants.filter((t) => t.status === TenantStatus.PROSPECT).length;

  const getStatusBadge = (status: TenantStatus) => {
    switch (status) {
      case TenantStatus.ACTIVE:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Active
          </span>
        );
      case TenantStatus.NOTICE:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            In Notice
          </span>
        );
      case TenantStatus.PROSPECT:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <AlertCircle className="w-3.5 h-3.5" />
            Prospect
          </span>
        );
      case TenantStatus.CHECKED_OUT:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Checked Out
          </span>
        );
      case TenantStatus.ARCHIVED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Archived
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <AppShell activePath="/tenants">
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Users className="w-7 h-7 text-brand-teal" />
              Tenant Directory & KYC
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage tenant profiles, KYC document validations, and stay history across all properties.
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-teal text-white font-medium text-sm hover:bg-teal-700 transition shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Onboard Tenant
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Tenants
              </span>
              <Users className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{totalTenants}</p>
            <p className="text-xs text-slate-500 mt-1">Registered in organization</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Active Residents
              </span>
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-emerald-600 mt-2">{activeTenants}</p>
            <p className="text-xs text-slate-500 mt-1">Currently residing</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Notice Period
              </span>
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-amber-600 mt-2">{noticeTenants}</p>
            <p className="text-xs text-slate-500 mt-1">Move-out scheduled</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Prospects
              </span>
              <FileCheck2 className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-blue-600 mt-2">{prospectTenants}</p>
            <p className="text-xs text-slate-500 mt-1">Pending allocation & KYC</p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, phone, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {['ALL', TenantStatus.PROSPECT, TenantStatus.ACTIVE, TenantStatus.NOTICE, TenantStatus.CHECKED_OUT].map(
              (status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition shrink-0 ${
                    statusFilter === status
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {status === 'ALL' ? 'All Tenants' : status.replace('_', ' ')}
                </button>
              )
            )}
          </div>
        </div>

        {/* Tenants Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-brand-teal animate-spin mb-3" />
              <p className="text-sm font-medium">Loading tenant profiles...</p>
            </div>
          ) : tenants.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800">No tenants found</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? 'No tenant matches your search criteria.'
                  : 'Start by onboarding your first tenant profile to manage KYC and stays.'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal text-white text-sm font-medium hover:bg-teal-700 transition"
                >
                  <UserPlus className="w-4 h-4" />
                  Onboard Tenant
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Tenant Name</th>
                    <th className="px-6 py-4">Contact Details</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Location</th>
                    <th className="px-6 py-4">Occupation / Organization</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tenants.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => router.push(`/tenants/${t.id}`)}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                    >
                      <td className="px-6 py-4 font-semibold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
                            {t.firstName.charAt(0)}
                            {t.lastName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">
                              {t.firstName} {t.lastName}
                            </div>
                            <div className="text-xs text-slate-400 font-normal">
                              ID: {t.id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{t.phone}</span>
                          </div>
                          {t.email && (
                            <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              <span>{t.email}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(t.status)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {t.permanentCity}, {t.permanentState}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs">
                          <div className="font-medium text-slate-800">
                            {t.occupation || 'Not specified'}
                          </div>
                          <div className="text-slate-500">{t.employerOrCollege || '—'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <Link
                          href={`/tenants/${t.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-teal hover:text-teal-800"
                        >
                          View Profile
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add Tenant Modal Dialog */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col my-8">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-teal-50 text-brand-teal">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Onboard New Tenant</h2>
                    <p className="text-xs text-slate-500">
                      Create tenant profile with verified contact and emergency details
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-slate-600 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleCreateTenant} className="flex-1 overflow-y-auto p-6 space-y-6">
                {errorMsg && (
                  <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Personal Information */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        First Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                        placeholder="e.g. Rahul"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                        placeholder="e.g. Sharma"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                        placeholder="10-digit mobile number"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                        placeholder="rahul@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                      />
                    </div>
                  </div>
                </div>

                {/* Permanent Address */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Permanent Address
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Street Address *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.permanentAddress}
                        onChange={(e) =>
                          setFormData({ ...formData, permanentAddress: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                        placeholder="House No, Street, Landmark"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          City *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.permanentCity}
                          onChange={(e) =>
                            setFormData({ ...formData, permanentCity: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                          placeholder="e.g. Bengaluru"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          State *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.permanentState}
                          onChange={(e) =>
                            setFormData({ ...formData, permanentState: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                          placeholder="e.g. Karnataka"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Postal Code *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.permanentPostalCode}
                          onChange={(e) =>
                            setFormData({ ...formData, permanentPostalCode: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                          placeholder="e.g. 560001"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Professional / Education Details */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Professional / Education Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Occupation
                      </label>
                      <input
                        type="text"
                        value={formData.occupation}
                        onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                        placeholder="e.g. Software Engineer / Student"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Employer or College Name
                      </label>
                      <input
                        type="text"
                        value={formData.employerOrCollege}
                        onChange={(e) =>
                          setFormData({ ...formData, employerOrCollege: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                        placeholder="e.g. Infosys / RV College"
                      />
                    </div>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Emergency Contact Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Contact Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.emergencyContactName}
                        onChange={(e) =>
                          setFormData({ ...formData, emergencyContactName: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                        placeholder="e.g. Ramesh Sharma"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Contact Phone *
                      </label>
                      <input
                        type="tel"
                        required
                        value={formData.emergencyContactPhone}
                        onChange={(e) =>
                          setFormData({ ...formData, emergencyContactPhone: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                        placeholder="e.g. 9876543210"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Relationship *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.emergencyContactRelation}
                        onChange={(e) =>
                          setFormData({ ...formData, emergencyContactRelation: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                        placeholder="e.g. Father / Mother"
                      />
                    </div>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-brand-teal text-white font-medium text-sm hover:bg-teal-700 transition disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving Profile...
                      </>
                    ) : (
                      'Save & Proceed to KYC'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
