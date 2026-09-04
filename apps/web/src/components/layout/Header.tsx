'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PropertyType,
  PropertyDto,
  ApiResponse,
  NotificationDto,
  NotificationType,
} from '@propertyos/types';
import { useAuth } from '@/lib/auth-context';
import {
  Building2,
  Bell,
  Shield,
  LogOut,
  LogIn,
  UserPlus,
  ChevronDown,
  Plus,
  CheckCheck,
  Check,
  ReceiptText,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Calendar,
  UserMinus,
  ShieldCheck,
  FileText,
  ExternalLink,
  Loader2,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface HeaderProps {
  currentPropertyType: PropertyType;
  onPropertyTypeChange: (type: PropertyType) => void;
  selectedPropertyName?: string;
}

function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case NotificationType.RENT_DUE:
      return <ReceiptText className="w-4 h-4 text-amber-600" />;
    case NotificationType.PAYMENT_RECEIVED:
      return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    case NotificationType.PAYMENT_OVERDUE:
      return <AlertTriangle className="w-4 h-4 text-rose-600" />;
    case NotificationType.MAINTENANCE_UPDATED:
      return <Wrench className="w-4 h-4 text-blue-600" />;
    case NotificationType.LEASE_EXPIRING:
      return <Calendar className="w-4 h-4 text-orange-600" />;
    case NotificationType.CHECKOUT_REMINDER:
      return <UserMinus className="w-4 h-4 text-indigo-600" />;
    case NotificationType.VISITOR_REQUEST:
      return <ShieldCheck className="w-4 h-4 text-purple-600" />;
    case NotificationType.DOCUMENT_EXPIRING:
      return <FileText className="w-4 h-4 text-amber-600" />;
    default:
      return <Bell className="w-4 h-4 text-slate-600" />;
  }
}

function getNotificationTypeBadge(type: NotificationType) {
  switch (type) {
    case NotificationType.RENT_DUE:
      return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">Rent Due</span>;
    case NotificationType.PAYMENT_RECEIVED:
      return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Payment</span>;
    case NotificationType.PAYMENT_OVERDUE:
      return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">Overdue</span>;
    case NotificationType.MAINTENANCE_UPDATED:
      return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">Maintenance</span>;
    case NotificationType.LEASE_EXPIRING:
      return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">Lease</span>;
    case NotificationType.CHECKOUT_REMINDER:
      return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">Checkout</span>;
    case NotificationType.VISITOR_REQUEST:
      return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">Visitor</span>;
    case NotificationType.DOCUMENT_EXPIRING:
      return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">Document</span>;
    default:
      return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-50 text-slate-700 border border-slate-200">General</span>;
  }
}

