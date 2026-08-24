'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/lib/auth-context';
import {
  ExpenseRecordDto,
  ExpenseCategoryDto,
  ExpenseSummaryDto,
  ExpenseCategoryType,
  PropertyType,
} from '@propertyos/types';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  CircleDollarSign,
  Calendar,
  Building2,
  PieChart,
  FileSpreadsheet,
  FileText,
  Trash2,
  Edit2,
  ExternalLink,
  Upload,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  ArrowUpRight,
  TrendingDown,
  Sparkles,
  RefreshCw,
  Eye,
} from 'lucide-react';

const CATEGORY_COLORS: Record<ExpenseCategoryType, { bg: string; text: string; border: string }> = {
  [ExpenseCategoryType.SALARY]: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  [ExpenseCategoryType.ELECTRICITY]: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  [ExpenseCategoryType.WATER]: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  [ExpenseCategoryType.FOOD]: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  [ExpenseCategoryType.MAINTENANCE]: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  [ExpenseCategoryType.CLEANING]: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  [ExpenseCategoryType.INTERNET]: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  [ExpenseCategoryType.SUPPLIES]: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  [ExpenseCategoryType.PROPERTY_TAX]: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  [ExpenseCategoryType.OTHER]: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
};

export default function ExpensesPage() {
  const { user } = useAuth();

  // State
  const [expenses, setExpenses] = useState<ExpenseRecordDto[]>([]);
  const [categories, setCategories] = useState<ExpenseCategoryDto[]>([]);
  const [summary, setSummary] = useState<ExpenseSummaryDto | null>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'THIS_MONTH' | 'HIGH_VALUE' | 'UTILITIES'>('ALL');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecordDto | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    propertyId: '',
    categoryName: ExpenseCategoryType.MAINTENANCE,
    title: '',
    amount: '',
    expenseDate: new Date().toISOString().split('T')[0],
    vendorName: '',
    notes: '',
    receiptUrl: '',
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch initial metadata
  const fetchMetadata = useCallback(async () => {
    try {
      const [catRes, propRes] = await Promise.all([
        fetch('/api/v1/expenses/categories', { credentials: 'include' }),
        fetch('/api/v1/properties', { credentials: 'include' }),
      ]);

      if (catRes.ok) {
        const catJson = await catRes.json();
        if (catJson.data) setCategories(catJson.data);
      }

      if (propRes.ok) {
        const propJson = await propRes.json();
        if (propJson.data) {
          setProperties(propJson.data);
          if (propJson.data.length > 0 && !formData.propertyId) {
            setFormData((prev) => ({ ...prev, propertyId: propJson.data[0].id }));
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch metadata:', e);
    }
  }, [formData.propertyId]);

  // Fetch expenses and summary
  const fetchExpensesData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Build query params
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '15');

      if (selectedPropertyId) params.set('propertyId', selectedPropertyId);
      if (selectedCategory) params.set('categoryName', selectedCategory);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      if (activeTab === 'HIGH_VALUE') {
        params.set('minAmount', '10000');
      } else if (activeTab === 'UTILITIES') {
        // Can filter on client or server
      } else if (activeTab === 'THIS_MONTH') {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
        params.set('startDate', start);
        params.set('endDate', end);
      }

      const [expRes, sumRes] = await Promise.all([
        fetch(`/api/v1/expenses?${params.toString()}`, { credentials: 'include' }),
        fetch(`/api/v1/expenses/summary${selectedPropertyId ? `?propertyId=${selectedPropertyId}` : ''}`, {
          credentials: 'include',
        }),
      ]);

      if (!expRes.ok) {
        throw new Error(`Failed to load expenses (${expRes.status})`);
      }

      const expJson = await expRes.json();
      setExpenses(expJson.data || []);
      if (expJson.meta) {
        setTotalPages(expJson.meta.totalPages || 1);
        setTotalCount(expJson.meta.total || 0);
      }

      if (sumRes.ok) {
        const sumJson = await sumRes.json();
        setSummary(sumJson.data || null);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading expense records');
    } finally {
      setLoading(false);
    }
  }, [page, selectedPropertyId, selectedCategory, searchQuery, activeTab]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  useEffect(() => {
    fetchExpensesData();
  }, [fetchExpensesData]);

  // Handle Form Input Changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Open Create Modal
  const openCreateModal = () => {
    setFormData({
      propertyId: properties[0]?.id || '',
      categoryName: ExpenseCategoryType.MAINTENANCE,
      title: '',
      amount: '',
      expenseDate: new Date().toISOString().split('T')[0],
      vendorName: '',
      notes: '',
      receiptUrl: '',
    });
    setReceiptFile(null);
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (expense: ExpenseRecordDto) => {
    setEditingExpense(expense);
    setFormData({
      propertyId: expense.propertyId,
      categoryName: expense.categoryName,
      title: expense.title,
      amount: String(expense.amount),
      expenseDate: expense.expenseDate.split('T')[0],
      vendorName: expense.vendorName || '',
      notes: expense.notes || '',
      receiptUrl: expense.receiptUrl || '',
    });
    setReceiptFile(null);
    setFormError(null);
    setIsEditModalOpen(true);
  };

  // Upload Receipt File
  const handleFileUpload = async (propertyId: string): Promise<string | null> => {
    if (!receiptFile) return formData.receiptUrl || null;

    const filePayload = new FormData();
    filePayload.append('file', receiptFile);
    filePayload.append('propertyId', propertyId);

    const uploadRes = await fetch('/api/v1/expenses/upload-receipt', {
      method: 'POST',
      credentials: 'include',
      body: filePayload,
    });

    if (!uploadRes.ok) {
      const errJson = await uploadRes.json();
      throw new Error(errJson.error?.message || 'Failed to upload receipt document');
    }

    const uploadJson = await uploadRes.json();
    return uploadJson.data?.fileUrl || null;
  };

  // Submit Create Expense
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const numAmount = parseFloat(formData.amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        throw new Error('Please enter a valid positive amount');
      }

      if (!formData.title.trim()) {
        throw new Error('Please enter a descriptive title for this expense');
      }

      let uploadedUrl = formData.receiptUrl;
      if (receiptFile) {
        uploadedUrl = (await handleFileUpload(formData.propertyId)) || '';
      }

      const payload = {
        propertyId: formData.propertyId,
        categoryName: formData.categoryName,
        title: formData.title.trim(),
        amount: numAmount,
        expenseDate: new Date(formData.expenseDate).toISOString(),
        vendorName: formData.vendorName.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        receiptUrl: uploadedUrl || undefined,
      };

      const res = await fetch('/api/v1/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || 'Failed to create expense record');
      }

      setIsCreateModalOpen(false);
      fetchExpensesData();
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while saving expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit Expense
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    setFormError(null);
    setIsSubmitting(true);

    try {
      const numAmount = parseFloat(formData.amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        throw new Error('Please enter a valid positive amount');
      }

      let uploadedUrl = formData.receiptUrl;
      if (receiptFile) {
        uploadedUrl = (await handleFileUpload(formData.propertyId)) || '';
      }

      const payload = {
        propertyId: formData.propertyId,
        categoryName: formData.categoryName,
        title: formData.title.trim(),
        amount: numAmount,
        expenseDate: new Date(formData.expenseDate).toISOString(),
        vendorName: formData.vendorName.trim() || null,
        notes: formData.notes.trim() || null,
        receiptUrl: uploadedUrl || null,
      };

      const res = await fetch(`/api/v1/expenses/${editingExpense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || 'Failed to update expense record');
      }

      setIsEditModalOpen(false);
      setEditingExpense(null);
      fetchExpensesData();
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while updating expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Expense
  const handleDeleteConfirm = async () => {
    if (!deletingExpenseId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/expenses/${deletingExpenseId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || 'Failed to delete expense record');
      }

      setDeletingExpenseId(null);
      fetchExpensesData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete expense record');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format currency in Indian Rupees
  const formatCurrency = (val: number | string | undefined | null) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <AppShell activePath="/expenses">
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-teal/10 text-brand-teal flex items-center justify-center font-bold">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-brand-navy">
                  Operational Expense Management
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Track property overheads, utility bills, maintenance outlays, and staff payroll in Indian Rupees (₹).
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchExpensesData()}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
              title="Refresh ledger"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-teal hover:bg-brand-teal/90 text-white font-medium text-sm shadow-sm transition-all transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Log New Expense</span>
            </button>
          </div>
        </div>

        {/* 4 StatCard KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-brand-teal flex items-center justify-center shrink-0">
              <CircleDollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Portfolio Outlays</p>
              <h3 className="text-2xl font-bold text-brand-navy mt-0.5">
                {formatCurrency(summary?.totalExpenseAmount)}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Cumulative operational overhead</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">This Month's Spending</p>
              <h3 className="text-2xl font-bold text-brand-navy mt-0.5">
                {formatCurrency(summary?.currentMonthExpenseAmount)}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Current calendar month overhead</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <PieChart className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Top Cost Category</p>
              <h3 className="text-lg font-bold text-brand-navy mt-0.5 truncate max-w-[150px]">
                {summary?.categoryBreakdown[0]
                  ? summary.categoryBreakdown[0].category.replace('_', ' ')
                  : 'N/A'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {summary?.categoryBreakdown[0]
                  ? formatCurrency(summary.categoryBreakdown[0].totalAmount)
                  : 'No expenses logged'}
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Expense Records</p>
              <h3 className="text-2xl font-bold text-brand-navy mt-0.5">
                {summary?.totalExpenseCount || 0}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Audited ledger entries</p>
            </div>
          </div>
        </div>

        {/* Category Spending Breakdown Overview */}
        {summary?.categoryBreakdown && summary.categoryBreakdown.length > 0 && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-teal" />
                Category Distribution
              </h4>
              <span className="text-xs text-slate-400">Real-Time Aggregates</span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {summary.categoryBreakdown.map((item) => {
                const style = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.OTHER;
                return (
                  <button
                    key={item.category}
                    onClick={() =>
                      setSelectedCategory(selectedCategory === item.category ? '' : item.category)
                    }
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                      selectedCategory === item.category
                        ? 'ring-2 ring-brand-teal ring-offset-1 ' + style.bg + ' ' + style.border + ' ' + style.text
                        : style.bg + ' ' + style.border + ' ' + style.text + ' hover:opacity-90'
                    }`}
                  >
                    <span>{item.category.replace('_', ' ')}</span>
                    <span className="font-bold opacity-90">{formatCurrency(item.totalAmount)}</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-white/60 rounded-full">{item.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Filter and Control Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 overflow-x-auto">
            <button
              onClick={() => {
                setActiveTab('ALL');
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'ALL'
                  ? 'bg-brand-navy text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All Outlays
            </button>
            <button
              onClick={() => {
                setActiveTab('THIS_MONTH');
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'THIS_MONTH'
                  ? 'bg-brand-navy text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => {
                setActiveTab('HIGH_VALUE');
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'HIGH_VALUE'
                  ? 'bg-brand-navy text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              High Value (&ge; ₹10,000)
            </button>
          </div>

          {/* Search and Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search title, vendor, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
              />
            </div>

            {/* Property Selector */}
            <div>
              <select
                value={selectedPropertyId}
                onChange={(e) => {
                  setSelectedPropertyId(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
              >
                <option value="">All Properties ({properties.length})</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.propertyType})
                  </option>
                ))}
              </select>
            </div>

            {/* Category Selector */}
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
              >
                <option value="">All Categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Filters */}
            {(selectedPropertyId || selectedCategory || searchQuery || activeTab !== 'ALL') && (
              <div className="flex items-center">
                <button
                  onClick={() => {
                    setSelectedPropertyId('');
                    setSelectedCategory('');
                    setSearchQuery('');
                    setActiveTab('ALL');
                    setPage(1);
                  }}
                  className="text-xs text-brand-teal hover:underline font-medium inline-flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  Reset Filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Expense Ledger Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-brand-teal mb-3" />
              <p className="text-sm font-medium">Loading audited expense ledger...</p>
            </div>
          ) : error ? (
            <div className="p-12 flex flex-col items-center justify-center text-red-500">
              <AlertCircle className="w-8 h-8 mb-3" />
              <p className="text-sm font-medium">{error}</p>
              <button
                onClick={() => fetchExpensesData()}
                className="mt-3 px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
              >
                Retry
              </button>
            </div>
          ) : expenses.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
                <Receipt className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-brand-navy">No Expense Records Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1 mb-5">
                {searchQuery || selectedPropertyId || selectedCategory
                  ? 'No operational expenses match your current filters. Try resetting the filter parameters.'
                  : 'Start recording operational outlays such as electricity bills, maintenance repairs, and staff payroll.'}
              </p>
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-teal text-white text-xs font-semibold shadow-sm hover:bg-brand-teal/90 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Record First Expense</span>
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Expense Title</th>
                      <th className="py-3 px-4">Property</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Vendor / Payee</th>
                      <th className="py-3 px-4">Receipt</th>
                      <th className="py-3 px-4 text-right">Amount (₹)</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expenses.map((record) => {
                      const catStyle = CATEGORY_COLORS[record.categoryName] || CATEGORY_COLORS.OTHER;
                      const formattedDate = new Date(record.expenseDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      });

                      return (
                        <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Date */}
                          <td className="py-3.5 px-4 font-medium text-slate-600 whitespace-nowrap">
                            {formattedDate}
                          </td>

                          {/* Title & Notes */}
                          <td className="py-3.5 px-4">
                            <p className="font-semibold text-brand-navy">{record.title}</p>
                            {record.notes && (
                              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                                {record.notes}
                              </p>
                            )}
                          </td>

                          {/* Property */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-medium text-slate-700">{record.propertyName}</span>
                            {record.propertyType && (
                              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium">
                                {record.propertyType}
                              </span>
                            )}
                          </td>

                          {/* Category */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                            >
                              {record.categoryName.replace('_', ' ')}
                            </span>
                          </td>

                          {/* Vendor */}
                          <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                            {record.vendorName || <span className="text-slate-300 italic">—</span>}
                          </td>

                          {/* Receipt */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {record.receiptUrl ? (
                              <button
                                onClick={() => setReceiptPreviewUrl(record.receiptUrl || null)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-teal-50 text-brand-teal hover:bg-teal-100 font-medium text-[11px] transition-colors"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Receipt</span>
                              </button>
                            ) : (
                              <span className="text-slate-300 italic text-[11px]">No file</span>
                            )}
                          </td>

                          {/* Amount */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap font-bold text-brand-navy text-sm">
                            {formatCurrency(record.amount)}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => openEditModal(record)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-brand-navy hover:bg-slate-100 transition-colors"
                                title="Edit Expense"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingExpenseId(record.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Delete Expense"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Bar */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50/50 border-t border-slate-200 text-xs text-slate-500">
                <span>
                  Showing {expenses.length} of {totalCount} total entries
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                  >
                    Previous
                  </button>
                  <span className="font-semibold text-slate-700">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ----------------- CREATE EXPENSE MODAL ----------------- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-teal/10 text-brand-teal flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-brand-navy">Record Operational Expense</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Property & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Property <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="propertyId"
                    value={formData.propertyId}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="categoryName"
                    value={formData.categoryName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Expense Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  placeholder="e.g. BESCOM Monthly Commercial Grid Bill"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                />
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="amount"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expense Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="expenseDate"
                    value={formData.expenseDate}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                  />
                </div>
              </div>

              {/* Vendor */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Vendor / Payee Name (Optional)
                </label>
                <input
                  type="text"
                  name="vendorName"
                  placeholder="e.g. BESCOM, Urban Company, Metro Cash & Carry"
                  value={formData.vendorName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                />
              </div>

              {/* Receipt File Upload */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Receipt Document / Invoice (PDF / PNG / JPEG, max 10MB)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,application/pdf"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-teal/10 file:text-brand-teal hover:file:bg-brand-teal/20 cursor-pointer"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Additional Notes (Optional)
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Payment transaction reference, cheque number, or maintenance breakdown details..."
                  value={formData.notes}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-brand-teal hover:bg-brand-teal/90 rounded-xl shadow-sm disabled:opacity-50 transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <span>Save Expense</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- EDIT EXPENSE MODAL ----------------- */}
      {isEditModalOpen && editingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-brand-navy">Edit Expense Record</h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Property & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Property</label>
                  <select
                    name="propertyId"
                    value={formData.propertyId}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    name="categoryName"
                    value={formData.categoryName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Title</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                />
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Date</label>
                  <input
                    type="date"
                    name="expenseDate"
                    value={formData.expenseDate}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                  />
                </div>
              </div>

              {/* Vendor */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor / Payee</label>
                <input
                  type="text"
                  name="vendorName"
                  value={formData.vendorName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                />
              </div>

              {/* Replace Receipt */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Replace Receipt Document (Optional)
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,application/pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-teal/10 file:text-brand-teal hover:file:bg-brand-teal/20 cursor-pointer"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  name="notes"
                  rows={2}
                  value={formData.notes}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-brand-navy hover:bg-brand-navy/90 rounded-xl shadow-sm disabled:opacity-50 transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- RECEIPT PREVIEW MODAL ----------------- */}
      {receiptPreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-brand-teal" />
                <h3 className="text-sm font-bold text-brand-navy">Receipt Document Preview</h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={receiptPreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-brand-teal font-medium hover:underline mr-2"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in New Tab</span>
                </a>
                <button
                  onClick={() => setReceiptPreviewUrl(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 flex items-center justify-center bg-slate-50">
              {receiptPreviewUrl.endsWith('.pdf') ? (
                <iframe
                  src={receiptPreviewUrl}
                  className="w-full h-[450px] rounded-xl border border-slate-200"
                  title="Receipt PDF"
                />
              ) : (
                <img
                  src={receiptPreviewUrl}
                  alt="Receipt Preview"
                  className="max-h-[450px] w-auto object-contain rounded-xl shadow-sm border border-slate-200"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ----------------- DELETE CONFIRMATION MODAL ----------------- */}
      {deletingExpenseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-brand-navy">Delete Expense Record?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete this operational outlay? An immutable audit snapshot will be saved to the database.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingExpenseId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
