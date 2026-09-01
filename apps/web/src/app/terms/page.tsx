'use client';

import React from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import {
  FileText,
  Shield,
  AlertCircle,
  CheckCircle2,
  Building,
  Scale,
  Lock,
} from 'lucide-react';

export default function TermsOfServicePage() {
  return (
    <AppShell activePath="/settings/organization">
      <div className="max-w-4xl mx-auto space-y-6 pb-16">
        {/* Legal Disclaimer */}
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <span className="font-bold uppercase tracking-wider text-amber-800">
              LEGAL REVIEW REQUIRED:
            </span>{' '}
            These Terms of Service include standard data fiduciary clauses aligned with the{' '}
            <strong>Digital Personal Data Protection Act, 2023 (India)</strong>. Operating organizations
            must execute tailored commercial terms with their legal counsel.
          </div>
        </div>

        {/* Header */}
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold text-brand-navy flex items-center gap-2">
            <FileText className="w-6 h-6 text-brand-teal" />
            Terms of Service & Platform Governance
          </h1>
          <p className="text-sm text-surface-textSecondary mt-1">
            Enterprise Operating Agreement & Data Protection Terms
          </p>
        </div>

        {/* Content Sections */}
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm space-y-6 text-sm text-slate-700 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building className="w-4 h-4 text-brand-teal" />
              1. Platform Purpose & Scope
            </h2>
            <p>
              PropertyOS provides enterprise software tools for property owners, co-living operators,
              and facility managers to administer properties, record occupant tenancy contracts,
              generate rent invoices, log operational maintenance requests, and maintain compliance records.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-brand-teal" />
              2. Data Protection & DPDP Act Compliance
            </h2>
            <p>
              The Organization acts as a <strong>Data Fiduciary</strong> in respect of all resident,
              occupant, staff, and visitor personal data entered into the system. All processing is
              conducted strictly for executing tenancy agreements, maintaining premises security, and
              fulfilling statutory reporting obligations under Indian law.
            </p>
            <p>
              Data Principals may exercise their statutory rights of access, correction, erasure, and
              nomination via our dedicated portal at{' '}
              <Link href="/privacy/data-rights" className="text-brand-teal font-semibold hover:underline">
                /privacy/data-rights
              </Link>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-brand-teal" />
              3. Security Safeguards & Audit Immutability
            </h2>
            <p>
              PropertyOS incorporates append-only cryptographic audit logging for financial and
              administrative actions. System records, ledger entries, and access logs are protected
              against tampering and unauthorized alterations.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Scale className="w-4 h-4 text-brand-teal" />
              4. Governing Law & Jurisdiction
            </h2>
            <p>
              These Terms and any dispute or claim arising out of or in connection with them shall be
              governed by and construed in accordance with the laws of India, and subject to the
              jurisdiction of the competent courts of India.
            </p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
