'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { BackButton } from '@/components/ui/BackButton';
import {
  Shield,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Send,
  User,
  Phone,
  Mail,
  Building,
  HelpCircle,
} from 'lucide-react';

export default function DataRightsPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    relationship: 'TENANT',
    propertyReference: '',
    rightType: 'ACCESS',
    specificDetails: '',
    identificationProofType: 'AADHAAR_LAST4',
    identificationNumber: '',
  });

  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketId, setTicketId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate structured processing and ticket generation
    setTimeout(() => {
      const generatedTicket = `DPR-${Date.now().toString().slice(-6)}`;
      setTicketId(generatedTicket);
      setIsSubmitting(false);
      setSubmitted(true);
    }, 600);
  };

  return (
    <AppShell activePath="/settings/organization">
      <div className="max-w-3xl mx-auto space-y-6 pb-16">
        {/* Navigation Breadcrumb & Back Button */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Link href="/privacy" className="hover:text-brand-teal">
              Privacy Notice
            </Link>
            <span>/</span>
            <span className="text-slate-900 font-semibold">Data Rights Request</span>
          </div>

          <BackButton fallbackHref="/privacy" label="Back to Privacy Notice" />
        </div>

        {/* Legal Disclaimer */}
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <span className="font-bold uppercase tracking-wider text-amber-800">
              LEGAL REVIEW REQUIRED:
            </span>{' '}
            Requests submitted via this form are processed in accordance with Sections 11–14 of the{' '}
            <strong>Digital Personal Data Protection Act, 2023</strong>. Statutory retention obligations
            (such as GST/Income Tax records and active lease obligations) take legal precedence over
            erasure requests.
          </div>
        </div>

        {/* Header */}
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold text-brand-navy flex items-center gap-2">
            <Shield className="w-6 h-6 text-brand-teal" />
            Data Principal Rights Request Portal
          </h1>
          <p className="text-sm text-surface-textSecondary mt-1">
            Exercise your statutory rights to access, correct, erase, or nominate representatives under the DPDP Act 2023.
          </p>
        </div>

        {submitted ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              Data Rights Request Acknowledged
            </h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Your request has been securely logged with the Grievance Redressal Office. A verification
              link has been dispatched to your contact details.
            </p>
            <div className="inline-block p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800">
              Reference Ticket ID: <strong>{ticketId}</strong>
            </div>
            <div className="text-xs text-slate-500 pt-2">
              Statutory Resolution Window: <strong>Within 15 Business Days</strong>
            </div>
            <div className="pt-4 flex justify-center gap-3">
              <button
                onClick={() => {
                  setSubmitted(false);
                  setFormData({
                    fullName: '',
                    phone: '',
                    email: '',
                    relationship: 'TENANT',
                    propertyReference: '',
                    rightType: 'ACCESS',
                    specificDetails: '',
                    identificationProofType: 'AADHAAR_LAST4',
                    identificationNumber: '',
                  });
                }}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition"
              >
                Submit Another Request
              </button>
              <Link
                href="/privacy"
                className="px-4 py-2 rounded-lg bg-brand-teal text-white text-xs font-semibold hover:bg-teal-700 transition"
              >
                Return to Privacy Notice
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
            {/* Step 1: Data Principal Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                1. Data Principal Identity Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="Enter full legal name"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Relationship with Property / Organization *
                  </label>
                  <select
                    value={formData.relationship}
                    onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                  >
                    <option value="TENANT">Current Tenant / Resident</option>
                    <option value="FORMER_TENANT">Former Tenant (Checked Out)</option>
                    <option value="PROSPECT">Prospective Tenant / Applicant</option>
                    <option value="STAFF">Employee / Maintenance Staff</option>
                    <option value="VISITOR">Visitor / Guest</option>
                    <option value="NOMINEE">Nominee / Legal Representative</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Registered Contact Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 9876543210"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Registered Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="resident@example.com"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Select Specific Statutory Right */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                2. Select Statutory Right to Exercise
              </h3>

              <div className="space-y-2">
                {[
                  {
                    id: 'ACCESS',
                    title: 'Right to Access Summary (Section 11)',
                    desc: 'Obtain an official summary of all personal data, stay records, and billing transactions processed by the organization.',
                  },
                  {
                    id: 'CORRECTION',
                    title: 'Right to Correction & Updating (Section 12)',
                    desc: 'Request correction of inaccurate information, incomplete KYC records, or change of registered contact credentials.',
                  },
                  {
                    id: 'ERASURE',
                    title: 'Right to Erasure / Account Closure (Section 12)',
                    desc: 'Request deletion of personal data upon checkout and lease completion (subject to statutory audit & tax laws).',
                  },
                  {
                    id: 'NOMINATION',
                    title: 'Right to Nominate Representative (Section 14)',
                    desc: 'Formally register or modify a nominee to exercise data rights in the event of death or incapacity.',
                  },
                  {
                    id: 'GRIEVANCE',
                    title: 'Grievance Redressal Complaint (Section 13)',
                    desc: 'File an official grievance regarding data processing, security safeguards, or unresolved requests.',
                  },
                ].map((right) => (
                  <label
                    key={right.id}
                    className={`block p-3.5 rounded-xl border cursor-pointer transition ${
                      formData.rightType === right.id
                        ? 'border-brand-teal bg-teal-50/40 ring-1 ring-brand-teal'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="rightType"
                        value={right.id}
                        checked={formData.rightType === right.id}
                        onChange={() => setFormData({ ...formData, rightType: right.id })}
                        className="mt-1 text-brand-teal focus:ring-brand-teal"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">{right.title}</span>
                        <span className="text-xs text-slate-500 block mt-0.5">{right.desc}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Step 3: Specific Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                3. Request Details & Specific Directives
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Describe your request or specific data records *
                </label>
                <textarea
                  required
                  rows={4}
                  value={formData.specificDetails}
                  onChange={(e) => setFormData({ ...formData, specificDetails: e.target.value })}
                  placeholder="Provide any relevant context, room number, stay dates, or specific fields to update/erase..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                />
              </div>
            </div>

            {/* Affirmation and Submit */}
            <div className="pt-2 border-t border-slate-100 space-y-4">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  required
                  id="affirm"
                  className="mt-0.5 text-brand-teal focus:ring-brand-teal rounded"
                />
                <label htmlFor="affirm" className="text-xs text-slate-600">
                  I hereby affirm that I am the authorized Data Principal or appointed legal representative
                  and that the details provided are accurate and true under the DPDP Act 2023.
                </label>
              </div>

              <div className="flex items-center justify-end gap-3">
                <Link
                  href="/privacy"
                  className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-teal text-white text-xs font-bold hover:bg-teal-700 transition shadow-sm disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Submitting Request...' : 'Submit Official Request'}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
