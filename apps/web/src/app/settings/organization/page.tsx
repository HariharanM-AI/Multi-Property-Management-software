'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { BackButton } from '@/components/ui/BackButton';
import { OrganizationDto, ApiResponse, Permission } from '@propertyos/types';
import {
  Building2,
  Mail,
  Phone,
  FileText,
  Users,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Save,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export default function OrganizationSettingsPage() {
  const { user, organization: authOrg, refreshUser } = useAuth();
  const isOwner = user?.roles?.includes('OWNER' as any);

  const [orgData, setOrgData] = useState<OrganizationDto | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    legalName: '',
    taxIdGst: '',
    phone: '',
    email: '',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrg() {
      try {
        const res = await fetch(`${API_BASE}/organization`, {
          credentials: 'include',
        });
        if (res.ok) {
          const json: ApiResponse<OrganizationDto> = await res.json();
          if (json.data) {
            setOrgData(json.data);
            setFormData({
              name: json.data.name || '',
              legalName: json.data.legalName || '',
              taxIdGst: json.data.taxIdGst || '',
              phone: json.data.phone || '',
              email: json.data.email || '',
            });
          }
        }
      } catch {
        setErrorMessage('Failed to load organization profile.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrg();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      const res = await fetch(`${API_BASE}/organization`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name.trim(),
          legalName: formData.legalName.trim() || null,
          taxIdGst: formData.taxIdGst.trim().toUpperCase() || null,
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
        }),
      });

      const json: ApiResponse<OrganizationDto> = await res.json();

      if (res.ok && json.success && json.data) {
        setOrgData(json.data);
        setSuccessMessage('Organization profile updated successfully.');
        await refreshUser();
      } else {
        const detailMsg = json.error?.details?.[0]?.message;
        setErrorMessage(detailMsg || json.error?.message || 'Failed to update organization.');
      }
    } catch {
      setErrorMessage('Network error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell activePath="/settings">
      <div className="space-y-6 w-full">
        {/* Navigation Back Button */}
        <div className="flex items-center justify-between">
          <BackButton fallbackHref="/" label="Back to Dashboard" />
        </div>

        {/* Breadcrumb & Navigation Tabs */}
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Settings</h1>
          <p className="text-xs text-surface-textSecondary mt-1">
            Manage organization profile, team members, and role-based permissions.
          </p>

          <div className="flex items-center gap-2 mt-4 border-b border-surface-border">
            <a
              href="/settings/organization"
              className="px-4 py-2 border-b-2 border-brand-teal text-xs font-semibold text-brand-teal"
            >
              Organization Profile
            </a>
            <a
              href="/settings/team"
              className="px-4 py-2 text-xs font-medium text-surface-textSecondary hover:text-brand-navy"
            >
              Team & Staff
            </a>
            <a
              href="/settings/roles"
              className="px-4 py-2 text-xs font-medium text-surface-textSecondary hover:text-brand-navy"
            >
              Role & Permissions Matrix
            </a>
          </div>
        </div>

        {/* Feedback Alerts */}
        {successMessage && (
          <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 flex items-center gap-3 text-brand-teal text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-300 flex items-center gap-3 text-brand-navy text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 text-brand-teal flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-surface-textSecondary font-medium">Total Properties</p>
              <p className="text-lg font-bold text-brand-navy">{orgData?.propertyCount ?? 0}</p>
            </div>
          </Card>

          <Card className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 text-brand-navy flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-surface-textSecondary font-medium">Active Team Members</p>
              <p className="text-lg font-bold text-brand-navy">{orgData?.memberCount ?? 1}</p>
            </div>
          </Card>

          <Card className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 text-brand-teal flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-surface-textSecondary font-medium">Isolation Status</p>
              <p className="text-xs font-bold text-brand-teal">Strict Tenant Scoping Active</p>
            </div>
          </Card>
        </div>

        {/* Profile Card & Form */}
        <Card className="p-6">
          <div className="flex items-center justify-between border-b border-surface-border pb-4 mb-6">
            <div>
              <h2 className="text-base font-bold text-brand-navy">Organization Details</h2>
              <p className="text-xs text-surface-textSecondary">
                Legal entity details, Indian GSTIN, and organizational contact points.
              </p>
            </div>
            {!isOwner && (
              <span className="text-[11px] px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-surface-textSecondary font-medium">
                Read-Only (Owner Privilege Required)
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-brand-navy">
                  Organization / Brand Name
                </label>
                <div className="mt-1 relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Building2 className="h-4 w-4 text-surface-textSecondary" />
                  </div>
                  <input
                    name="name"
                    type="text"
                    required
                    disabled={!isOwner}
                    value={formData.name}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy disabled:bg-surface-subtle disabled:text-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-navy">
                  Registered Legal Business Name
                </label>
                <div className="mt-1 relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <FileText className="h-4 w-4 text-surface-textSecondary" />
                  </div>
                  <input
                    name="legalName"
                    type="text"
                    disabled={!isOwner}
                    value={formData.legalName}
                    onChange={handleChange}
                    placeholder="e.g. Omkar Living Spaces Private Limited"
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy disabled:bg-surface-subtle disabled:text-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-brand-navy">
                  GSTIN / Tax ID
                </label>
                <input
                  name="taxIdGst"
                  type="text"
                  disabled={!isOwner}
                  value={formData.taxIdGst}
                  onChange={handleChange}
                  placeholder="29ABCDE1234F1Z5"
                  className="mt-1 block w-full px-3.5 py-2.5 font-mono uppercase bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy disabled:bg-surface-subtle disabled:text-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-navy">
                  Business Phone (India)
                </label>
                <div className="mt-1 relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Phone className="h-4 w-4 text-surface-textSecondary" />
                  </div>
                  <input
                    name="phone"
                    type="tel"
                    disabled={!isOwner}
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="9845012345"
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy disabled:bg-surface-subtle disabled:text-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-navy">
                  Official Contact Email
                </label>
                <div className="mt-1 relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-surface-textSecondary" />
                  </div>
                  <input
                    name="email"
                    type="email"
                    disabled={!isOwner}
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="contact@company.com"
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy disabled:bg-surface-subtle disabled:text-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>
              </div>
            </div>

            {isOwner && (
              <div className="pt-4 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="font-semibold shadow-sm inline-flex items-center gap-2"
                  isLoading={isSaving}
                >
                  <Save className="w-4 h-4" />
                  <span>Save Organization Profile</span>
                </Button>
              </div>
            )}
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
