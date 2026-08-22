'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/lib/auth-context';
import {
  AgreementTemplateDto,
  AgreementType,
  TemplateStatus,
} from '@propertyos/types';
import {
  FileText,
  Plus,
  ArrowLeft,
  Search,
  CheckCircle2,
  Archive,
  Edit,
  History,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  X,
  Code,
  Sparkles,
} from 'lucide-react';

const SUPPORTED_PLACEHOLDERS = [
  { token: '{{TENANT_NAME}}', desc: 'Full name of the tenant' },
  { token: '{{TENANT_PHONE}}', desc: 'Primary contact phone' },
  { token: '{{TENANT_EMAIL}}', desc: 'Tenant email address' },
  { token: '{{TENANT_ADDRESS}}', desc: 'Permanent residential address' },
  { token: '{{TENANT_CITY}}', desc: 'Permanent city' },
  { token: '{{TENANT_STATE}}', desc: 'Permanent state' },
  { token: '{{PROPERTY_NAME}}', desc: 'Property display name' },
  { token: '{{PROPERTY_ADDRESS}}', desc: 'Property physical address' },
  { token: '{{PROPERTY_CITY}}', desc: 'Property city' },
  { token: '{{LEASE_START_DATE}}', desc: 'Start date of the lease' },
  { token: '{{LEASE_END_DATE}}', desc: 'End date of the lease' },
  { token: '{{MONTHLY_RENT}}', desc: 'Monthly rent amount' },
  { token: '{{SECURITY_DEPOSIT}}', desc: 'Security deposit amount' },
  { token: '{{UNIT_NUMBER}}', desc: 'Rental unit number (Whole Unit)' },
  { token: '{{BED_NUMBER}}', desc: 'Assigned bed number (PG)' },
  { token: '{{ROOM_NUMBER}}', desc: 'Assigned room number (PG)' },
  { token: '{{EMERGENCY_CONTACT_NAME}}', desc: 'Emergency contact name' },
  { token: '{{EMERGENCY_CONTACT_PHONE}}', desc: 'Emergency contact phone' },
  { token: '{{AGREEMENT_DATE}}', desc: 'Current agreement date' },
];

