'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { BackButton } from '@/components/ui/BackButton';
import {
  NotificationDto,
  NotificationType,
} from '@propertyos/types';
import { useAuth } from '@/lib/auth-context';
import {
  Bell,
  CheckCheck,
  Check,
  Trash2,
  Search,
  ReceiptText,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Calendar,
  UserMinus,
  ShieldCheck,
  FileText,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  Inbox,
  Clock,
  Sparkles,
  Loader2,
  RefreshCw,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

type TabKey = 'ALL' | 'UNREAD' | 'BILLING' | 'MAINTENANCE' | 'LEASES' | 'VISITORS';

function formatFullDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case NotificationType.RENT_DUE:
      return <ReceiptText className="w-5 h-5 text-amber-600" />;
    case NotificationType.PAYMENT_RECEIVED:
      return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
    case NotificationType.PAYMENT_OVERDUE:
      return <AlertTriangle className="w-5 h-5 text-rose-600" />;
    case NotificationType.MAINTENANCE_UPDATED:
      return <Wrench className="w-5 h-5 text-blue-600" />;
    case NotificationType.LEASE_EXPIRING:
      return <Calendar className="w-5 h-5 text-orange-600" />;
    case NotificationType.CHECKOUT_REMINDER:
      return <UserMinus className="w-5 h-5 text-indigo-600" />;
    case NotificationType.VISITOR_REQUEST:
      return <ShieldCheck className="w-5 h-5 text-purple-600" />;
    case NotificationType.DOCUMENT_EXPIRING:
      return <FileText className="w-5 h-5 text-amber-600" />;
    default:
      return <Bell className="w-5 h-5 text-slate-600" />;
  }
}

