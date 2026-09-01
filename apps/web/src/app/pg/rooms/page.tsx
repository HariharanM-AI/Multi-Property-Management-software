'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/lib/auth-context';
import {
  PropertyDto,
  FloorDto,
  RoomDto,
  BedDto,
  PropertyType,
  RoomSharingType,
  BedStatus,
} from '@propertyos/types';
import {
  BedDouble,
  Layers,
  Building,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Wrench,
  Users,
  ArrowRight,
  TrendingUp,
  Shield,
  Loader2,
  ChevronRight,
  DoorOpen,
  X,
  Sparkles,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export default function PgRoomsHubPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const [properties, setProperties] = useState<PropertyDto[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [selectedProperty, setSelectedProperty] = useState<PropertyDto | null>(null);

  const [floors, setFloors] = useState<FloorDto[]>([]);
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [beds, setBeds] = useState<BedDto[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sharingFilter, setSharingFilter] = useState<string>('ALL');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('ALL');

  const [loading, setLoading] = useState(true);

  // Selected Bed for Inspection / Status Management Drawer
  const [selectedBed, setSelectedBed] = useState<BedDto | null>(null);
  const [selectedBedRoom, setSelectedBedRoom] = useState<RoomDto | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // 1. Fetch all PG properties
  const fetchProperties = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/properties`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          const pgProps = json.data.filter((p: PropertyDto) => p.propertyType === PropertyType.PG);
          setProperties(pgProps);
          if (pgProps.length > 0) {
            setSelectedPropertyId((prev) => (prev ? prev : pgProps[0].id));
          }
        }
      }
    } catch {}
  }, []);

  // 2. Fetch floors, rooms, and beds for the selected PG property
  const fetchInventory = useCallback(async (propertyId: string) => {
    if (!propertyId) return;
    setLoading(true);
    try {
      // Fetch property details
      const propRes = await fetch(`${API_BASE}/properties/${propertyId}`, { credentials: 'include' });
      if (propRes.ok) {
        const pJson = await propRes.json();
        if (pJson.data) setSelectedProperty(pJson.data);
      }

      // Fetch floors
      const floorsRes = await fetch(`${API_BASE}/properties/${propertyId}/floors`, { credentials: 'include' });
      if (floorsRes.ok) {
        const fJson = await floorsRes.json();
        setFloors(fJson.data || []);
      }

      // Fetch rooms
      const roomsRes = await fetch(`${API_BASE}/properties/${propertyId}/rooms`, { credentials: 'include' });
      if (roomsRes.ok) {
        const rJson = await roomsRes.json();
        setRooms(rJson.data || []);
      }

      // Fetch beds
      const bedsRes = await fetch(`${API_BASE}/properties/${propertyId}/beds`, { credentials: 'include' });
      if (bedsRes.ok) {
        const bJson = await bedsRes.json();
        setBeds(bJson.data || []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  useEffect(() => {
    if (selectedPropertyId) {
      fetchInventory(selectedPropertyId);
    } else {
      setLoading(false);
    }
  }, [selectedPropertyId, fetchInventory]);

  // Aggregate bed metrics
  const totalBeds = beds.length;
  const occupiedBeds = beds.filter((b) => b.status === BedStatus.OCCUPIED).length;
  const availableBeds = beds.filter((b) => b.status === BedStatus.AVAILABLE).length;
  const reservedBeds = beds.filter((b) => b.status === BedStatus.RESERVED).length;
  const maintenanceBeds = beds.filter((b) => b.status === BedStatus.MAINTENANCE).length;
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  // Filtered rooms
  const filteredRooms = rooms.filter((r) => {
    const matchesSearch =
      r.roomNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.sharingType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSharing = sharingFilter === 'ALL' || r.sharingType === sharingFilter;
    const matchesFloor = selectedFloorId === 'ALL' || r.floorId === selectedFloorId;

    if (statusFilter !== 'ALL') {
      const roomBeds = beds.filter((b) => b.roomId === r.id);
      const hasStatus = roomBeds.some((b) => b.status === statusFilter);
      return matchesSearch && matchesSharing && matchesFloor && hasStatus;
    }

    return matchesSearch && matchesSharing && matchesFloor;
  });

  const handleOpenBedInspection = (bed: BedDto, room: RoomDto) => {
    setSelectedBed(bed);
    setSelectedBedRoom(room);
    setStatusFeedback(null);
  };

  const handleUpdateBedStatus = async (newStatus: BedStatus) => {
    if (!selectedBed || !selectedPropertyId) return;
    setIsUpdatingStatus(true);
    setStatusFeedback(null);

    try {
      const res = await fetch(`${API_BASE}/properties/${selectedPropertyId}/beds/${selectedBed.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        const json = await res.json();
        setBeds((prev) => prev.map((b) => (b.id === selectedBed.id ? { ...b, status: newStatus } : b)));
        setSelectedBed((prev) => (prev ? { ...prev, status: newStatus } : null));
        setStatusFeedback(`Bed status updated to ${newStatus}`);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setStatusFeedback(errJson.error?.message || 'Failed to update bed status.');
      }
    } catch {
      setStatusFeedback('Network error while updating bed status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <AppShell activePath="/pg/rooms">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Navigation Breadcrumb & Back Button */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Link href="/properties" className="hover:text-slate-900 font-medium">
              Properties
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-900 font-semibold">PG Beds & Rooms Operations</span>
          </div>

          <BackButton fallbackHref="/properties" label="Back to Properties" />
        </div>

        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-teal-50 text-brand-teal flex items-center justify-center font-bold border border-teal-100 shadow-2xs">
              <BedDouble className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                PG Beds & Rooms Hub
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage sharing allocations, inspect bed states, and analyze real-time PG occupancy metrics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/properties/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-teal hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Add New Property
            </Link>
          </div>
        </div>

        {/* Property Selector Bar */}
        {properties.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-3">
              <label htmlFor="pg-select" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Building className="w-4 h-4 text-brand-teal" />
                Select PG Property:
              </label>
              <select
                id="pg-select"
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code}) — {p.city}
                  </option>
                ))}
              </select>
            </div>

            {selectedProperty && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Address:</span>
                <span className="font-medium text-slate-700">
                  {selectedProperty.address}, {selectedProperty.city}
                </span>
                <Link
                  href={`/properties/${selectedProperty.id}`}
                  className="text-brand-teal hover:underline font-bold ml-2 inline-flex items-center gap-0.5"
                >
                  Property Overview <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        ) : (
          !loading && (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-brand-teal flex items-center justify-center mx-auto">
                <Building className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">No PG Properties Registered</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Create a PG / Co-Living property to automatically generate floor structures, sharing rooms, and bed inventories in one workflow.
                </p>
              </div>
              <Link
                href="/properties/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-teal hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition"
              >
                <Plus className="w-4 h-4" />
                Add PG Property with Inventory
              </Link>
            </div>
          )
        )}

        {/* Live Occupancy Metric Cards */}
        {selectedPropertyId && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Floors</span>
              <p className="text-xl font-bold text-slate-900">{floors.length}</p>
              <span className="text-[10px] text-slate-500">Configured levels</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Rooms</span>
              <p className="text-xl font-bold text-slate-900">{rooms.length}</p>
              <span className="text-[10px] text-slate-500">Sharing rooms</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Beds</span>
              <p className="text-xl font-bold text-brand-teal">{totalBeds}</p>
              <span className="text-[10px] text-teal-600 font-semibold">{occupancyRate}% occupied</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Available</span>
              <p className="text-xl font-bold text-emerald-600">{availableBeds}</p>
              <span className="text-[10px] text-emerald-600 font-medium">Ready for stay</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Occupied</span>
              <p className="text-xl font-bold text-blue-600">{occupiedBeds}</p>
              <span className="text-[10px] text-blue-600 font-medium">Active occupants</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Maintenance</span>
              <p className="text-xl font-bold text-rose-600">{maintenanceBeds}</p>
              <span className="text-[10px] text-rose-600 font-medium">Under repair</span>
            </div>
          </div>
        )}

        {/* Room & Bed Inventory Grid */}
        {selectedPropertyId && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <DoorOpen className="w-5 h-5 text-brand-teal" />
                <h3 className="text-base font-bold text-slate-900">
                  Rooms & Bed Allocations ({filteredRooms.length} of {rooms.length})
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search room number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-teal w-44"
                  />
                </div>

                {/* Floor Filter */}
                <select
                  value={selectedFloorId}
                  onChange={(e) => setSelectedFloorId(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none"
                >
                  <option value="ALL">All Floors</option>
                  {floors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} (L{f.floorNumber})
                    </option>
                  ))}
                </select>

                {/* Sharing Filter */}
                <select
                  value={sharingFilter}
                  onChange={(e) => setSharingFilter(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none"
                >
                  <option value="ALL">All Sharing Types</option>
                  <option value="SINGLE">Single</option>
                  <option value="DOUBLE">Double</option>
                  <option value="TRIPLE">Triple</option>
                  <option value="FOUR_SHARING">Quad</option>
                  <option value="DORMITORY">Dormitory</option>
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none"
                >
                  <option value="ALL">All Bed Statuses</option>
                  <option value="AVAILABLE">Has Available Bed</option>
                  <option value="OCCUPIED">Has Occupied Bed</option>
                  <option value="RESERVED">Has Reserved Bed</option>
                  <option value="UNDER_MAINTENANCE">Has Maintenance Bed</option>
                </select>
              </div>
            </div>

            {/* Loading Indicator */}
            {loading ? (
              <div className="p-12 flex justify-center items-center text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-brand-teal" />
                <span>Loading room structures and bed inventories...</span>
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="p-10 text-center text-slate-400 space-y-3">
                <DoorOpen className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs">No rooms found matching your filters in this property.</p>
              </div>
            ) : (
              /* Room Cards Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRooms.map((room) => {
                  const roomBeds = beds.filter((b) => b.roomId === room.id);
                  const floor = floors.find((f) => f.id === room.floorId);

                  return (
                    <div
                      key={room.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-brand-teal/40 transition shadow-2xs space-y-3"
                    >
                      {/* Card Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 font-bold text-sm flex items-center justify-center border border-slate-200 font-mono">
                            {room.roomNumber}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-slate-900">
                              {room.sharingType} Sharing
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {floor ? floor.name : 'Unassigned Floor'}
                            </p>
                          </div>
                        </div>

                        <span className="text-xs font-bold text-brand-teal">
                          ₹{Number(room.baseRent).toLocaleString()}/mo
                        </span>
                      </div>

                      {/* Bed Chips List */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Beds ({roomBeds.length}) — Click to Manage
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {roomBeds.map((bed) => {
                            let badgeStyle = 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-400';
                            if (bed.status === BedStatus.AVAILABLE) {
                              badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:border-emerald-400';
                            } else if (bed.status === BedStatus.OCCUPIED) {
                              badgeStyle = 'bg-blue-50 text-blue-800 border-blue-200 hover:border-blue-400';
                            } else if (bed.status === BedStatus.RESERVED) {
                              badgeStyle = 'bg-amber-50 text-amber-800 border-amber-200 hover:border-amber-400';
                            } else if (bed.status === BedStatus.MAINTENANCE) {
                              badgeStyle = 'bg-rose-50 text-rose-800 border-rose-200 hover:border-rose-400';
                            }

                            return (
                              <button
                                key={bed.id}
                                onClick={() => handleOpenBedInspection(bed, room)}
                                className={`px-2.5 py-2 rounded-lg border text-xs font-semibold flex items-center justify-between transition text-left cursor-pointer active:scale-95 ${badgeStyle}`}
                              >
                                <span className="font-mono">{bed.bedNumber}</span>
                                <span className="text-[9px] uppercase font-bold tracking-tight">
                                  {bed.status.replace('_', ' ')}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Capacity: {room.capacity} beds</span>
                        <span className="text-emerald-700 font-semibold">
                          {roomBeds.filter((b) => b.status === BedStatus.AVAILABLE).length} available
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Bed Inspection / Status Management Drawer */}
        {selectedBed && selectedBedRoom && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 text-brand-teal flex items-center justify-center font-bold font-mono">
                    {selectedBed.bedNumber}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Bed {selectedBed.bedNumber} • Room {selectedBedRoom.roomNumber}
                    </h3>
                    <p className="text-[10px] text-slate-500">{selectedBedRoom.sharingType} Sharing Room</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedBed(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-medium">Current Status:</span>
                  <span
                    className={`font-bold px-2.5 py-0.5 rounded-full border text-[10px] uppercase ${
                      selectedBed.status === BedStatus.AVAILABLE
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : selectedBed.status === BedStatus.OCCUPIED
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : selectedBed.status === BedStatus.RESERVED
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {selectedBed.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-medium">Base Monthly Rent:</span>
                  <span className="font-bold text-brand-teal">
                    ₹{Number(selectedBed.monthlyRent || selectedBedRoom.baseRent).toLocaleString()}/mo
                  </span>
                </div>

                {statusFeedback && (
                  <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-xs text-brand-teal font-medium">
                    {statusFeedback}
                  </div>
                )}

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-700 block">Update Operational Status:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleUpdateBedStatus(BedStatus.AVAILABLE)}
                      disabled={isUpdatingStatus || selectedBed.status === BedStatus.AVAILABLE}
                      className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold rounded-lg text-xs transition disabled:opacity-40"
                    >
                      Mark Available
                    </button>
                    <button
                      onClick={() => handleUpdateBedStatus(BedStatus.MAINTENANCE)}
                      disabled={isUpdatingStatus || selectedBed.status === BedStatus.MAINTENANCE}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 font-bold rounded-lg text-xs transition disabled:opacity-40"
                    >
                      Mark Maintenance
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setSelectedBed(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