export default function AgreementTemplatesPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<AgreementTemplateDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AgreementTemplateDto | null>(null);
  const [showCheatsheet, setShowCheatsheet] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<AgreementType>(AgreementType.RENTAL_AGREEMENT);
  const [formDescription, setFormDescription] = useState('');
  const [formContent, setFormContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/v1/agreement-templates', {
        headers,
        credentials: 'include',
      });

      if (res.status === 401) {
        setTemplates([]);
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to load agreement templates');
      }

      const json = await res.json();
      const list = json.data?.templates || json.templates || (Array.isArray(json.data) ? json.data : []);
      setTemplates(list);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error fetching templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormType(AgreementType.RENTAL_AGREEMENT);
    setFormDescription('');
    setFormContent(`STANDARD PROPERTY AGREEMENT
Date: {{AGREEMENT_DATE}}

This agreement is entered into between Property Management for {{PROPERTY_NAME}} and Tenant {{TENANT_NAME}} (Phone: {{TENANT_PHONE}}).

1. PREMISES & TERMS:
Monthly Rent: {{MONTHLY_RENT}}
Security Deposit: {{SECURITY_DEPOSIT}}

2. EMERGENCY CONTACT:
Name: {{EMERGENCY_CONTACT_NAME}} ({{EMERGENCY_CONTACT_PHONE}})

3. TERMS & CONDITIONS:
All parties agree to the property community guidelines.`);
    setFormError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (template: AgreementTemplateDto) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormType(template.agreementType);
    setFormDescription(template.description || '');
    setFormContent(template.content);
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const url = editingTemplate
        ? `/api/v1/agreement-templates/${editingTemplate.id}`
        : '/api/v1/agreement-templates';
      const method = editingTemplate ? 'PATCH' : 'POST';

      const payload = editingTemplate
        ? {
            name: formName,
            description: formDescription || undefined,
            content: formContent,
          }
        : {
            name: formName,
            agreementType: formType,
            description: formDescription || undefined,
            content: formContent,
          };

      const res = await fetch(url, {
        method,
        headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to save template');
      }

      setShowModal(false);
      fetchTemplates();
    } catch (err: any) {
      setFormError(err.message || 'Error saving template');
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivate = async (templateId: string) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/agreement-templates/${templateId}/activate`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || 'Failed to activate template');
      }
      fetchTemplates();
    } catch (err: any) {
      alert(`Activation Error: ${err.message}`);
    }
  };

  const handleArchive = async (templateId: string) => {
    if (!confirm('Are you sure you want to archive this template? Archived templates cannot generate new agreements.')) {
      return;
    }
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/agreement-templates/${templateId}/archive`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || 'Failed to archive template');
      }
      fetchTemplates();
    } catch (err: any) {
      alert(`Archive Error: ${err.message}`);
    }
  };

  const copyToken = (tok: string) => {
    navigator.clipboard.writeText(tok);
    setCopiedToken(tok);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  return (
    <AppShell activePath="/settings/organization">
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/agreements"
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition shadow-sm"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Agreement Templates Management
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Versioned legal templates with deterministic placeholder mapping
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowCheatsheet(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition shadow-sm"
            >
              <Code className="w-4 h-4 text-brand-teal" />
              Placeholders Cheatsheet
            </button>

            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal text-white font-medium text-sm hover:bg-teal-700 transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Template
            </button>
          </div>
        </div>

        {/* Templates List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-brand-teal animate-spin mb-3" />
              <p className="text-sm font-medium text-slate-600">Loading templates...</p>
            </div>
          ) : errorMsg ? (
            <div className="py-16 text-center text-rose-500">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm font-medium">{errorMsg}</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800">No Templates Configured</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Create agreement templates with standard placeholders for fast and consistent agreement generation.
              </p>
              <button
                onClick={handleOpenCreate}
                className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-brand-teal text-white text-xs font-semibold hover:bg-teal-700 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Template
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Template Name</th>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4">Version</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Updated</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {templates.map((tmpl) => (
                    <tr key={tmpl.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{tmpl.name}</div>
                        {tmpl.description && (
                          <div className="text-[11px] text-slate-500 truncate max-w-sm mt-0.5">
                            {tmpl.description}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-800">
                          {tmpl.agreementType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-medium">
                          v{tmpl.version}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {tmpl.status === TemplateStatus.ACTIVE ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Active
                          </span>
                        ) : tmpl.status === TemplateStatus.ARCHIVED ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <Archive className="w-3 h-3" /> Archived
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Draft
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(tmpl.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {tmpl.status === TemplateStatus.DRAFT && (
                            <button
                              onClick={() => handleActivate(tmpl.id)}
                              className="px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition"
                            >
                              Activate
                            </button>
                          )}
                          {tmpl.status === TemplateStatus.ACTIVE && (
                            <button
                              onClick={() => handleArchive(tmpl.id)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-100 transition"
                            >
                              Archive
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEdit(tmpl)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
                            title="Edit Template"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create / Edit Template Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-lg">
                  {editingTemplate ? `Edit Template (v${editingTemplate.version})` : 'Create Agreement Template'}
                </h3>
                <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {editingTemplate?.status === TemplateStatus.ACTIVE && (
                <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700 flex items-center gap-2">
                  <History className="w-4 h-4 shrink-0" />
                  <span>
                    This template is ACTIVE. Saving modifications will automatically branch and create a new version (v{editingTemplate.version + 1}) to preserve historical immutability.
                  </span>
                </div>
              )}

              {formError && (
                <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Template Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                  />
                </div>

                {!editingTemplate && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Agreement Type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as AgreementType)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
                    >
                      <option value={AgreementType.RENTAL_AGREEMENT}>RENTAL AGREEMENT</option>
                      <option value={AgreementType.PG_AGREEMENT}>PG AGREEMENT</option>
                      <option value={AgreementType.HOUSE_RULES}>HOUSE RULES</option>
                      <option value={AgreementType.ADDENDUM}>ADDENDUM</option>
                      <option value={AgreementType.OTHER}>OTHER</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Short description of this template"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">
                      Template Content (with Placeholders) <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCheatsheet(true)}
                      className="text-[11px] text-brand-teal hover:underline flex items-center gap-1 font-medium"
                    >
                      <Code className="w-3 h-3" /> View Placeholders
                    </button>
                  </div>
                  <textarea
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    required
                    rows={12}
                    className="w-full font-mono text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20 bg-slate-50/50"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal text-white font-medium hover:bg-teal-700 transition disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : editingTemplate ? 'Update Template' : 'Create Template'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Placeholders Cheatsheet Modal */}
        {showCheatsheet && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-teal-50 text-brand-teal">
                    <Code className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">Supported Placeholders</h3>
                    <p className="text-xs text-slate-500">Deterministic tokens whitelisted for template rendering</p>
                  </div>
                </div>
                <button onClick={() => setShowCheatsheet(false)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 divide-y divide-slate-100 text-xs">
                {SUPPORTED_PLACEHOLDERS.map((item) => (
                  <div key={item.token} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-brand-teal bg-teal-50/70 px-2 py-0.5 rounded">
                        {item.token}
                      </span>
                      <p className="text-slate-500 text-[11px] mt-0.5">{item.desc}</p>
                    </div>
                    <button
                      onClick={() => copyToken(item.token)}
                      className="p-1 text-slate-400 hover:text-brand-teal"
                      title="Copy placeholder"
                    >
                      {copiedToken === item.token ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