function getNotificationBadge(type: NotificationType) {
  switch (type) {
    case NotificationType.RENT_DUE:
      return (
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
          Rent Due
        </span>
      );
    case NotificationType.PAYMENT_RECEIVED:
      return (
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          Payment Received
        </span>
      );
    case NotificationType.PAYMENT_OVERDUE:
      return (
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
          Payment Overdue
        </span>
      );
    case NotificationType.MAINTENANCE_UPDATED:
      return (
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
          Maintenance Update
        </span>
      );
    case NotificationType.LEASE_EXPIRING:
      return (
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
          Lease Expiry
        </span>
      );
    case NotificationType.CHECKOUT_REMINDER:
      return (
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
          Checkout Reminder
        </span>
      );
    case NotificationType.VISITOR_REQUEST:
      return (
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
          Visitor Request
        </span>
      );
    case NotificationType.DOCUMENT_EXPIRING:
      return (
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
          Document Expiry
        </span>
      );
    default:
      return (
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
          General
        </span>
      );
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch(`${API_BASE}/notifications/unread-count`, {
        method: 'GET',
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data && typeof json.data.unreadCount === 'number') {
          setUnreadCount(json.data.unreadCount);
        }
      }
    } catch {}
  }, [isAuthenticated]);

  // Fetch notifications based on activeTab, search, page
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', String(limit));

      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      if (activeTab === 'UNREAD') {
        params.append('isRead', 'false');
      } else if (activeTab === 'MAINTENANCE') {
        params.append('type', NotificationType.MAINTENANCE_UPDATED);
      } else if (activeTab === 'VISITORS') {
        params.append('type', NotificationType.VISITOR_REQUEST);
      }

      const res = await fetch(`${API_BASE}/notifications?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (res.ok) {
        const json = await res.json();
        const raw = json.data || json;
        const listData = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
        let list = listData as NotificationDto[];

        // Client-side category filtering for composite tabs
        if (activeTab === 'BILLING') {
          list = list.filter(
            (n) =>
              n.type === NotificationType.RENT_DUE ||
              n.type === NotificationType.PAYMENT_RECEIVED ||
              n.type === NotificationType.PAYMENT_OVERDUE
          );
        } else if (activeTab === 'LEASES') {
          list = list.filter(
            (n) =>
              n.type === NotificationType.LEASE_EXPIRING ||
              n.type === NotificationType.CHECKOUT_REMINDER ||
              n.type === NotificationType.DOCUMENT_EXPIRING
          );
        }

        setNotifications(list);
        setTotal(raw?.total || json?.total || list.length);
        setTotalPages(raw?.totalPages || json?.totalPages || 1);
      }
    } catch {
      // Ignore network error
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, activeTab, searchQuery, page, limit]);

  useEffect(() => {
    fetchUnreadCount();
    fetchNotifications();
  }, [fetchUnreadCount, fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {}
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await fetch(`${API_BASE}/notifications/mark-all-read`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    } catch {}
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/notifications/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        setTotal((prev) => Math.max(0, prev - 1));
        fetchUnreadCount();
      }
    } catch {}
  };

  const handleNotificationClick = (notif: NotificationDto) => {
    if (!notif.isRead) {
      handleMarkAsRead(notif.id);
    }
    if (notif.link) {
      router.push(notif.link);
    }
  };

  const statCounts = useMemo(() => {
    const unread = unreadCount;
    const totalCount = total;
    return { unread, total: totalCount };
  }, [unreadCount, total]);

  return (
    <AppShell activePath="/notifications">
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Navigation Back Button */}
        <div className="flex items-center justify-between">
          <BackButton fallbackHref="/" label="Back to Dashboard" />
        </div>

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-brand-white p-6 rounded-2xl border border-surface-border shadow-sm">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-brand-teal">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-brand-navy">In-App Notification Center</h1>
                <p className="text-xs text-surface-textSecondary font-medium">
                  Centralized alerts for billing, payments, maintenance updates, leases, and visitors
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                fetchNotifications();
                fetchUnreadCount();
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-surface-textSecondary bg-surface-subtle hover:bg-slate-100 border border-surface-border rounded-xl transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                id="mark-all-read-btn"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-brand-white bg-brand-teal hover:bg-teal-700 rounded-xl transition-colors shadow-sm"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Mark All as Read</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick KPI Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-brand-white p-4 rounded-xl border border-surface-border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-surface-textSecondary">Total Alerts</span>
              <Inbox className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-brand-navy">{statCounts.total}</p>
          </div>

          <div className="bg-brand-white p-4 rounded-xl border border-surface-border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-surface-textSecondary">Unread</span>
              <Bell className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-2xl font-bold text-rose-600">{statCounts.unread}</p>
          </div>

          <div className="bg-brand-white p-4 rounded-xl border border-surface-border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-surface-textSecondary">Alert Scope</span>
              <ShieldCheck className="w-4 h-4 text-brand-teal" />
            </div>
            <p className="text-sm font-bold text-brand-navy">Operations & Finance</p>
          </div>

          <div className="bg-brand-white p-4 rounded-xl border border-surface-border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-surface-textSecondary">Delivery Channel</span>
              <Clock className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-sm font-bold text-emerald-600">Active In-App Feed</p>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="bg-brand-white p-4 rounded-2xl border border-surface-border shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => {
                  setActiveTab('ALL');
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === 'ALL'
                    ? 'bg-brand-navy text-brand-white shadow-sm'
                    : 'text-surface-textSecondary hover:bg-surface-subtle hover:text-brand-navy'
                }`}
              >
                All
              </button>
              <button
                onClick={() => {
                  setActiveTab('UNREAD');
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeTab === 'UNREAD'
                    ? 'bg-brand-navy text-brand-white shadow-sm'
                    : 'text-surface-textSecondary hover:bg-surface-subtle hover:text-brand-navy'
                }`}
              >
                <span>Unread</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px]">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setActiveTab('BILLING');
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === 'BILLING'
                    ? 'bg-brand-navy text-brand-white shadow-sm'
                    : 'text-surface-textSecondary hover:bg-surface-subtle hover:text-brand-navy'
                }`}
              >
                Billing & Rent
              </button>
              <button
                onClick={() => {
                  setActiveTab('MAINTENANCE');
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === 'MAINTENANCE'
                    ? 'bg-brand-navy text-brand-white shadow-sm'
                    : 'text-surface-textSecondary hover:bg-surface-subtle hover:text-brand-navy'
                }`}
              >
                Maintenance
              </button>
              <button
                onClick={() => {
                  setActiveTab('LEASES');
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === 'LEASES'
                    ? 'bg-brand-navy text-brand-white shadow-sm'
                    : 'text-surface-textSecondary hover:bg-surface-subtle hover:text-brand-navy'
                }`}
              >
                Leases & KYC
              </button>
              <button
                onClick={() => {
                  setActiveTab('VISITORS');
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === 'VISITORS'
                    ? 'bg-brand-navy text-brand-white shadow-sm'
                    : 'text-surface-textSecondary hover:bg-surface-subtle hover:text-brand-navy'
                }`}
              >
                Visitors
              </button>
            </div>

            {/* Search Box */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-surface-textSecondary absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search alerts..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-surface-subtle border border-surface-border focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal transition-all"
              />
            </div>
          </div>

          {/* Notifications Inbox Feed */}
          <div className="divide-y divide-surface-border rounded-xl border border-surface-border overflow-hidden bg-brand-white">
            {isLoading ? (
              <div className="py-16 flex flex-col items-center justify-center text-surface-textSecondary gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-brand-teal" />
                <span className="text-xs">Loading notifications...</span>
              </div>
            ) : notifications.length > 0 ? (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`group p-4 sm:p-5 flex items-start gap-4 transition-colors cursor-pointer ${
                    !notif.isRead
                      ? 'bg-teal-50/30 hover:bg-teal-50/60'
                      : 'hover:bg-slate-50/80 bg-brand-white'
                  }`}
                >
                  {/* Category Icon */}
                  <div className="w-10 h-10 rounded-xl bg-surface-subtle border border-surface-border flex items-center justify-center shrink-0 mt-0.5">
                    {getNotificationIcon(notif.type)}
                  </div>

                  {/* Content Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        {getNotificationBadge(notif.type)}
                        <h3
                          className={`text-sm font-semibold truncate ${
                            !notif.isRead ? 'text-brand-navy font-bold' : 'text-slate-800'
                          }`}
                        >
                          {notif.title}
                        </h3>
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-brand-teal shrink-0" />
                        )}
                      </div>
                      <span className="text-[11px] text-surface-textSecondary font-medium shrink-0">
                        {formatFullDateTime(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-surface-textSecondary leading-relaxed mb-2">
                      {notif.message}
                    </p>

                    {/* Metadata Context & Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-3 text-[11px]">
                        {notif.property && (
                          <span className="font-semibold text-brand-teal">
                            📍 {notif.property.name} ({notif.property.code})
                          </span>
                        )}
                        {notif.readAt && (
                          <span className="text-slate-400">
                            Read at {formatFullDateTime(notif.readAt)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {notif.link && (
                          <Link
                            href={notif.link}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-teal hover:text-teal-800 transition-colors px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200"
                          >
                            <span>Open Details</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}

                        {!notif.isRead ? (
                          <button
                            onClick={() => handleMarkAsRead(notif.id)}
                            title="Mark as read"
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-brand-navy px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5 text-brand-teal" />
                            <span>Mark read</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium px-2 py-0.5">
                            ✓ Read
                          </span>
                        )}

                        <button
                          onClick={() => handleDelete(notif.id)}
                          title="Dismiss / Delete notification"
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 px-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-surface-subtle flex items-center justify-center mx-auto mb-4 text-slate-400">
                  <Inbox className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-brand-navy mb-1">No notifications found</h3>
                <p className="text-xs text-surface-textSecondary max-w-sm mx-auto">
                  {searchQuery
                    ? `No notifications matched "${searchQuery}". Try searching for something else.`
                    : activeTab === 'UNREAD'
                    ? 'You have read all your notifications. Nothing new right now.'
                    : 'There are no notifications in this category yet.'}
                </p>
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-surface-textSecondary">
                Page {page} of {totalPages} ({total} total alerts)
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-subtle border border-surface-border text-brand-navy hover:bg-brand-white disabled:opacity-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 inline mr-1" />
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-subtle border border-surface-border text-brand-navy hover:bg-brand-white disabled:opacity-50 transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4 inline ml-1" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
