'use client';

import React from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PropertyType } from '@propertyos/types';
import {
  BedDouble,
  Building2,
  Receipt,
  Wrench,
  ShieldCheck,
  Zap,
  UtensilsCrossed,
  CheckCircle2,
  Database,
  Lock,
  Layers,
} from 'lucide-react';

export default function HomePage() {
  return (
    <AppShell>
      {({ propertyType }) => (
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Top Banner / Architecture State */}
          <div className="bg-brand-white border border-surface-border rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold tracking-wider uppercase text-brand-teal">
                    Phase 1 Foundation Milestone
                  </span>
                  <StatusBadge status="FOUNDATION VERIFIED" variant="active" />
                </div>
                <h2 className="text-2xl font-bold text-brand-navy">
                  PropertyOS Multi-Tenant Architecture
                </h2>
                <p className="text-sm text-surface-textSecondary mt-1">
                  Deterministic, non-AI modular monolith for Indian residential & PG operations.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-subtle border border-surface-border text-xs text-brand-navy">
                  <Database className="w-4 h-4 text-brand-teal" />
                  <span className="font-semibold">PostgreSQL + Prisma 6</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-subtle border border-surface-border text-xs text-brand-navy">
                  <Lock className="w-4 h-4 text-brand-teal" />
                  <span className="font-semibold">Argon2id + HTTP-Only</span>
                </div>
              </div>
            </div>
          </div>

          {/* Operating Model Adaptive Showcase */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-brand-teal" />
                  <span>Operating Model</span>
                </CardTitle>
                <StatusBadge
                  status={propertyType === PropertyType.PG ? 'PG / CO-LIVING' : 'WHOLE-UNIT RENTAL'}
                  variant="active"
                />
              </CardHeader>
              <p className="text-xs text-surface-textSecondary mb-4">
                {propertyType === PropertyType.PG
                  ? 'Manages floor-level wings, rooms, bed inventory, meal subscriptions, and sub-metered electricity splitting.'
                  : 'Manages apartment/villa units, household lease contracts, security deposit settlements, and rent escalations.'}
              </p>
              <div className="p-3 bg-surface-subtle rounded-lg border border-surface-border text-xs space-y-1.5 text-brand-navy">
                <div className="flex justify-between">
                  <span className="text-surface-textSecondary">Inventory Unit:</span>
                  <span className="font-semibold">
                    {propertyType === PropertyType.PG ? 'Individual Beds' : 'Entire Unit / Flat'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-textSecondary">Billing Cycle:</span>
                  <span className="font-semibold">Per-Tenant Monthly</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-textSecondary">Mess/Meals:</span>
                  <span className="font-semibold">
                    {propertyType === PropertyType.PG ? 'Enabled' : 'Disabled (Hidden)'}
                  </span>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-brand-teal" />
                  <span>Security & Tenancy Guard</span>
                </CardTitle>
                <StatusBadge status="ENFORCED" variant="active" />
              </CardHeader>
              <div className="space-y-2 text-xs text-brand-navy">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                  <span>Argon2id password hashing</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                  <span>HTTP-only secure cookie session storage</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                  <span>Strict organization tenancy isolation</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                  <span>Zero wildcard CORS in production</span>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-brand-teal" />
                  <span>Infrastructure Status</span>
                </CardTitle>
                <StatusBadge status="DOCKER + GCP READY" variant="active" />
              </CardHeader>
              <div className="space-y-2 text-xs text-brand-navy">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                  <span>PostgreSQL 16 + PostGIS extension</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                  <span>Redis 7 + BullMQ job queues</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                  <span>Local zero-cost file storage driver</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                  <span>Zero AI / ML modules active in Phase 1</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Core Operational Capabilities Matrix */}
          <div className="bg-brand-white border border-surface-border rounded-2xl p-6">
            <h3 className="text-base font-bold text-brand-navy mb-4">
              Operational Domain Matrix ({propertyType === PropertyType.PG ? 'PG / Co-Living' : 'Whole-Unit Rental'})
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-surface-border bg-surface-subtle space-y-1">
                <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-brand-teal mb-2">
                  {propertyType === PropertyType.PG ? (
                    <BedDouble className="w-4 h-4" />
                  ) : (
                    <Building2 className="w-4 h-4" />
                  )}
                </div>
                <h4 className="text-sm font-semibold text-brand-navy">
                  {propertyType === PropertyType.PG ? 'Bed Allocation' : 'Unit Lease Engine'}
                </h4>
                <p className="text-xs text-surface-textSecondary">
                  {propertyType === PropertyType.PG
                    ? 'Floor, room sharing, bed status tracking.'
                    : 'Flat/villa lease, renewal, escalation.'}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-surface-border bg-surface-subtle space-y-1">
                <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-brand-teal mb-2">
                  <Receipt className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-semibold text-brand-navy">Billing & Ledger</h4>
                <p className="text-xs text-surface-textSecondary">
                  Rent invoices, late fees, payment receipts.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-surface-border bg-surface-subtle space-y-1">
                <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-brand-teal mb-2">
                  <Zap className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-semibold text-brand-navy">Sub-Meter Utilities</h4>
                <p className="text-xs text-surface-textSecondary">
                  Meter readings, consumption & billing.
                </p>
              </div>

              {propertyType === PropertyType.PG ? (
                <div className="p-4 rounded-xl border border-surface-border bg-surface-subtle space-y-1">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-brand-teal mb-2">
                    <UtensilsCrossed className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-semibold text-brand-navy">Mess & Food</h4>
                  <p className="text-xs text-surface-textSecondary">
                    Daily headcount, meal subscriptions.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-surface-border bg-surface-subtle space-y-1">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-brand-teal mb-2">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-semibold text-brand-navy">Maintenance</h4>
                  <p className="text-xs text-surface-textSecondary">
                    Tickets, vendor tracking, cost audit.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
