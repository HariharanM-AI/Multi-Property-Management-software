'use client';

import React from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { BackButton } from '@/components/ui/BackButton';
import {
  Shield,
  Lock,
  FileText,
  UserCheck,
  AlertCircle,
  Clock,
  ArrowRight,
  ExternalLink,
  Building,
  Mail,
  Phone,
  CheckCircle2,
  Scale,
  Database,
  Users,
} from 'lucide-react';

export default function PrivacyNoticePage() {
  return (
    <AppShell activePath="/settings/organization">
      <div className="max-w-5xl mx-auto space-y-8 pb-16">
        {/* Navigation Back Button */}
        <div className="flex items-center justify-between">
          <BackButton fallbackHref="/settings/organization" label="Back to Settings" />
        </div>
        {/* Legal Disclaimer Banner */}
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <span className="font-bold uppercase tracking-wider text-amber-800">
              LEGAL REVIEW REQUIRED:
            </span>{' '}
            This Privacy Notice is a baseline architectural compliance template prepared under the{' '}
            <strong>Digital Personal Data Protection Act, 2023 (DPDP Act, India)</strong>. Property
            operators must customize the designated Grievance Officer details and data retention
            schedules with their legal counsel prior to commercial execution.
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-50 text-brand-teal border border-teal-200 rounded-xl">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-brand-navy">
                  Privacy Notice & Data Protection Policy
                </h1>
                <p className="text-sm text-surface-textSecondary">
                  Compliance with the Digital Personal Data Protection Act, 2023 (India)
                </p>
              </div>
            </div>
          </div>

          <Link
            href="/privacy/data-rights"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-teal text-white text-sm font-semibold hover:bg-teal-700 transition shadow-sm"
          >
            <span>Exercise Data Rights</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Overview & Data Fiduciary Details */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Building className="w-5 h-5 text-brand-teal" />
            1. Data Fiduciary Identification & Scope
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            This Privacy Notice describes how PropertyOS operating organizations (&quot;Data Fiduciary&quot;,
            &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collect, store, process, and protect the digital personal data of
            residents, prospective tenants, staff, and facility visitors (&quot;Data Principals&quot;) in
            accordance with the <strong>Digital Personal Data Protection Act, 2023 (DPDP Act)</strong>.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-xs font-semibold text-slate-500 block uppercase">Governing Law</span>
              <span className="text-sm font-bold text-slate-900">DPDP Act, 2023 (India)</span>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-xs font-semibold text-slate-500 block uppercase">Primary Purpose</span>
              <span className="text-sm font-bold text-slate-900">Tenancy & Facility Operations</span>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-xs font-semibold text-slate-500 block uppercase">Audit Standard</span>
              <span className="text-sm font-bold text-slate-900">Append-Only Cryptographic Log</span>
            </div>
          </div>
        </div>

        {/* Itemized Categories of Personal Data Collected */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-brand-teal" />
            2. Personal Data We Collect and Specific Purposes
          </h2>
          <p className="text-sm text-slate-600">
            We collect personal data only for specific, legitimate, and documented operational purposes:
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Data Category</th>
                  <th className="p-3">Data Elements</th>
                  <th className="p-3">Lawful Purpose & Ground</th>
                  <th className="p-3">Retention Period</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                <tr>
                  <td className="p-3 font-semibold text-slate-900">Occupant KYC & Identity</td>
                  <td className="p-3">Full name, phone, email, government ID type, masked ID number, proof of residence</td>
                  <td className="p-3">Tenancy agreement execution, identity verification, police verification compliance</td>
                  <td className="p-3">Duration of stay + 7 years (statutory requirement)</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-900">Financial & Invoicing</td>
                  <td className="p-3">Rent invoices, payment receipts, UPI/bank transaction IDs, security deposit records</td>
                  <td className="p-3">Contractual performance, accounting, tax audits under Indian Income Tax Act</td>
                  <td className="p-3">8 financial years (statutory requirement)</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-900">Facility Services & Maintenance</td>
                  <td className="p-3">Maintenance requests, unit numbers, service descriptions, technician assignment</td>
                  <td className="p-3">Property maintenance, resolving repair tickets, facility management</td>
                  <td className="p-3">3 years post-resolution</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-900">Security & Visitors</td>
                  <td className="p-3">Visitor full name, contact phone, purpose of visit, entry/exit timestamp</td>
                  <td className="p-3">Premises security, physical access control, resident safety</td>
                  <td className="p-3">90 days (auto-purged unless incident flagged)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Data Principal Rights */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Scale className="w-5 h-5 text-brand-teal" />
            3. Your Rights as a Data Principal under DPDP Act 2023
          </h2>
          <p className="text-sm text-slate-600">
            Under Chapter III of the DPDP Act 2023, you have the following enforceable rights regarding your personal data:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-brand-teal" />
                Right to Access Summary
              </h3>
              <p className="text-xs text-slate-600">
                You have the right to obtain a summary of your personal data being processed and the identities of any Data Processors with whom it has been shared.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-brand-teal" />
                Right to Correction & Updating
              </h3>
              <p className="text-xs text-slate-600">
                You have the right to correct inaccurate or misleading personal data, complete any incomplete records, and update your information.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-brand-teal" />
                Right to Erasure
              </h3>
              <p className="text-xs text-slate-600">
                You have the right to request erasure of your personal data when the specified purpose of collection is no longer served, subject to statutory retention obligations.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-brand-teal" />
                Right of Grievance Redressal & Nomination
              </h3>
              <p className="text-xs text-slate-600">
                You have the right to an accessible grievance redressal mechanism and the right to nominate an individual to exercise your rights in the event of death or incapacity.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/privacy/data-rights"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-teal hover:underline"
            >
              Submit an official Data Principal Rights Request &rarr;
            </Link>
          </div>
        </div>

        {/* Grievance Redressal Mechanism */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-brand-teal" />
            4. Designated Grievance Redressal Officer
          </h2>
          <p className="text-sm text-slate-600">
            In accordance with Section 13 of the DPDP Act 2023, the Data Fiduciary has appointed a designated Grievance Officer to resolve privacy concerns:
          </p>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-700">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="font-bold block text-slate-900">Designation:</span>
                <span>Data Protection & Grievance Redressal Officer</span>
              </div>
              <div>
                <span className="font-bold block text-slate-900">Response Window:</span>
                <span>Acknowledgment within 24 hours; Resolution within 15 business days</span>
              </div>
              <div>
                <span className="font-bold block text-slate-900">Email:</span>
                <span className="font-mono text-brand-teal">privacy@propertyos.internal</span>
              </div>
              <div>
                <span className="font-bold block text-slate-900">Escalation Authority:</span>
                <span>Data Protection Board of India (DPBI)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
