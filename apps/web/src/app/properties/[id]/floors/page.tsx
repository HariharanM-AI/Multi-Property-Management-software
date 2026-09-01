'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/lib/auth-context';
import {
  PropertyDto,
  FloorDto,
  RoomDto,
  BedDto,
  PgPropertySummaryDto,
  PropertyType,
  RoomSharingType,
  BedStatus,
  ApiResponse,
} from '@propertyos/types';
import {
  Layers,
  BedDouble,
  Home,
  Plus,
  Trash2,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export default function PgFloorsPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params.id as string;
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // State
  const [property, setProperty] = useState<PropertyDto | null>(null);
  const [summary, setSummary] = useState<PgPropertySummaryDto | null>(null);
  const [floors, setFloors] = useState<FloorDto[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fallback Dev Flag
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  // Modals
  const [showAddFloorModal, setShowAddFloorModal] = useState(false);
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [showEditBedModal, setShowEditBedModal] = useState(false);
  const [selectedBed, setSelectedBed] = useState<BedDto | null>(null);

  // Form Fields
  const [floorNumber, setFloorNumber] = useState(0);
  const [floorName, setFloorName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [roomSharingType, setRoomSharingType] = useState<RoomSharingType>(RoomSharingType.DOUBLE);
  const [roomCapacity, setRoomCapacity] = useState(2);
  const [roomBaseRent, setRoomBaseRent] = useState(5000);
  const [autoGenerateBeds, setAutoGenerateBeds] = useState(true);
  const [bedPrice, setBedPrice] = useState(5000);
  const [bedStatus, setBedStatus] = useState<BedStatus>(BedStatus.AVAILABLE);

  // Fallback local stores
  const [fallbackFloors, setFallbackFloors] = useState<FloorDto[]>([]);
  const [fallbackRooms, setFallbackRooms] = useState<Record<string, RoomDto[]>>({});

  const useDevFallback = () => {
    setIsUsingFallback(true);
    setProperty({
      id: propertyId,
      organizationId: 'org-1',
      code: 'PROP-000001',
      name: 'GreenGlen PG Residency',
      propertyType: PropertyType.PG,
      status: 'ACTIVE' as any,
      description: 'Premium co-living property near HSR BDA complex (Offline Dev Fallback)',
      address: '#42, 14th Main Road, Sector 4',
      locality: 'HSR Layout',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560102',
      country: 'India',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const mockFloors: FloorDto[] = [
      {
        id: 'floor-ground',
        propertyId,
        floorNumber: 0,
        name: 'Ground Floor',
        roomsCount: 1,
        bedsCount: 2,
        occupiedBedsCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'floor-first',
        propertyId,
        floorNumber: 1,
        name: '1st Floor',
        roomsCount: 1,
        bedsCount: 2,
        occupiedBedsCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    setFallbackFloors(mockFloors);
    setFloors(mockFloors);
    setSelectedFloorId('floor-ground');

    const mockRoomsGround: RoomDto[] = [
      {
        id: 'room-101',
        propertyId,
        floorId: 'floor-ground',
        roomNumber: '101',
        sharingType: RoomSharingType.DOUBLE,
        capacity: 2,
        baseRent: 6000,
        amenities: ['Wifi', 'Tv'],
        beds: [
          {
            id: 'bed-101a',
            roomId: 'room-101',
            bedNumber: '101-A',
            monthlyRent: 6000,
            status: BedStatus.AVAILABLE,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'bed-101b',
            roomId: 'room-101',
            bedNumber: '101-B',
            monthlyRent: 6000,
            status: BedStatus.AVAILABLE,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        bedsCount: 2,
        availableBedsCount: 2,
        occupiedBedsCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const mockRoomsFirst: RoomDto[] = [
      {
        id: 'room-201',
        propertyId,
        floorId: 'floor-first',
        roomNumber: '201',
        sharingType: RoomSharingType.DOUBLE,
        capacity: 2,
        baseRent: 6500,
        amenities: ['Wifi'],
        beds: [
          {
            id: 'bed-201a',
            roomId: 'room-201',
            bedNumber: '201-A',
            monthlyRent: 6500,
            status: BedStatus.OCCUPIED,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'bed-201b',
            roomId: 'room-201',
            bedNumber: '201-B',
            monthlyRent: 6500,
            status: BedStatus.AVAILABLE,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        bedsCount: 2,
        availableBedsCount: 1,
        occupiedBedsCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const initialRoomsMap = {
      'floor-ground': mockRoomsGround,
      'floor-first': mockRoomsFirst,
    };
    setFallbackRooms(initialRoomsMap);
    setRooms(mockRoomsGround);

    updateSummary(mockFloors, initialRoomsMap);
  };

  const updateSummary = (currFloors: FloorDto[], currRoomsMap: Record<string, RoomDto[]>) => {
    let totRooms = 0;
    let totBeds = 0;
    let avBeds = 0;
    let ocBeds = 0;
    let reserved = 0;
    let maintenance = 0;
    let blocked = 0;
    let cleaning = 0;
    let notice = 0;

    Object.values(currRoomsMap).forEach((roomList) => {
      totRooms += roomList.length;
      roomList.forEach((r) => {
        totBeds += r.beds?.length || 0;
        r.beds?.forEach((b) => {
          if (b.status === BedStatus.AVAILABLE) avBeds++;
          else if (b.status === BedStatus.OCCUPIED) ocBeds++;
          else if (b.status === BedStatus.RESERVED) reserved++;
          else if (b.status === BedStatus.MAINTENANCE) maintenance++;
          else if (b.status === BedStatus.BLOCKED) blocked++;
          else if (b.status === BedStatus.CLEANING) cleaning++;
          else if (b.status === BedStatus.NOTICE) notice++;
        });
      });
    });

    setSummary({
      propertyId,
      totalFloors: currFloors.length,
      totalRooms: totRooms,
      totalBeds: totBeds,
      availableBeds: avBeds,
      occupiedBeds: ocBeds,
      reservedBeds: reserved,
      maintenanceBeds: maintenance,
      blockedBeds: blocked,
      cleaningBeds: cleaning,
      noticeBeds: notice,
      occupancyRate: totBeds > 0 ? Math.round((ocBeds / totBeds) * 100) : 0,
    });
  };

  // Fetch initial details
  useEffect(() => {
    if (!authLoading && !isAuthenticated && process.env.NODE_ENV === 'production') {
      router.push('/login');
      return;
    }
    fetchPropertyDetails();
  }, [propertyId, isAuthenticated, authLoading]);

  // Fetch rooms when floor changes
  useEffect(() => {
    if (selectedFloorId) {
      if (isUsingFallback) {
        setRooms(fallbackRooms[selectedFloorId] || []);
      } else {
        fetchRooms(selectedFloorId);
      }
    }
  }, [selectedFloorId, isUsingFallback, fallbackRooms]);

  const fetchPropertyDetails = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const propRes = await fetch(`${API_BASE}/properties/${propertyId}`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!propRes.ok) {
        if (process.env.NODE_ENV === 'development') {
          useDevFallback();
          setIsLoading(false);
          return;
        }
        throw new Error('Failed to load property details.');
      }
      const propJson: ApiResponse<PropertyDto> = await propRes.json();
      if (!propJson.success || !propJson.data) {
        throw new Error(propJson.error?.message || 'Property not found.');
      }

      if (propJson.data.propertyType !== PropertyType.PG) {
        setProperty(propJson.data);
        setIsLoading(false);
        return;
      }

      setProperty(propJson.data);

      const sumRes = await fetch(`${API_BASE}/properties/${propertyId}/pg/summary`, {
        method: 'GET',
        credentials: 'include',
      });
      if (sumRes.ok) {
        const sumJson: ApiResponse<PgPropertySummaryDto> = await sumRes.json();
        if (sumJson.success && sumJson.data) {
          setSummary(sumJson.data);
        }
      }

      const floorRes = await fetch(`${API_BASE}/properties/${propertyId}/floors`, {
        method: 'GET',
        credentials: 'include',
      });
      if (floorRes.ok) {
        const floorJson: ApiResponse<FloorDto[]> = await floorRes.json();
        if (floorJson.success && floorJson.data) {
          setFloors(floorJson.data);
          if (floorJson.data.length > 0) {
            setSelectedFloorId(floorJson.data[0].id);
          }
        }
      }
    } catch (err: any) {
      if (process.env.NODE_ENV === 'development') {
        useDevFallback();
      } else {
        setError(err.message || 'An error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRooms = async (floorId: string) => {
    try {
      const res = await fetch(`${API_BASE}/properties/${propertyId}/rooms?floorId=${floorId}`, {
        method: 'GET',
        credentials: 'include',
      });
      if (res.ok) {
        const json: ApiResponse<RoomDto[]> = await res.json();
        if (json.success && json.data) {
          setRooms(json.data);
        }
      }
    } catch {
      // Graceful fallback
    }
  };

  const handleAddFloor = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isUsingFallback) {
      const floorId = `floor-${Date.now()}`;
      const newFloor: FloorDto = {
        id: floorId,
        propertyId,
        floorNumber,
        name: floorName || `Floor ${floorNumber}`,
        roomsCount: 0,
        bedsCount: 0,
        occupiedBedsCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedFloors = [...fallbackFloors, newFloor].sort((a, b) => a.floorNumber - b.floorNumber);
      setFallbackFloors(updatedFloors);
      setFloors(updatedFloors);

      const updatedRooms = { ...fallbackRooms, [floorId]: [] };
      setFallbackRooms(updatedRooms);

      setSelectedFloorId(floorId);
      setShowAddFloorModal(false);
      setFloorName('');
      updateSummary(updatedFloors, updatedRooms);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/properties/${propertyId}/floors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          floorNumber: Number(floorNumber) || 1,
          name: floorName.trim() || (floorNumber === 0 ? 'Ground Floor' : `Floor ${floorNumber}`),
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setShowAddFloorModal(false);
        setFloorName('');
        setFloorNumber((prev) => prev + 1);
        await fetchPropertyDetails();
      } else {
        alert(json.error?.message || 'Failed to add floor');
      }
    } catch {
      alert('Network error');
    }
  };

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFloorId) return;

    if (isUsingFallback) {
      const roomId = `room-${Date.now()}`;
      const generatedBeds: BedDto[] = [];
      if (autoGenerateBeds) {
        for (let i = 0; i < roomCapacity; i++) {
          generatedBeds.push({
            id: `bed-${roomId}-${i}`,
            roomId,
            bedNumber: `${roomNumber}-${String.fromCharCode(65 + i)}`,
            monthlyRent: roomBaseRent,
            status: BedStatus.AVAILABLE,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

      const newRoom: RoomDto = {
        id: roomId,
        propertyId,
        floorId: selectedFloorId,
        roomNumber,
        sharingType: roomSharingType,
        capacity: roomCapacity,
        baseRent: roomBaseRent,
        amenities: [],
        beds: generatedBeds,
        bedsCount: generatedBeds.length,
        availableBedsCount: generatedBeds.length,
        occupiedBedsCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedFloorRooms = [...(fallbackRooms[selectedFloorId] || []), newRoom];
      const updatedRooms = { ...fallbackRooms, [selectedFloorId]: updatedFloorRooms };
      setFallbackRooms(updatedRooms);
      setRooms(updatedFloorRooms);

      const updatedFloors = fallbackFloors.map((f) => {
        if (f.id === selectedFloorId) {
          return {
            ...f,
            roomsCount: updatedFloorRooms.length,
            bedsCount: updatedFloorRooms.reduce((acc, r) => acc + (r.beds?.length || 0), 0),
          };
        }
        return f;
      });
      setFallbackFloors(updatedFloors);
      setFloors(updatedFloors);

      setShowAddRoomModal(false);
      setRoomNumber('');
      updateSummary(updatedFloors, updatedRooms);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/properties/${propertyId}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          floorId: selectedFloorId,
          roomNumber,
          sharingType: roomSharingType,
          capacity: roomCapacity,
          baseRent: roomBaseRent,
          autoGenerateBeds,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setShowAddRoomModal(false);
        setRoomNumber('');
        await fetchPropertyDetails();
        if (selectedFloorId) {
          fetchRooms(selectedFloorId);
        }
      } else {
        alert(json.error?.message || 'Failed to add room');
      }
    } catch {
      alert('Network error');
    }
  };

  const handleUpdateBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBed) return;

    if (isUsingFallback && selectedFloorId) {
      // Offline transition safety validation
      if (selectedBed.status === BedStatus.OCCUPIED && bedStatus === BedStatus.MAINTENANCE) {
        alert('Cannot set occupied bed to maintenance directly. Checkout tenant first.');
        return;
      }

      const updatedFloorRooms = fallbackRooms[selectedFloorId].map((r) => {
        if (r.id === selectedBed.roomId) {
          const updatedBeds = r.beds?.map((b) => {
            if (b.id === selectedBed.id) {
              return { ...b, monthlyRent: bedPrice, status: bedStatus };
            }
            return b;
          }) || [];
          return {
            ...r,
            beds: updatedBeds,
            availableBedsCount: updatedBeds.filter((b) => b.status === BedStatus.AVAILABLE).length,
            occupiedBedsCount: updatedBeds.filter((b) => b.status === BedStatus.OCCUPIED).length,
          };
        }
        return r;
      });

      const updatedRoomsMap = { ...fallbackRooms, [selectedFloorId]: updatedFloorRooms };
      setFallbackRooms(updatedRoomsMap);
      setRooms(updatedFloorRooms);

      const updatedFloors = fallbackFloors.map((f) => {
        if (f.id === selectedFloorId) {
          let floorOccupied = 0;
          updatedFloorRooms.forEach((r) => {
            floorOccupied += r.beds?.filter((b) => b.status === BedStatus.OCCUPIED).length || 0;
          });
          return { ...f, occupiedBedsCount: floorOccupied };
        }
        return f;
      });
      setFallbackFloors(updatedFloors);
      setFloors(updatedFloors);

      setShowEditBedModal(false);
      setSelectedBed(null);
      updateSummary(updatedFloors, updatedRoomsMap);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/properties/${propertyId}/beds/${selectedBed.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          monthlyRent: bedPrice,
          status: bedStatus,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setShowEditBedModal(false);
        setSelectedBed(null);
        await fetchPropertyDetails();
        if (selectedFloorId) {
          fetchRooms(selectedFloorId);
        }
      } else {
        alert(json.error?.message || 'Failed to update bed');
      }
    } catch {
      alert('Network error');
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm('Are you sure you want to delete this room? This will soft-delete all non-occupied beds.')) return;

    if (isUsingFallback && selectedFloorId) {
      const targetRoom = fallbackRooms[selectedFloorId].find((r) => r.id === roomId);
      const isOccupied = targetRoom?.beds?.some((b) => b.status === BedStatus.OCCUPIED);
      if (isOccupied) {
        alert('Cannot delete room containing occupied beds.');
        return;
      }

      const updatedFloorRooms = fallbackRooms[selectedFloorId].filter((r) => r.id !== roomId);
      const updatedRoomsMap = { ...fallbackRooms, [selectedFloorId]: updatedFloorRooms };
      setFallbackRooms(updatedRoomsMap);
      setRooms(updatedFloorRooms);

      const updatedFloors = fallbackFloors.map((f) => {
        if (f.id === selectedFloorId) {
          return {
            ...f,
            roomsCount: updatedFloorRooms.length,
            bedsCount: updatedFloorRooms.reduce((acc, r) => acc + (r.beds?.length || 0), 0),
          };
        }
        return f;
      });
      setFallbackFloors(updatedFloors);
      setFloors(updatedFloors);

      updateSummary(updatedFloors, updatedRoomsMap);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/properties/${propertyId}/rooms/${roomId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        await fetchPropertyDetails();
        if (selectedFloorId) {
          fetchRooms(selectedFloorId);
        }
      } else {
        alert(json.error?.message || 'Failed to delete room');
      }
    } catch {
      alert('Network error');
    }
  };

  const handleDeleteFloor = async (floorId: string) => {
    if (!confirm('Are you sure you want to delete this floor? All rooms and beds will be soft-deleted.')) return;

    if (isUsingFallback) {
      const hasOccupied = fallbackRooms[floorId]?.some((r) => r.beds?.some((b) => b.status === BedStatus.OCCUPIED));
      if (hasOccupied) {
        alert('Cannot delete floor containing occupied beds.');
        return;
      }

      const updatedFloors = fallbackFloors.filter((f) => f.id !== floorId);
      setFallbackFloors(updatedFloors);
      setFloors(updatedFloors);

      const updatedRoomsMap = { ...fallbackRooms };
      delete updatedRoomsMap[floorId];
      setFallbackRooms(updatedRoomsMap);

      if (updatedFloors.length > 0) {
        setSelectedFloorId(updatedFloors[0].id);
      } else {
        setSelectedFloorId(null);
      }

      updateSummary(updatedFloors, updatedRoomsMap);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/properties/${propertyId}/floors/${floorId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        await fetchPropertyDetails();
      } else {
        alert(json.error?.message || 'Failed to delete floor');
      }
    } catch {
      alert('Network error');
    }
  };

  const getBedStatusColor = (status: BedStatus) => {
    switch (status) {
      case BedStatus.AVAILABLE:
        return 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100';
      case BedStatus.OCCUPIED:
        return 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100';
      case BedStatus.RESERVED:
        return 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100';
      case BedStatus.MAINTENANCE:
        return 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100';
      case BedStatus.CLEANING:
        return 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100';
      case BedStatus.NOTICE:
        return 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100';
      case BedStatus.BLOCKED:
        return 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100';
      default:
        return 'border-slate-200 bg-slate-50 text-slate-700';
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-teal"></div>
        </div>
      </AppShell>
    );
  }

  if (error || !property) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto py-8 px-4">
          <Card className="border-rose-200 bg-rose-50/50 p-6 flex items-start gap-4">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-rose-900 text-sm">Error Loading Inventory</h3>
              <p className="text-xs text-rose-700 mt-1">{error || 'Property not found.'}</p>
              <Link href="/properties" className="inline-block mt-4 text-xs font-bold text-rose-900 hover:underline">
                &larr; Back to Properties
              </Link>
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto py-8 px-4 space-y-6">
        {/* Navigation Back Button */}
        <div className="flex items-center justify-between">
          <BackButton fallbackHref={`/properties/${propertyId}`} label="Back to Property" />
        </div>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-surface-border pb-6 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                PG / CO-LIVING
              </span>
              {isUsingFallback && (
                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500 text-white animate-pulse">
                  OFFLINE DEV DEMO MODE
                </span>
              )}
            </div>
            <h1 className="text-lg font-extrabold text-brand-navy tracking-tight">{property.name}</h1>
            <p className="text-xs text-surface-textSecondary">{property.address}, {property.city}</p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFloorNumber(floors.length);
                setShowAddFloorModal(true);
              }}
              className="border-slate-300 hover:bg-slate-50 text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Floor
            </Button>
            <Button
              size="sm"
              onClick={() => setShowAddRoomModal(true)}
              className="bg-brand-teal hover:bg-teal-800 text-xs font-bold text-white"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Room
            </Button>
          </div>
        </div>

        {/* Occupancy metrics summary */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card className="p-4 space-y-1">
              <p className="text-[10px] text-surface-textSecondary font-bold uppercase tracking-wider">Total Floors</p>
              <p className="text-lg font-black text-brand-navy">{summary.totalFloors}</p>
            </Card>
            <Card className="p-4 space-y-1">
              <p className="text-[10px] text-surface-textSecondary font-bold uppercase tracking-wider">Total Rooms</p>
              <p className="text-lg font-black text-brand-navy">{summary.totalRooms}</p>
            </Card>
            <Card className="p-4 space-y-1">
              <p className="text-[10px] text-surface-textSecondary font-bold uppercase tracking-wider">Total Beds</p>
              <p className="text-lg font-black text-brand-navy">{summary.totalBeds}</p>
            </Card>
            <Card className="p-4 space-y-1">
              <p className="text-[10px] text-surface-textSecondary font-bold uppercase tracking-wider">Available Beds</p>
              <p className="text-lg font-black text-emerald-600">{summary.availableBeds}</p>
            </Card>
            <Card className="p-4 space-y-1">
              <p className="text-[10px] text-surface-textSecondary font-bold uppercase tracking-wider">Occupied Beds</p>
              <p className="text-lg font-black text-indigo-600">{summary.occupiedBeds}</p>
            </Card>
            <Card className="p-4 space-y-1">
              <p className="text-[10px] text-surface-textSecondary font-bold uppercase tracking-wider">Occupancy Rate</p>
              <div className="flex items-center gap-2">
                <p className="text-lg font-black text-brand-navy">{summary.occupancyRate}%</p>
                <TrendingUp className="w-4 h-4 text-brand-teal" />
              </div>
            </Card>
          </div>
        )}

        {/* Floor Tab navigation and room grid */}
        {floors.length === 0 ? (
          <Card className="p-8 text-center border-dashed border-slate-300 space-y-4">
            <Layers className="w-8 h-8 text-slate-400 mx-auto" />
            <h2 className="text-sm font-bold text-brand-navy">No Floors Created Yet</h2>
            <p className="text-xs text-surface-textSecondary max-w-sm mx-auto">
              Start by building your PG structure. Create a ground floor and add rooms to allocate beds.
            </p>
            <Button
              size="sm"
              onClick={() => {
                setFloorNumber(0);
                setShowAddFloorModal(true);
              }}
              className="bg-brand-navy hover:bg-slate-800 text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Create Ground Floor
            </Button>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Tab strip */}
            <div className="flex items-center gap-2 border-b border-surface-border overflow-x-auto pb-px">
              {floors.map((floor) => (
                <button
                  key={floor.id}
                  id={`tab-${floor.id}`}
                  onClick={() => setSelectedFloorId(floor.id)}
                  className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all ${
                    selectedFloorId === floor.id
                      ? 'border-brand-teal text-brand-teal'
                      : 'border-transparent text-surface-textSecondary hover:text-brand-navy hover:border-slate-300'
                  }`}
                >
                  {floor.name}
                  <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    {floor.roomsCount || 0} Rooms
                  </span>
                </button>
              ))}
            </div>

            {/* Selected floor actions */}
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black text-brand-navy uppercase tracking-wider">
                Rooms on {floors.find((f) => f.id === selectedFloorId)?.name}
              </h2>
              {selectedFloorId && (
                <button
                  onClick={() => handleDeleteFloor(selectedFloorId)}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Floor
                </button>
              )}
            </div>

            {/* Room list and bed grid */}
            {rooms.length === 0 ? (
              <Card className="p-8 text-center border-dashed border-slate-300 space-y-4">
                <Home className="w-8 h-8 text-slate-400 mx-auto" />
                <h2 className="text-sm font-bold text-brand-navy">No Rooms on this Floor</h2>
                <p className="text-xs text-surface-textSecondary max-w-sm mx-auto">
                  Add rooms like single sharing or dormitory to this floor.
                </p>
                <Button
                  size="sm"
                  onClick={() => setShowAddRoomModal(true)}
                  className="bg-brand-teal hover:bg-teal-800 text-xs font-bold text-white"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Room to Floor
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {rooms.map((room) => (
                  <Card key={room.id} className="p-6 border border-surface-border shadow-sm flex flex-col justify-between">
                    <div className="space-y-4">
                      {/* Room Header */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <h3 className="text-md font-extrabold text-brand-navy">Room {room.roomNumber}</h3>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand-navy/10 text-brand-navy">
                              {room.sharingType} SHARING
                            </span>
                            <span className="text-[9px] text-surface-textSecondary font-semibold">
                              Capacity: {room.capacity} beds
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDeleteRoom(room.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                            title="Delete Room"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Visual Bed Grid */}
                      <div className="space-y-1.5">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bed Grid</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {room.beds?.map((bed) => (
                            <button
                              key={bed.id}
                              onClick={() => {
                                setSelectedBed(bed);
                                setBedPrice(bed.monthlyRent);
                                setBedStatus(bed.status);
                                setShowEditBedModal(true);
                              }}
                              className={`p-3 rounded-lg border text-left flex flex-col justify-between h-20 transition-all shadow-sm ${getBedStatusColor(
                                bed.status
                              )}`}
                            >
                              <span className="text-xs font-bold">{bed.bedNumber}</span>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] opacity-75 font-medium">₹{bed.monthlyRent}/mo</span>
                                <span className="text-[8px] font-black uppercase tracking-wider">
                                  {bed.status}
                                </span>
                              </div>
                            </button>
                          ))}
                          {room.beds && room.beds.length < room.capacity && (
                            <button
                              onClick={() => {
                                if (isUsingFallback && selectedFloorId) {
                                  const newBedNum = `${room.roomNumber}-${String.fromCharCode(65 + (room.beds?.length || 0))}`;
                                  const newBed: BedDto = {
                                    id: `bed-${room.id}-${Date.now()}`,
                                    roomId: room.id,
                                    bedNumber: newBedNum,
                                    monthlyRent: room.baseRent,
                                    status: BedStatus.AVAILABLE,
                                    createdAt: new Date(),
                                    updatedAt: new Date(),
                                  };

                                  const updatedFloorRooms = fallbackRooms[selectedFloorId].map((r) => {
                                    if (r.id === room.id) {
                                      const updatedBeds = [...(r.beds || []), newBed];
                                      return {
                                        ...r,
                                        beds: updatedBeds,
                                        bedsCount: updatedBeds.length,
                                        availableBedsCount: updatedBeds.filter((b) => b.status === BedStatus.AVAILABLE).length,
                                      };
                                    }
                                    return r;
                                  });

                                  const updatedRoomsMap = { ...fallbackRooms, [selectedFloorId]: updatedFloorRooms };
                                  setFallbackRooms(updatedRoomsMap);
                                  setRooms(updatedFloorRooms);

                                  const updatedFloors = fallbackFloors.map((f) => {
                                    if (f.id === selectedFloorId) {
                                      return {
                                        ...f,
                                        bedsCount: updatedFloorRooms.reduce((acc, r) => acc + (r.beds?.length || 0), 0),
                                      };
                                    }
                                    return f;
                                  });
                                  setFallbackFloors(updatedFloors);
                                  setFloors(updatedFloors);

                                  updateSummary(updatedFloors, updatedRoomsMap);
                                  return;
                                }

                                fetch(`${API_BASE}/properties/${propertyId}/beds`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({
                                    roomId: room.id,
                                    bedNumber: `${room.roomNumber}-${String.fromCharCode(65 + (room.beds?.length || 0))}`,
                                    monthlyRent: room.baseRent,
                                    status: BedStatus.AVAILABLE,
                                  }),
                                }).then(async (res) => {
                                  if (res.ok) {
                                    await fetchPropertyDetails();
                                    fetchRooms(selectedFloorId!);
                                  }
                                });
                              }}
                              className="p-3 rounded-lg border border-dashed border-slate-300 hover:border-brand-teal hover:bg-teal-50/20 text-slate-400 hover:text-brand-teal transition-all flex flex-col items-center justify-center h-20 gap-1 text-[10px] font-bold"
                            >
                              <Plus className="w-4 h-4" /> Add Bed
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-surface-border mt-4 pt-4 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-500">Base Rent: ₹{room.baseRent}/mo</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                        {room.beds?.filter((b) => b.status === BedStatus.AVAILABLE).length} Available
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Floor Modal */}
      {showAddFloorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/60 backdrop-blur-sm p-4">
          <Card className="max-w-md w-full p-6 space-y-4">
            <h3 className="text-md font-extrabold text-brand-navy">Add New Floor</h3>
            <form onSubmit={handleAddFloor} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Floor Number</label>
                <input
                  type="number"
                  value={floorNumber}
                  onChange={(e) => setFloorNumber(parseInt(e.target.value))}
                  className="w-full text-xs p-2.5 border border-surface-border rounded-lg"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Floor Name</label>
                <input
                  type="text"
                  placeholder="e.g. Ground Floor, 1st Floor"
                  value={floorName}
                  onChange={(e) => setFloorName(e.target.value)}
                  className="w-full text-xs p-2.5 border border-surface-border rounded-lg"
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddFloorModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-brand-teal hover:bg-teal-800 text-white font-bold">
                  Add Floor
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Add Room Modal */}
      {showAddRoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/60 backdrop-blur-sm p-4">
          <Card className="max-w-md w-full p-6 space-y-4">
            <h3 className="text-md font-extrabold text-brand-navy">Add Room</h3>
            <form onSubmit={handleAddRoom} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Room Number</label>
                <input
                  type="text"
                  placeholder="e.g. 101, G01"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  className="w-full text-xs p-2.5 border border-surface-border rounded-lg"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Sharing Type</label>
                  <select
                    value={roomSharingType}
                    onChange={(e) => {
                      const type = e.target.value as RoomSharingType;
                      setRoomSharingType(type);
                      switch (type) {
                        case RoomSharingType.SINGLE:
                          setRoomCapacity(1);
                          break;
                        case RoomSharingType.DOUBLE:
                          setRoomCapacity(2);
                          break;
                        case RoomSharingType.TRIPLE:
                          setRoomCapacity(3);
                          break;
                        case RoomSharingType.FOUR_SHARING:
                          setRoomCapacity(4);
                          break;
                        case RoomSharingType.DORMITORY:
                          setRoomCapacity(6);
                          break;
                      }
                    }}
                    className="w-full text-xs p-2.5 border border-surface-border rounded-lg bg-white"
                  >
                    <option value={RoomSharingType.SINGLE}>Single</option>
                    <option value={RoomSharingType.DOUBLE}>Double</option>
                    <option value={RoomSharingType.TRIPLE}>Triple</option>
                    <option value={RoomSharingType.FOUR_SHARING}>Four Sharing</option>
                    <option value={RoomSharingType.DORMITORY}>Dormitory</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Capacity (Beds)</label>
                  <input
                    type="number"
                    value={roomCapacity}
                    onChange={(e) => setRoomCapacity(parseInt(e.target.value))}
                    className="w-full text-xs p-2.5 border border-surface-border rounded-lg"
                    min={1}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Monthly Base Rent (₹)</label>
                <input
                  type="number"
                  value={roomBaseRent}
                  onChange={(e) => setRoomBaseRent(parseInt(e.target.value))}
                  className="w-full text-xs p-2.5 border border-surface-border rounded-lg"
                  min={0}
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoBeds"
                  checked={autoGenerateBeds}
                  onChange={(e) => setAutoGenerateBeds(e.target.checked)}
                  className="rounded text-brand-teal focus:ring-brand-teal w-4 h-4 border-slate-300"
                />
                <label htmlFor="autoBeds" className="text-xs font-bold text-slate-600">
                  Auto-generate bed inventory matching capacity
                </label>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddRoomModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-brand-teal hover:bg-teal-800 text-white font-bold">
                  Create Room
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Edit Bed Modal */}
      {showEditBedModal && selectedBed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/60 backdrop-blur-sm p-4">
          <Card className="max-w-md w-full p-6 space-y-4">
            <h3 className="text-md font-extrabold text-brand-navy">Manage Bed {selectedBed.bedNumber}</h3>
            <form onSubmit={handleUpdateBed} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Monthly Rent (₹)</label>
                <input
                  type="number"
                  value={bedPrice}
                  onChange={(e) => setBedPrice(parseInt(e.target.value))}
                  className="w-full text-xs p-2.5 border border-surface-border rounded-lg"
                  min={0}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Bed Status</label>
                <select
                  value={bedStatus}
                  onChange={(e) => setBedStatus(e.target.value as BedStatus)}
                  className="w-full text-xs p-2.5 border border-surface-border rounded-lg bg-white"
                >
                  <option value={BedStatus.AVAILABLE}>Available</option>
                  <option value={BedStatus.RESERVED}>Reserved</option>
                  <option value={BedStatus.OCCUPIED}>Occupied</option>
                  <option value={BedStatus.MAINTENANCE}>Maintenance</option>
                  <option value={BedStatus.CLEANING}>Cleaning</option>
                  <option value={BedStatus.NOTICE}>Notice</option>
                  <option value={BedStatus.BLOCKED}>Blocked</option>
                </select>
              </div>

              <div className="flex items-center justify-between border-t border-surface-border pt-4">
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm('Are you sure you want to delete this bed from inventory?')) return;

                    if (isUsingFallback && selectedFloorId) {
                      if (selectedBed.status === BedStatus.OCCUPIED) {
                        alert('Cannot delete occupied bed.');
                        return;
                      }

                      const updatedFloorRooms = fallbackRooms[selectedFloorId].map((r) => {
                        if (r.id === selectedBed.roomId) {
                          const updatedBeds = r.beds?.filter((b) => b.id !== selectedBed.id) || [];
                          return {
                            ...r,
                            beds: updatedBeds,
                            bedsCount: updatedBeds.length,
                            availableBedsCount: updatedBeds.filter((b) => b.status === BedStatus.AVAILABLE).length,
                          };
                        }
                        return r;
                      });

                      const updatedRoomsMap = { ...fallbackRooms, [selectedFloorId]: updatedFloorRooms };
                      setFallbackRooms(updatedRoomsMap);
                      setRooms(updatedFloorRooms);

                      const updatedFloors = fallbackFloors.map((f) => {
                        if (f.id === selectedFloorId) {
                          return {
                            ...f,
                            bedsCount: updatedFloorRooms.reduce((acc, r) => acc + (r.beds?.length || 0), 0),
                          };
                        }
                        return f;
                      });
                      setFallbackFloors(updatedFloors);
                      setFloors(updatedFloors);

                      setShowEditBedModal(false);
                      setSelectedBed(null);
                      updateSummary(updatedFloors, updatedRoomsMap);
                      return;
                    }

                    const res = await fetch(`${API_BASE}/properties/${propertyId}/beds/${selectedBed.id}`, {
                      method: 'DELETE',
                      credentials: 'include',
                    });
                    if (res.ok) {
                      setShowEditBedModal(false);
                      await fetchPropertyDetails();
                      fetchRooms(selectedFloorId!);
                    } else {
                      const json = await res.json();
                      alert(json.error?.message || 'Failed to delete bed');
                    }
                  }}
                  className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove Bed
                </button>

                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowEditBedModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="bg-brand-teal hover:bg-teal-800 text-white font-bold">
                    Save Changes
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
