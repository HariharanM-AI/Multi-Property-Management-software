'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  TeamMemberDto,
  TeamInvitationDto,
  UserRole,
  ApiResponse,
} from '@propertyos/types';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCcw,
  Trash2,
  PowerOff,
  Power,
  ChevronDown,
  Clock,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export default function TeamSettingsPage() {
  const { user } = useAuth();
  const isOwner = user?.roles?.includes(UserRole.OWNER);

  const [teamMembers, setTeamMembers] = useState<TeamMemberDto[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitationDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Invite Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>(UserRole.PROPERTY_MANAGER);
  const [isInviting, setIsInviting] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  // Feedback State
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [teamRes, invRes] = await Promise.all([
        fetch(`${API_BASE}/team`, { credentials: 'include' }),
        fetch(`${API_BASE}/invitations`, { credentials: 'include' }),
      ]);

      if (teamRes.ok) {
        const teamJson: ApiResponse<TeamMemberDto[]> = await teamRes.json();
        if (teamJson.data) setTeamMembers(teamJson.data);
      }

      if (invRes.ok) {
        const invJson: ApiResponse<TeamInvitationDto[]> = await invRes.json();
        if (invJson.data) setInvitations(invJson.data);
      }
    } catch {
      setErrorMessage('Failed to load team data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setDevToken(null);
    setIsInviting(true);

    try {
      const res = await fetch(`${API_BASE}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
        }),
      });

      const json: ApiResponse<{ message: string; devInvitationToken?: string }> = await res.json();

      if (res.ok && json.success) {
        setSuccessMessage('Invitation created successfully.');
        if (json.data?.devInvitationToken) {
          setDevToken(json.data.devInvitationToken);
        } else {
          setIsInviteModalOpen(false);
          setInviteEmail('');
        }
        await fetchData();
      } else {
        const detailMsg = json.error?.details?.[0]?.message;
        setErrorMessage(detailMsg || json.error?.message || 'Failed to send invitation.');
      }
    } catch {
      setErrorMessage('Network error while creating invitation.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (targetUserId: string, newRole: UserRole) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`${API_BASE}/team/${targetUserId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: newRole }),
      });

      const json: ApiResponse<{ message: string }> = await res.json();

      if (res.ok && json.success) {
        setSuccessMessage('Role updated successfully.');
        await fetchData();
      } else {
        setErrorMessage(json.error?.message || 'Failed to update role.');
      }
    } catch {
      setErrorMessage('Network error while updating role.');
    }
  };

  const handleToggleActive = async (targetUserId: string, currentlyActive: boolean) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const endpoint = currentlyActive ? 'deactivate' : 'reactivate';

    try {
      const res = await fetch(`${API_BASE}/team/${targetUserId}/${endpoint}`, {
        method: 'POST',
        credentials: 'include',
      });

      const json: ApiResponse<{ message: string }> = await res.json();

      if (res.ok && json.success) {
        setSuccessMessage(json.data?.message || 'Status updated successfully.');
        await fetchData();
      } else {
        setErrorMessage(json.error?.message || 'Failed to update member status.');
      }
    } catch {
      setErrorMessage('Network error.');
    }
  };

  const handleCancelInvite = async (invitationId: string) => {
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_BASE}/invitations/${invitationId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        setSuccessMessage('Invitation cancelled.');
        await fetchData();
      } else {
        const json = await res.json();
        setErrorMessage(json.error?.message || 'Failed to cancel invitation.');
      }
    } catch {
      setErrorMessage('Network error.');
    }
  };

  const handleResendInvite = async (invitationId: string) => {
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_BASE}/invitations/${invitationId}/resend`, {
        method: 'POST',
        credentials: 'include',
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSuccessMessage('Invitation renewed and resent.');
        if (json.data?.devInvitationToken) {
          setDevToken(json.data.devInvitationToken);
        }
        await fetchData();
      } else {
        setErrorMessage(json.error?.message || 'Failed to resend invitation.');
      }
    } catch {
      setErrorMessage('Network error.');
    }
  };

  return (
    <AppShell activePath="/settings">
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header & Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-brand-navy">Team & Staff</h1>
            <p className="text-xs text-surface-textSecondary mt-1">
              Invite team members, assign operational roles, and manage access permissions.
            </p>
          </div>

          {isOwner && (
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setDevToken(null);
                setInviteEmail('');
                setIsInviteModalOpen(true);
              }}
              className="font-semibold shadow-sm inline-flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Invite Team Member</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 border-b border-surface-border">
          <a
            href="/settings/organization"
            className="px-4 py-2 text-xs font-medium text-surface-textSecondary hover:text-brand-navy"
          >
            Organization Profile
          </a>
          <a
            href="/settings/team"
            className="px-4 py-2 border-b-2 border-brand-teal text-xs font-semibold text-brand-teal"
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

        {/* Feedback Messages */}
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

        {/* Active Team Members Table */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-surface-border flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-brand-navy">Active Organization Members</h2>
              <p className="text-[11px] text-surface-textSecondary">
                Members with active credentials and designated role access.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-surface-subtle border border-surface-border text-brand-navy">
              {teamMembers.length} Members
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-subtle border-b border-surface-border text-surface-textSecondary font-semibold">
                <tr>
                  <th className="py-3 px-4">Member Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {teamMembers.map((m) => {
                  const isCurrentActor = m.id === user?.id;
                  const isMemberOwner = m.roles.includes(UserRole.OWNER);

                  return (
                    <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-brand-navy">
                        {m.firstName} {m.lastName}{' '}
                        {isCurrentActor && (
                          <span className="text-[10px] text-brand-teal font-normal">(You)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-surface-textSecondary">{m.email}</td>
                      <td className="py-3 px-4">
                        {isOwner && !isCurrentActor ? (
                          <select
                            value={m.roles[0] || UserRole.PROPERTY_MANAGER}
                            onChange={(e) => handleRoleChange(m.id, e.target.value as UserRole)}
                            className="text-xs font-semibold px-2 py-1 bg-brand-white border border-surface-border rounded-lg text-brand-navy focus:ring-1 focus:ring-brand-teal"
                          >
                            <option value={UserRole.OWNER}>OWNER</option>
                            <option value={UserRole.PROPERTY_MANAGER}>PROPERTY_MANAGER</option>
                            <option value={UserRole.ACCOUNTANT}>ACCOUNTANT</option>
                            <option value={UserRole.WARDEN}>WARDEN</option>
                            <option value={UserRole.SECURITY}>SECURITY</option>
                            <option value={UserRole.MAINTENANCE_STAFF}>MAINTENANCE_STAFF</option>
                          </select>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 border border-slate-200 text-brand-navy uppercase">
                            {m.roles[0] || 'MEMBER'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            m.isActive
                              ? 'bg-teal-50 text-brand-teal border border-teal-200'
                              : 'bg-slate-100 text-surface-disabled border border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              m.isActive ? 'bg-brand-teal' : 'bg-surface-disabled'
                            }`}
                          />
                          {m.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isOwner && !isCurrentActor && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleToggleActive(m.id, m.isActive)}
                              className={`p-1.5 rounded-lg border text-xs font-medium transition-colors ${
                                m.isActive
                                  ? 'text-surface-textSecondary border-surface-border hover:bg-slate-100 hover:text-brand-navy'
                                  : 'text-brand-teal border-teal-200 bg-teal-50 hover:bg-teal-100'
                              }`}
                              title={m.isActive ? 'Deactivate Member' : 'Reactivate Member'}
                            >
                              {m.isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Pending Invitations Table */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-surface-border flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-brand-navy">Pending Team Invitations</h2>
              <p className="text-[11px] text-surface-textSecondary">
                Invitations sent with cryptographic single-use tokens awaiting acceptance.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-surface-subtle border border-surface-border text-brand-navy">
              {invitations.length} Pending
            </span>
          </div>

          {invitations.length === 0 ? (
            <div className="p-8 text-center text-xs text-surface-textSecondary">
              No pending invitations. All invited members have completed onboarding.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-subtle border-b border-surface-border text-surface-textSecondary font-semibold">
                  <tr>
                    <th className="py-3 px-4">Invited Email</th>
                    <th className="py-3 px-4">Designated Role</th>
                    <th className="py-3 px-4">Invited By</th>
                    <th className="py-3 px-4">Expires</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-brand-navy">{inv.email}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 border border-teal-200 text-brand-teal uppercase">
                          {inv.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-surface-textSecondary">
                        {inv.invitedBy.firstName} {inv.invitedBy.lastName}
                      </td>
                      <td className="py-3 px-4 text-surface-textSecondary flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-surface-disabled" />
                        <span>{new Date(inv.expiresAt).toLocaleDateString()}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isOwner && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleResendInvite(inv.id)}
                              className="p-1.5 rounded-lg border border-surface-border text-surface-textSecondary hover:bg-slate-100 hover:text-brand-navy transition-colors"
                              title="Resend / Renew Token"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleCancelInvite(inv.id)}
                              className="p-1.5 rounded-lg border border-surface-border text-surface-textSecondary hover:bg-slate-100 hover:text-brand-navy transition-colors"
                              title="Cancel Invitation"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Invite Member Modal Dialog */}
        {isInviteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-navy/60 backdrop-blur-xs">
            <div className="bg-brand-white rounded-2xl border border-surface-border shadow-xl w-full max-w-md p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-surface-border pb-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-brand-teal" />
                  <h3 className="text-base font-bold text-brand-navy">Invite Team Member</h3>
                </div>
                <button
                  onClick={() => setIsInviteModalOpen(false)}
                  className="text-surface-textSecondary hover:text-brand-navy"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {devToken ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-xs text-brand-teal font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Invitation created successfully!</span>
                  </div>

                  {process.env.NODE_ENV === 'development' && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-300 space-y-2">
                      <div className="text-[11px] font-bold uppercase text-brand-teal">
                        Local Development Acceptance Link
                      </div>
                      <p className="text-xs font-mono text-brand-navy break-all">
                        Token: {devToken}
                      </p>
                      <a
                        href={`/invitations/accept?token=${devToken}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block mt-2 text-xs font-semibold text-brand-teal hover:underline"
                      >
                        Open Acceptance Screen in New Tab →
                      </a>
                    </div>
                  )}

                  <Button
                    variant="secondary"
                    size="md"
                    className="w-full"
                    onClick={() => {
                      setIsInviteModalOpen(false);
                      setDevToken(null);
                      setInviteEmail('');
                    }}
                  >
                    Close
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSendInvite} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-brand-navy">
                      Member Email Address
                    </label>
                    <div className="mt-1 relative rounded-lg shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Mail className="h-4 w-4 text-surface-textSecondary" />
                      </div>
                      <input
                        type="email"
                        required
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="manager@company.com"
                        className="block w-full pl-10 pr-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-brand-navy">
                      Assign Role
                    </label>
                    <div className="mt-1 relative">
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as UserRole)}
                        className="block w-full px-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal"
                      >
                        <option value={UserRole.PROPERTY_MANAGER}>PROPERTY_MANAGER (Operations & Property)</option>
                        <option value={UserRole.ACCOUNTANT}>ACCOUNTANT (Billing & Financial Reports)</option>
                        <option value={UserRole.WARDEN}>WARDEN (PG Operations & Tenant Management)</option>
                        <option value={UserRole.SECURITY}>SECURITY (Security & Visitor Gatepass)</option>
                        <option value={UserRole.MAINTENANCE_STAFF}>MAINTENANCE_STAFF (Maintenance Work Orders)</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={() => setIsInviteModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      className="font-semibold"
                      isLoading={isInviting}
                    >
                      Send Invitation
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
