'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/lib/auth-context';
import {
  ElectricityMeterDto,
  ElectricityReadingDto,
  ElectricityRateDto,
  ElectricityChargeDto,
  ElectricitySummaryDto,
  MeterType,
  MeterStatus,
  ElectricityRateStatus,
  ElectricityChargeStatus,
  ElectricityAllocationType,
  PropertyType,
} from '@propertyos/types';
import {
  Zap,
  Plus,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  CircleDollarSign,
  ArrowRight,
  TrendingUp,
  Shield,
  Layers,
  Calendar,
  Loader2,
  FileText,
  Play,
  RotateCcw,
  Building,
  User,
  X,
  Gauge,
  HelpCircle,
  FileSpreadsheet,
} from 'lucide-react';

export default function ElectricityManagementPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [properties, setProperties] = useState<any[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [rooms, setRooms] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<'overview' | 'meters' | 'readings' | 'rates' | 'charges'>('overview');

  // Summary & Data State
  const [summary, setSummary] = useState<ElectricitySummaryDto | null>(null);
  const [meters, setMeters] = useState<ElectricityMeterDto[]>([]);
  const [readings, setReadings] = useState<ElectricityReadingDto[]>([]);
  const [rates, setRates] = useState<ElectricityRateDto[]>([]);
  const [charges, setCharges] = useState<ElectricityChargeDto[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Create Meter Modal State
  const [showMeterModal, setShowMeterModal] = useState(false);
  const [meterNumber, setMeterNumber] = useState('');
  const [meterType, setMeterType] = useState<MeterType>(MeterType.ROOM);
  const [meterRoomId, setMeterRoomId] = useState('');
  const [meterInitialReading, setMeterInitialReading] = useState('0');
  const [savingMeter, setSavingMeter] = useState(false);

  // Record Reading Modal State
  const [showReadingModal, setShowReadingModal] = useState(false);
  const [readingMeterId, setReadingMeterId] = useState('');
  const [readingDate, setReadingDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentReading, setCurrentReading] = useState('');
  const [isResetOverride, setIsResetOverride] = useState(false);
  const [resetReason, setResetReason] = useState('');
  const [readingNotes, setReadingNotes] = useState('');
  const [savingReading, setSavingReading] = useState(false);

  // Add Rate Modal State
  const [showRateModal, setShowRateModal] = useState(false);
  const [ratePerUnit, setRatePerUnit] = useState('');
  const [rateEffectiveFrom, setRateEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [rateEffectiveTo, setRateEffectiveTo] = useState('');
  const [savingRate, setSavingRate] = useState(false);

  // Generate Charges Modal State
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateReadingId, setGenerateReadingId] = useState('');
  const [autoInvoice, setAutoInvoice] = useState(true);
  const [generatingCharges, setGeneratingCharges] = useState(false);

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('propertyos_token') : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  // Fetch properties on mount
  useEffect(() => {
    async function loadProperties() {
      try {
        const res = await fetch('/api/v1/properties', {
          headers: getHeaders(),
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          const list = json.data || json;
          // Filter to PG properties only
          const pgProps = list.filter((p: any) => p.propertyType === PropertyType.PG);
          setProperties(pgProps);
          if (pgProps.length > 0) {
            setSelectedPropertyId(pgProps[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load properties', err);
      }
    }
    loadProperties();
  }, []);

  // Fetch rooms for selected property
  useEffect(() => {
    if (!selectedPropertyId) return;
    async function loadRooms() {
      try {
        const res = await fetch(`/api/v1/properties/${selectedPropertyId}/rooms`, {
          headers: getHeaders(),
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          setRooms(json.data || json);
        }
      } catch (err) {
        console.error('Failed to load rooms', err);
      }
    }
    loadRooms();
  }, [selectedPropertyId]);

  // Fetch all electricity data for selected property
  const loadData = useCallback(async () => {
    if (!selectedPropertyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const [sumRes, meterRes, readRes, rateRes, chargeRes] = await Promise.all([
        fetch(`/api/v1/properties/${selectedPropertyId}/electricity/summary`, { headers: getHeaders(), credentials: 'include' }),
        fetch(`/api/v1/properties/${selectedPropertyId}/electricity/meters`, { headers: getHeaders(), credentials: 'include' }),
        fetch(`/api/v1/properties/${selectedPropertyId}/electricity/readings`, { headers: getHeaders(), credentials: 'include' }),
        fetch(`/api/v1/properties/${selectedPropertyId}/electricity/rates`, { headers: getHeaders(), credentials: 'include' }),
        fetch(`/api/v1/properties/${selectedPropertyId}/electricity/charges`, { headers: getHeaders(), credentials: 'include' }),
      ]);

      if (sumRes.ok) {
        const sumJson = await sumRes.json();
        setSummary(sumJson.data || sumJson);
      }
      if (meterRes.ok) {
        const mJson = await meterRes.json();
        setMeters(mJson.data || mJson);
      }
      if (readRes.ok) {
        const rJson = await readRes.json();
        setReadings(rJson.data || rJson);
      }
      if (rateRes.ok) {
        const rtJson = await rateRes.json();
        setRates(rtJson.data || rtJson);
      }
      if (chargeRes.ok) {
        const cJson = await chargeRes.json();
        setCharges(cJson.data || cJson);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch electricity data');
    } finally {
      setLoading(false);
    }
  }, [selectedPropertyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handler: Create Meter
  const handleCreateMeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meterNumber.trim()) return;

    setSavingMeter(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/v1/properties/${selectedPropertyId}/electricity/meters`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          meterNumber: meterNumber.trim(),
          meterType,
          roomId: meterType === MeterType.ROOM ? meterRoomId || null : null,
          initialReading: parseFloat(meterInitialReading) || 0,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create meter');
      }

      setShowMeterModal(false);
      setMeterNumber('');
      setMeterRoomId('');
      setMeterInitialReading('0');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSavingMeter(false);
    }
  };

  // Handler: Record Reading
  const handleRecordReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!readingMeterId || !currentReading) return;

    setSavingReading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/v1/properties/${selectedPropertyId}/electricity/readings`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          meterId: readingMeterId,
          readingDate: new Date(readingDate).toISOString(),
          currentReading: parseFloat(currentReading),
          isResetOverride,
          resetReason: isResetOverride ? resetReason.trim() : undefined,
          notes: readingNotes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to record meter reading');
      }

      setShowReadingModal(false);
      setReadingMeterId('');
      setCurrentReading('');
      setIsResetOverride(false);
      setResetReason('');
      setReadingNotes('');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSavingReading(false);
    }
  };

  // Handler: Add Rate
  const handleAddRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratePerUnit) return;

    setSavingRate(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/v1/properties/${selectedPropertyId}/electricity/rates`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          ratePerUnit: parseFloat(ratePerUnit),
          effectiveFrom: new Date(rateEffectiveFrom).toISOString(),
          effectiveTo: rateEffectiveTo ? new Date(rateEffectiveTo).toISOString() : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to add electricity rate');
      }

      setShowRateModal(false);
      setRatePerUnit('');
      setRateEffectiveTo('');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSavingRate(false);
    }
  };

  // Handler: Generate Charges
  const handleGenerateCharges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!generateReadingId) return;

    setGeneratingCharges(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/v1/properties/${selectedPropertyId}/electricity/charges/generate`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          readingId: generateReadingId,
          autoInvoice,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to generate electricity charges');
      }

      setShowGenerateModal(false);
      setGenerateReadingId('');
      await loadData();
      setActiveTab('charges');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setGeneratingCharges(false);
    }
  };

  const selectedMeter = meters.find((m) => m.id === readingMeterId);

  return (
    <AppShell activePath="/electricity">
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Electricity Management
                </h1>
                <p className="text-sm text-slate-500">
                  Meter readings, deterministic room occupant allocation, rate configuration & billing
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Property Selector */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
              <Building className="w-4 h-4 text-slate-400" />
              <select
                aria-label="Select PG Property"
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="text-sm font-medium text-slate-800 bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer"
              >
                {properties.length === 0 ? (
                  <option value="">No PG Properties</option>
                ) : (
                  properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))
                )}
              </select>
            </div>

            <button
              onClick={() => setShowReadingModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 shadow-sm transition-colors"
            >
              <Gauge className="w-4 h-4 text-slate-500" />
              <span>Record Reading</span>
            </button>

            <button
              onClick={() => setShowMeterModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal text-white text-sm font-medium hover:bg-teal-700 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Meter</span>
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-between text-rose-800 text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Meters</span>
              <Gauge className="w-4 h-4 text-brand-teal" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {summary ? summary.totalMeters : 0}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              <span className="text-emerald-600 font-medium">{summary ? summary.activeMeters : 0}</span> Active
            </p>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Consumption</span>
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {summary ? Number(summary.currentPeriodConsumption).toLocaleString('en-IN') : 0}
            </p>
            <p className="text-xs text-slate-500 mt-1">Units (kWh) Recorded</p>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Charges</span>
              <CircleDollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              ₹{summary ? Number(summary.totalElectricityCharges).toLocaleString('en-IN') : '0'}
            </p>
            <p className="text-xs text-slate-500 mt-1">Generated to date</p>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-amber-600 mt-2">
              {summary ? summary.pendingChargesCount : 0}
            </p>
            <p className="text-xs text-slate-500 mt-1">Uninvoiced charges</p>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Invoiced</span>
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-600 mt-2">
              {summary ? summary.invoicedChargesCount : 0}
            </p>
            <p className="text-xs text-slate-500 mt-1">Linked to invoices</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-slate-200">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', name: 'Overview' },
              { id: 'meters', name: `Meters (${meters.length})` },
              { id: 'readings', name: `Readings (${readings.length})` },
              { id: 'rates', name: `Rates (${rates.length})` },
              { id: 'charges', name: `Charges (${charges.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-brand-teal text-brand-teal'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* TAB CONTENTS */}
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-brand-teal mb-3" />
            <p className="text-sm font-medium">Loading electricity operations...</p>
          </div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Readings */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-800 text-sm">Recent Meter Readings</h3>
                    <button
                      onClick={() => setActiveTab('readings')}
                      className="text-xs font-medium text-brand-teal hover:underline"
                    >
                      View all
                    </button>
                  </div>
                  {readings.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                      No readings recorded yet for this property.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {readings.slice(0, 5).map((r) => (
                        <div key={r.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800 text-sm">
                                Meter {r.meter?.meterNumber || '—'}
                              </span>
                              {r.isResetOverride && (
                                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">
                                  RESET
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">
                              Date: {new Date(r.readingDate).toLocaleDateString('en-IN')} | Prev: {r.previousReading} → Curr: {r.currentReading}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-slate-900 text-sm">
                              {r.unitsConsumed} units
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Active Rates & Quick Actions */}
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-slate-800 text-sm">Active Electricity Tariff</h3>
                      <button
                        onClick={() => setShowRateModal(true)}
                        className="text-xs font-medium text-brand-teal hover:underline inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Configure Rate
                      </button>
                    </div>
                    {rates.length === 0 ? (
                      <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>No rate tariff configured. Please add an active rate before generating charges.</span>
                      </div>
                    ) : (
                      <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-500">Current Unit Tariff</p>
                          <p className="text-2xl font-bold text-brand-navy mt-0.5">
                            ₹{Number(rates[0].ratePerUnit).toFixed(2)} <span className="text-xs font-normal text-slate-500">/ unit</span>
                          </p>
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          <p>Effective From</p>
                          <p className="font-medium text-slate-700">{new Date(rates[0].effectiveFrom).toLocaleDateString('en-IN')}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-gradient-to-br from-slate-900 to-brand-navy rounded-xl p-6 text-white shadow-sm">
                    <h3 className="font-semibold text-base">Charge Generation Flow</h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      1. Record monthly meter reading.
                      <br />
                      2. For room meters, the system automatically checks active occupants and splits consumption evenly with zero rounding loss.
                      <br />
                      3. Generate charges and auto-invoice into CORE-011 for balanced double-entry accounting.
                    </p>
                    <button
                      onClick={() => {
                        if (readings.length > 0) {
                          setGenerateReadingId(readings[0].id);
                          setShowGenerateModal(true);
                        } else {
                          setErrorMsg('Record at least one meter reading before generating charges.');
                        }
                      }}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal text-white text-xs font-medium hover:bg-teal-600 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Generate Charges from Reading</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* METERS TAB */}
            {activeTab === 'meters' && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 text-sm">Configured Meters</h3>
                  <button
                    onClick={() => setShowMeterModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-teal text-white text-xs font-medium hover:bg-teal-700"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Meter</span>
                  </button>
                </div>
                {meters.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-sm">
                    No electricity meters registered for this property yet.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs">
                        <th className="py-3 px-4 font-semibold">Meter Number</th>
                        <th className="py-3 px-4 font-semibold">Type</th>
                        <th className="py-3 px-4 font-semibold">Room Assigned</th>
                        <th className="py-3 px-4 font-semibold text-right">Initial Reading</th>
                        <th className="py-3 px-4 font-semibold">Last Reading</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {meters.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="py-3.5 px-4 font-medium text-slate-900">{m.meterNumber}</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-700">
                              {m.meterType}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {m.room ? `Room ${m.room.roomNumber}` : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-700">{m.initialReading}</td>
                          <td className="py-3.5 px-4 text-slate-500">
                            {m.lastReadingAt ? new Date(m.lastReadingAt).toLocaleDateString('en-IN') : 'No readings'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
                              m.status === MeterStatus.ACTIVE
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {m.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => {
                                setReadingMeterId(m.id);
                                setShowReadingModal(true);
                              }}
                              className="text-xs font-medium text-brand-teal hover:underline"
                            >
                              Record Reading
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* READINGS TAB */}
            {activeTab === 'readings' && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 text-sm">Reading History</h3>
                  <button
                    onClick={() => setShowReadingModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-teal text-white text-xs font-medium hover:bg-teal-700"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Record Reading</span>
                  </button>
                </div>
                {readings.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-sm">
                    No readings found.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs">
                        <th className="py-3 px-4 font-semibold">Date</th>
                        <th className="py-3 px-4 font-semibold">Meter</th>
                        <th className="py-3 px-4 font-semibold text-right">Previous</th>
                        <th className="py-3 px-4 font-semibold text-right">Current</th>
                        <th className="py-3 px-4 font-semibold text-right">Units Consumed</th>
                        <th className="py-3 px-4 font-semibold">Override</th>
                        <th className="py-3 px-4 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {readings.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="py-3.5 px-4 font-medium text-slate-800">
                            {new Date(r.readingDate).toLocaleDateString('en-IN')}
                          </td>
                          <td className="py-3.5 px-4 text-slate-700">
                            Meter {r.meter?.meterNumber || '—'}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-600">{r.previousReading}</td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-900 font-semibold">{r.currentReading}</td>
                          <td className="py-3.5 px-4 text-right font-mono text-brand-teal font-bold">{r.unitsConsumed}</td>
                          <td className="py-3.5 px-4">
                            {r.isResetOverride ? (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded" title={r.resetReason || ''}>
                                RESET: {r.resetReason}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => {
                                setGenerateReadingId(r.id);
                                setShowGenerateModal(true);
                              }}
                              className="text-xs font-medium text-brand-teal hover:underline inline-flex items-center gap-1"
                            >
                              <Play className="w-3 h-3" />
                              <span>Generate Charges</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* RATES TAB */}
            {activeTab === 'rates' && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 text-sm">Electricity Rates</h3>
                  <button
                    onClick={() => setShowRateModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-teal text-white text-xs font-medium hover:bg-teal-700"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Rate Tariff</span>
                  </button>
                </div>
                {rates.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-sm">
                    No electricity rates configured.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs">
                        <th className="py-3 px-4 font-semibold">Rate Per Unit (₹)</th>
                        <th className="py-3 px-4 font-semibold">Effective From</th>
                        <th className="py-3 px-4 font-semibold">Effective To</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rates.map((rt) => (
                        <tr key={rt.id} className="hover:bg-slate-50">
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            ₹{Number(rt.ratePerUnit).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {new Date(rt.effectiveFrom).toLocaleDateString('en-IN')}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {rt.effectiveTo ? new Date(rt.effectiveTo).toLocaleDateString('en-IN') : 'Ongoing'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800">
                              {rt.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* CHARGES TAB */}
            {activeTab === 'charges' && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 text-sm">Electricity Charges & Invoices</h3>
                </div>
                {charges.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-sm">
                    No charges generated yet.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs">
                        <th className="py-3 px-4 font-semibold">Period</th>
                        <th className="py-3 px-4 font-semibold">Tenant / Target</th>
                        <th className="py-3 px-4 font-semibold">Meter</th>
                        <th className="py-3 px-4 font-semibold text-right">Units</th>
                        <th className="py-3 px-4 font-semibold text-right">Amount (₹)</th>
                        <th className="py-3 px-4 font-semibold">Allocation</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold">Invoice</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {charges.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="py-3.5 px-4 text-slate-600 text-xs">
                            {new Date(c.chargePeriodStart).toLocaleDateString('en-IN')} - {new Date(c.chargePeriodEnd).toLocaleDateString('en-IN')}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-900">
                            {c.tenant ? `${c.tenant.firstName} ${c.tenant.lastName}` : (c.room ? `Room ${c.room.roomNumber}` : 'Property Common')}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {c.meter?.meterNumber || '—'}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-700">{c.unitsConsumed}</td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">₹{Number(c.amount).toFixed(2)}</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-slate-100 text-slate-700">
                              {c.allocationType}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
                              c.status === ElectricityChargeStatus.INVOICED
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            {c.invoice ? (
                              <Link href="/invoices" className="font-semibold text-brand-teal hover:underline">
                                {c.invoice.invoiceNumber}
                              </Link>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}

        {/* MODAL: CREATE METER */}
        {showMeterModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-base">Add Electricity Meter</h3>
                <button onClick={() => setShowMeterModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateMeter} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Meter Number / Identifier *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MTR-R101, MAIN-01"
                    value={meterNumber}
                    onChange={(e) => setMeterNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Meter Type</label>
                  <select
                    value={meterType}
                    onChange={(e) => setMeterType(e.target.value as MeterType)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  >
                    <option value={MeterType.ROOM}>Room Meter (Allocates to occupants)</option>
                    <option value={MeterType.PROPERTY}>Property Main Meter</option>
                    <option value={MeterType.COMMON_AREA}>Common Area Meter</option>
                  </select>
                </div>

                {meterType === MeterType.ROOM && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Assign to Room *</label>
                    <select
                      required
                      value={meterRoomId}
                      onChange={(e) => setMeterRoomId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                    >
                      <option value="">Select Room...</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          Room {r.roomNumber} ({r.sharingType})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Initial / Baseline Reading</label>
                  <input
                    type="number"
                    step="0.01"
                    value={meterInitialReading}
                    onChange={(e) => setMeterInitialReading(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Starting counter value when installed.</p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowMeterModal(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingMeter}
                    className="px-4 py-2 rounded-lg bg-brand-teal text-white text-sm font-medium hover:bg-teal-700 flex items-center gap-2"
                  >
                    {savingMeter && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Save Meter</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: RECORD READING */}
        {showReadingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-base">Record Meter Reading</h3>
                <button onClick={() => setShowReadingModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRecordReading} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select Meter *</label>
                  <select
                    required
                    value={readingMeterId}
                    onChange={(e) => setReadingMeterId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  >
                    <option value="">Select Meter...</option>
                    {meters.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.meterNumber} ({m.room ? `Room ${m.room.roomNumber}` : m.meterType})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Reading Date *</label>
                  <input
                    type="date"
                    required
                    value={readingDate}
                    onChange={(e) => setReadingDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Current Reading *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Enter current meter counter value"
                    value={currentReading}
                    onChange={(e) => setCurrentReading(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>

                {/* Reset Override Toggle */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="resetOverride"
                      checked={isResetOverride}
                      onChange={(e) => setIsResetOverride(e.target.checked)}
                      className="w-4 h-4 text-brand-teal rounded border-slate-300"
                    />
                    <label htmlFor="resetOverride" className="text-xs font-semibold text-slate-800 cursor-pointer">
                      Authorized Meter Reset / Replacement Override
                    </label>
                  </div>

                  {isResetOverride && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Mandatory Reset Reason *</label>
                      <input
                        type="text"
                        required={isResetOverride}
                        placeholder="e.g. Defective meter replaced with zero baseline"
                        value={resetReason}
                        onChange={(e) => setResetReason(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-teal"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowReadingModal(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingReading}
                    className="px-4 py-2 rounded-lg bg-brand-teal text-white text-sm font-medium hover:bg-teal-700 flex items-center gap-2"
                  >
                    {savingReading && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Record Reading</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: ADD RATE */}
        {showRateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-base">Add Electricity Rate Tariff</h3>
                <button onClick={() => setShowRateModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddRate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Rate Per Unit (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 10.00"
                    value={ratePerUnit}
                    onChange={(e) => setRatePerUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Effective From *</label>
                  <input
                    type="date"
                    required
                    value={rateEffectiveFrom}
                    onChange={(e) => setRateEffectiveFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Effective To (Optional)</label>
                  <input
                    type="date"
                    value={rateEffectiveTo}
                    onChange={(e) => setRateEffectiveTo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRateModal(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingRate}
                    className="px-4 py-2 rounded-lg bg-brand-teal text-white text-sm font-medium hover:bg-teal-700 flex items-center gap-2"
                  >
                    {savingRate && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Save Rate</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: GENERATE CHARGES */}
        {showGenerateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-base">Generate Electricity Charges</h3>
                <button onClick={() => setShowGenerateModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleGenerateCharges} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select Reading *</label>
                  <select
                    required
                    value={generateReadingId}
                    onChange={(e) => setGenerateReadingId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  >
                    <option value="">Select Reading...</option>
                    {readings.map((r) => (
                      <option key={r.id} value={r.id}>
                        {new Date(r.readingDate).toLocaleDateString('en-IN')} - Meter {r.meter?.meterNumber} ({r.unitsConsumed} units)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="autoInvoiceCheck"
                      checked={autoInvoice}
                      onChange={(e) => setAutoInvoice(e.target.checked)}
                      className="w-4 h-4 text-brand-teal rounded border-slate-300"
                    />
                    <label htmlFor="autoInvoiceCheck" className="text-xs font-semibold text-slate-800 cursor-pointer">
                      Auto-issue CORE-011 Invoice & Ledger Entries
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Directly creates and issues tenant invoices under UTILITY revenue ledger account.
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowGenerateModal(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={generatingCharges}
                    className="px-4 py-2 rounded-lg bg-brand-teal text-white text-sm font-medium hover:bg-teal-700 flex items-center gap-2"
                  >
                    {generatingCharges && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Confirm & Generate</span>
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
