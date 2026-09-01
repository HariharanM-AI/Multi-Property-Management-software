'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/layout/AppShell';
import { BackButton } from '@/components/ui/BackButton';
import {
  JobType,
  JobExecutionStatus,
  QueueStatsDto,
  JobExecutionDto,
  ScheduledJobConfigDto,
} from '@propertyos/types';
import {
  CalendarClock,
  Zap,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Activity,
  Server,
  Layers,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
  X,
  FileText,
  SlidersHorizontal,
  Search,
  Check,
  Copy,
  Terminal,
  ShieldAlert,
} from 'lucide-react';

export default function JobsPage() {
  const { user } = useAuth();

  // Primary State
  const [stats, setStats] = useState<QueueStatsDto | null>(null);
  const [executions, setExecutions] = useState<JobExecutionDto[]>([]);
  const [schedules, setSchedules] = useState<ScheduledJobConfigDto[]>([]);

  // Loading States
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalExecutions, setTotalExecutions] = useState(0);

  const [selectedJobType, setSelectedJobType] = useState<JobType | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<JobExecutionStatus | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Drawers
  const [selectedExecution, setSelectedExecution] = useState<JobExecutionDto | null>(null);
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [triggerJobType, setTriggerJobType] = useState<JobType>(JobType.INVOICE_GENERATION);
  const [triggerPayload, setTriggerPayload] = useState('{}');
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  // Edit Cron Schedule Modal
  const [editingSchedule, setEditingSchedule] = useState<ScheduledJobConfigDto | null>(null);
  const [editCronInput, setEditCronInput] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [copied, setCopied] = useState(false);

  // 1. Fetch System Stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await fetch('/api/v1/jobs/stats', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to fetch job stats');
      const data = await res.json();
      setStats(data?.data || data);
    } catch (err: any) {
      console.error('Error fetching job stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // 2. Fetch Job Schedules
  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/jobs/schedules', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to fetch schedules');
      const data = await res.json();
      const raw = data?.data || data;
      const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
      setSchedules(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error('Error fetching schedules:', err);
    }
  }, []);

  // 3. Fetch Execution History
  const fetchExecutions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      if (selectedJobType) params.append('jobType', selectedJobType);
      if (selectedStatus) params.append('status', selectedStatus);

      const res = await fetch(`/api/v1/jobs/executions?${params.toString()}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Access denied: You do not have permission to view job executions.');
        }
        throw new Error('Failed to fetch executions');
      }

      const resData = await res.json();
      const raw = resData?.data || resData;
      const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
      setExecutions(Array.isArray(list) ? list : []);

      if (resData?.meta) {
        setTotalPages(resData.meta.totalPages || 1);
        setTotalExecutions(resData.meta.total || 0);
      } else if (raw?.meta) {
        setTotalPages(raw.meta.totalPages || 1);
        setTotalExecutions(raw.meta.total || 0);
      } else {
        setTotalPages(1);
        setTotalExecutions(Array.isArray(list) ? list.length : 0);
      }
    } catch (err: any) {
      console.error('Error fetching executions:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, selectedJobType, selectedStatus]);

  // Initial Load
  useEffect(() => {
    fetchStats();
    fetchSchedules();
    fetchExecutions();
  }, [fetchStats, fetchSchedules, fetchExecutions]);

  // Auto-refresh poll every 10s
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchStats();
      fetchExecutions();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchStats, fetchExecutions]);

  // Handle Manual Trigger
  const handleTriggerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTriggerError(null);
    setTriggering(true);

    try {
      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(triggerPayload);
      } catch (err) {
        throw new Error('Invalid JSON payload syntax. Please verify formatting.');
      }

      const res = await fetch('/api/v1/jobs/trigger', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobType: triggerJobType,
          payload: parsedPayload,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to dispatch job');
      }

      setShowTriggerModal(false);
      setTriggerPayload('{}');
      await fetchStats();
      await fetchExecutions();
    } catch (err: any) {
      setTriggerError(err.message);
    } finally {
      setTriggering(false);
    }
  };

  // Handle Queue Controls: Pause
  const handlePauseQueue = async (queueName: string) => {
    try {
      setActionLoading(`pause_${queueName}`);
      const res = await fetch('/api/v1/jobs/pause', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueName }),
      });
      if (!res.ok) throw new Error('Failed to pause queue');
      await fetchStats();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Queue Controls: Resume
  const handleResumeQueue = async (queueName: string) => {
    try {
      setActionLoading(`resume_${queueName}`);
      const res = await fetch('/api/v1/jobs/resume', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueName }),
      });
      if (!res.ok) throw new Error('Failed to resume queue');
      await fetchStats();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Queue Clean
  const handleCleanQueue = async (queueName: string) => {
    if (!confirm(`Are you sure you want to clean completed/failed jobs from ${queueName}?`)) return;
    try {
      setActionLoading(`clean_${queueName}`);
      const res = await fetch('/api/v1/jobs/clean', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueName, graceMs: 0, limit: 500 }),
      });
      if (!res.ok) throw new Error('Failed to clean queue');
      await fetchStats();
      await fetchExecutions();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Retry DLQ / Failed Job
  const handleRetryJob = async (executionId: string) => {
    try {
      setActionLoading(`retry_${executionId}`);
      const res = await fetch(`/api/v1/jobs/retry/${executionId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to retry job execution');
      await fetchStats();
      await fetchExecutions();
      if (selectedExecution?.id === executionId) {
        setSelectedExecution((prev) => (prev ? { ...prev, status: JobExecutionStatus.PENDING } : null));
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Toggle Schedule Enabled
  const handleToggleSchedule = async (sch: ScheduledJobConfigDto) => {
    try {
      setActionLoading(`toggle_${sch.id}`);
      const res = await fetch(`/api/v1/jobs/schedules/${sch.jobType}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !sch.isEnabled }),
      });
      if (!res.ok) throw new Error('Failed to update schedule');
      await fetchSchedules();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Save Cron Expression
  const handleSaveCron = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule) return;
    setSavingSchedule(true);
    try {
      const res = await fetch(`/api/v1/jobs/schedules/${editingSchedule.jobType}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cronExpression: editCronInput.trim() }),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || 'Invalid cron expression');
      }
      setEditingSchedule(null);
      await fetchSchedules();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingSchedule(false);
    }
  };

  // Copy Metadata
  const handleCopy = (obj: any) => {
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Status Badge Formatter
  const formatStatusBadge = (st: JobExecutionStatus) => {
    switch (st) {
      case JobExecutionStatus.COMPLETED:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case JobExecutionStatus.RUNNING:
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case JobExecutionStatus.PENDING:
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case JobExecutionStatus.FAILED:
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case JobExecutionStatus.CANCELLED:
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const formatJobTypeBadge = (jt: JobType) => {
    switch (jt) {
      case JobType.INVOICE_GENERATION:
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case JobType.PAYMENT_REMINDERS:
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case JobType.MAINTENANCE_ESCALATION:
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case JobType.AGREEMENT_EXPIRY:
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case JobType.SYSTEM_CLEANUP:
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getCronHumanReadable = (cron: string) => {
    if (cron === '0 0 1 * *') return 'Monthly on 1st at midnight';
    if (cron === '0 8 * * *') return 'Daily at 08:00 AM';
    if (cron === '*/15 * * * *') return 'Every 15 minutes';
    if (cron === '0 9 * * *') return 'Daily at 09:00 AM';
    if (cron === '0 3 * * *') return 'Daily at 03:00 AM';
    if (cron === '0 * * * *') return 'Hourly at minute 0';
    return 'Custom schedule';
  };

  // Filter executions by search
  const filteredExecutions = executions.filter((exec) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const idMatch = exec.id.toLowerCase().includes(q);
    const bullIdMatch = exec.bullJobId?.toLowerCase().includes(q) || false;
    const actorMatch =
      exec.triggeredBy?.firstName.toLowerCase().includes(q) ||
      exec.triggeredBy?.lastName.toLowerCase().includes(q) ||
      exec.triggeredBy?.email.toLowerCase().includes(q) ||
      false;
    return idMatch || bullIdMatch || actorMatch;
  });

  const totalActive =
    (stats?.queues?.jobs?.active || 0) +
    (stats?.queues?.notifications?.active || 0) +
    (stats?.queues?.dlq?.active || 0);

  const totalCompleted =
    (stats?.queues?.jobs?.completed || 0) +
    (stats?.queues?.notifications?.completed || 0) +
    (stats?.queues?.dlq?.completed || 0);

  const totalFailed =
    (stats?.queues?.jobs?.failed || 0) +
    (stats?.queues?.notifications?.failed || 0) +
    (stats?.queues?.dlq?.failed || 0);

  const totalWaiting =
    (stats?.queues?.jobs?.waiting || 0) +
    (stats?.queues?.notifications?.waiting || 0) +
    (stats?.queues?.dlq?.waiting || 0);

  return (
    <AppShell activePath="/jobs">
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Navigation Back Button */}
        <div className="flex items-center justify-between">
          <BackButton fallbackHref="/" label="Back to Dashboard" />
        </div>

        {/* 1. Header & Top Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-50 text-brand-teal border border-teal-200 rounded-xl">
              <CalendarClock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                <span>Automated Operations & Jobs</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-brand-teal border border-teal-200">
                  Automated Pipelines
                </span>
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Scheduled recurring automation, background tasks, invoice generation, and dead-letter recovery
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Health status badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono shadow-2xs">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  stats?.redisConnected ? 'bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50' : 'bg-rose-500'
                }`}
              />
              <span className="text-slate-700 font-medium">Engine: {stats?.redisConnected ? 'Active' : 'Offline'}</span>
            </div>

            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition shadow-2xs ${
                autoRefresh
                  ? 'bg-teal-50 border-teal-200 text-brand-teal'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Auto (10s): {autoRefresh ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={() => {
                fetchStats();
                fetchExecutions();
                fetchSchedules();
              }}
              disabled={statsLoading || loading}
              className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-2xs"
              title="Refresh All"
            >
              <RefreshCw className={`w-4 h-4 text-slate-500 ${statsLoading || loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setShowTriggerModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal hover:bg-teal-700 text-white text-sm font-semibold shadow-sm transition"
            >
              <Zap className="w-4 h-4" />
              <span>Manual Trigger</span>
            </button>
          </div>
        </div>

        {/* 2. Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Active Jobs */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Running</span>
              <p className="text-2xl font-bold text-blue-600 mt-2 font-mono">{totalActive}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-500 border border-blue-200">
              <Activity className="w-5 h-5" />
            </div>
          </div>

          {/* Completed */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed</span>
              <p className="text-2xl font-bold text-emerald-600 mt-2 font-mono">{totalCompleted}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-500 border border-emerald-200">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          {/* Failed / DLQ */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Failed / DLQ</span>
              <p className="text-2xl font-bold text-rose-600 mt-2 font-mono">{totalFailed}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-500 border border-rose-200">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>

          {/* Waiting / Delayed */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Waiting / Delayed</span>
              <p className="text-2xl font-bold text-amber-600 mt-2 font-mono">{totalWaiting}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-500 border border-amber-200">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          {/* Engine Status */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Processing Engine</span>
              <p className="text-base font-bold text-brand-teal mt-1">BullMQ v5.41</p>
              <p className="text-xs text-slate-500 mt-0.5">3 Dedicated Queues</p>
            </div>
            <div className="p-2.5 rounded-xl bg-teal-50 text-brand-teal border border-teal-200">
              <Server className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* 3. Queue Pipeline Topology Cards Grid */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-teal" />
            Queue Pipeline Topology
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Queue 1: propertyos:jobs */}
            <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">propertyos:jobs</h3>
                    <p className="text-xs text-slate-500 mt-0.5">General Background & Batch Jobs</p>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      stats?.queues?.jobs?.paused
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {stats?.queues?.jobs?.paused ? 'PAUSED' : 'ACTIVE'}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-100 text-center font-mono">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Waiting</p>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">{stats?.queues?.jobs?.waiting || 0}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <p className="text-[10px] text-blue-600 uppercase font-semibold">Active</p>
                    <p className="text-sm font-bold text-blue-600 mt-0.5">{stats?.queues?.jobs?.active || 0}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <p className="text-[10px] text-emerald-600 uppercase font-semibold">Done</p>
                    <p className="text-sm font-bold text-emerald-600 mt-0.5">{stats?.queues?.jobs?.completed || 0}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <p className="text-[10px] text-rose-600 uppercase font-semibold">Failed</p>
                    <p className="text-sm font-bold text-rose-600 mt-0.5">{stats?.queues?.jobs?.failed || 0}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                {stats?.queues?.jobs?.paused ? (
                  <button
                    onClick={() => handleResumeQueue('propertyos:jobs')}
                    disabled={actionLoading === 'resume_propertyos:jobs'}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold transition shadow-2xs"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Resume</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handlePauseQueue('propertyos:jobs')}
                    disabled={actionLoading === 'pause_propertyos:jobs'}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-semibold transition shadow-2xs"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </button>
                )}

                <button
                  onClick={() => handleCleanQueue('propertyos:jobs')}
                  disabled={actionLoading === 'clean_propertyos:jobs'}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-2xs"
                  title="Clean completed jobs"
                >
                  <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Clean</span>
                </button>
              </div>
            </div>

            {/* Queue 2: propertyos:notifications */}
            <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">propertyos:notifications</h3>
                    <p className="text-xs text-slate-500 mt-0.5">In-App Notification Dispatch</p>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      stats?.queues?.notifications?.paused
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {stats?.queues?.notifications?.paused ? 'PAUSED' : 'ACTIVE'}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-100 text-center font-mono">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Waiting</p>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">{stats?.queues?.notifications?.waiting || 0}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <p className="text-[10px] text-blue-600 uppercase font-semibold">Active</p>
                    <p className="text-sm font-bold text-blue-600 mt-0.5">{stats?.queues?.notifications?.active || 0}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <p className="text-[10px] text-emerald-600 uppercase font-semibold">Done</p>
                    <p className="text-sm font-bold text-emerald-600 mt-0.5">{stats?.queues?.notifications?.completed || 0}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <p className="text-[10px] text-rose-600 uppercase font-semibold">Failed</p>
                    <p className="text-sm font-bold text-rose-600 mt-0.5">{stats?.queues?.notifications?.failed || 0}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                {stats?.queues?.notifications?.paused ? (
                  <button
                    onClick={() => handleResumeQueue('propertyos:notifications')}
                    disabled={actionLoading === 'resume_propertyos:notifications'}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold transition shadow-2xs"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Resume</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handlePauseQueue('propertyos:notifications')}
                    disabled={actionLoading === 'pause_propertyos:notifications'}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-semibold transition shadow-2xs"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </button>
                )}

                <button
                  onClick={() => handleCleanQueue('propertyos:notifications')}
                  disabled={actionLoading === 'clean_propertyos:notifications'}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-2xs"
                >
                  <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Clean</span>
                </button>
              </div>
            </div>

            {/* Queue 3: propertyos:dlq */}
            <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">propertyos:dlq</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Dead-Letter Inspection Queue</p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-purple-50 text-purple-700 border-purple-200">
                    DLQ
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-100 text-center font-mono">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Waiting</p>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">{stats?.queues?.dlq?.waiting || 0}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <p className="text-[10px] text-blue-600 uppercase font-semibold">Active</p>
                    <p className="text-sm font-bold text-blue-600 mt-0.5">{stats?.queues?.dlq?.active || 0}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <p className="text-[10px] text-emerald-600 uppercase font-semibold">Done</p>
                    <p className="text-sm font-bold text-emerald-600 mt-0.5">{stats?.queues?.dlq?.completed || 0}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <p className="text-[10px] text-rose-600 uppercase font-semibold">Failed</p>
                    <p className="text-sm font-bold text-rose-600 mt-0.5">{stats?.queues?.dlq?.failed || 0}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => handleCleanQueue('propertyos:dlq')}
                  disabled={actionLoading === 'clean_propertyos:dlq'}
                  className="w-full py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 shadow-2xs"
                >
                  <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Clean DLQ</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Scheduled Jobs Configuration Matrix */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-brand-teal" />
            Recurring Job Schedulers
          </h2>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Job Type</th>
                  <th className="px-5 py-3.5">Schedule (Cron)</th>
                  <th className="px-5 py-3.5">Enabled</th>
                  <th className="px-5 py-3.5">Last Run</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(schedules || []).map((sch) => (
                  <tr key={sch.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${formatJobTypeBadge(sch.jobType)}`}>
                        {sch.jobType}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-mono text-xs font-semibold text-slate-900">{sch.cronExpression}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{getCronHumanReadable(sch.cronExpression)}</div>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => handleToggleSchedule(sch)}
                        disabled={actionLoading === `toggle_${sch.id}`}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          sch.isEnabled ? 'bg-brand-teal' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-xs ${
                            sch.isEnabled ? 'translate-x-4' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      {sch.lastRunAt ? (
                        <div>
                          <div className="text-xs text-slate-800 font-mono">{new Date(sch.lastRunAt).toLocaleString('en-IN')}</div>
                          {sch.lastStatus && (
                            <span
                              className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-md font-semibold border ${formatStatusBadge(
                                sch.lastStatus,
                              )}`}
                            >
                              {sch.lastStatus}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Never run</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setEditingSchedule(sch);
                          setEditCronInput(sch.cronExpression);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 transition shadow-2xs"
                      >
                        Edit Cron
                      </button>
                      <button
                        onClick={() => {
                          setTriggerJobType(sch.jobType);
                          setShowTriggerModal(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-brand-teal border border-teal-200 text-xs font-semibold transition shadow-2xs"
                      >
                        Run Now
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. Execution History Table */}
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-teal" />
              Job Execution History ({totalExecutions})
            </h2>

            {/* Filter Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter by Job Type"
                value={selectedJobType}
                onChange={(e) => {
                  setSelectedJobType(e.target.value as any);
                  setPage(1);
                }}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal shadow-2xs"
              >
                <option value="">All Job Types</option>
                {Object.values(JobType).map((jt) => (
                  <option key={jt} value={jt}>
                    {jt}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by Execution Status"
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value as any);
                  setPage(1);
                }}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal shadow-2xs"
              >
                <option value="">All Statuses</option>
                {Object.values(JobExecutionStatus).map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter executions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal shadow-2xs"
                />
              </div>

              {(selectedJobType || selectedStatus || searchQuery) && (
                <button
                  onClick={() => {
                    setSelectedJobType('');
                    setSelectedStatus('');
                    setSearchQuery('');
                    setPage(1);
                  }}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800"
                  title="Clear filters"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Execution ID / Bull ID</th>
                    <th className="px-5 py-3.5">Job Type</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Triggered By</th>
                    <th className="px-5 py-3.5">Started At</th>
                    <th className="px-5 py-3.5">Duration</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-5 py-4"><div className="h-4 bg-slate-100 rounded w-28"></div></td>
                        <td className="px-5 py-4"><div className="h-5 bg-slate-100 rounded w-32"></div></td>
                        <td className="px-5 py-4"><div className="h-5 bg-slate-100 rounded w-20"></div></td>
                        <td className="px-5 py-4"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                        <td className="px-5 py-4"><div className="h-4 bg-slate-100 rounded w-28"></div></td>
                        <td className="px-5 py-4"><div className="h-4 bg-slate-100 rounded w-16"></div></td>
                        <td className="px-5 py-4 text-right"><div className="h-7 bg-slate-100 rounded w-16 ml-auto"></div></td>
                      </tr>
                    ))
                  ) : filteredExecutions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center text-slate-400">
                        <Activity className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                        <p className="font-semibold text-slate-700">No job executions recorded</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Manual triggers and scheduled executions will appear here in real-time.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredExecutions.map((exec) => {
                      const durationMs =
                        exec.startedAt && exec.completedAt
                          ? new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime()
                          : null;

                      return (
                        <tr key={exec.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-mono text-xs text-slate-900 font-semibold truncate max-w-[130px]" title={exec.id}>
                              {exec.id.substring(0, 12)}...
                            </div>
                            {exec.bullJobId && (
                              <div className="text-[11px] font-mono text-slate-500 truncate max-w-[130px]">
                                bull:{exec.bullJobId}
                              </div>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${formatJobTypeBadge(exec.jobType)}`}>
                              {exec.jobType}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${formatStatusBadge(exec.status)}`}>
                              {exec.status}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            {exec.triggeredBy ? (
                              <div className="text-xs">
                                <span className="font-semibold text-slate-900">
                                  {exec.triggeredBy.firstName} {exec.triggeredBy.lastName}
                                </span>
                                <span className="text-[11px] text-slate-500 block">{exec.triggeredBy.email}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Automated Cron</span>
                            )}
                          </td>

                          <td className="px-5 py-4 text-xs font-mono text-slate-600">
                            {exec.startedAt ? new Date(exec.startedAt).toLocaleString('en-IN') : 'Queued'}
                          </td>

                          <td className="px-5 py-4 text-xs font-mono text-slate-600">
                            {durationMs !== null ? `${durationMs} ms` : '—'}
                          </td>

                          <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                            {exec.status === JobExecutionStatus.FAILED && (
                              <button
                                onClick={() => handleRetryJob(exec.id)}
                                disabled={actionLoading === `retry_${exec.id}`}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition shadow-2xs"
                                title="Re-enqueue to DLQ / Active"
                              >
                                Retry
                              </button>
                            )}

                            <button
                              onClick={() => setSelectedExecution(exec)}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition inline-flex items-center gap-1 shadow-2xs"
                            >
                              <Eye className="w-3.5 h-3.5 text-brand-teal" />
                              <span>Inspect</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50/50">
              <div>
                Showing <span className="font-semibold text-slate-800">{executions.length}</span> of{' '}
                <span className="font-semibold text-slate-800">{totalExecutions}</span> executions
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-medium text-slate-700">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Slide-Over Execution Inspector Drawer */}
        {selectedExecution && (
          <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
            <div className="w-full max-w-xl bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-teal-50 text-brand-teal border border-teal-200">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Execution Inspector</h3>
                    <p className="text-xs font-mono text-slate-500">{selectedExecution.id}</p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedExecution(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
                {/* Meta Grid */}
                <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Job Type</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{selectedExecution.jobType}</p>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Status</span>
                    <p className="mt-0.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${formatStatusBadge(selectedExecution.status)}`}>
                        {selectedExecution.status}
                      </span>
                    </p>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Queue Name</span>
                    <p className="font-mono text-xs text-slate-700 mt-0.5">{selectedExecution.queueName}</p>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Bull Job ID</span>
                    <p className="font-mono text-xs text-slate-700 mt-0.5">{selectedExecution.bullJobId || '—'}</p>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Attempts</span>
                    <p className="text-xs font-mono text-slate-700 mt-0.5">
                      {selectedExecution.attempts} / {selectedExecution.maxAttempts}
                    </p>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Created At</span>
                    <p className="text-xs font-mono text-slate-700 mt-0.5">
                      {new Date(selectedExecution.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>

                {/* Error Banner if Failed */}
                {selectedExecution.error && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      <span>Execution Error Failure</span>
                    </div>
                    <p className="font-mono text-xs text-rose-900 whitespace-pre-wrap">{selectedExecution.error}</p>
                  </div>
                )}

                {/* Sensitive Payload Notice */}
                <div className="p-3 bg-teal-50 border border-teal-100 rounded-xl flex items-center gap-2 text-xs text-teal-800">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-brand-teal" />
                  <span>Payload credentials and API secrets are automatically protected and redacted.</span>
                </div>

                {/* Payload JSON */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-brand-teal" />
                      Input Payload
                    </h4>
                    <button
                      onClick={() => handleCopy(selectedExecution.payload)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  <pre className="p-4 rounded-xl bg-slate-900 text-teal-300 font-mono text-xs overflow-x-auto max-h-60 border border-slate-800">
                    {JSON.stringify(selectedExecution.payload || {}, null, 2)}
                  </pre>
                </div>

                {/* Result Metadata JSON */}
                {selectedExecution.result && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Execution Result Metadata
                    </h4>

                    <pre className="p-4 rounded-xl bg-slate-900 text-emerald-300 font-mono text-xs overflow-x-auto max-h-60 border border-slate-800">
                      {JSON.stringify(selectedExecution.result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                {selectedExecution.status === JobExecutionStatus.FAILED && (
                  <button
                    onClick={() => handleRetryJob(selectedExecution.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry Pipeline Job</span>
                  </button>
                )}

                <button
                  onClick={() => setSelectedExecution(null)}
                  className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition ml-auto shadow-2xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Manual Trigger */}
        {showTriggerModal && (
          <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-teal-50 text-brand-teal border border-teal-200">
                    <Zap className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">Manual Pipeline Trigger</h3>
                </div>

                <button
                  onClick={() => setShowTriggerModal(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {triggerError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{triggerError}</span>
                </div>
              )}

              <form onSubmit={handleTriggerSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Job Pipeline Type</label>
                  <select
                    value={triggerJobType}
                    onChange={(e) => setTriggerJobType(e.target.value as JobType)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                  >
                    {Object.values(JobType).map((jt) => (
                      <option key={jt} value={jt}>
                        {jt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Custom JSON Payload (Optional)</label>
                  <textarea
                    rows={4}
                    value={triggerPayload}
                    onChange={(e) => setTriggerPayload(e.target.value)}
                    placeholder='{"propertyId": "...", "dryRun": false}'
                    className="w-full p-3 font-mono text-xs bg-slate-900 text-teal-300 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
                  />
                  <p className="text-[11px] text-slate-500">
                    Deterministic jobs will automatically scope to your current organization.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowTriggerModal(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={triggering}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal text-white text-xs font-semibold hover:bg-teal-700 transition shadow-sm disabled:opacity-50"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>{triggering ? 'Dispatching...' : 'Dispatch Job Now'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit Cron Schedule */}
        {editingSchedule && (
          <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-teal-50 text-brand-teal border border-teal-200">
                    <CalendarClock className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">Edit Cron Schedule</h3>
                </div>

                <button
                  onClick={() => setEditingSchedule(null)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveCron} className="space-y-4">
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 font-medium">Job Type</span>
                  <p className="font-bold text-slate-900">{editingSchedule.jobType}</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Cron Expression (5-part format)</label>
                  <input
                    type="text"
                    value={editCronInput}
                    onChange={(e) => setEditCronInput(e.target.value)}
                    placeholder="*/15 * * * *"
                    className="w-full px-3 py-2 font-mono text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                  />
                  <div className="text-[11px] text-slate-500 space-y-1">
                    <p>Standard examples:</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li><code>0 0 1 * *</code> — Monthly 1st at midnight</li>
                      <li><code>0 8 * * *</code> — Daily at 8:00 AM</li>
                      <li><code>*/15 * * * *</code> — Every 15 minutes</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingSchedule(null)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={savingSchedule}
                    className="px-4 py-2 rounded-lg bg-brand-teal text-white text-xs font-semibold hover:bg-teal-700 transition shadow-sm disabled:opacity-50"
                  >
                    {savingSchedule ? 'Saving...' : 'Update Schedule'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
