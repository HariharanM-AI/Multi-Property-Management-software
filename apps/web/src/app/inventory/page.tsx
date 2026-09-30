'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageTransition } from '@/components/ui/MotionWrapper';
import {
  Package,
  Plus,
  Search,
  Building2,
  BedDouble,
  Home,
  Wrench,
  Trash2,
  Edit2,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  IndianRupee,
  Layers,
  XCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  InventoryItemDto,
  InventorySummaryDto,
  InventoryCategory,
  InventoryCondition,
  InventoryStatus,
} from '@propertyos/types';

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItemDto[]>([]);
  const [summary, setSummary] = useState<InventorySummaryDto>({
    totalItems: 0,
    assignedItems: 0,
    availableItems: 0,
    underRepairItems: 0,
    damagedItems: 0,
    totalAssetValue: '0.00',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<'all' | 'assigned' | 'available' | 'under_repair' | 'damaged'>('all');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [activeItem, setActiveItem] = useState<InventoryItemDto | null>(null);

  const [properties, setProperties] = useState<any[]>([]);
  const [propertyRooms, setPropertyRooms] = useState<any[]>([]);
  const [propertyUnits, setPropertyUnits] = useState<any[]>([]);

  // Add Item form
  const [addForm, setAddForm] = useState({
    propertyId: '',
    roomId: '',
    rentalUnitId: '',
    itemName: '',
    category: 'APPLIANCE' as InventoryCategory,
    serialNumber: '',
    condition: 'NEW' as InventoryCondition,
    status: 'AVAILABLE' as InventoryStatus,
    purchaseDate: '',
    purchasePrice: '',
  });

  // Edit Item form
  const [editForm, setEditForm] = useState({
    itemName: '',
    category: 'APPLIANCE' as InventoryCategory,
    serialNumber: '',
    condition: 'GOOD' as InventoryCondition,
    status: 'AVAILABLE' as InventoryStatus,
    purchasePrice: '',
  });

  // Assign form
  const [assignForm, setAssignForm] = useState({
    roomId: '',
    rentalUnitId: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      let url = '/api/v1/inventory/summary';
      if (selectedPropertyId) {
        url += `?propertyId=${selectedPropertyId}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.data) {
          setSummary(data.data);
        }
      }
    } catch (e) {
      console.error('Failed to fetch inventory summary', e);
    }
  }, [selectedPropertyId]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = '/api/v1/inventory?limit=100';
      if (selectedPropertyId) {
        url += `&propertyId=${selectedPropertyId}`;
      }
      if (selectedCategory) {
        url += `&category=${selectedCategory}`;
      }
      if (activeTab === 'assigned') {
        url += '&status=ASSIGNED';
      } else if (activeTab === 'available') {
        url += '&status=AVAILABLE';
      } else if (activeTab === 'under_repair') {
        url += '&status=UNDER_REPAIR';
      } else if (activeTab === 'damaged') {
        url += '&condition=DAMAGED';
      }
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load inventory items (${res.status})`);
      }
      const data = await res.json();
      setItems(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load inventory items');
    } finally {
      setLoading(false);
    }
  }, [selectedPropertyId, selectedCategory, activeTab, searchQuery]);

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/v1/properties');
      if (res.ok) {
        const data = await res.json();
        setProperties(data.data || []);
        if (data.data?.length > 0 && !addForm.propertyId) {
          setAddForm((prev) => ({ ...prev, propertyId: data.data[0].id }));
          fetchPropertyLocations(data.data[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load properties', e);
    }
  };

  const fetchPropertyLocations = async (propId: string) => {
    setPropertyRooms([]);
    setPropertyUnits([]);
    const targetProp = properties.find((p) => p.id === propId);
    if (!targetProp) return;

    if (targetProp.propertyType === 'PG') {
      try {
        const res = await fetch(`/api/v1/properties/${propId}/rooms`);
        if (res.ok) {
          const data = await res.json();
          setPropertyRooms(data.data || []);
        }
      } catch (e) {
        console.error('Failed to load rooms for PG', e);
      }
    } else if (targetProp.propertyType === 'RENTAL_HOUSE') {
      try {
        const res = await fetch(`/api/v1/properties/${propId}/units`);
        if (res.ok) {
          const data = await res.json();
          setPropertyUnits(data.data || []);
        }
      } catch (e) {
        console.error('Failed to load units for Rental property', e);
      }
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    fetchSummary();
    fetchItems();
  }, [fetchSummary, fetchItems]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: any = {
        propertyId: addForm.propertyId,
        itemName: addForm.itemName,
        category: addForm.category,
        condition: addForm.condition,
      };

      if (addForm.serialNumber.trim()) {
        payload.serialNumber = addForm.serialNumber.trim();
      }
      if (addForm.purchaseDate) {
        payload.purchaseDate = new Date(addForm.purchaseDate).toISOString();
      }
      if (addForm.purchasePrice) {
        payload.purchasePrice = Number(addForm.purchasePrice);
      }

      const currentProp = properties.find((p) => p.id === addForm.propertyId);
      if (currentProp?.propertyType === 'PG' && addForm.roomId) {
        payload.roomId = addForm.roomId;
      } else if (currentProp?.propertyType === 'RENTAL_HOUSE' && addForm.rentalUnitId) {
        payload.rentalUnitId = addForm.rentalUnitId;
      }

      const res = await fetch('/api/v1/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowAddModal(false);
        setAddForm({
          propertyId: properties[0]?.id || '',
          roomId: '',
          rentalUnitId: '',
          itemName: '',
          category: 'APPLIANCE',
          serialNumber: '',
          condition: 'NEW',
          status: 'AVAILABLE',
          purchaseDate: '',
          purchasePrice: '',
        });
        await Promise.all([fetchSummary(), fetchItems()]);
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to create inventory item');
      }
    } catch (e) {
      alert('Error creating inventory item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    setSubmitting(true);
    try {
      const payload: any = {
        itemName: editForm.itemName,
        category: editForm.category,
        condition: editForm.condition,
        status: editForm.status,
      };
      if (editForm.serialNumber !== undefined) {
        payload.serialNumber = editForm.serialNumber.trim() || null;
      }
      if (editForm.purchasePrice) {
        payload.purchasePrice = Number(editForm.purchasePrice);
      }

      const res = await fetch(`/api/v1/inventory/${activeItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowEditModal(false);
        setActiveItem(null);
        await Promise.all([fetchSummary(), fetchItems()]);
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to update item');
      }
    } catch (e) {
      alert('Error updating inventory item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    setSubmitting(true);
    try {
      const payload: any = {};
      if (activeItem.propertyType === 'PG') {
        payload.roomId = assignForm.roomId || null;
      } else {
        payload.rentalUnitId = assignForm.rentalUnitId || null;
      }

      const res = await fetch(`/api/v1/inventory/${activeItem.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowAssignModal(false);
        setActiveItem(null);
        await Promise.all([fetchSummary(), fetchItems()]);
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to assign item');
      }
    } catch (e) {
      alert('Error assigning item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassign = async (id: string) => {
    if (!confirm('Unassign this item back to common property stock?')) return;
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/v1/inventory/${id}/unassign`, {
        method: 'POST',
      });
      if (res.ok) {
        await Promise.all([fetchSummary(), fetchItems()]);
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to unassign item');
      }
    } catch (e) {
      alert('Error unassigning item');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}" from inventory? This action is permanent.`)) return;
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/v1/inventory/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await Promise.all([fetchSummary(), fetchItems()]);
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to delete item');
      }
    } catch (e) {
      alert('Error deleting item');
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ASSIGNED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            Assigned
          </span>
        );
      case 'AVAILABLE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400 border border-teal-200 dark:border-teal-800">
            <Sparkles className="w-3 h-3" />
            In Stock
          </span>
        );
      case 'UNDER_REPAIR':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Wrench className="w-3 h-3" />
            Under Repair
          </span>
        );
      case 'DISPOSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            <XCircle className="w-3 h-3" />
            Disposed
          </span>
        );
      default:
        return null;
    }
  };

  const getConditionBadge = (condition: string) => {
    switch (condition) {
      case 'NEW':
        return (
          <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-xs">
            <Sparkles className="w-3 h-3 text-emerald-500" />
            <span>Brand New</span>
          </span>
        );
      case 'GOOD':
        return <span className="text-teal-600 font-semibold text-xs">Good</span>;
      case 'FAIR':
        return <span className="text-amber-600 font-semibold text-xs">Fair</span>;
      case 'POOR':
        return <span className="text-orange-600 font-semibold text-xs">Poor</span>;
      case 'DAMAGED':
        return <span className="text-rose-600 font-semibold text-xs">Damaged</span>;
      default:
        return <span>{condition}</span>;
    }
  };

  return (
    <AppShell>
      <PageTransition className="space-y-6 w-full pb-12">
        <PageHeader
          title="Property & Room Inventory"
          subtitle="Operational asset ledger, appliance serial tracking, room & unit assignments, and condition grading"
          icon={Package}
          showBack={true}
          backHref="/"
          backLabel="Back to Dashboard"
          actions={
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                fetchProperties();
                setShowAddModal(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1.5 inline" />
              Add Inventory Asset
            </Button>
          }
        />

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Assets"
            value={summary.totalItems}
            subtext="Tracked across properties"
            icon={Package}
            variant="teal"
          />
          <StatCard
            label="Assigned to Rooms/Units"
            value={summary.assignedItems}
            subtext="In active resident rooms"
            icon={BedDouble}
            variant="emerald"
          />
          <StatCard
            label="In Stock / Available"
            value={summary.availableItems}
            subtext="Property common stock"
            icon={Layers}
            variant="blue"
          />
          <StatCard
            label="Portfolio Asset Value"
            value={`₹${summary.totalAssetValue}`}
            subtext="Valuation (non-disposed)"
            icon={IndianRupee}
            variant="amber"
          />
        </div>

        {/* Roster & Table Section */}
        <div className="bg-brand-white dark:bg-surface-dark border border-surface-border rounded-xl shadow-xs overflow-hidden">
          {/* Header with Filters and Search */}
          <div className="p-4 border-b border-surface-border flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex flex-wrap gap-1 p-1 bg-surface-background dark:bg-zinc-800 rounded-lg">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'all'
                    ? 'bg-brand-white dark:bg-zinc-700 text-brand-navy dark:text-zinc-100 shadow-xs'
                    : 'text-surface-textSecondary hover:text-brand-navy'
                }`}
              >
                All Assets ({summary.totalItems})
              </button>
              <button
                onClick={() => setActiveTab('assigned')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'assigned'
                    ? 'bg-brand-white dark:bg-zinc-700 text-brand-navy dark:text-zinc-100 shadow-xs'
                    : 'text-surface-textSecondary hover:text-brand-navy'
                }`}
              >
                Assigned ({summary.assignedItems})
              </button>
              <button
                onClick={() => setActiveTab('available')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'available'
                    ? 'bg-brand-white dark:bg-zinc-700 text-brand-navy dark:text-zinc-100 shadow-xs'
                    : 'text-surface-textSecondary hover:text-brand-navy'
                }`}
              >
                In Stock ({summary.availableItems})
              </button>
              <button
                onClick={() => setActiveTab('under_repair')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'under_repair'
                    ? 'bg-brand-white dark:bg-zinc-700 text-brand-navy dark:text-zinc-100 shadow-xs'
                    : 'text-surface-textSecondary hover:text-brand-navy'
                }`}
              >
                Under Repair ({summary.underRepairItems})
              </button>
              <button
                onClick={() => setActiveTab('damaged')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'damaged'
                    ? 'bg-brand-white dark:bg-zinc-700 text-brand-navy dark:text-zinc-100 shadow-xs'
                    : 'text-surface-textSecondary hover:text-brand-navy'
                }`}
              >
                Damaged ({summary.damagedItems})
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 w-full lg:w-auto">
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border border-surface-border bg-surface-background dark:bg-zinc-800 text-brand-navy dark:text-zinc-100 focus:ring-2 focus:ring-brand-teal"
              >
                <option value="">All Properties</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border border-surface-border bg-surface-background dark:bg-zinc-800 text-brand-navy dark:text-zinc-100 focus:ring-2 focus:ring-brand-teal"
              >
                <option value="">All Categories</option>
                <option value="APPLIANCE">Appliances</option>
                <option value="FURNITURE">Furniture</option>
                <option value="ELECTRONIC">Electronics</option>
                <option value="LINEN">Linen</option>
                <option value="OTHER">Other</option>
              </select>

              <div className="relative w-full sm:w-56">
                <Search className="w-4 h-4 absolute left-3 top-2 text-surface-textSecondary" />
                <input
                  type="text"
                  placeholder="Search item or serial..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-surface-border bg-surface-background dark:bg-zinc-800 text-brand-navy dark:text-zinc-100 focus:ring-2 focus:ring-brand-teal"
                />
              </div>
            </div>
          </div>

          {/* Asset List Table */}
          {loading ? (
            <div className="p-12 text-center text-xs text-surface-textSecondary">
              Loading inventory records...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-xs text-rose-600">{error}</div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No inventory assets found"
              description="No assets recorded matching your current filter criteria."
              actionLabel="Add New Asset"
              onAction={() => {
                fetchProperties();
                setShowAddModal(true);
              }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-background/50 dark:bg-zinc-800/50 border-b border-surface-border text-surface-textSecondary font-semibold">
                    <th className="py-3 px-4">Asset Details</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Property & Placement</th>
                    <th className="py-3 px-4">Serial / Tag</th>
                    <th className="py-3 px-4">Condition</th>
                    <th className="py-3 px-4">Purchase Valuation</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-background/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-brand-navy dark:text-zinc-100">{item.itemName}</div>
                        <div className="text-surface-textSecondary text-[11px]">
                          Added {new Date(item.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-brand-navy dark:text-zinc-300">
                        {item.category}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-brand-navy dark:text-zinc-100">{item.propertyName || 'Property'}</div>
                        <div className="text-surface-textSecondary text-[11px] flex items-center gap-1">
                          {item.roomNumber ? (
                            <>
                              <BedDouble className="w-3 h-3 text-brand-teal" />
                              <span>Room {item.roomNumber}</span>
                            </>
                          ) : item.unitNumber ? (
                            <>
                              <Home className="w-3 h-3 text-brand-teal" />
                              <span>Unit {item.unitNumber}</span>
                            </>
                          ) : (
                            <span>Common Stock</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-surface-textSecondary">
                        {item.serialNumber ? item.serialNumber : '—'}
                      </td>
                      <td className="py-3 px-4">{getConditionBadge(item.condition)}</td>
                      <td className="py-3 px-4 font-mono text-brand-navy dark:text-zinc-100">
                        {item.purchasePrice !== null && item.purchasePrice !== undefined ? (
                          `₹${Number(item.purchasePrice).toLocaleString('en-IN')}`
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(item.status)}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex gap-1.5 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            title="Assign / Reassign"
                            disabled={item.status === 'DISPOSED' || item.status === 'UNDER_REPAIR'}
                            onClick={() => {
                              setActiveItem(item);
                              fetchPropertyLocations(item.propertyId);
                              setAssignForm({
                                roomId: item.roomId || '',
                                rentalUnitId: item.rentalUnitId || '',
                              });
                              setShowAssignModal(true);
                            }}
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </Button>
                          {item.status === 'ASSIGNED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              title="Unassign to Stock"
                              isLoading={actionLoadingId === item.id}
                              onClick={() => handleUnassign(item.id)}
                            >
                              <Layers className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            title="Edit Asset"
                            onClick={() => {
                              setActiveItem(item);
                              setEditForm({
                                itemName: item.itemName,
                                category: item.category as InventoryCategory,
                                serialNumber: item.serialNumber || '',
                                condition: item.condition as InventoryCondition,
                                status: item.status as InventoryStatus,
                                purchasePrice: item.purchasePrice ? String(item.purchasePrice) : '',
                              });
                              setShowEditModal(true);
                            }}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            title="Delete Asset"
                            isLoading={actionLoadingId === item.id}
                            onClick={() => handleDelete(item.id, item.itemName)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Add Inventory Asset */}
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add New Inventory Asset"
        >
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-brand-navy dark:text-zinc-300 mb-1">
                Select Property *
              </label>
              <select
                required
                value={addForm.propertyId}
                onChange={(e) => {
                  setAddForm({ ...addForm, propertyId: e.target.value, roomId: '', rentalUnitId: '' });
                  fetchPropertyLocations(e.target.value);
                }}
                className="w-full text-xs px-3 py-2 rounded-lg border border-surface-border bg-surface-background dark:bg-zinc-800 text-brand-navy dark:text-zinc-100 focus:ring-2 focus:ring-brand-teal"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.propertyType})
                  </option>
                ))}
              </select>
            </div>

            {/* Room or Unit Assignment depending on property type */}
            {properties.find((p) => p.id === addForm.propertyId)?.propertyType === 'PG' && (
              <div>
                <label className="block text-xs font-semibold text-brand-navy dark:text-zinc-300 mb-1">
                  Assign to Room (Optional — Leave blank for common property stock)
                </label>
                <select
                  value={addForm.roomId}
                  onChange={(e) => setAddForm({ ...addForm, roomId: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-surface-border bg-surface-background dark:bg-zinc-800 text-brand-navy dark:text-zinc-100 focus:ring-2 focus:ring-brand-teal"
                >
                  <option value="">Common Stock (Unassigned)</option>
                  {propertyRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Room {r.roomNumber} ({r.sharingType})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {properties.find((p) => p.id === addForm.propertyId)?.propertyType === 'RENTAL_HOUSE' && (
              <div>
                <label className="block text-xs font-semibold text-brand-navy dark:text-zinc-300 mb-1">
                  Assign to Rental Unit (Optional — Leave blank for common property stock)
                </label>
                <select
                  value={addForm.rentalUnitId}
                  onChange={(e) => setAddForm({ ...addForm, rentalUnitId: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-surface-border bg-surface-background dark:bg-zinc-800 text-brand-navy dark:text-zinc-100 focus:ring-2 focus:ring-brand-teal"
                >
                  <option value="">Common Stock (Unassigned)</option>
                  {propertyUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      Unit {u.unitNumber} ({u.unitType})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-brand-navy dark:text-zinc-300 mb-1">
                Asset / Item Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Voltas 1.5T Split AC, Godrej Wardrobe, Samsung Refrigerator"
                value={addForm.itemName}
                onChange={(e) => setAddForm({ ...addForm, itemName: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-surface-border bg-surface-background dark:bg-zinc-800 text-brand-navy dark:text-zinc-100 focus:ring-2 focus:ring-brand-teal"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-brand-navy dark:text-zinc-300 mb-1">
                  Category *
                </label>
                <select
                  required
                  value={addForm.category}
                  onChange={(e) => setAddForm({ ...addForm, category: e.target.value as InventoryCategory })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-surface-border bg-surface-background dark:bg-zinc-800 text-brand-navy dark:text-zinc-100 focus:ring-2 focus:ring-brand-teal"
                >
                  <option value="APPLIANCE">Appliance</option>
                  <option value="FURNITURE">Furniture</option>
                  <option value="ELECTRONIC">Electronic</option>
                  <option value="LINEN">Linen</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-brand-navy dark:text-zinc-300 mb-1">
                  Initial Condition *
                </label>
                <select
                  required
                  value={addForm.condition}
                  onChange={(e) => setAddForm({ ...addForm, condition: e.target.value as InventoryCondition })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-surface-border bg-surface-background dark:bg-zinc-800 text-brand-navy dark:text-zinc-100 focus:ring-2 focus:ring-brand-teal"
                >
                  <option value="NEW">Brand New</option>
                  <option value="GOOD">Good</option>
                  <option value="FAIR">Fair</option>
                  <option value="POOR">Poor</option>
                  <option value="DAMAGED">Damaged</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-brand-navy dark:text-zinc-300 mb-1">
                  Serial Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. SN-AC-20260824"
                  value={addForm.serialNumber}
                  onChange={(e) => setAddForm({ ...addForm, serialNumber: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-surface-border bg-surface-background dark:bg-zinc-800 text-brand-navy dark:text-zinc-100 focus:ring-2 focus:ring-brand-teal font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-brand-navy dark:text-zinc-300 mb-1">
                  Purchase Price (₹, Optional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 28500.00"
                  value={addForm.purchasePrice}
                  onChange={(e) => setAddForm({ ...addForm, purchasePrice: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-surface-border bg-surface-background dark:bg-zinc-800 text-brand-navy dark:text-zinc-100 focus:ring-2 focus:ring-brand-teal font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-surface-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={submitting}>
                Save Asset
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Edit Asset */}
        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title="Edit Inventory Asset"
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-brand-navy dark:text-zinc-300 mb-1">
                Asset / Item Name *
              </label>
              <input
                type="text"
                required
                value={editForm.itemName}
                onChange={(e) => setEditForm({ ...editForm, itemName: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-surface-border bg-surface-background dark:bg-zinc-800 text-brand-navy dark:text-zinc-100 focus:ring-2 focus:ring-brand-teal"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-brand-navy dark:text-zinc-300 mb-1">
                  Category *
                </label>
                <select
                  required
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value as InventoryCategory })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-surface-border bg-surface-background dark:bg-zinc-800 text-brand-navy dark:text-zinc-100 focus:ring-2 focus:ring-brand-teal"
                >
                  <option value="APPLIANCE">Appliance</option>
                  <option value="FURNITURE">Furniture</option>
                  <option value="ELECTRONIC">Electronic</option>
                  <option value="LINEN">Linen</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-brand-navy dark:text-zinc-300 mb-1">
                  Condition *
                </label>
                <select
                  required
                  value={editForm.condition}
                  onChange={(e) => setEditForm({ ...editForm, condition: e.target.value as InventoryCondition })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-surface-border bg-surface-background dark:bg-zinc-800 text-brand-navy dark:text-zinc-100 focus:ring-2 focus:ring-brand-teal"
                >
                  <option value="NEW">Brand New</option>
                  <option value="GOOD">Good</option>
                  <option value="FAIR">Fair</option>
                  <option value="POOR">Poor</option>
                  <option value="DAMAGED">Damaged</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-brand-navy dark:text-zinc-300 mb-1">
                  Status *
                </label>
                <select
                  required
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as InventoryStatus })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-surface-border bg-surface-background dark:bg-zinc-800 text-brand-navy dark:text-zinc-100 focus:ring-2 focus:ring-brand-teal"
                >
                  <option value="AVAILABLE">Available / In Stock</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="UNDER_REPAIR">Under Repair</option>
                  <option value="DISPOSED">Disposed / Scrapped</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-brand-navy dark:text-zinc-300 mb-1">
                  Purchase Price (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.purchasePrice}
                  onChange={(e) => setEditForm({ ...editForm, purchasePrice: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-surface-border bg-surface-background dark:bg-zinc-800 text-brand-navy dark:text-zinc-100 focus:ring-2 focus:ring-brand-teal font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-navy dark:text-zinc-300 mb-1">
                Serial Number
              </label>
              <input
                type="text"
                value={editForm.serialNumber}
                onChange={(e) => setEditForm({ ...editForm, serialNumber: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-surface-border bg-surface-background dark:bg-zinc-800 text-brand-navy dark:text-zinc-100 focus:ring-2 focus:ring-brand-teal font-mono"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-surface-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={submitting}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Assign / Reassign Asset */}
        <Modal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          title={`Assign / Transfer "${activeItem?.itemName || 'Asset'}"`}
        >
          <form onSubmit={handleAssignSubmit} className="space-y-4">
            <div className="p-3 bg-surface-background dark:bg-zinc-800 rounded-lg text-xs space-y-1">
              <div>
                Property: <span className="font-semibold">{activeItem?.propertyName}</span> ({activeItem?.propertyType})
              </div>
              <div>
                Current Placement: <span className="font-semibold">{activeItem?.locationDisplay}</span>
              </div>
            </div>

            {activeItem?.propertyType === 'PG' && (
              <div>
                <label className="block text-xs font-semibold text-brand-navy dark:text-zinc-300 mb-1">
                  Select Room Target *
                </label>
                <select
                  value={assignForm.roomId}
                  onChange={(e) => setAssignForm({ ...assignForm, roomId: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-surface-border bg-surface-background dark:bg-zinc-800 text-brand-navy dark:text-zinc-100 focus:ring-2 focus:ring-brand-teal"
                >
                  <option value="">Unassigned (Return to Stock)</option>
                  {propertyRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Room {r.roomNumber} ({r.sharingType})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {activeItem?.propertyType === 'RENTAL_HOUSE' && (
              <div>
                <label className="block text-xs font-semibold text-brand-navy dark:text-zinc-300 mb-1">
                  Select Rental Unit Target *
                </label>
                <select
                  value={assignForm.rentalUnitId}
                  onChange={(e) => setAssignForm({ ...assignForm, rentalUnitId: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-surface-border bg-surface-background dark:bg-zinc-800 text-brand-navy dark:text-zinc-100 focus:ring-2 focus:ring-brand-teal"
                >
                  <option value="">Unassigned (Return to Stock)</option>
                  {propertyUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      Unit {u.unitNumber} ({u.unitType})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-3 border-t border-surface-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAssignModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={submitting}>
                Save Assignment
              </Button>
            </div>
          </form>
        </Modal>
      </PageTransition>
    </AppShell>
  );
}