export const Header: React.FC<HeaderProps> = ({
  currentPropertyType,
  onPropertyTypeChange,
  selectedPropertyName,
}) => {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [properties, setProperties] = useState<PropertyDto[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<PropertyDto | null>(null);
  const [isPropertyDropdownOpen, setIsPropertyDropdownOpen] = useState(false);

  // In-App Notification Center State
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(false);
  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const propertyDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch unread notification count
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
    } catch {
      // Ignore network errors in polling
    }
  }, [isAuthenticated]);

  // Fetch recent notifications for dropdown
  const fetchRecentNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingNotifs(true);
    try {
      const res = await fetch(`${API_BASE}/notifications?limit=8`, {
        method: 'GET',
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data.data)) {
          setNotifications(json.data.data);
        }
      }
    } catch {
      // Ignore error
    } finally {
      setIsLoadingNotifs(false);
    }
  }, [isAuthenticated]);

  // Fetch properties on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetch(`${API_BASE}/properties?pageSize=50`, {
        method: 'GET',
        credentials: 'include',
      })
        .then((res) => res.json())
        .then((json: ApiResponse<PropertyDto[]>) => {
          if (json.success && json.data && json.data.length > 0) {
            setProperties(json.data);
            setSelectedProperty(json.data[0]);
            onPropertyTypeChange(json.data[0].propertyType);
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated, onPropertyTypeChange]);

  // Poll unread count every 30s
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notifDropdownRef.current &&
        !notifDropdownRef.current.contains(event.target as Node)
      ) {
        setIsNotifDropdownOpen(false);
      }
      if (
        propertyDropdownRef.current &&
        !propertyDropdownRef.current.contains(event.target as Node)
      ) {
        setIsPropertyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleNotifDropdown = () => {
    if (!isNotifDropdownOpen) {
      fetchRecentNotifications();
      fetchUnreadCount();
    }
    setIsNotifDropdownOpen(!isNotifDropdownOpen);
  };

  const handleMarkAsRead = async (e: React.MouseEvent, notif: NotificationDto) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${API_BASE}/notifications/${notif.id}/read`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
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
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch {}
  };

  const handleNotificationClick = async (notif: NotificationDto) => {
    if (!notif.isRead) {
      try {
        await fetch(`${API_BASE}/notifications/${notif.id}/read`, {
          method: 'PATCH',
          credentials: 'include',
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {}
    }
    setIsNotifDropdownOpen(false);
    if (notif.link) {
      router.push(notif.link);
    } else {
      router.push('/notifications');
    }
  };

  const handleSelectProperty = (prop: PropertyDto) => {
    setSelectedProperty(prop);
    onPropertyTypeChange(prop.propertyType);
    setIsPropertyDropdownOpen(false);
  };

  const displayName =
    selectedProperty?.name ||
    selectedPropertyName ||
    (currentPropertyType === PropertyType.PG
      ? 'GreenGlen PG Residency'
      : 'Indiranagar Heights Flat #402');

  return (
    <header className="h-16 bg-brand-white border-b border-surface-border px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left Context / Spacer */}
      <div className="flex items-center gap-4" />

      {/* Right Actions & Auth Status */}
      <div className="flex items-center gap-4">
        {/* Verified Enterprise Operations Badge */}
        <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold ${
          currentPropertyType === PropertyType.RENTAL_HOUSE
            ? 'bg-blue-50 border border-blue-200 text-blue-700'
            : 'bg-teal-50 border border-teal-200 text-brand-teal'
        }`}>
          <Shield className="w-3.5 h-3.5" />
          <span>Enterprise Operations</span>
        </div>

        {/* Notification Bell Control */}
        <div className="relative" ref={notifDropdownRef}>
          <button
            onClick={handleToggleNotifDropdown}
            aria-label="Notifications"
            id="header-notification-bell"
            className={`p-2 rounded-lg text-surface-textSecondary hover:bg-surface-subtle hover:text-brand-navy transition-colors relative ${
              isNotifDropdownOpen ? 'bg-surface-subtle text-brand-navy' : ''
            }`}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span
                id="header-notification-badge"
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-brand-white shadow-sm animate-in fade-in"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* In-App Notification Dropdown Popover */}
          {isNotifDropdownOpen && (
            <div
              id="header-notification-popover"
              className="absolute right-0 mt-2 w-80 sm:w-96 bg-brand-white rounded-2xl border border-surface-border shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
            >
              {/* Popover Header */}
              <div className="px-4 py-3 bg-slate-900 text-brand-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-teal-400" />
                  <h3 className="font-semibold text-sm">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[11px] font-bold border border-rose-500/30">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="flex items-center gap-1 text-xs text-teal-300 hover:text-teal-100 font-medium transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              {/* Notification List */}
              <div className="max-h-[380px] overflow-y-auto divide-y divide-surface-border">
                {isLoadingNotifs ? (
                  <div className="py-12 flex flex-col items-center justify-center text-surface-textSecondary gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-brand-teal" />
                    <span className="text-xs">Loading notifications...</span>
                  </div>
                ) : notifications.length > 0 ? (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`group p-3 hover:bg-slate-50 transition-colors cursor-pointer flex gap-3 relative ${
                        !notif.isRead ? 'bg-teal-50/40' : ''
                      }`}
                    >
                      {/* Icon */}
                      <div className="w-8 h-8 rounded-xl bg-surface-subtle border border-surface-border flex items-center justify-center shrink-0 mt-0.5">
                        {getNotificationIcon(notif.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <div className="flex items-center gap-1.5 truncate">
                            {getNotificationTypeBadge(notif.type)}
                            <h4
                              className={`text-xs font-semibold truncate ${
                                !notif.isRead ? 'text-brand-navy font-bold' : 'text-slate-700'
                              }`}
                            >
                              {notif.title}
                            </h4>
                          </div>
                          <span className="text-[10px] text-surface-textSecondary shrink-0 whitespace-nowrap">
                            {formatTimeAgo(notif.createdAt)}
                          </span>
                        </div>

                        <p className="text-[11px] text-surface-textSecondary line-clamp-2 leading-relaxed">
                          {notif.message}
                        </p>

                        {notif.property && (
                          <p className="text-[10px] text-brand-teal font-medium mt-1">
                            📍 {notif.property.name}
                          </p>
                        )}
                      </div>

                      {/* Read Status Dot / Mark as read trigger */}
                      <div className="flex flex-col items-end justify-between shrink-0 pl-1">
                        {!notif.isRead ? (
                          <button
                            title="Mark as read"
                            onClick={(e) => handleMarkAsRead(e, notif)}
                            className="w-4 h-4 rounded-full bg-brand-teal flex items-center justify-center hover:bg-teal-700 transition-colors"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                          </button>
                        ) : (
                          <Check className="w-3.5 h-3.5 text-slate-300" />
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 px-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-surface-subtle flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <Bell className="w-6 h-6" />
                    </div>
                    <h4 className="text-xs font-bold text-brand-navy mb-1">All caught up!</h4>
                    <p className="text-[11px] text-surface-textSecondary">
                      You don't have any unread notifications right now.
                    </p>
                  </div>
                )}
              </div>

              {/* Popover Footer */}
              <div className="p-2.5 bg-surface-subtle border-t border-surface-border flex items-center justify-center">
                <Link
                  href="/notifications"
                  onClick={() => setIsNotifDropdownOpen(false)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-teal hover:text-teal-800 transition-colors py-1 px-3 rounded-lg hover:bg-teal-50/80"
                >
                  <span>View all notifications</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User / Authentication Actions */}
        <div className="flex items-center gap-3 pl-2 border-l border-surface-border">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs font-semibold text-brand-navy">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-[10px] text-brand-teal font-medium uppercase">
                  {user.roles[0] || 'OWNER'}
                </p>
              </div>
              <button
                onClick={() => logout()}
                title="Sign Out"
                className="p-2 rounded-lg text-surface-textSecondary hover:bg-slate-100 hover:text-brand-navy transition-colors"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-subtle border border-surface-border text-brand-navy hover:bg-brand-white transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-teal text-brand-white hover:bg-teal-700 transition-colors shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
