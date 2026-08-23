'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { PropertyType } from '@propertyos/types';
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
  XCircle,
  Play,
  Check,
  ShieldCheck,
  Ban,
  RefreshCw,
  Plus,
} from 'lucide-react';

const API_BASE = '/api/v1';

export default function MaintenanceTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: ticketId } = use(params);

  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [newComment, setNewComment] = useState<string>('');
  const [submittingComment, setSubmittingComment] = useState<boolean>(false);

  // Modal / Action States
  const [actionModal, setActionModal] = useState<string | null>(null); // 'ASSIGN', 'COMPLETE', 'CANCEL', 'VERIFY', 'CLOSE'
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [assignNotes, setAssignNotes] = useState<string>('');
  const [actualCostInput, setActualCostInput] = useState<string>('');
  const [resolutionNotesInput, setResolutionNotesInput] = useState<string>('');
  const [cancelReasonInput, setCancelReasonInput] = useState<string>('');
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);

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
      alert(e.message || 'Error updating ticket status');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const propertyType = ticket?.property?.propertyType === 'RENTAL_HOUSE' ? PropertyType.RENTAL_HOUSE : PropertyType.PG;

  const STEPS = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CLOSED'];
  const currentStepIndex = STEPS.indexOf(ticket?.status || 'OPEN');

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-hidden">
      {/* Sidebar */}
      <Sidebar currentPropertyType={propertyType} activePath="/maintenance" />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-900/50">
        {/* Header */}
        <header className="h-16 px-8 border-b border-slate-800 bg-slate-900/80 backdrop-blur flex items-center justify-between shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <Link
              href="/maintenance"
              className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-teal-400">{ticket?.ticketNumber}</span>
                <span className="text-slate-500">•</span>
                <h1 className="font-bold text-base text-white tracking-tight">{ticket?.title || 'Loading Ticket...'}</h1>
              </div>
              <p className="text-xs text-slate-400">{ticket?.property?.name}</p>
            </div>
          </div>

          {/* Action Buttons Toolbar */}
          {ticket && (
            <div className="flex items-center gap-2">
              {ticket.status === 'OPEN' && (
                <button
                  onClick={() => setActionModal('ASSIGN')}
                  className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow transition"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Assign Staff</span>
                </button>
              )}

              {(ticket.status === 'OPEN' || ticket.status === 'ASSIGNED') && (
                <button
                  onClick={() => executeAction('start')}
                  disabled={isProcessingAction}
                  className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow transition"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Start Work</span>
                </button>
              )}

              {(ticket.status === 'IN_PROGRESS' || ticket.status === 'ASSIGNED') && (
                <button
                  onClick={() => setActionModal('COMPLETE')}
                  className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow transition"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Complete Work</span>
                </button>
              )}

              {ticket.status === 'COMPLETED' && (
                <button
                  onClick={() => executeAction('verify')}
                  disabled={isProcessingAction}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow transition"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verify Work</span>
                </button>
              )}

              {(ticket.status === 'VERIFIED' || ticket.status === 'COMPLETED') && (
                <button
                  onClick={() => executeAction('close')}
                  disabled={isProcessingAction}
                  className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow transition"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Close Ticket</span>
                </button>
              )}

              {ticket.status !== 'CLOSED' && ticket.status !== 'CANCELLED' && (
                <button
                  onClick={() => setActionModal('CANCEL')}
                  className="flex items-center gap-1.5 bg-rose-600/20 text-rose-300 hover:bg-rose-600/30 px-3 py-1.5 rounded-lg text-xs font-semibold border border-rose-500/30 transition"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              )}
            </div>
          )}
        </header>

        {loading ? (
          <div className="p-16 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-teal-400 mb-3" />
            <p className="text-sm">Loading ticket details...</p>
          </div>
        ) : !ticket ? (
          <div className="p-16 text-center text-slate-400">
            <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white">Ticket Not Found</h3>
            <p className="text-xs text-slate-400 mt-1">The requested ticket does not exist or you do not have permission to view it.</p>
          </div>
        ) : (
          <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
            {/* State Machine Progress Bar */}
            <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-4">
                <span>Workflow Progression</span>
                <span className="uppercase font-bold text-teal-400">Current: {ticket.status}</span>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {STEPS.map((st, idx) => {
                  const isCompleted = currentStepIndex > idx || ticket.status === 'CLOSED';
                  const isCurrent = ticket.status === st;
                  const isCancelled = ticket.status === 'CANCELLED';

                  return (
                    <div key={st} className="flex flex-col items-center gap-2 text-center">
                      <div
                        className={`w-full h-2 rounded-full transition ${
                          isCancelled
                            ? 'bg-rose-500/40'
                            : isCompleted
                            ? 'bg-teal-500'
                            : isCurrent
                            ? 'bg-amber-400 animate-pulse'
                            : 'bg-slate-800'
                        }`}
                      />
                      <span
                        className={`text-[10px] uppercase font-bold tracking-wider ${
                          isCurrent ? 'text-amber-400' : isCompleted ? 'text-teal-400' : 'text-slate-500'
                        }`}
                      >
                        {st}
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
                <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-teal-500/10 text-teal-400 border border-teal-500/20">
                        {ticket.category}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                          ticket.priority === 'URGENT'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : ticket.priority === 'HIGH'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}
                      >
                        {ticket.priority} Priority
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">Created: {new Date(ticket.createdAt).toLocaleString()}</span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white mb-2">{ticket.title}</h3>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
                  </div>

                  {ticket.resolutionNotes && (
                    <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-4 mt-4">
                      <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Resolution Notes</span>
                      <p className="text-xs text-slate-300 mt-1">{ticket.resolutionNotes}</p>
                    </div>
                  )}
                </div>

                {/* Comments & Activity Stream */}
                <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <MessageSquare className="w-4 h-4 text-teal-400" />
                    <span>Internal Comments & Discussion ({ticket.comments?.length || 0})</span>
                  </div>

                  {/* Comments List */}
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {ticket.comments?.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No comments on this ticket yet.</p>
                    ) : (
                      ticket.comments?.map((comment: any) => (
                        <div key={comment.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-teal-300">
                              {comment.author?.firstName} {comment.author?.lastName}
                            </span>
                            <span className="text-[10px] text-slate-500">{new Date(comment.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">{comment.body}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Comment Composer */}
                  <form onSubmit={handleAddComment} className="flex gap-2 pt-3 border-t border-slate-800">
                    <input
                      type="text"
                      placeholder="Add an update or internal note..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                    />
                    <button
                      type="submit"
                      disabled={submittingComment || !newComment.trim()}
                      className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Post</span>
                    </button>
                  </form>
                </div>

                {/* Attachments Section */}
                <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white font-bold text-sm">
                      <Paperclip className="w-4 h-4 text-teal-400" />
                      <span>Evidence & Attachments ({ticket.attachments?.length || 0})</span>
                    </div>
                  </div>

                  {ticket.attachments?.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No attachments uploaded.</p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {ticket.attachments?.map((att: any) => (
                        <div key={att.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-teal-300">
                              {att.type}
                            </span>
                            <span className="text-[10px] text-slate-500">{(att.fileSize / 1024).toFixed(0)} KB</span>
                          </div>
                          <p className="font-semibold text-slate-200 truncate">{att.fileName}</p>
                          <p className="text-[10px] text-slate-400">By: {att.uploadedBy?.firstName}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Col: Metadata, Assigned Staff, Timeline */}
              <div className="space-y-6">
                {/* Location & Property Card */}
                <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Target & Location</span>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Property:</span>
                      <span className="font-semibold text-white">{ticket.property?.name}</span>
                    </div>
                    {ticket.room && (
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">Room:</span>
                        <span className="font-semibold text-white">Room {ticket.room.roomNumber}</span>
                      </div>
                    )}
                    {ticket.bed && (
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">Bed:</span>
                        <span className="font-semibold text-white">Bed {ticket.bed.bedNumber}</span>
                      </div>
                    )}
                    {ticket.rentalUnit && (
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">Rental Unit:</span>
                        <span className="font-semibold text-white">Unit {ticket.rentalUnit.unitNumber}</span>
                      </div>
                    )}
                    {ticket.locationDetails && (
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">Details:</span>
                        <span className="font-semibold text-white">{ticket.locationDetails}</span>
                      </div>
                    )}
                    {ticket.tenant && (
                      <div className="flex justify-between py-1">
                        <span className="text-slate-400">Tenant:</span>
                        <span className="font-semibold text-white">{ticket.tenant.firstName} {ticket.tenant.lastName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Assigned Staff & Vendor Card */}
                <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Staff & Handling</span>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Assigned Staff:</span>
                      <span className="font-semibold text-teal-300">
                        {ticket.assignedTo ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}` : 'Unassigned'}
                      </span>
                    </div>
                    {ticket.vendor && (
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">Vendor:</span>
                        <span className="font-semibold text-white">{ticket.vendor.name} ({ticket.vendor.phone})</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Est Cost:</span>
                      <span className="font-semibold text-slate-300">
                        {ticket.estimatedCost ? `₹${ticket.estimatedCost}` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Actual Cost:</span>
                      <span className="font-bold text-emerald-400">
                        {ticket.actualCost ? `₹${ticket.actualCost}` : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Transition History Trail */}
                <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <History className="w-3.5 h-3.5 text-teal-400" />
                    <span>Audit Trail</span>
                  </div>
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1 text-xs">
                    {ticket.statusHistory?.map((h: any, idx: number) => (
                      <div key={h.id || idx} className="border-l-2 border-teal-500 pl-3 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-[11px]">
                            {h.fromStatus} → {h.toStatus}
                          </span>
                          <span className="text-[10px] text-slate-500">{new Date(h.createdAt).toLocaleDateString()}</span>
                        </div>
                        {h.reason && <p className="text-[11px] text-slate-400">{h.reason}</p>}
                        <p className="text-[10px] text-slate-500">By: {h.changedBy?.firstName || 'System'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Action Modals */}
      {actionModal === 'ASSIGN' && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Assign Staff Member</h3>
            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1">Staff User</label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
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
              <label className="block text-xs text-slate-300 font-semibold mb-1">Assignment Notes</label>
              <textarea
                rows={2}
                value={assignNotes}
                onChange={(e) => setAssignNotes(e.target.value)}
                placeholder="Instructions for staff member..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setActionModal(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => executeAction('assign', 'POST', { assignedToId: selectedStaffId, notes: assignNotes })}
                disabled={!selectedStaffId || isProcessingAction}
                className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {actionModal === 'COMPLETE' && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Complete Maintenance Work</h3>
            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1">Actual Cost Incurred (₹)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 750.00"
                value={actualCostInput}
                onChange={(e) => setActualCostInput(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1">Resolution Summary</label>
              <textarea
                rows={3}
                placeholder="Detail what repairs were conducted..."
                value={resolutionNotesInput}
                onChange={(e) => setResolutionNotesInput(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setActionModal(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  executeAction('complete', 'POST', {
                    actualCost: actualCostInput ? parseFloat(actualCostInput) : undefined,
                    resolutionNotes: resolutionNotesInput,
                  })
                }
                disabled={isProcessingAction}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50"
              >
                Complete Work
              </button>
            </div>
          </div>
        </div>
      )}

      {actionModal === 'CANCEL' && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Cancel Maintenance Request</h3>
            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1">Cancellation Reason *</label>
              <textarea
                required
                rows={3}
                placeholder="State why this ticket is being cancelled..."
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setActionModal(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
              >
                Back
              </button>
              <button
                onClick={() => executeAction('cancel', 'POST', { reason: cancelReasonInput })}
                disabled={!cancelReasonInput.trim() || isProcessingAction}
                className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
