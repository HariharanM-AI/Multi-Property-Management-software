'use client';

import React from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { BackButton } from '@/components/ui/BackButton';
import {
  Shield,
  CheckCircle2,
  XCircle,
  Building2,
  Users,
  ReceiptText,
  Wrench,
  FileSpreadsheet,
} from 'lucide-react';

interface MatrixRow {
  permission: string;
  label: string;
  category: string;
  owner: boolean;
  manager: boolean;
  accountant: boolean;
  warden: boolean;
  security: boolean;
  maintenance: boolean;
}

const PERMISSION_ROWS: MatrixRow[] = [
  // Organization
  { permission: 'organization.read', label: 'View Organization Profile', category: 'Organization & Team', owner: true, manager: true, accountant: true, warden: true, security: true, maintenance: true },
  { permission: 'organization.update', label: 'Update Legal Name / GSTIN', category: 'Organization & Team', owner: true, manager: false, accountant: false, warden: false, security: false, maintenance: false },
  { permission: 'team.read', label: 'View Team Roster', category: 'Organization & Team', owner: true, manager: true, accountant: true, warden: true, security: false, maintenance: false },
  { permission: 'team.invite', label: 'Invite New Team Members', category: 'Organization & Team', owner: true, manager: false, accountant: false, warden: false, security: false, maintenance: false },
  { permission: 'team.update', label: 'Modify Roles / Deactivate', category: 'Organization & Team', owner: true, manager: false, accountant: false, warden: false, security: false, maintenance: false },
  { permission: 'team.remove', label: 'Remove Team Member', category: 'Organization & Team', owner: true, manager: false, accountant: false, warden: false, security: false, maintenance: false },

  // Property
  { permission: 'property.read', label: 'View Properties & Units', category: 'Property Management Foundation', owner: true, manager: true, accountant: true, warden: true, security: true, maintenance: true },
  { permission: 'property.create', label: 'Create New Properties', category: 'Property Management Foundation', owner: true, manager: true, accountant: false, warden: false, security: false, maintenance: false },
  { permission: 'property.update', label: 'Update Property Details', category: 'Property Management Foundation', owner: true, manager: true, accountant: false, warden: false, security: false, maintenance: false },
  { permission: 'property.delete', label: 'Delete Property', category: 'Property Management Foundation', owner: true, manager: false, accountant: false, warden: false, security: false, maintenance: false },

  // Tenant
  { permission: 'tenant.read', label: 'View Tenants & Leases', category: 'Tenant Management Foundation', owner: true, manager: true, accountant: true, warden: true, security: true, maintenance: false },
  { permission: 'tenant.create', label: 'Onboard New Tenant', category: 'Tenant Management Foundation', owner: true, manager: true, accountant: false, warden: false, security: false, maintenance: false },
  { permission: 'tenant.update', label: 'Update Tenant / Bed Assignment', category: 'Tenant Management Foundation', owner: true, manager: true, accountant: false, warden: true, security: false, maintenance: false },
  { permission: 'tenant.delete', label: 'Terminate / Evict Tenant', category: 'Tenant Management Foundation', owner: true, manager: false, accountant: false, warden: false, security: false, maintenance: false },

  // Billing
  { permission: 'billing.read', label: 'View Invoices & Payments', category: 'Billing & Finance Foundation', owner: true, manager: false, accountant: true, warden: false, security: false, maintenance: false },
  { permission: 'billing.create', label: 'Generate Invoices & Dues', category: 'Billing & Finance Foundation', owner: true, manager: false, accountant: true, warden: false, security: false, maintenance: false },
  { permission: 'billing.update', label: 'Record Payments & Receipts', category: 'Billing & Finance Foundation', owner: true, manager: false, accountant: true, warden: false, security: false, maintenance: false },

  // Maintenance
  { permission: 'maintenance.read', label: 'View Maintenance Tickets', category: 'Maintenance & Operations Foundation', owner: true, manager: true, accountant: false, warden: true, security: false, maintenance: true },
  { permission: 'maintenance.create', label: 'Create Maintenance Request', category: 'Maintenance & Operations Foundation', owner: true, manager: true, accountant: false, warden: true, security: false, maintenance: false },
  { permission: 'maintenance.assign', label: 'Assign Tickets to Staff', category: 'Maintenance & Operations Foundation', owner: true, manager: true, accountant: false, warden: false, security: false, maintenance: false },
  { permission: 'maintenance.update', label: 'Resolve & Update Ticket Status', category: 'Maintenance & Operations Foundation', owner: true, manager: true, accountant: false, warden: true, security: false, maintenance: true },

  // Reports
  { permission: 'reports.read', label: 'View Financial & Operational Reports', category: 'Reports & Analytics Foundation', owner: true, manager: true, accountant: true, warden: false, security: false, maintenance: false },
];

