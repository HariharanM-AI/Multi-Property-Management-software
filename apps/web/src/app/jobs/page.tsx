'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  JobType,
  JobExecutionStatus,
  JobExecutionDto,
  ScheduledJobConfigDto,
  QueueStatsDto,
} from '@propertyos/types';
import {
  Activity,
  CalendarClock,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Server,
  Layers,
  ChevronLeft,
  ChevronRight,
  X,
  Sliders,
  SlidersHorizontal,
  FileText,
  Copy,
  Check,
  Zap,
  Info,
} from 'lucide-react';

export default function JobsPage() {
  const { user } = useAuth();

  // State
  const [stats, setStats] = useState<QueueStatsDto | null>(null);
  const [schedules, setSchedules] = useState<ScheduledJobConfigDto[]>([]);
  const [executions, setExecutions] = useState<JobExecutionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalExecutions, setTotalExecutions] = useState(0);

  const [selectedJobType, setSelectedJobType] = useState<JobType | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<JobExecutionStatus | ''>('');
  const [selectedQueue, setSelectedQueue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals / Drawers
  const [selectedExecution, setSelectedExecution] = useState<JobExecutionDto | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledJobConfigDto | null>(null);
  const [editCronInput, setEditCronInput] = useState('');
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [triggerJobType, setTriggerJobType] = useState<JobType>(JobType.INVOICE_GENERATION);
  const [triggerForceRun, setTriggerForceRun] = useState(false);
  const [triggerParamsJson, setTriggerParamsJson] = useState('{}');
  const [copied, setCopied] = useState(false);

  // Fetch Queue Stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await fetch('/api/v1/jobs/stats', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err: any) {
      console.error('Error loading queue stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch Schedules
  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/jobs/schedules', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setSchedules(data);
      }
    } catch (err: any) {
      console.error('Error loading schedules:', err);
    }
  }, []);

  // Fetch Executions
  const fetchExecutions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      if (selectedJobType) params.append('jobType', selectedJobType);
      if (selectedStatus) params.append('status', selectedStatus);
      if (selectedQueue) params.append('queueName', selectedQueue);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await fetch(`/api/v1/jobs/executions?${params.toString()}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to load job executions');
      }

      const data = await res.json();
      setExecutions(data.data || []);
      setTotalPages(data.totalPages || 1);
      setTotalExecutions(data.total || 0);
    } catch (err: any) {
      setError(err.message || 'Error fetching executions');
    } finally {
      setLoading(false);
    }
  }, [page, limit, selectedJobType, selectedStatus, selectedQueue, startDate, endDate]);

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchSchedules();
    fetchExecutions();
  }, [fetchStats, fetchSchedules, fetchExecutions]);

  // Auto-refresh timer
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchStats();
      fetchExecutions();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchStats, fetchExecutions]);

  // Manual Trigger
  const handleTriggerJob = async () => {
    try {
      setActionLoading('trigger');
      let parsedParams = {};
      try {
        parsedParams = JSON.parse(triggerParamsJson);
      } catch {
        alert('Invalid JSON in parameters');
        setActionLoading(null);
        return;
      }

      const res = await fetch('/api/v1/jobs/trigger', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobType: triggerJobType,
          forceRun: triggerForceRun,
          parameters: parsedParams,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to trigger job');
      }

      setShowTriggerModal(false);
      fetchStats();
      fetchExecutions();
    } catch (err: any) {
      alert(`Error triggering job: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Pause Queue
  const handlePauseQueue = async (queueName: string) => {
    try {
      setActionLoading(`pause_${queueName}`);
      const res = await fetch('/api/v1/jobs/pause', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueName, action: 'pause' }),
      });
      if (!res.ok) throw new Error('Failed to pause queue');
      fetchStats();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Resume Queue
  const handleResumeQueue = async (queueName: string) => {
    try {
      setActionLoading(`resume_${queueName}`);
      const res = await fetch('/api/v1/jobs/resume', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueName, action: 'resume' }),
      });
      if (!res.ok) throw new Error('Failed to resume queue');
      fetchStats();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Clean Queue
  const handleCleanQueue = async (queueName: string) => {
    if (!confirm(`Are you sure you want to clean completed jobs from ${queueName}?`)) return;
    try {
      setActionLoading(`clean_${queueName}`);
      const res = await fetch('/api/v1/jobs/clean', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueName, action: 'clean', gracePeriodMs: 5000, limit: 1000 }),
      });
      if (!res.ok) throw new Error('Failed to clean queue');
      fetchStats();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Retry Failed Execution
  const handleRetryExecution = async (id: string) => {
    try {
      setActionLoading(`retry_${id}`);
      const res = await fetch(`/api/v1/jobs/retry/${id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to retry execution');
      }
      if (selectedExecution?.id === id) {
        const updated = await res.json();
        setSelectedExecution(updated);
      }
      fetchStats();
      fetchExecutions();
    } catch (err: any) {
      alert(`Retry Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Update Schedule Cron / Toggle
  const handleSaveSchedule = async () => {
    if (!editingSchedule) return;
    try {
      setActionLoading('save_schedule');
      const res = await fetch(`/api/v1/jobs/schedules/${editingSchedule.jobType}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cronExpression: editCronInput,
          isEnabled: editingSchedule.isEnabled,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to update schedule');
      }
      setEditingSchedule(null);
      fetchSchedules();
    } catch (err: any) {
      alert(`Update Schedule Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleSchedule = async (schedule: ScheduledJobConfigDto) => {
    try {
      setActionLoading(`toggle_${schedule.id}`);
      const res = await fetch(`/api/v1/jobs/schedules/${schedule.jobType}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isEnabled: !schedule.isEnabled,
        }),
      });
      if (!res.ok) throw new Error('Failed to toggle schedule state');
      fetchSchedules();
    } catch (err: any) {
      alert(`Toggle Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Format Helpers
  const formatJobTypeBadge = (jobType: JobType) => {
    switch (jobType) {
      case JobType.INVOICE_GENERATION:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case JobType.PAYMENT_REMINDERS:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case JobType.MAINTENANCE_ESCALATION:
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case JobType.AGREEMENT_EXPIRY:
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case JobType.NOTIFICATION_DISPATCH:
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case JobType.SYSTEM_CLEANUP:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const formatStatusBadge = (status: JobExecutionStatus) => {
    switch (status) {
      case JobExecutionStatus.COMPLETED:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case JobExecutionStatus.RUNNING:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30 animate-pulse';
      case JobExecutionStatus.PENDING:
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case JobExecutionStatus.FAILED:
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case JobExecutionStatus.CANCELLED:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  const getCronHumanReadable = (cron: string) => {
    if (cron === '0 0 1 * *') return 'Monthly on 1st at midnight';
    if (cron === '0 8 * * *') return 'Daily at 08:00 AM';
    if (cron === '*/15 * * * *') return 'Every 15 minutes';
    if (cron === '0 9 * * *') return 'Daily at 09:00 AM';
    if (cron === '* * * * *') return 'Every minute';
    if (cron === '0 2 * * *') return 'Daily at 02:00 AM';
    return cron;
  };

  // Compute Total Metrics
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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-8 space-y-8">
      {/* 1. Header & Top Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-500/10 border border-teal-500/30 rounded-xl text-teal-400">
              <CalendarClock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                Automated Job Scheduler & Queues
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono border border-slate-700">
                  CORE-029
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                BullMQ & Redis background worker pipeline, recurring cron schedules & dead-letter recovery
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Health status badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                stats?.redisConnected ? 'bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50' : 'bg-rose-500'
              }`}
            />
            <span className="text-slate-300">Redis: {stats?.redisConnected ? 'Connected' : 'Offline'}</span>
          </div>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              autoRefresh
                ? 'bg-teal-500/10 border-teal-500/30 text-teal-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
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
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Refresh All"
          >
            <RefreshCw className={`w-4 h-4 ${statsLoading || loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowTriggerModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold shadow-sm transition-colors"
          >
            <Zap className="w-4 h-4" />
            <span>Manual Trigger</span>
          </button>
        </div>
      </div>

      {/* 2. Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Active Jobs */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Active Running</p>
            <p className="text-2xl font-bold text-blue-400 mt-1 font-mono">{totalActive}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* Completed */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Completed</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{totalCompleted}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Failed / DLQ */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Failed / DLQ</p>
            <p className="text-2xl font-bold text-rose-400 mt-1 font-mono">{totalFailed}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Waiting / Delayed */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Waiting / Delayed</p>
            <p className="text-2xl font-bold text-amber-400 mt-1 font-mono">{totalWaiting}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Engine Status */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Processing Engine</p>
            <p className="text-sm font-semibold text-teal-400 mt-1">BullMQ v5.41</p>
            <p className="text-[11px] text-slate-400">3 Dedicated Queues</p>
          </div>
          <div className="p-2.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400">
            <Server className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Queue Topology Cards Grid */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-teal-400" />
          Queue Pipeline Topology
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Queue 1: propertyos:jobs */}
          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white text-base">propertyos:jobs</h3>
                  <p className="text-xs text-slate-400">General Background & Batch Jobs</p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium border ${
                    stats?.queues?.jobs?.paused
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {stats?.queues?.jobs?.paused ? 'PAUSED' : 'ACTIVE'}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-center font-mono">
                <div className="bg-slate-950/60 p-2 rounded border border-slate-800/60">
                  <p className="text-[10px] text-slate-400">Waiting</p>
                  <p className="text-sm font-bold text-slate-200">{stats?.queues?.jobs?.waiting || 0}</p>
                </div>
                <div className="bg-slate-950/60 p-2 rounded border border-slate-800/60">
                  <p className="text-[10px] text-blue-400">Active</p>
                  <p className="text-sm font-bold text-blue-400">{stats?.queues?.jobs?.active || 0}</p>
                </div>
                <div className="bg-slate-950/60 p-2 rounded border border-slate-800/60">
                  <p className="text-[10px] text-emerald-400">Done</p>
                  <p className="text-sm font-bold text-emerald-400">{stats?.queues?.jobs?.completed || 0}</p>
                </div>
                <div className="bg-slate-950/60 p-2 rounded border border-slate-800/60">
                  <p className="text-[10px] text-rose-400">Failed</p>
                  <p className="text-sm font-bold text-rose-400">{stats?.queues?.jobs?.failed || 0}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
              {stats?.queues?.jobs?.paused ? (
                <button
                  onClick={() => handleResumeQueue('propertyos:jobs')}
                  disabled={actionLoading === 'resume_propertyos:jobs'}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 rounded-lg text-xs font-medium transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Resume</span>
                </button>
              ) : (
                <button
                  onClick={() => handlePauseQueue('propertyos:jobs')}
                  disabled={actionLoading === 'pause_propertyos:jobs'}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-600/20 border border-amber-500/30 text-amber-300 hover:bg-amber-600/30 rounded-lg text-xs font-medium transition-colors"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>
              )}

              <button
                onClick={() => handleCleanQueue('propertyos:jobs')}
                disabled={actionLoading === 'clean_propertyos:jobs'}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                title="Clean completed jobs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clean</span>
              </button>
            </div>
          </div>

          {/* Queue 2: propertyos:notifications */}
          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white text-base">propertyos:notifications</h3>
                  <p className="text-xs text-slate-400">In-App Notification Dispatch</p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium border ${
                    stats?.queues?.notifications?.paused
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {stats?.queues?.notifications?.paused ? 'PAUSED' : 'ACTIVE'}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-center font-mono">
                <div className="bg-slate-950/60 p-2 rounded border border-slate-800/60">
                  <p className="text-[10px] text-slate-400">Waiting</p>
                  <p className="text-sm font-bold text-slate-200">{stats?.queues?.notifications?.waiting || 0}</p>
                </div>
                <div className="bg-slate-950/60 p-2 rounded border border-slate-800/60">
                  <p className="text-[10px] text-blue-400">Active</p>
                  <p className="text-sm font-bold text-blue-400">{stats?.queues?.notifications?.active || 0}</p>
                </div>
                <div className="bg-slate-950/60 p-2 rounded border border-slate-800/60">
                  <p className="text-[10px] text-emerald-400">Done</p>
                  <p className="text-sm font-bold text-emerald-400">{stats?.queues?.notifications?.completed || 0}</p>
                </div>
                <div className="bg-slate-950/60 p-2 rounded border border-slate-800/60">
                  <p className="text-[10px] text-rose-400">Failed</p>
                  <p className="text-sm font-bold text-rose-400">{stats?.queues?.notifications?.failed || 0}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
              {stats?.queues?.notifications?.paused ? (
                <button
                  onClick={() => handleResumeQueue('propertyos:notifications')}
                  disabled={actionLoading === 'resume_propertyos:notifications'}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 rounded-lg text-xs font-medium transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Resume</span>
                </button>
              ) : (
                <button
                  onClick={() => handlePauseQueue('propertyos:notifications')}
                  disabled={actionLoading === 'pause_propertyos:notifications'}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-600/20 border border-amber-500/30 text-amber-300 hover:bg-amber-600/30 rounded-lg text-xs font-medium transition-colors"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>
              )}

              <button
                onClick={() => handleCleanQueue('propertyos:notifications')}
                disabled={actionLoading === 'clean_propertyos:notifications'}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clean</span>
              </button>
            </div>
          </div>

          {/* Queue 3: propertyos:dlq */}
          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white text-base">propertyos:dlq</h3>
                  <p className="text-xs text-slate-400">Dead-Letter Inspection Queue</p>
                </div>
                <span className="px-2 py-0.5 rounded text-xs font-medium border bg-purple-500/10 text-purple-400 border-purple-500/30">
                  DLQ
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-center font-mono">
                <div className="bg-slate-950/60 p-2 rounded border border-slate-800/60">
                  <p className="text-[10px] text-slate-400">Waiting</p>
                  <p className="text-sm font-bold text-slate-200">{stats?.queues?.dlq?.waiting || 0}</p>
                </div>
                <div className="bg-slate-950/60 p-2 rounded border border-slate-800/60">
                  <p className="text-[10px] text-blue-400">Active</p>
                  <p className="text-sm font-bold text-blue-400">{stats?.queues?.dlq?.active || 0}</p>
                </div>
                <div className="bg-slate-950/60 p-2 rounded border border-slate-800/60">
                  <p className="text-[10px] text-emerald-400">Done</p>
                  <p className="text-sm font-bold text-emerald-400">{stats?.queues?.dlq?.completed || 0}</p>
                </div>
                <div className="bg-slate-950/60 p-2 rounded border border-slate-800/60">
                  <p className="text-[10px] text-rose-400">Failed</p>
                  <p className="text-sm font-bold text-rose-400">{stats?.queues?.dlq?.failed || 0}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
              <button
                onClick={() => handleCleanQueue('propertyos:dlq')}
                disabled={actionLoading === 'clean_propertyos:dlq'}
                className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clean DLQ</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Scheduled Jobs Configuration Matrix */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-teal-400" />
          Recurring Job Schedulers
        </h2>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/90 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Job Type</th>
                <th className="px-5 py-3.5">Schedule (Cron)</th>
                <th className="px-5 py-3.5">Enabled</th>
                <th className="px-5 py-3.5">Last Run</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {schedules.map((sch) => (
                <tr key={sch.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded text-xs font-semibold border ${formatJobTypeBadge(sch.jobType)}`}>
                      {sch.jobType}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-mono text-xs text-white">{sch.cronExpression}</div>
                    <div className="text-[11px] text-slate-400">{getCronHumanReadable(sch.cronExpression)}</div>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => handleToggleSchedule(sch)}
                      disabled={actionLoading === `toggle_${sch.id}`}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        sch.isEnabled ? 'bg-teal-600' : 'bg-slate-800'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          sch.isEnabled ? 'translate-x-4' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    {sch.lastRunAt ? (
                      <div>
                        <div className="text-xs text-white font-mono">{new Date(sch.lastRunAt).toLocaleString('en-IN')}</div>
                        {sch.lastStatus && (
                          <span
                            className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.2 rounded border ${formatStatusBadge(
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
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
                    >
                      Edit Cron
                    </button>
                    <button
                      onClick={() => {
                        setTriggerJobType(sch.jobType);
                        setShowTriggerModal(true);
                      }}
                      className="px-2.5 py-1 rounded bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 text-xs font-medium transition-colors"
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
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-400" />
            Job Execution History ({totalExecutions})
          </h2>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedJobType}
              onChange={(e) => {
                setSelectedJobType(e.target.value as any);
                setPage(1);
              }}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-teal-500"
            >
              <option value="">All Job Types</option>
              {Object.values(JobType).map((jt) => (
                <option key={jt} value={jt}>
                  {jt}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value as any);
                setPage(1);
              }}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-teal-500"
            >
              <option value="">All Statuses</option>
              {Object.values(JobExecutionStatus).map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            <select
              value={selectedQueue}
              onChange={(e) => {
                setSelectedQueue(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-teal-500"
            >
              <option value="">All Queues</option>
              <option value="propertyos:jobs">propertyos:jobs</option>
              <option value="propertyos:notifications">propertyos:notifications</option>
              <option value="propertyos:dlq">propertyos:dlq</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/90 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Execution ID / Bull ID</th>
                <th className="px-5 py-3.5">Job Type</th>
                <th className="px-5 py-3.5">Queue</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Attempts</th>
                <th className="px-5 py-3.5">Duration</th>
                <th className="px-5 py-3.5">Created At</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-400 mb-2" />
                    <span>Loading execution history...</span>
                  </td>
                </tr>
              ) : executions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <p className="font-semibold text-slate-300">No executions found</p>
                    <p className="text-xs text-slate-400">Trigger a background job or wait for recurring cron schedules.</p>
                  </td>
                </tr>
              ) : (
                executions.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-mono text-xs text-white font-medium truncate max-w-[150px]" title={item.id}>
                        {item.id}
                      </div>
                      {item.bullJobId && (
                        <div className="font-mono text-[10px] text-slate-400 truncate max-w-[150px]">
                          {item.bullJobId}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${formatJobTypeBadge(item.jobType)}`}>
                        {item.jobType}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-400">{item.queueName}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${formatStatusBadge(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-300">
                      {item.attempts}/{item.maxAttempts}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-300">
                      {item.durationMs !== null && item.durationMs !== undefined ? `${item.durationMs}ms` : '—'}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-400">
                      {new Date(item.createdAt).toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2">
                      <button
                        onClick={() => setSelectedExecution(item)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
                      >
                        Inspect
                      </button>
                      {item.status === JobExecutionStatus.FAILED && (
                        <button
                          onClick={() => handleRetryExecution(item.id)}
                          disabled={actionLoading === `retry_${item.id}`}
                          className="px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors inline-flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Retry</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-400">
              Page {page} of {totalPages} ({totalExecutions} records)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium disabled:opacity-40 hover:bg-slate-800"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium disabled:opacity-40 hover:bg-slate-800"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Execution Detail Slide-Over Drawer */}
      {selectedExecution && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-teal-400" />
                  Execution Details
                </h3>
                <p className="text-xs font-mono text-slate-400">{selectedExecution.id}</p>
              </div>
              <button
                onClick={() => setSelectedExecution(null)}
                className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                <span className="text-slate-400">Job Type:</span>
                <p className="font-semibold text-white mt-0.5">{selectedExecution.jobType}</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                <span className="text-slate-400">Status:</span>
                <p className="font-semibold text-white mt-0.5">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${formatStatusBadge(selectedExecution.status)}`}>
                    {selectedExecution.status}
                  </span>
                </p>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                <span className="text-slate-400">Attempts:</span>
                <p className="font-mono text-white mt-0.5">
                  {selectedExecution.attempts} / {selectedExecution.maxAttempts}
                </p>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                <span className="text-slate-400">Duration:</span>
                <p className="font-mono text-white mt-0.5">
                  {selectedExecution.durationMs !== null ? `${selectedExecution.durationMs}ms` : '—'}
                </p>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                <span className="text-slate-400">Bull Job ID:</span>
                <p className="font-mono text-white mt-0.5 truncate">{selectedExecution.bullJobId || '—'}</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                <span className="text-slate-400">Queue Name:</span>
                <p className="font-mono text-white mt-0.5">{selectedExecution.queueName}</p>
              </div>
            </div>

            {selectedExecution.error && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-1">
                <p className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  Execution Error
                </p>
                <pre className="text-xs font-mono text-rose-300 whitespace-pre-wrap">{selectedExecution.error}</pre>
              </div>
            )}

            {/* Payload View */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Sanitized Payload:</span>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(selectedExecution.payload, null, 2))}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto max-h-48">
                {JSON.stringify(selectedExecution.payload || {}, null, 2)}
              </pre>
            </div>

            {/* Result View */}
            {selectedExecution.result && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-300">Execution Result:</span>
                <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto max-h-48">
                  {JSON.stringify(selectedExecution.result, null, 2)}
                </pre>
              </div>
            )}

            {selectedExecution.status === JobExecutionStatus.FAILED && (
              <div className="pt-4 border-t border-slate-800">
                <button
                  onClick={() => handleRetryExecution(selectedExecution.id)}
                  disabled={actionLoading === `retry_${selectedExecution.id}`}
                  className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold rounded-lg shadow transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Retry This Failed Job</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. Manual Trigger Modal */}
      {showTriggerModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-teal-400" />
                Trigger Background Job
              </h3>
              <button onClick={() => setShowTriggerModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Select Job Type</label>
                <select
                  value={triggerJobType}
                  onChange={(e) => setTriggerJobType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500"
                >
                  {Object.values(JobType).map((jt) => (
                    <option key={jt} value={jt}>
                      {jt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="forceRun"
                  checked={triggerForceRun}
                  onChange={(e) => setTriggerForceRun(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-teal-600 focus:ring-0"
                />
                <label htmlFor="forceRun" className="text-xs text-slate-300 select-none cursor-pointer">
                  Force Run (Bypass idempotency time-window checks)
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Parameters (JSON)</label>
                <textarea
                  value={triggerParamsJson}
                  onChange={(e) => setTriggerParamsJson(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-teal-500"
                  placeholder="{}"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowTriggerModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleTriggerJob}
                disabled={actionLoading === 'trigger'}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Enqueue Job</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Edit Cron Schedule Modal */}
      {editingSchedule && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-teal-400" />
                Edit Schedule — {editingSchedule.jobType}
              </h3>
              <button onClick={() => setEditingSchedule(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Standard Cron Expression (5-parts)</label>
                <input
                  type="text"
                  value={editCronInput}
                  onChange={(e) => setEditCronInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-teal-500"
                  placeholder="0 0 1 * *"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Format: minute hour day-of-month month day-of-week (e.g. &quot;0 0 1 * *&quot; or &quot;*/15 * * * *&quot;)
                </p>
              </div>

              {/* Quick Presets */}
              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 font-medium">Quick Presets:</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setEditCronInput('0 0 1 * *')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-mono"
                  >
                    Monthly 1st
                  </button>
                  <button
                    onClick={() => setEditCronInput('0 8 * * *')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-mono"
                  >
                    Daily 8am
                  </button>
                  <button
                    onClick={() => setEditCronInput('*/15 * * * *')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-mono"
                  >
                    Every 15m
                  </button>
                  <button
                    onClick={() => setEditCronInput('0 9 * * *')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-mono"
                  >
                    Daily 9am
                  </button>
                  <button
                    onClick={() => setEditCronInput('* * * * *')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-mono"
                  >
                    Every 1m
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setEditingSchedule(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSchedule}
                disabled={actionLoading === 'save_schedule'}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg"
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
