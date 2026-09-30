'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Wrench,
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  Building2,
  Calendar,
  IndianRupee,
  Paperclip,
  MessageSquare,
  History,
  Send,
  Play,
  Check,
  ShieldCheck,
  Ban,
  RefreshCw,
} from 'lucide-react';

const API_BASE = '/api/v1';

export default function MaintenanceTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: ticketId } = use(params);

  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [newComment, setNewComment] = useState<string>('');
  const [submittingComment, setSubmittingComment] = useState<boolean>(false);

  // Modal / Action States
  const [actionModal, setActionModal] = useState<string | null>(null); // 'ASSIGN', 'COMPLETE', 'CANCEL'
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [assignNotes, setAssignNotes] = useState<string>('');
  const [actualCostInput, setActualCostInput] = useState<string>('');
  const [resolutionNotesInput, setResolutionNotesInput] = useState<string>('');
  const [cancelReasonInput, setCancelReasonInput] = useState<string>('');
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchTicket = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/maintenance/tickets/${ticketId}`, { headers, credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setTicket(json.data);
      }
    } catch (e) {
      console.error('Failed to load ticket:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/team`, { headers, credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setStaffUsers(json.data || []);
      }
    } catch (e) {
      console.error('Failed to load team:', e);
    }
  };

  useEffect(() => {
    fetchTicket();
    fetchTeamMembers();
  }, [ticketId]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/maintenance/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ body: newComment.trim() }),
      });

      if (res.ok) {
        setNewComment('');
        fetchTicket();
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to post comment');
      }
    } catch (e: any) {
      alert(e.message || 'An error occurred while posting comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const executeAction = async (endpoint: string, method: string = 'POST', payload: any = {}) => {
    setIsProcessingAction(true);
    setActionError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/maintenance/tickets/${ticketId}/${endpoint}`, {
        method,
        headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || `Failed to perform action`);
      }

      setActionModal(null);
      fetchTicket();
    } catch (e: any) {
      setActionError(e.message || 'Error updating ticket status');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const STEPS = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CLOSED'];
  const currentStepIndex = STEPS.indexOf(ticket?.status || 'OPEN');

  return (
    <AppShell activePath="/maintenance">
      <div className="space-y-6 w-full pb-16">
        {/* Back Link & Page Header */}
        <div className="flex items-center gap-2 mb-1">
          <Link
            href="/maintenance"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-surface-textSecondary hover:text-brand-navy transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Maintenance Tickets</span>
          </Link>
        </div>

        {loading ? (
          <div className="bg-brand-white border border-surface-border rounded-xl p-16 text-center text-surface-textSecondary space-y-3">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto text-brand-teal" />
            <p className="text-xs font-medium">Loading ticket details...</p>
          </div>
        ) : !ticket ? (
          <EmptyState
            icon={AlertTriangle}
            title="Ticket Not Found"
            description="The requested maintenance ticket does not exist or you do not have permission to access it."
            actionLabel="Return to Tickets"
            actionHref="/maintenance"
          />
        ) : (
          <>
            {/* Header with Title and Actions */}
            <PageHeader
              title={ticket.title}
              subtitle={`${ticket.property?.name} • ${ticket.category.replace('_', ' ')} • Created ${new Date(ticket.createdAt).toLocaleDateString()}`}
              icon={Wrench}
              badge={
                <div className="flex items-center gap-2 ml-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-brand-teal px-2 py-0.5 rounded bg-teal-50 border border-teal-200">
                    {ticket.ticketNumber}
                  </span>
                  <StatusBadge status={ticket.priority} />
                  <StatusBadge status={ticket.status} />
                </div>
              }
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  {ticket.status === 'OPEN' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setActionError(null);
                        setActionModal('ASSIGN');
                      }}
                      className="gap-1.5"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Assign Staff</span>
                    </Button>
                  )}

                  {(ticket.status === 'OPEN' || ticket.status === 'ASSIGNED') && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => executeAction('start')}
                      isLoading={isProcessingAction}
                      className="gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Start Work</span>
                    </Button>
                  )}

                  {(ticket.status === 'IN_PROGRESS' || ticket.status === 'ASSIGNED') && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setActionError(null);
                        setActionModal('COMPLETE');
                      }}
                      className="gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Complete Work</span>
                    </Button>
                  )}

                  {ticket.status === 'COMPLETED' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => executeAction('verify')}
                      isLoading={isProcessingAction}
                      className="gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Verify Work</span>
                    </Button>
                  )}

                  {(ticket.status === 'VERIFIED' || ticket.status === 'COMPLETED') && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => executeAction('close')}
                      isLoading={isProcessingAction}
                      className="gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Close Ticket</span>
                    </Button>
                  )}

                  {ticket.status !== 'CLOSED' && ticket.status !== 'CANCELLED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setActionError(null);
                        setActionModal('CANCEL');
                      }}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 gap-1.5"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </Button>
                  )}
                </div>
              }
            />

            {/* State Machine Progress Stepper */}
            <div className="bg-brand-white border border-surface-border rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-surface-textSecondary">
                <span>Workflow Progression</span>
                <span className="uppercase font-bold text-brand-teal">Current Status: {ticket.status}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1">
                {STEPS.map((st, idx) => {
                  const isCompleted = currentStepIndex > idx || ticket.status === 'CLOSED';
                  const isCurrent = ticket.status === st;
                  const isCancelled = ticket.status === 'CANCELLED';

                  return (
                    <div key={st} className="flex flex-col items-center gap-1.5 text-center">
                      <div
                        className={`w-full h-2 rounded-full transition-colors ${
                          isCancelled
                            ? 'bg-rose-200'
                            : isCompleted
                            ? 'bg-brand-teal'
                            : isCurrent
                            ? 'bg-amber-400 animate-pulse'
                            : 'bg-slate-100'
                        }`}
                      />
                      <span
                        className={`text-[10px] uppercase font-bold tracking-wider ${
                          isCurrent
                            ? 'text-amber-700'
                            : isCompleted
                            ? 'text-brand-teal'
                            : 'text-surface-disabled'
                        }`}
                      >
                        {st.replace('_', ' ')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ticket Details & Comments Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Main Info, Comments, Attachments */}
              <div className="lg:col-span-2 space-y-6">
                {/* Issue Details Card */}
                <div className="bg-brand-white border border-surface-border rounded-xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                        {ticket.category.replace('_', ' ')}
                      </span>
                      <StatusBadge status={ticket.priority} />
                    </div>
                    <span className="text-xs text-surface-textSecondary">
                      Logged: {new Date(ticket.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-brand-navy mb-2">{ticket.title}</h3>
                    <p className="text-xs text-brand-navy whitespace-pre-wrap leading-relaxed">
                      {ticket.description}
                    </p>
                  </div>

                  {ticket.resolutionNotes && (
                    <div className="bg-surface-subtle border border-surface-border rounded-lg p-4 mt-3">
                      <span className="text-xs font-bold text-brand-teal uppercase tracking-wider block">
                        Resolution Notes
                      </span>
                      <p className="text-xs text-brand-navy mt-1">{ticket.resolutionNotes}</p>
                    </div>
                  )}
                </div>

                {/* Comments & Discussion */}
                <div className="bg-brand-white border border-surface-border rounded-xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 text-brand-navy font-bold text-sm">
                    <MessageSquare className="w-4 h-4 text-brand-teal" />
                    <span>Discussion & Updates ({ticket.comments?.length || 0})</span>
                  </div>

                  {/* Comments List */}
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {ticket.comments?.length === 0 ? (
                      <p className="text-xs text-surface-textSecondary italic py-3 text-center">
                        No comments recorded on this ticket yet.
                      </p>
                    ) : (
                      ticket.comments?.map((comment: any) => (
                        <div
                          key={comment.id}
                          className="bg-surface-subtle border border-surface-border rounded-lg p-3.5 space-y-1"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-brand-navy">
                              {comment.author?.firstName} {comment.author?.lastName}
                            </span>
                            <span className="text-[10px] text-surface-textSecondary">
                              {new Date(comment.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-brand-navy leading-relaxed">{comment.body}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Comment Composer */}
                  <form onSubmit={handleAddComment} className="flex gap-2 pt-3 border-t border-surface-border">
                    <input
                      type="text"
                      placeholder="Add an update or internal note..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="flex-1 bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-xs text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      isLoading={submittingComment}
                      disabled={!newComment.trim()}
                      className="gap-1.5 shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Post</span>
                    </Button>
                  </form>
                </div>

                {/* Attachments Section */}
                <div className="bg-brand-white border border-surface-border rounded-xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 text-brand-navy font-bold text-sm">
                    <Paperclip className="w-4 h-4 text-brand-teal" />
                    <span>Evidence & Attachments ({ticket.attachments?.length || 0})</span>
                  </div>

                  {ticket.attachments?.length === 0 ? (
                    <p className="text-xs text-surface-textSecondary italic py-3 text-center">
                      No attachments uploaded for this ticket.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {ticket.attachments?.map((att: any) => (
                        <div
                          key={att.id}
                          className="bg-surface-subtle border border-surface-border rounded-xl p-3 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded bg-white text-[10px] font-bold text-brand-teal border border-surface-border">
                              {att.type}
                            </span>
                            <span className="text-[10px] text-surface-textSecondary">
                              {(att.fileSize / 1024).toFixed(0)} KB
                            </span>
                          </div>
                          <p className="font-semibold text-brand-navy truncate">{att.fileName}</p>
                          <p className="text-[10px] text-surface-textSecondary">
                            By: {att.uploadedBy?.firstName}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Col: Metadata, Assigned Staff, Timeline */}
              <div className="space-y-6">
                {/* Location & Property Card */}
                <div className="bg-brand-white border border-surface-border rounded-xl p-5 shadow-sm space-y-3">
                  <span className="text-xs font-bold text-surface-textSecondary uppercase tracking-wider block">
                    Target & Location
                  </span>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-surface-border">
                      <span className="text-surface-textSecondary">Property:</span>
                      <span className="font-semibold text-brand-navy">{ticket.property?.name}</span>
                    </div>
                    {ticket.room && (
                      <div className="flex justify-between py-1 border-b border-surface-border">
                        <span className="text-surface-textSecondary">Room:</span>
                        <span className="font-semibold text-brand-navy">Room {ticket.room.roomNumber}</span>
                      </div>
                    )}
                    {ticket.bed && (
                      <div className="flex justify-between py-1 border-b border-surface-border">
                        <span className="text-surface-textSecondary">Bed:</span>
                        <span className="font-semibold text-brand-navy">Bed {ticket.bed.bedNumber}</span>
                      </div>
                    )}
                    {ticket.rentalUnit && (
                      <div className="flex justify-between py-1 border-b border-surface-border">
                        <span className="text-surface-textSecondary">Rental Unit:</span>
                        <span className="font-semibold text-brand-navy">Unit {ticket.rentalUnit.unitNumber}</span>
                      </div>
                    )}
                    {ticket.locationDetails && (
                      <div className="flex justify-between py-1 border-b border-surface-border">
                        <span className="text-surface-textSecondary">Details:</span>
                        <span className="font-semibold text-brand-navy">{ticket.locationDetails}</span>
                      </div>
                    )}
                    {ticket.tenant && (
                      <div className="flex justify-between py-1">
                        <span className="text-surface-textSecondary">Tenant:</span>
                        <span className="font-semibold text-brand-navy">
                          {ticket.tenant.firstName} {ticket.tenant.lastName}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Assigned Staff & Vendor Card */}
                <div className="bg-brand-white border border-surface-border rounded-xl p-5 shadow-sm space-y-3">
                  <span className="text-xs font-bold text-surface-textSecondary uppercase tracking-wider block">
                    Staff & Financials
                  </span>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-surface-border">
                      <span className="text-surface-textSecondary">Assigned Staff:</span>
                      <span className="font-semibold text-brand-teal">
                        {ticket.assignedTo
                          ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`
                          : 'Unassigned'}
                      </span>
                    </div>
                    {ticket.vendor && (
                      <div className="flex justify-between py-1 border-b border-surface-border">
                        <span className="text-surface-textSecondary">Vendor:</span>
                        <span className="font-semibold text-brand-navy">
                          {ticket.vendor.name} ({ticket.vendor.phone})
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 border-b border-surface-border">
                      <span className="text-surface-textSecondary">Est Cost:</span>
                      <span className="font-semibold text-brand-navy">
                        {ticket.estimatedCost ? `₹${ticket.estimatedCost}` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-surface-textSecondary">Actual Cost:</span>
                      <span className="font-bold text-emerald-700">
                        {ticket.actualCost ? `₹${ticket.actualCost}` : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Transition History Trail */}
                <div className="bg-brand-white border border-surface-border rounded-xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-surface-textSecondary uppercase tracking-wider">
                    <History className="w-3.5 h-3.5 text-brand-teal" />
                    <span>Status History Audit</span>
                  </div>
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1 text-xs">
                    {ticket.statusHistory?.map((h: any, idx: number) => (
                      <div key={h.id || idx} className="border-l-2 border-brand-teal pl-3 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-brand-navy text-[11px]">
                            {h.fromStatus} → {h.toStatus}
                          </span>
                          <span className="text-[10px] text-surface-textSecondary">
                            {new Date(h.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {h.reason && <p className="text-[11px] text-surface-textSecondary">{h.reason}</p>}
                        <p className="text-[10px] text-surface-disabled">
                          By: {h.changedBy?.firstName || 'System'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Assign Modal */}
      <Modal
        isOpen={actionModal === 'ASSIGN'}
        onClose={() => setActionModal(null)}
        title="Assign Staff Member"
        subtitle="Assign a team member to take ownership of this ticket"
        maxWidth="md"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setActionModal(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!selectedStaffId}
              isLoading={isProcessingAction}
              onClick={() =>
                executeAction('assign', 'POST', { assignedToId: selectedStaffId, notes: assignNotes })
              }
            >
              Assign
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {actionError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {actionError}
            </div>
          )}
          <div>
            <label className="block text-brand-navy font-semibold mb-1">Staff Member *</label>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-xs text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
            >
              <option value="">Select Team Member</option>
              {staffUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-brand-navy font-semibold mb-1">Assignment Notes</label>
            <textarea
              rows={2}
              value={assignNotes}
              onChange={(e) => setAssignNotes(e.target.value)}
              placeholder="Instructions for staff member..."
              className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-xs text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
            />
          </div>
        </div>
      </Modal>

      {/* Complete Modal */}
      <Modal
        isOpen={actionModal === 'COMPLETE'}
        onClose={() => setActionModal(null)}
        title="Complete Maintenance Work"
        subtitle="Record resolution details and actual cost incurred"
        maxWidth="md"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setActionModal(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={isProcessingAction}
              onClick={() =>
                executeAction('complete', 'POST', {
                  actualCost: actualCostInput ? parseFloat(actualCostInput) : undefined,
                  resolutionNotes: resolutionNotesInput,
                })
              }
            >
              Complete Work
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {actionError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {actionError}
            </div>
          )}
          <div>
            <label className="block text-brand-navy font-semibold mb-1">Actual Cost Incurred (₹)</label>
            <input
              type="number"
              step="0.01"
              placeholder="e.g. 750.00"
              value={actualCostInput}
              onChange={(e) => setActualCostInput(e.target.value)}
              className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-xs text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
            />
          </div>
          <div>
            <label className="block text-brand-navy font-semibold mb-1">Resolution Summary</label>
            <textarea
              rows={3}
              placeholder="Detail what repairs or replacements were conducted..."
              value={resolutionNotesInput}
              onChange={(e) => setResolutionNotesInput(e.target.value)}
              className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-xs text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
            />
          </div>
        </div>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        isOpen={actionModal === 'CANCEL'}
        onClose={() => setActionModal(null)}
        title="Cancel Maintenance Request"
        subtitle="State why this ticket is being cancelled"
        maxWidth="md"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setActionModal(null)}>
              Back
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={!cancelReasonInput.trim()}
              isLoading={isProcessingAction}
              onClick={() => executeAction('cancel', 'POST', { reason: cancelReasonInput })}
            >
              Confirm Cancellation
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {actionError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {actionError}
            </div>
          )}
          <div>
            <label className="block text-brand-navy font-semibold mb-1">Cancellation Reason *</label>
            <textarea
              required
              rows={3}
              placeholder="State why this ticket is being cancelled..."
              value={cancelReasonInput}
              onChange={(e) => setCancelReasonInput(e.target.value)}
              className="w-full bg-surface-subtle border border-surface-border rounded-lg px-3 py-2 text-xs text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
            />
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