export default function RolesPermissionsPage() {
  return (
    <AppShell activePath="/settings">
      <div className="space-y-6 w-full">
        {/* Navigation Back Button */}
        <div className="flex items-center justify-between">
          <BackButton fallbackHref="/" label="Back to Dashboard" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Role & Permissions Matrix</h1>
          <p className="text-xs text-surface-textSecondary mt-1">
            Deterministic RBAC matrix governing multi-tenant access control and operational boundaries.
          </p>

          <div className="flex items-center gap-2 mt-4 border-b border-surface-border">
            <a
              href="/settings/organization"
              className="px-4 py-2 text-xs font-medium text-surface-textSecondary hover:text-brand-navy"
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
              className="px-4 py-2 border-b-2 border-brand-teal text-xs font-semibold text-brand-teal"
            >
              Role & Permissions Matrix
            </a>
          </div>
        </div>

        {/* Roles Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 border-l-4 border-l-brand-teal space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-brand-navy">OWNER</span>
              <span className="text-[10px] uppercase font-bold text-brand-teal px-2 py-0.5 rounded bg-teal-50">
                Superuser
              </span>
            </div>
            <p className="text-[11px] text-surface-textSecondary">
              Full administrative privileges over the organization, team roster, financial records, and all properties.
            </p>
          </Card>

          <Card className="p-4 border-l-4 border-l-brand-navy space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-brand-navy">PROPERTY_MANAGER</span>
              <span className="text-[10px] uppercase font-bold text-slate-700 px-2 py-0.5 rounded bg-slate-100">
                Operations
              </span>
            </div>
            <p className="text-[11px] text-surface-textSecondary">
              Operational property and tenant management, maintenance assignments, and day-to-day oversight without legal ownership control.
            </p>
          </Card>

          <Card className="p-4 border-l-4 border-l-brand-teal space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-brand-navy">ACCOUNTANT</span>
              <span className="text-[10px] uppercase font-bold text-brand-teal px-2 py-0.5 rounded bg-teal-50">
                Financial
              </span>
            </div>
            <p className="text-[11px] text-surface-textSecondary">
              Invoicing, rent collection records, expense tracking, and P&L financial reports with zero security/team administration.
            </p>
          </Card>

          <Card className="p-4 border-l-4 border-l-slate-400 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-brand-navy">WARDEN</span>
              <span className="text-[10px] uppercase font-bold text-slate-700 px-2 py-0.5 rounded bg-slate-100">
                PG Ops
              </span>
            </div>
            <p className="text-[11px] text-surface-textSecondary">
              PG property operations, room/bed occupancy tracking, mess supervision, and student maintenance requests.
            </p>
          </Card>

          <Card className="p-4 border-l-4 border-l-slate-400 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-brand-navy">SECURITY</span>
              <span className="text-[10px] uppercase font-bold text-slate-700 px-2 py-0.5 rounded bg-slate-100">
                Gatepass
              </span>
            </div>
            <p className="text-[11px] text-surface-textSecondary">
              Gate check-in/out, visitor verification, night attendance logs, and emergency property visibility.
            </p>
          </Card>

          <Card className="p-4 border-l-4 border-l-slate-400 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-brand-navy">MAINTENANCE_STAFF</span>
              <span className="text-[10px] uppercase font-bold text-slate-700 px-2 py-0.5 rounded bg-slate-100">
                Field
              </span>
            </div>
            <p className="text-[11px] text-surface-textSecondary">
              Execution and resolution of assigned electrical, plumbing, and appliance maintenance tickets.
            </p>
          </Card>
        </div>

        {/* Permissions Table */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-surface-border">
            <h2 className="text-sm font-bold text-brand-navy">Machine-Enforced Permission Matrix</h2>
            <p className="text-[11px] text-surface-textSecondary">
              Granular capabilities enforced by the backend PermissionsGuard on every incoming request.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-subtle border-b border-surface-border text-surface-textSecondary font-semibold">
                <tr>
                  <th className="py-3 px-4">Permission / Capability</th>
                  <th className="py-3 px-2 text-center">OWNER</th>
                  <th className="py-3 px-2 text-center">PROPERTY_MANAGER</th>
                  <th className="py-3 px-2 text-center">ACCOUNTANT</th>
                  <th className="py-3 px-2 text-center">WARDEN</th>
                  <th className="py-3 px-2 text-center">SECURITY</th>
                  <th className="py-3 px-2 text-center">MAINTENANCE_STAFF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {PERMISSION_ROWS.map((row) => (
                  <tr key={row.permission} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-brand-navy">{row.label}</p>
                      <p className="text-[10px] font-mono text-surface-textSecondary">{row.permission}</p>
                    </td>
                    <td className="py-3 px-2 text-center">
                      {row.owner ? (
                        <CheckCircle2 className="w-4 h-4 text-brand-teal inline" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300 inline" />
                      )}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {row.manager ? (
                        <CheckCircle2 className="w-4 h-4 text-brand-teal inline" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300 inline" />
                      )}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {row.accountant ? (
                        <CheckCircle2 className="w-4 h-4 text-brand-teal inline" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300 inline" />
                      )}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {row.warden ? (
                        <CheckCircle2 className="w-4 h-4 text-brand-teal inline" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300 inline" />
                      )}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {row.security ? (
                        <CheckCircle2 className="w-4 h-4 text-brand-teal inline" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300 inline" />
                      )}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {row.maintenance ? (
                        <CheckCircle2 className="w-4 h-4 text-brand-teal inline" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300 inline" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
