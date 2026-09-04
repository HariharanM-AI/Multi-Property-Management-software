'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/lib/auth-context';
import { getOwnerProfile, onOwnerProfileChange } from '@/lib/ownerProfileStorage';
import { getCleanPropertyDescription } from '@/lib/propertyUtils';
import {
  PropertyType,
  RoomSharingType,
  STANDARD_AMENITIES_CATALOG,
  CreatePropertyDto,
  ApiResponse,
  PropertyDto,
} from '@propertyos/types';
import {
  Building2,
  BedDouble,
  Home,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  MapPin,
  Sparkles,
  Info,
  AlertCircle,
  Wifi,
  Zap,
  Shield,
  UserCheck,
  Shirt,
  Wind,
  Flame,
  Car,
  ArrowUpDown,
  Droplet,
  Bath,
  Utensils,
  Dumbbell,
  Box,
  Tv,
  Layers,
  Plus,
  Trash2,
  Loader2,
  Check,
  FileSignature,
  PenTool,
  Type,
  RotateCcw,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Wifi,
  Zap,
  Shield,
  UserCheck,
  Shirt,
  Wind,
  Flame,
  Car,
  ArrowUpDown,
  Droplet,
  Bath,
  Utensils,
  Sparkles,
  Dumbbell,
  Box,
  Tv,
};

const BEDS_PER_SHARING: Record<RoomSharingType, number> = {
  [RoomSharingType.SINGLE]: 1,
  [RoomSharingType.DOUBLE]: 2,
  [RoomSharingType.TRIPLE]: 3,
  [RoomSharingType.FOUR_SHARING]: 4,
  [RoomSharingType.DORMITORY]: 6,
};

export type RoomCategory =
  | 'SINGLE'
  | 'DOUBLE'
  | 'TRIPLE'
  | 'FOUR_SHARING'
  | 'CUSTOM_NORMAL'
  | 'DORMITORY';

export interface RoomSetupItem {
  id: string;
  roomNumber: string;
  category: RoomCategory;
  sharingType: RoomSharingType;
  customBeds?: number;
  isAc: boolean;
  baseRent: number;
  securityDeposit: number;
}

export interface FloorSetupItem {
  id: string;
  floorNumber: number;
  name: string;
  rooms: RoomSetupItem[];
}

export interface RentalHouseItem {
  id: string;
  houseNumber: string;
  bhkType: string;
  monthlyRent: number;
  securityDeposit: number;
}

export interface RentalFloorSetupItem {
  id: string;
  floorNumber: number;
  name: string;
  houses: RentalHouseItem[];
}

export default function NewPropertyPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Basic Property Details
  const [formData, setFormData] = useState<CreatePropertyDto>({
    propertyType: PropertyType.PG,
    name: '',
    description: '',
    address: '',
    addressLine1: '',
    addressLine2: '',
    locality: '',
    city: '',
    district: '',
    state: '',
    country: 'India',
    postalCode: '',
    latitude: undefined,
    longitude: undefined,
    contactPhone: '',
    contactEmail: '',
    ownerName: '',
    ownerAddress: '',
    ownerPhone: '',
    ownerSignature: '',
    noticePeriodDays: 30,
    lockInPeriodValue: 1,
    lockInPeriodUnit: 'MONTHS',
    lockInMonths: 1,
    amenityIds: ['wifi', 'power_backup', 'cctv', 'ro_water'],
  });

  // Owner E-Signature State
  const [ownerSignMode, setOwnerSignMode] = useState<'draw' | 'type'>('draw');
  const [ownerTypedName, setOwnerTypedName] = useState('');
  const ownerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isOwnerDrawing, setIsOwnerDrawing] = useState(false);
  const [hasOwnerDrawn, setHasOwnerDrawn] = useState(false);
  const hasOwnerDrawnRef = useRef(false);
  const ownerLastPointRef = useRef<{ x: number; y: number } | null>(null);

  const startOwnerDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = ownerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsOwnerDrawing(true);
    setHasOwnerDrawn(true);
    hasOwnerDrawnRef.current = true;
    setErrorMessage(null);

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ownerLastPointRef.current = { x, y };

    const inkColor = formData.propertyType === PropertyType.RENTAL_HOUSE ? '#1e3a8a' : '#0f766e';
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawOwner = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isOwnerDrawing) return;
    const canvas = ownerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    if (ownerLastPointRef.current) {
      const midX = (ownerLastPointRef.current.x + x) / 2;
      const midY = (ownerLastPointRef.current.y + y) / 2;
      ctx.quadraticCurveTo(ownerLastPointRef.current.x, ownerLastPointRef.current.y, midX, midY);
      ctx.stroke();
    } else {
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    ownerLastPointRef.current = { x, y };
    hasOwnerDrawnRef.current = true;
    setHasOwnerDrawn(true);
    setErrorMessage(null);
  };

  const stopOwnerDrawing = () => {
    if (isOwnerDrawing) {
      setIsOwnerDrawing(false);
      ownerLastPointRef.current = null;
      const canvas = ownerCanvasRef.current;
      if (canvas && hasOwnerDrawnRef.current) {
        const sigData = canvas.toDataURL('image/png');
        setFormData((prev) => ({ ...prev, ownerSignature: sigData }));
        setHasOwnerDrawn(true);
        setErrorMessage(null);
      }
    }
  };

  const clearOwnerCanvas = () => {
    const canvas = ownerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasOwnerDrawnRef.current = false;
    ownerLastPointRef.current = null;
    setHasOwnerDrawn(false);
    setFormData((prev) => ({ ...prev, ownerSignature: '' }));
  };

  // Auto-populate owner details & digital signature from Owner Profile
  useEffect(() => {
    const profile = getOwnerProfile(user);
    setFormData((prev) => ({
      ...prev,
      ownerName: profile.fullName || prev.ownerName,
      ownerPhone: profile.phone || prev.ownerPhone,
      ownerAddress: profile.address || prev.ownerAddress,
      ownerSignature: profile.signature || prev.ownerSignature,
    }));

    if (profile.signature) {
      hasOwnerDrawnRef.current = true;
      setHasOwnerDrawn(true);
      if (profile.signMode) {
        setOwnerSignMode(profile.signMode);
      }
      if (profile.typedName) {
        setOwnerTypedName(profile.typedName);
      }
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = onOwnerProfileChange((updated) => {
      setFormData((prev) => ({
        ...prev,
        ownerName: updated.fullName,
        ownerPhone: updated.phone,
        ownerAddress: updated.address,
        ownerSignature: updated.signature,
      }));
      if (updated.signature) {
        hasOwnerDrawnRef.current = true;
        setHasOwnerDrawn(true);
        if (updated.signMode) setOwnerSignMode(updated.signMode);
        if (updated.typedName) setOwnerTypedName(updated.typedName);
      }
    });

    return () => unsubscribe();
  }, []);

  // When step 2 is entered with draw mode and an existing signature, draw it on the canvas
  useEffect(() => {
    if (step === 2 && ownerSignMode === 'draw' && formData.ownerSignature) {
      const canvas = ownerCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = formData.ownerSignature;
    }
  }, [step, ownerSignMode, formData.ownerSignature]);

  // 2. Flexible PG Floors & Rooms Inventory Configuration (Starts empty)
  const [pgFloors, setPgFloors] = useState<FloorSetupItem[]>([]);

  // 3. Hierarchical Rental House Floors & Units Configuration (Starts empty)
  const [rentalFloors, setRentalFloors] = useState<RentalFloorSetupItem[]>([]);

  const handleAmenityToggle = (amenityId: string) => {
    const current = formData.amenityIds || [];
    if (current.includes(amenityId)) {
      setFormData({ ...formData, amenityIds: current.filter((id) => id !== amenityId) });
    } else {
      setFormData({ ...formData, amenityIds: [...current, amenityId] });
    }
  };

  // Helper for PG room bed count (handles predefined, custom normal rooms, and dormitory halls)
  const getRoomBedCount = (room: RoomSetupItem) => {
    if (room.category === 'CUSTOM_NORMAL' || room.category === 'DORMITORY') {
      return Math.max(1, Number(room.customBeds) || (room.category === 'DORMITORY' ? 8 : 5));
    }
    return BEDS_PER_SHARING[room.sharingType] || 1;
  };

  // PG Floor & Room Handlers
  const handleAddFloor = () => {
    const validFloors = pgFloors
      .map((f) => Number(f.floorNumber))
      .filter((n) => !isNaN(n) && isFinite(n));
    const nextFloorNum = validFloors.length > 0 ? Math.max(...validFloors) + 1 : 1;
    const newFloor: FloorSetupItem = {
      id: `floor-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      floorNumber: nextFloorNum,
      name: nextFloorNum === 0 ? 'Ground Floor' : `Floor ${nextFloorNum}`,
      rooms: [
        {
          id: `room-${Date.now()}-1`,
          roomNumber: `${nextFloorNum}01`,
          category: 'DOUBLE',
          sharingType: RoomSharingType.DOUBLE,
          customBeds: 2,
          isAc: false,
          baseRent: 8500,
          securityDeposit: 17000,
        },
      ],
    };
    setPgFloors([...pgFloors, newFloor]);
  };

  const handleRemoveFloor = (floorId: string) => {
    const remaining = pgFloors.filter((f) => f.id !== floorId);
    const reordered = remaining.map((f, fIdx) => {
      const newFloorNum = fIdx + 1;
      const updatedRooms = f.rooms.map((r, rIdx) => {
        const count = rIdx + 1;
        return {
          ...r,
          roomNumber: `${newFloorNum}${count < 10 ? '0' + count : count}`,
        };
      });
      return {
        ...f,
        floorNumber: newFloorNum,
        name: newFloorNum === 0 ? 'Ground Floor' : `Floor ${newFloorNum}`,
        rooms: updatedRooms,
      };
    });
    setPgFloors(reordered);
  };

  const handleUpdateFloor = (floorId: string, field: 'name' | 'floorNumber', value: any) => {
    setPgFloors(
      pgFloors.map((f) => {
        if (f.id === floorId) {
          if (field === 'floorNumber') {
            const raw = value;
            const newFloorNum = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
            const updatedRooms = f.rooms.map((r, idx) => {
              const count = idx + 1;
              return {
                ...r,
                roomNumber: `${newFloorNum}${count < 10 ? '0' + count : count}`,
              };
            });
            return {
              ...f,
              floorNumber: newFloorNum,
              name: newFloorNum === 0 ? 'Ground Floor' : `Floor ${newFloorNum}`,
              rooms: updatedRooms,
            };
          }
          return { ...f, [field]: value };
        }
        return f;
      })
    );
  };

  const handleAddRoom = (floorId: string) => {
    setPgFloors(
      pgFloors.map((f) => {
        if (f.id === floorId) {
          const count = f.rooms.length + 1;
          const suggestedNumber = `${f.floorNumber}${count < 10 ? '0' + count : count}`;
          const newRoom: RoomSetupItem = {
            id: `room-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            roomNumber: suggestedNumber,
            category: 'DOUBLE',
            sharingType: RoomSharingType.DOUBLE,
            customBeds: 2,
            isAc: false,
            baseRent: 8500,
            securityDeposit: 17000,
          };
          return { ...f, rooms: [...f.rooms, newRoom] };
        }
        return f;
      })
    );
  };

  const handleRemoveRoom = (floorId: string, roomId: string) => {
    setPgFloors(
      pgFloors.map((f) => {
        if (f.id === floorId) {
          if (f.rooms.length <= 1) return f;
          const remaining = f.rooms.filter((r) => r.id !== roomId);
          const reordered = remaining.map((r, idx) => {
            const count = idx + 1;
            const newRoomNum = `${f.floorNumber}${count < 10 ? '0' + count : count}`;
            return {
              ...r,
              roomNumber: newRoomNum,
            };
          });
          return { ...f, rooms: reordered };
        }
        return f;
      })
    );
  };

  const handleUpdateRoom = (
    floorId: string,
    roomId: string,
    field: keyof RoomSetupItem,
    value: any
  ) => {
    setPgFloors(
      pgFloors.map((f) => {
        if (f.id === floorId) {
          return {
            ...f,
            rooms: f.rooms.map((r) => {
              if (r.id === roomId) {
                const updated = { ...r, [field]: value };
                if (field === 'category') {
                  const cat = value as RoomCategory;
                  if (cat === 'SINGLE') {
                    updated.sharingType = RoomSharingType.SINGLE;
                    updated.customBeds = 1;
                  } else if (cat === 'DOUBLE') {
                    updated.sharingType = RoomSharingType.DOUBLE;
                    updated.customBeds = 2;
                  } else if (cat === 'TRIPLE') {
                    updated.sharingType = RoomSharingType.TRIPLE;
                    updated.customBeds = 3;
                  } else if (cat === 'FOUR_SHARING') {
                    updated.sharingType = RoomSharingType.FOUR_SHARING;
                    updated.customBeds = 4;
                  } else if (cat === 'CUSTOM_NORMAL') {
                    updated.sharingType = RoomSharingType.FOUR_SHARING;
                    updated.customBeds = r.customBeds && r.customBeds > 0 ? r.customBeds : 5;
                  } else if (cat === 'DORMITORY') {
                    updated.sharingType = RoomSharingType.DORMITORY;
                    updated.customBeds = r.customBeds && r.customBeds > 0 ? r.customBeds : 8;
                  }
                }
                return updated;
              }
              return r;
            }),
          };
        }
        return f;
      })
    );
  };

  // Rental House Floor & House Handlers
  const handleAddRentalFloor = () => {
    const validFloors = rentalFloors
      .map((f) => Number(f.floorNumber))
      .filter((n) => !isNaN(n) && isFinite(n));
    const nextFloorNum = validFloors.length > 0 ? Math.max(...validFloors) + 1 : 1;
    const newFloor: RentalFloorSetupItem = {
      id: `rfloor-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      floorNumber: nextFloorNum,
      name: nextFloorNum === 0 ? 'Ground Floor' : `Floor ${nextFloorNum}`,
      houses: [
        {
          id: `house-${Date.now()}-1`,
          houseNumber: `Flat ${nextFloorNum}01`,
          bhkType: '2BHK',
          monthlyRent: 25000,
          securityDeposit: 75000,
        },
      ],
    };
    setRentalFloors([...rentalFloors, newFloor]);
  };

  const handleRemoveRentalFloor = (floorId: string) => {
    const remaining = rentalFloors.filter((f) => f.id !== floorId);
    const reordered = remaining.map((f, fIdx) => {
      const newFloorNum = fIdx + 1;
      const updatedHouses = f.houses.map((h, hIdx) => {
        const count = hIdx + 1;
        return {
          ...h,
          houseNumber: `Flat ${newFloorNum}${count < 10 ? '0' + count : count}`,
        };
      });
      return {
        ...f,
        floorNumber: newFloorNum,
        name: newFloorNum === 0 ? 'Ground Floor' : `Floor ${newFloorNum}`,
        houses: updatedHouses,
      };
    });
    setRentalFloors(reordered);
  };

  const handleUpdateRentalFloor = (floorId: string, field: 'name' | 'floorNumber', value: any) => {
    setRentalFloors(
      rentalFloors.map((f) => {
        if (f.id === floorId) {
          if (field === 'floorNumber') {
            const raw = value;
            const newFloorNum = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
            const updatedHouses = f.houses.map((h, idx) => {
              const count = idx + 1;
              return {
                ...h,
                houseNumber: `Flat ${newFloorNum}${count < 10 ? '0' + count : count}`,
              };
            });
            return {
              ...f,
              floorNumber: newFloorNum,
              name: newFloorNum === 0 ? 'Ground Floor' : `Floor ${newFloorNum}`,
              houses: updatedHouses,
            };
          }
          return { ...f, [field]: value };
        }
        return f;
      })
    );
  };

  const handleAddRentalHouse = (floorId: string) => {
    setRentalFloors(
      rentalFloors.map((f) => {
        if (f.id === floorId) {
          const count = f.houses.length + 1;
          const suggestedNumber = `Flat ${f.floorNumber}${count < 10 ? '0' + count : count}`;
          const newHouse: RentalHouseItem = {
            id: `house-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            houseNumber: suggestedNumber,
            bhkType: '2BHK',
            monthlyRent: 25000,
            securityDeposit: 75000,
          };
          return { ...f, houses: [...f.houses, newHouse] };
        }
        return f;
      })
    );
  };

  const handleRemoveRentalHouse = (floorId: string, houseId: string) => {
    setRentalFloors(
      rentalFloors.map((f) => {
        if (f.id === floorId) {
          if (f.houses.length <= 1) return f;
          const remaining = f.houses.filter((h) => h.id !== houseId);
          const reordered = remaining.map((h, idx) => {
            const count = idx + 1;
            const newHouseNum = `Flat ${f.floorNumber}${count < 10 ? '0' + count : count}`;
            return {
              ...h,
              houseNumber: newHouseNum,
            };
          });
          return { ...f, houses: reordered };
        }
        return f;
      })
    );
  };

  const handleUpdateRentalHouse = (
    floorId: string,
    houseId: string,
    field: keyof RentalHouseItem,
    value: any
  ) => {
    setRentalFloors(
      rentalFloors.map((f) => {
        if (f.id === floorId) {
          return {
            ...f,
            houses: f.houses.map((h) => {
              if (h.id === houseId) {
                return { ...h, [field]: value };
              }
              return h;
            }),
          };
        }
        return f;
      })
    );
  };

  const handleNext = () => {
    setErrorMessage(null);

    // Validation per step
    if (step === 2) {
      if (!formData.name.trim() || formData.name.trim().length < 2) {
        setErrorMessage('Property Name is required (at least 2 characters).');
        return;
      }
      const cleanDesc = getCleanPropertyDescription(formData.description);
      if (!cleanDesc || cleanDesc.length < 5) {
        setErrorMessage('Property Description is required (at least 5 characters).');
        return;
      }
      if (!formData.contactPhone?.trim() || !/^[6-9]\d{9}$/.test(formData.contactPhone.trim())) {
        setErrorMessage('Manager Contact Phone is required (must be a valid 10-digit Indian mobile number).');
        return;
      }
      if (!formData.contactEmail?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail.trim())) {
        setErrorMessage('Manager Contact Email is required (valid email address).');
        return;
      }
      if (formData.noticePeriodDays === undefined || formData.noticePeriodDays === null || Number(formData.noticePeriodDays) < 0) {
        setErrorMessage('Notice Period Required is mandatory (must be 0 or more days).');
        return;
      }
      if (formData.lockInPeriodValue === undefined || formData.lockInPeriodValue === null || Number(formData.lockInPeriodValue) < 0) {
        setErrorMessage('Minimum Lock-In Period is mandatory (must be 0 or more).');
        return;
      }
      if (!formData.ownerName?.trim() || formData.ownerName.trim().length < 2) {
        setErrorMessage('Landlord / Property Owner Legal Name is required (at least 2 characters).');
        return;
      }
      if (!formData.ownerPhone?.trim() || !/^[6-9]\d{9}$/.test(formData.ownerPhone.trim())) {
        setErrorMessage('Owner WhatsApp / Contact Number is required (must be a valid 10-digit Indian mobile number).');
        return;
      }
      if (!formData.ownerAddress?.trim() || formData.ownerAddress.trim().length < 5) {
        setErrorMessage('Owner Office / Permanent Address is required (at least 5 characters).');
        return;
      }

      // Check owner digital signature
      const finalOwnerSig = formData.ownerSignature || getOwnerProfile(user).signature;
      if (!finalOwnerSig) {
        setErrorMessage('Landlord / Property Owner Digital Signature is required.');
        return;
      }
      setFormData((prev) => ({ ...prev, ownerSignature: finalOwnerSig }));
    }

    if (step === 3) {
      if (!formData.address.trim()) {
        setErrorMessage('Street address is required.');
        return;
      }
      if (!formData.city.trim()) {
        setErrorMessage('City is required.');
        return;
      }
      if (!formData.state.trim()) {
        setErrorMessage('State is required.');
        return;
      }
      if (!/^[1-9][0-9]{5}$/.test(formData.postalCode.trim())) {
        setErrorMessage('Please enter a valid 6-digit Indian PIN code (e.g. 560102).');
        return;
      }
    }

    if (step === 5) {
      if (formData.propertyType === PropertyType.PG) {
        if (pgFloors.length === 0) {
          setErrorMessage('Please add at least one floor to your PG property.');
          return;
        }
        for (const f of pgFloors) {
          if (!f.name.trim()) {
            setErrorMessage('All floors must have a valid floor name.');
            return;
          }
          if (f.rooms.length === 0) {
            setErrorMessage(`Floor "${f.name}" must have at least one room.`);
            return;
          }
          for (const r of f.rooms) {
            if (!r.roomNumber.trim()) {
              setErrorMessage(`All rooms on "${f.name}" must have a room number.`);
              return;
            }
            if (Number(r.baseRent) <= 0) {
              setErrorMessage(`Room "${r.roomNumber}" on "${f.name}" must have a valid base rent.`);
              return;
            }
            if (Number(r.securityDeposit) < 0) {
              setErrorMessage(`Room "${r.roomNumber}" on "${f.name}" cannot have negative deposit.`);
              return;
            }
            if (
              (r.category === 'CUSTOM_NORMAL' || r.category === 'DORMITORY') &&
              (Number(r.customBeds) || 0) < 1
            ) {
              setErrorMessage(`Room "${r.roomNumber}" must have at least 1 bed configured.`);
              return;
            }
          }
        }
      } else {
        if (rentalFloors.length === 0) {
          setErrorMessage('Please add at least one floor to your rental property.');
          return;
        }
        for (const f of rentalFloors) {
          if (!f.name.trim()) {
            setErrorMessage('All floors must have a valid floor name.');
            return;
          }
          if (f.houses.length === 0) {
            setErrorMessage(`Floor "${f.name}" must have at least one house / flat.`);
            return;
          }
          for (const h of f.houses) {
            if (!h.houseNumber.trim()) {
              setErrorMessage(`All houses on "${f.name}" must have a house identifier (e.g. Flat 101).`);
              return;
            }
            if (Number(h.monthlyRent) <= 0) {
              setErrorMessage(`House "${h.houseNumber}" on "${f.name}" must have a valid monthly rent.`);
              return;
            }
            if (Number(h.securityDeposit) < 0) {
              setErrorMessage(`House "${h.houseNumber}" on "${f.name}" cannot have negative deposit.`);
              return;
            }
          }
        }
      }
    }

    setStep((s) => Math.min(6, s + 1));
  };

  const handlePrevious = () => {
    setErrorMessage(null);
    setStep((s) => Math.max(1, s - 1));
  };

  // Calculations for PG
  const totalPgFloors = pgFloors.length;
  const totalPgRooms = pgFloors.reduce((acc, f) => acc + f.rooms.length, 0);
  const totalPgBeds = pgFloors.reduce(
    (acc, f) => acc + f.rooms.reduce((rAcc, r) => rAcc + getRoomBedCount(r), 0),
    0
  );
  const totalPgMonthlyRevenue = pgFloors.reduce(
    (acc, f) =>
      acc +
      f.rooms.reduce(
        (rAcc, r) => rAcc + getRoomBedCount(r) * (Number(r.baseRent) || 0),
        0
      ),
    0
  );
  const totalPgSecurityDeposit = pgFloors.reduce(
    (acc, f) =>
      acc +
      f.rooms.reduce(
        (rAcc, r) => rAcc + getRoomBedCount(r) * (Number(r.securityDeposit) || 0),
        0
      ),
    0
  );

  // Calculations for Rental House
  const totalRentalFloors = rentalFloors.length;
  const totalRentalUnitsCount = rentalFloors.reduce((acc, f) => acc + f.houses.length, 0);
  const totalRentalMonthlyRevenue = rentalFloors.reduce(
    (acc, f) => acc + f.houses.reduce((hAcc, h) => hAcc + (Number(h.monthlyRent) || 0), 0),
    0
  );
  const totalRentalSecurityDeposit = rentalFloors.reduce(
    (acc, f) => acc + f.houses.reduce((hAcc, h) => hAcc + (Number(h.securityDeposit) || 0), 0),
    0
  );

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setSubmissionProgress('Creating property record...');

    try {
      // 1. Create Property
      const payload: CreatePropertyDto = {
        ...formData,
        name: formData.name.trim(),
        description: getCleanPropertyDescription(formData.description).trim() || '',
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        postalCode: formData.postalCode.trim(),
        contactPhone: formData.contactPhone?.trim() || undefined,
        contactEmail: formData.contactEmail?.trim() || undefined,
        ownerName: formData.ownerName?.trim() || undefined,
        ownerAddress: formData.ownerAddress?.trim() || undefined,
        ownerPhone: formData.ownerPhone?.trim() || undefined,
        ownerSignature: formData.ownerSignature || (ownerSignMode === 'type' && ownerTypedName.trim() ? `TYPE:${ownerTypedName.trim()}` : undefined),
        noticePeriodDays: Number(formData.noticePeriodDays ?? 30),
        lockInPeriodValue: Number(formData.lockInPeriodValue ?? 1),
        lockInPeriodUnit: formData.lockInPeriodUnit || 'MONTHS',
        lockInMonths: formData.lockInPeriodUnit === 'YEARS' ? Number(formData.lockInPeriodValue || 1) * 12 : Number(formData.lockInPeriodValue || 1),
        latitude: formData.latitude ? Number(formData.latitude) : undefined,
        longitude: formData.longitude ? Number(formData.longitude) : undefined,
      };

      const res = await fetch(`${API_BASE}/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const json: ApiResponse<PropertyDto> = await res.json();

      if (!res.ok || !json.success || !json.data) {
        const errorDetail = json.error?.details?.[0]?.message;
        setErrorMessage(errorDetail || json.error?.message || 'Failed to create property.');
        setIsSubmitting(false);
        return;
      }

      const propertyId = json.data.id;

      // 2. Initialize Inventory Structures
      if (formData.propertyType === PropertyType.PG) {
        setSubmissionProgress('Initializing customized PG floors, rooms & auto-generating beds...');

        for (const floor of pgFloors) {
          setSubmissionProgress(`Configuring ${floor.name} and rooms...`);
          // Create Floor
          const floorRes = await fetch(`${API_BASE}/properties/${propertyId}/floors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              floorNumber: Number(floor.floorNumber) || 1,
              name: floor.name.trim() || `Floor ${floor.floorNumber}`,
            }),
          });

          if (floorRes.ok) {
            const floorJson = await floorRes.json();
            const floorId = floorJson.data?.id;

            if (floorId) {
              // Create Rooms for this floor
              for (const room of floor.rooms) {
                const bedCount = getRoomBedCount(room);
                const roomTypeLabel =
                  room.category === 'DORMITORY'
                    ? `Dormitory (${bedCount} Beds)`
                    : room.category === 'CUSTOM_NORMAL'
                    ? `Custom Room (${bedCount} Beds)`
                    : `${room.sharingType} Sharing Room`;

                await fetch(`${API_BASE}/properties/${propertyId}/rooms`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    floorId,
                    roomNumber: room.roomNumber.trim(),
                    sharingType: room.category === 'DORMITORY' ? RoomSharingType.DORMITORY : room.sharingType,
                    capacity: bedCount,
                    baseRent: Number(room.baseRent) || 8500,
                    amenities: room.isAc ? ['ac'] : [],
                    description: `${roomTypeLabel} (${room.isAc ? 'AC' : 'Non-AC'}) • ${room.roomNumber}`,
                  }),
                });
              }
            }
          }
        }
      } else {
        // Whole-Unit Rental House: Create Units hierarchical by floor
        setSubmissionProgress('Initializing residential rental houses & floors...');
        for (const floor of rentalFloors) {
          for (const house of floor.houses) {
            await fetch(`${API_BASE}/properties/${propertyId}/units`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                unitNumber: house.houseNumber.trim(),
                unitType: house.bhkType,
                floorNumber: Number(floor.floorNumber) || 1,
                monthlyRent: Number(house.monthlyRent) || 20000,
                securityDeposit: Number(house.securityDeposit) || 60000,
                description: `${house.bhkType} Unit • ${house.houseNumber} on ${floor.name}`,
              }),
            });
          }
        }
      }

      setSubmissionProgress('Finalizing setup and redirecting...');
      router.push(`/properties/${propertyId}`);
    } catch {
      setErrorMessage('Network error while initializing property and inventory.');
      setIsSubmitting(false);
    }
  };

  const stepsList = [
    { num: 1, title: 'Operating Model' },
    { num: 2, title: 'Basic Info' },
    { num: 3, title: 'Location' },
    { num: 4, title: 'Amenities' },
    { num: 5, title: formData.propertyType === PropertyType.PG ? 'Beds & Rooms' : 'Floors & Houses' },
    { num: 6, title: 'Review & Confirm' },
  ];

  if (!authLoading && !isAuthenticated) {
    return (
      <AppShell activePath="/properties">
        <div className="max-w-2xl mx-auto my-12 text-center bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-sm animate-fadeIn">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-200/80 text-brand-teal flex items-center justify-center mx-auto mb-6">
            <Building2 className="w-8 h-8" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold uppercase tracking-wider mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Authorized Action Only</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-3">
            Sign In to Create New Property
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-md mx-auto leading-relaxed mb-8">
            Property registration, room inventory setup, and landlord legal binding require an authenticated property owner session.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <Link
              href="/login?returnUrl=/properties/new"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-teal hover:bg-teal-700 text-white font-bold text-sm shadow-md shadow-teal-700/10 transition"
            >
              <span>Sign In to Continue</span>
            </Link>
            <Link
              href="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm border border-slate-300 transition"
            >
              <span>Register New Account</span>
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activePath="/properties">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation Breadcrumb & Back Button */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-surface-textSecondary">
            <Link href="/properties" className="hover:text-brand-navy font-medium">
              Properties
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-brand-navy font-semibold">New Property</span>
          </div>

          <BackButton fallbackHref="/properties" label="Back to Properties" />
        </div>

        {/* Header Banner */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-brand-teal" />
            Add New Property & Initialize Inventory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Register your property with automatic floor, room, bed, or unit structure setup in one seamless workflow.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="bg-brand-white p-4 rounded-xl border border-surface-border shadow-sm">
          <div className="flex items-center justify-between">
            {stepsList.map((s, index) => (
              <React.Fragment key={s.num}>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      step === s.num
                        ? 'bg-brand-teal text-brand-white shadow-sm'
                        : step > s.num
                        ? 'bg-teal-50 text-brand-teal border border-teal-200'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                  </div>
                  <span
                    className={`text-xs font-semibold hidden md:inline ${
                      step === s.num ? 'text-brand-navy font-bold' : 'text-surface-textSecondary'
                    }`}
                  >
                    {s.title}
                  </span>
                </div>
                {index < stepsList.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 hidden sm:block ${
                      step > s.num ? 'bg-brand-teal' : 'bg-slate-200'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-300 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-brand-navy shrink-0 mt-0.5" />
            <div className="text-xs text-brand-navy leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Step Form Container */}
        <div className="bg-brand-white rounded-2xl border border-surface-border p-8 shadow-sm">
          {/* STEP 1: OPERATING MODEL */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-brand-navy">Select Operating Model</h2>
                <p className="text-xs text-surface-textSecondary mt-1">
                  How will this property be operated? Choose between bed-level PG sharing or full unit leasing.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* PG / Co-Living Option */}
                <div
                  onClick={() => setFormData({ ...formData, propertyType: PropertyType.PG })}
                  className={`p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                    formData.propertyType === PropertyType.PG
                      ? 'border-brand-teal bg-teal-50/20 shadow-md ring-1 ring-brand-teal'
                      : 'border-surface-border hover:border-slate-300 bg-brand-white'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 text-brand-teal flex items-center justify-center">
                      <BedDouble className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-brand-navy">PG / Co-Living / Hostel</h3>
                        {formData.propertyType === PropertyType.PG && (
                          <CheckCircle2 className="w-5 h-5 text-brand-teal" />
                        )}
                      </div>
                      <p className="text-xs text-surface-textSecondary mt-2 leading-relaxed">
                        Best for shared accommodation, student hostels, and co-living facilities with per-bed pricing.
                      </p>
                    </div>
                    <ul className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-700">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                        Instant floor, room & bed inventory generator
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                        Meal plan & mess management support
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                        Fixed electricity-inclusive rent options
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Whole-Unit Rental Option */}
                <div
                  onClick={() => setFormData({ ...formData, propertyType: PropertyType.RENTAL_HOUSE })}
                  className={`p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                    formData.propertyType === PropertyType.RENTAL_HOUSE
                      ? 'border-blue-600 bg-blue-50/20 shadow-md ring-1 ring-blue-600'
                      : 'border-surface-border hover:border-slate-300 bg-brand-white'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
                      <Home className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-brand-navy">Whole-Unit Rental House</h3>
                        {formData.propertyType === PropertyType.RENTAL_HOUSE && (
                          <CheckCircle2 className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                      <p className="text-xs text-surface-textSecondary mt-2 leading-relaxed">
                        Best for apartments, flats, independent villas, and residential units leased as full homes.
                      </p>
                    </div>
                    <ul className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-700">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        Quick unit-level inventory builder (1BHK, 2BHK, 3BHK)
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        Security deposit & deduction tracking
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        Annual rent escalation schedules
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: BASIC INFO */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-brand-navy">Basic Information</h2>
                <p className="text-xs text-surface-textSecondary mt-1">
                  Specify display name, description, and primary property manager contact.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-brand-navy">
                    Property Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. GreenGlen PG Residency or Indiranagar Heights"
                    className="mt-1 block w-full px-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-brand-navy">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the property, landmarks, or target audience (min 5 characters)..."
                    className="mt-1 block w-full px-3.5 py-2 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-brand-navy">
                      Manager Contact Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.contactPhone || ''}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      placeholder="e.g. 9845012345 (10 digits)"
                      className="mt-1 block w-full px-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-brand-navy">
                      Manager Contact Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.contactEmail || ''}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      placeholder="e.g. manager@property.in"
                      className="mt-1 block w-full px-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
                    />
                  </div>
                </div>

                {/* STANDARD TENANCY AGREEMENT TERMS & COVENANTS SECTION */}
                <div className="p-5 rounded-2xl bg-amber-50/40 border border-amber-200/90 space-y-4 shadow-2xs mt-4">
                  <div className="flex items-center justify-between border-b border-amber-200/70 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                        <Shield className="w-4.5 h-4.5 text-amber-700" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">
                          Standard Tenancy Agreement Terms & Rules
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Configure statutory notice and lock-in covenants automatically enforced on every tenancy contract.
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      Legally Binding
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Notice Period Required (Days) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="365"
                          required
                          value={formData.noticePeriodDays ?? 30}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              noticePeriodDays: e.target.value === '' ? ('' as any) : Math.max(0, parseInt(e.target.value, 10) || 0),
                            })
                          }
                          placeholder="e.g. 30"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                        />
                        <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-500 pointer-events-none">
                          Days
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Mandatory notice resident must serve prior to vacating (default: 30 days).
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Minimum Lock-In Period <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="120"
                          required
                          value={formData.lockInPeriodValue ?? 1}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              lockInPeriodValue: e.target.value === '' ? ('' as any) : Math.max(0, parseInt(e.target.value, 10) || 0),
                            })
                          }
                          placeholder="e.g. 1"
                          className="w-24 px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-brand-teal"
                        />
                        <select
                          value={formData.lockInPeriodUnit || 'MONTHS'}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              lockInPeriodUnit: e.target.value as 'DAYS' | 'MONTHS' | 'YEARS',
                            })
                          }
                          className="flex-1 px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                        >
                          <option value="DAYS">Day(s)</option>
                          <option value="MONTHS">Month(s)</option>
                          <option value="YEARS">Year(s)</option>
                        </select>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Minimum duration before resident can terminate without deposit forfeiture (default: 1 Month).
                      </p>
                    </div>
                  </div>
                </div>

                {/* OWNER / LANDLORD DETAILS & LEGAL E-SIGNATURE SECTION */}
                <div className="p-5 rounded-2xl bg-teal-50/40 border border-teal-200/90 space-y-4 shadow-2xs mt-4">
                  <div className="flex items-center justify-between border-b border-teal-200/70 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-teal-100 text-brand-teal flex items-center justify-center font-bold">
                        <FileSignature className="w-4.5 h-4.5 text-teal-700" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">
                          Landlord / Property Owner Profile & Digital Signature
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Pre-embeds your signature automatically onto every legal tenancy agreement generated for this property.
                        </p>
                      </div>
                    </div>
                    
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Owner / Landlord Legal Name 
                      </label>
                      <input
                        type="text"
                        readOnly
                        tabIndex={-1}
                        value={formData.ownerName || ''}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-default select-none focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Owner WhatsApp / Contact Number 
                      </label>
                      <input
                        type="tel"
                        readOnly
                        tabIndex={-1}
                        value={formData.ownerPhone || ''}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-default select-none focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Owner Office / Permanent Address 
                      </label>
                      <input
                        type="text"
                        readOnly
                        tabIndex={-1}
                        value={formData.ownerAddress || ''}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-default select-none focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Owner Signature Non-Editable Display */}
                  <div className="pt-2 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <PenTool className="w-3.5 h-3.5 text-brand-teal" />
                        Owner Digital Signature 
                      </span>
                    </div>

                    <div className={`relative rounded-2xl bg-white border-2 overflow-hidden shadow-inner flex items-center justify-center p-3 h-44 sm:h-52 ${
                      formData.propertyType === PropertyType.RENTAL_HOUSE ? 'border-blue-300' : 'border-teal-300'
                    }`}>
                      {formData.ownerSignature ? (
                        formData.ownerSignature.startsWith('data:image/') ? (
                          <img
                            src={formData.ownerSignature}
                            alt="Owner Digital Signature"
                            className="h-full w-full object-contain pointer-events-none select-none"
                          />
                        ) : formData.ownerSignature.startsWith('TYPE:') ? (
                          <div className="font-sans font-semibold text-slate-800 text-xl tracking-wide select-none">
                            {formData.ownerSignature.replace('TYPE:', '')}
                          </div>
                        ) : (
                          <img
                            src={formData.ownerSignature}
                            alt="Owner Digital Signature"
                            className="h-full w-full object-contain pointer-events-none select-none"
                          />
                        )
                      ) : (
                        <div className="flex items-center justify-center pointer-events-none text-slate-400 text-xs sm:text-sm italic">
                          No digital signature configured in profile
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: LOCATION */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-brand-navy">Location & Address</h2>
                <p className="text-xs text-surface-textSecondary mt-1">
                  Specify street address, locality, city, state, and postal code.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-brand-navy">
                    Street Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="e.g. #42, 14th Main Road, Sector 4"
                    className="mt-1 block w-full px-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-brand-navy">Locality / Area</label>
                    <input
                      type="text"
                      value={formData.locality || ''}
                      onChange={(e) => setFormData({ ...formData, locality: e.target.value })}
                      placeholder="e.g. HSR Layout or Koramangala"
                      className="mt-1 block w-full px-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-brand-navy">
                      PIN Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      placeholder="e.g. 560102"
                      className="mt-1 block w-full px-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-brand-navy">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="e.g. Bengaluru"
                      className="mt-1 block w-full px-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-brand-navy">
                      State <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      placeholder="e.g. Karnataka"
                      className="mt-1 block w-full px-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: AMENITIES */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-brand-navy">Property Amenities</h2>
                <p className="text-xs text-surface-textSecondary mt-1">
                  Select available utilities, facilities, and services at this property.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {STANDARD_AMENITIES_CATALOG.map((amenity) => {
                  const isSelected = formData.amenityIds?.includes(amenity.id);
                  const Icon = ICON_MAP[amenity.icon] || Sparkles;

                  return (
                    <div
                      key={amenity.id}
                      onClick={() => handleAmenityToggle(amenity.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-150 flex flex-col justify-between ${
                        isSelected
                          ? 'border-brand-teal bg-teal-50/40 text-brand-navy shadow-sm'
                          : 'border-surface-border hover:border-slate-300 bg-brand-white text-surface-textSecondary'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Icon
                          className={`w-5 h-5 ${isSelected ? 'text-brand-teal' : 'text-slate-400'}`}
                        />
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-brand-teal" />}
                      </div>
                      <div className="mt-3">
                        <p className="text-xs font-semibold leading-snug">{amenity.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{amenity.category}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 5: INVENTORY SETUP (PG BEDS & ROOMS OR RENTAL UNITS) */}
          {step === 5 && (
            <div className="space-y-6">
              {formData.propertyType === PropertyType.PG ? (
                /* CUSTOMIZED PG FLOORS & ROOMS BUILDER */
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-brand-navy flex items-center gap-2">
                        <BedDouble className="w-5 h-5 text-brand-teal" />
                        Configure PG Floors, Rooms & Beds
                      </h2>
                      <p className="text-xs text-surface-textSecondary mt-1">
                        Add floors, customize room numbers, select standard or custom sharing capacities for normal rooms and dormitories, set AC, and configure rent & security deposit.
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddFloor}
                      className="gap-1 text-xs font-semibold shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Floor
                    </Button>
                  </div>

                  {pgFloors.length === 0 ? (
                    /* EMPTY STATE FOR PG FLOORS */
                    <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50">
                      <div className="w-12 h-12 rounded-2xl bg-teal-50 text-brand-teal border border-teal-200 flex items-center justify-center mx-auto mb-3 shadow-xs">
                        <Layers className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-800">No Floors Added Yet</h3>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                        Start building your PG structure by clicking the button below to add your first floor level and custom rooms.
                      </p>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleAddFloor}
                        className="gap-1.5 font-semibold shadow-xs"
                      >
                        <Plus className="w-4 h-4" />
                        Add First Floor
                      </Button>
                    </div>
                  ) : (
                    /* FLOORS LIST */
                    <div className="space-y-5">
                      {pgFloors.map((floor) => {
                        const floorBedCount = floor.rooms.reduce(
                          (acc, r) => acc + getRoomBedCount(r),
                          0
                        );
                        const floorRentTotal = floor.rooms.reduce(
                          (acc, r) => acc + getRoomBedCount(r) * (Number(r.baseRent) || 0),
                          0
                        );
                        const floorDepositTotal = floor.rooms.reduce(
                          (acc, r) => acc + getRoomBedCount(r) * (Number(r.securityDeposit) || 0),
                          0
                        );

                        return (
                          <div
                            key={floor.id}
                            className="rounded-2xl border border-surface-border bg-white shadow-2xs overflow-hidden"
                          >
                            {/* Floor Card Header */}
                            <div className="bg-slate-50/80 px-4 py-3.5 border-b border-surface-border space-y-2.5">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 flex-wrap">
                                  <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-brand-teal flex items-center justify-center font-bold text-xs shrink-0">
                                    <Layers className="w-4 h-4" />
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-bold text-slate-600 whitespace-nowrap">Floor Level:</span>
                                      <input
                                        type="number"
                                        min="0"
                                        max="50"
                                        value={floor.floorNumber}
                                        onChange={(e) => handleUpdateFloor(floor.id, 'floorNumber', Number(e.target.value) || 0)}
                                        className="w-14 px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-teal"
                                      />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-bold text-slate-600 whitespace-nowrap">Floor Name:</span>
                                      <input
                                        type="text"
                                        value={floor.name}
                                        onChange={(e) => handleUpdateFloor(floor.id, 'name', e.target.value)}
                                        placeholder={`Floor ${floor.floorNumber}`}
                                        className="w-36 px-2.5 py-1 text-xs font-bold text-brand-navy bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-teal"
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAddRoom(floor.id)}
                                    className="gap-1.5 text-xs font-semibold px-3 py-1.5 bg-white whitespace-nowrap shrink-0 h-8 border-teal-200 text-brand-teal hover:bg-teal-50"
                                  >
                                    <Plus className="w-3.5 h-3.5 shrink-0" />
                                    <span>Add Room</span>
                                  </Button>

                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFloor(floor.id)}
                                    title="Remove this floor"
                                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition shrink-0"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-brand-teal border border-teal-200 inline-flex items-center">
                                  {floor.rooms.length} {floor.rooms.length === 1 ? 'Room' : 'Rooms'} • {floorBedCount} Beds Ready (₹{floorRentTotal.toLocaleString('en-IN')}/mo • ₹{floorDepositTotal.toLocaleString('en-IN')} Dep.)
                                </span>
                              </div>
                            </div>

                            {/* Rooms Table */}
                            <div className="p-4">
                              <table className="w-full text-left text-xs border-collapse table-auto">
                                <thead>
                                  <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    <th className="pb-2 pl-1 w-[13%]">Room No.</th>
                                    <th className="pb-2 w-[31%]">Sharing Type / Beds</th>
                                    <th className="pb-2 w-[14%]">Climate</th>
                                    <th className="pb-2 w-[14%]">Rent / Bed</th>
                                    <th className="pb-2 w-[14%]">Deposit / Bed</th>
                                    <th className="pb-2 w-[14%] text-right pr-1">Total Rent & Dep.</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {floor.rooms.map((room) => {
                                    const bedCount = getRoomBedCount(room);
                                    const totalRoomRent = bedCount * (Number(room.baseRent) || 0);
                                    const totalRoomDeposit = bedCount * (Number(room.securityDeposit) || 0);

                                    return (
                                      <tr key={room.id} className="hover:bg-slate-50/50 transition">
                                        <td className="py-2.5 pl-1 pr-2">
                                          <input
                                            type="text"
                                            value={room.roomNumber}
                                            onChange={(e) =>
                                              handleUpdateRoom(floor.id, room.id, 'roomNumber', e.target.value)
                                            }
                                            placeholder="Room No"
                                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-teal"
                                          />
                                        </td>
                                        <td className="py-2.5 pr-2">
                                          <div className="flex items-center gap-1.5">
                                            <select
                                              value={room.category || 'DOUBLE'}
                                              onChange={(e) =>
                                                handleUpdateRoom(
                                                  floor.id,
                                                  room.id,
                                                  'category',
                                                  e.target.value as RoomCategory
                                                )
                                              }
                                              className="w-full min-w-0 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-teal"
                                            >
                                              <option value="SINGLE">Single (1 Bed)</option>
                                              <option value="DOUBLE">Double (2 Beds)</option>
                                              <option value="TRIPLE">Triple (3 Beds)</option>
                                              <option value="FOUR_SHARING">Quad (4 Beds)</option>
                                              <option value="CUSTOM_NORMAL">Custom Beds</option>
                                              <option value="DORMITORY">Custom Dormitory</option>
                                            </select>

                                            {(room.category === 'CUSTOM_NORMAL' || room.category === 'DORMITORY') && (
                                              <div className="flex items-center gap-1 shrink-0">
                                                <input
                                                  type="number"
                                                  min="1"
                                                  max="50"
                                                  value={room.customBeds === 0 ? '' : (room.customBeds ?? (room.category === 'DORMITORY' ? 8 : 5))}
                                                  onFocus={(e) => e.target.select()}
                                                  onChange={(e) => {
                                                    const v = e.target.value;
                                                    handleUpdateRoom(
                                                      floor.id,
                                                      room.id,
                                                      'customBeds',
                                                      v === '' ? '' : Math.max(1, Number(v))
                                                    );
                                                  }}
                                                  className={`w-14 px-1.5 py-1.5 border rounded-lg text-xs font-bold text-center focus:outline-none focus:ring-1 ${
                                                    room.category === 'DORMITORY'
                                                      ? 'bg-amber-50/70 border-amber-300 text-amber-900 focus:ring-amber-500'
                                                      : 'bg-teal-50/70 border-teal-300 text-teal-900 focus:ring-teal-500'
                                                  }`}
                                                  placeholder="e.g. 5"
                                                  title={`Enter number of beds for this ${room.category === 'DORMITORY' ? 'dormitory' : 'room'}`}
                                                />
                                                <span className={`text-[10px] font-bold ${room.category === 'DORMITORY' ? 'text-amber-700' : 'text-teal-700'}`}>
                                                  Beds
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </td>
                                        <td className="py-2.5 pr-2">
                                          <select
                                            value={room.isAc ? 'AC' : 'NON_AC'}
                                            onChange={(e) =>
                                              handleUpdateRoom(floor.id, room.id, 'isAc', e.target.value === 'AC')
                                            }
                                            className={`w-full px-2 py-1.5 rounded-lg text-xs font-bold border transition ${
                                              room.isAc
                                                ? 'bg-teal-50 text-teal-700 border-teal-300'
                                                : 'bg-slate-50 text-slate-600 border-slate-300'
                                            }`}
                                          >
                                            <option value="NON_AC">💨 Non-AC</option>
                                            <option value="AC">❄️ AC</option>
                                          </select>
                                        </td>
                                        <td className="py-2.5 pr-2">
                                          <input
                                            type="number"
                                            min="500"
                                            value={room.baseRent === 0 ? '' : room.baseRent}
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => {
                                              const v = e.target.value;
                                              handleUpdateRoom(
                                                floor.id,
                                                room.id,
                                                'baseRent',
                                                v === '' ? 0 : Number(v)
                                              );
                                            }}
                                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-teal"
                                          />
                                        </td>
                                        <td className="py-2.5 pr-2">
                                          <input
                                            type="number"
                                            min="0"
                                            value={room.securityDeposit === 0 ? '' : room.securityDeposit}
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => {
                                              const v = e.target.value;
                                              handleUpdateRoom(
                                                floor.id,
                                                room.id,
                                                'securityDeposit',
                                                v === '' ? 0 : Number(v)
                                              );
                                            }}
                                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-teal"
                                          />
                                        </td>
                                        <td className="py-2.5 pr-2">
                                          <div className="relative w-full">
                                            <span className="absolute left-2 top-1.5 text-slate-400 font-bold text-xs">₹</span>
                                            <input
                                              type="number"
                                              min="500"
                                              step="500"
                                              value={room.baseRent}
                                              onChange={(e) =>
                                                handleUpdateRoom(
                                                  floor.id,
                                                  room.id,
                                                  'baseRent',
                                                  Number(e.target.value)
                                                )
                                              }
                                              className="w-full pl-5 pr-1.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-teal"
                                            />
                                          </div>
                                        </td>
                                        <td className="py-2.5 pr-2">
                                          <div className="relative w-full">
                                            <span className="absolute left-2 top-1.5 text-slate-400 font-bold text-xs">₹</span>
                                            <input
                                              type="number"
                                              min="0"
                                              step="500"
                                              value={room.securityDeposit}
                                              onChange={(e) =>
                                                handleUpdateRoom(
                                                  floor.id,
                                                  room.id,
                                                  'securityDeposit',
                                                  Number(e.target.value)
                                                )
                                              }
                                              className="w-full pl-5 pr-1.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-teal"
                                            />
                                          </div>
                                        </td>
                                        <td className="py-2.5 text-right pr-1">
                                          <div className="flex items-center justify-end gap-2">
                                            <div className="text-right leading-tight">
                                              <span className="text-[11px] font-bold text-slate-800 block whitespace-nowrap">
                                                {bedCount}B • ₹{totalRoomRent.toLocaleString('en-IN')}
                                              </span>
                                              <span className="text-[9px] text-slate-400 block font-medium whitespace-nowrap">
                                                Dep: ₹{totalRoomDeposit.toLocaleString('en-IN')}
                                              </span>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveRoom(floor.id, room.id)}
                                              disabled={floor.rooms.length <= 1}
                                              title={floor.rooms.length <= 1 ? 'At least 1 room required on floor' : 'Delete room'}
                                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition disabled:opacity-30 disabled:hover:text-slate-400 shrink-0"
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
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* HIERARCHICAL RENTAL FLOORS & HOUSES BUILDER */
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-brand-navy flex items-center gap-2">
                        <Home className="w-5 h-5 text-blue-600" />
                        Configure Rental Floors & Houses
                      </h2>
                      <p className="text-xs text-surface-textSecondary mt-1">
                        Add floors and create residential houses/flats with custom types, monthly rent, and security deposits.
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddRentalFloor}
                      className="gap-1 text-xs font-semibold shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Floor
                    </Button>
                  </div>

                  {rentalFloors.length === 0 ? (
                    /* EMPTY STATE FOR RENTAL FLOORS */
                    <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center mx-auto mb-3 shadow-xs">
                        <Home className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-800">No Floors Added Yet</h3>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                        Start building your rental property by clicking the button below to add your first floor level and residential houses.
                      </p>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleAddRentalFloor}
                        className="gap-1.5 font-semibold bg-blue-600 hover:bg-blue-700 shadow-xs"
                      >
                        <Plus className="w-4 h-4" />
                        Add First Floor
                      </Button>
                    </div>
                  ) : (
                    /* RENTAL FLOORS LIST */
                    <div className="space-y-5">
                      {rentalFloors.map((floor) => {
                        const floorRentTotal = floor.houses.reduce(
                          (acc, h) => acc + (Number(h.monthlyRent) || 0),
                          0
                        );
                        const floorDepositTotal = floor.houses.reduce(
                          (acc, h) => acc + (Number(h.securityDeposit) || 0),
                          0
                        );

                        return (
                          <div
                            key={floor.id}
                            className="rounded-2xl border border-surface-border bg-white shadow-2xs overflow-hidden"
                          >
                            {/* Floor Card Header */}
                            <div className="bg-slate-50/80 px-4 py-3.5 border-b border-surface-border space-y-2.5">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 flex-wrap">
                                  <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                                    <Layers className="w-4 h-4" />
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-bold text-slate-600 whitespace-nowrap">Floor Level:</span>
                                      <input
                                        type="number"
                                        min="0"
                                        max="50"
                                        value={floor.floorNumber}
                                        onChange={(e) => handleUpdateRentalFloor(floor.id, 'floorNumber', Number(e.target.value) || 0)}
                                        className="w-14 px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-bold text-slate-600 whitespace-nowrap">Floor Name:</span>
                                      <input
                                        type="text"
                                        value={floor.name}
                                        onChange={(e) => handleUpdateRentalFloor(floor.id, 'name', e.target.value)}
                                        placeholder={`Floor ${floor.floorNumber}`}
                                        className="w-36 px-2.5 py-1 text-xs font-bold text-brand-navy bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAddRentalHouse(floor.id)}
                                    className="gap-1.5 text-xs font-semibold px-3 py-1.5 bg-white whitespace-nowrap shrink-0 h-8 border-blue-200 text-blue-600 hover:bg-blue-50"
                                  >
                                    <Plus className="w-3.5 h-3.5 shrink-0" />
                                    <span>Add House</span>
                                  </Button>

                                  <button
                                    type="button"
                                    onClick={() => handleRemoveRentalFloor(floor.id)}
                                    title="Remove this floor"
                                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition shrink-0"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center">
                                  {floor.houses.length} {floor.houses.length === 1 ? 'House' : 'Houses'} • ₹{floorRentTotal.toLocaleString('en-IN')}/mo (₹{floorDepositTotal.toLocaleString('en-IN')} Dep.)
                                </span>
                              </div>
                            </div>

                            {/* Houses Table */}
                            <div className="p-4">
                              <table className="w-full text-left text-xs border-collapse table-auto">
                                <thead>
                                  <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    <th className="pb-2 pl-1 w-[26%]">House / Flat No.</th>
                                    <th className="pb-2 w-[26%]">House Type</th>
                                    <th className="pb-2 w-[22%]">Monthly Rent (₹)</th>
                                    <th className="pb-2 w-[20%]">Security Deposit (₹)</th>
                                    <th className="pb-2 w-[6%] text-right pr-1">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {floor.houses.map((house) => (
                                    <tr key={house.id} className="hover:bg-slate-50/50 transition">
                                      <td className="py-2.5 pl-1 pr-2">
                                        <input
                                          type="text"
                                          value={house.houseNumber}
                                          onChange={(e) =>
                                            handleUpdateRentalHouse(floor.id, house.id, 'houseNumber', e.target.value)
                                          }
                                          placeholder="e.g. Flat 101"
                                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                      </td>
                                      <td className="py-2.5 pr-2">
                                        <select
                                          value={house.bhkType}
                                          onChange={(e) =>
                                            handleUpdateRentalHouse(floor.id, house.id, 'bhkType', e.target.value)
                                          }
                                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        >
                                          <option value="1RK">1 RK</option>
                                          <option value="1BHK">1 BHK</option>
                                          <option value="2BHK">2 BHK</option>
                                          <option value="3BHK">3 BHK</option>
                                          <option value="4BHK">4 BHK</option>
                                          <option value="Villa">Villa</option>
                                          <option value="Penthouse">Penthouse</option>
                                          <option value="Independent House">Independent House</option>
                                        </select>
                                      </td>
                                      <td className="py-2.5 pr-2">
                                        <div className="relative w-full">
                                          <span className="absolute left-2.5 top-1.5 text-slate-400 font-bold text-xs">₹</span>
                                          <input
                                            type="number"
                                            min="1000"
                                            step="500"
                                            value={house.monthlyRent}
                                            onChange={(e) =>
                                              handleUpdateRentalHouse(
                                                floor.id,
                                                house.id,
                                                'monthlyRent',
                                                Number(e.target.value)
                                              )
                                            }
                                            className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                          />
                                        </div>
                                      </td>
                                      <td className="py-2.5 pr-2">
                                        <div className="relative w-full">
                                          <span className="absolute left-2.5 top-1.5 text-slate-400 font-bold text-xs">₹</span>
                                          <input
                                            type="number"
                                            min="0"
                                            step="1000"
                                            value={house.securityDeposit}
                                            onChange={(e) =>
                                              handleUpdateRentalHouse(
                                                floor.id,
                                                house.id,
                                                'securityDeposit',
                                                Number(e.target.value)
                                              )
                                            }
                                            className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                          />
                                        </div>
                                      </td>
                                      <td className="py-2.5 text-right pr-1">
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveRentalHouse(floor.id, house.id)}
                                          disabled={floor.houses.length <= 1}
                                          title={floor.houses.length <= 1 ? 'At least 1 house required on floor' : 'Delete house'}
                                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition disabled:opacity-30 disabled:hover:text-slate-400"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}

                      {/* Rental Summary Card */}
                      <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 flex items-center justify-between text-xs text-blue-950 flex-wrap gap-2">
                        <span className="font-bold">
                          ⚡ {totalRentalUnitsCount} Houses across {totalRentalFloors} Floors Ready to Initialize
                        </span>
                        <span>
                          Total Rent Roll: <strong>₹{totalRentalMonthlyRevenue.toLocaleString('en-IN')}/mo</strong> | Total Deposit: <strong>₹{totalRentalSecurityDeposit.toLocaleString('en-IN')}</strong>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 6: REVIEW & SUBMIT */}
          {step === 6 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-brand-navy">Review & Confirm Initialization</h2>
                <p className="text-xs text-surface-textSecondary mt-1">
                  Verify your property configuration and inventory setup before finalizing.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-surface-subtle border border-surface-border space-y-4 text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                  <span className="text-surface-textSecondary">Operating Model</span>
                  <span
                    className={`font-bold px-2.5 py-0.5 rounded-full border ${
                      formData.propertyType === PropertyType.PG
                        ? 'bg-teal-50 text-brand-teal border-teal-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}
                  >
                    {formData.propertyType === PropertyType.PG
                      ? 'PG / Co-Living'
                      : 'Whole-Unit Rental'}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                  <span className="text-surface-textSecondary">Property Name</span>
                  <strong className="text-brand-navy font-bold text-sm">{formData.name}</strong>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                  <span className="text-surface-textSecondary">Location</span>
                  <span className="text-brand-navy font-medium text-right max-w-xs">
                    {formData.address}, {formData.locality ? `${formData.locality}, ` : ''}
                    {formData.city}, {formData.state} — {formData.postalCode}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                  <span className="text-surface-textSecondary">Initial Inventory Setup</span>
                  <span className="text-brand-navy font-bold text-right">
                    {formData.propertyType === PropertyType.PG
                      ? `${totalPgFloors} Floors • ${totalPgRooms} Rooms • ${totalPgBeds} Beds (₹${totalPgMonthlyRevenue.toLocaleString('en-IN')}/mo Rent • ₹${totalPgSecurityDeposit.toLocaleString('en-IN')} Deposit)`
                      : `${totalRentalFloors} Floors • ${totalRentalUnitsCount} Houses (₹${totalRentalMonthlyRevenue.toLocaleString('en-IN')}/mo Rent • ₹${totalRentalSecurityDeposit.toLocaleString('en-IN')} Deposit)`}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                  <span className="text-surface-textSecondary">Tenancy Agreement Terms</span>
                  <span className="text-brand-navy font-bold text-right text-xs">
                    Notice: <span className="text-brand-teal">{formData.noticePeriodDays || 30} Days</span> • Lock-In: <span className="text-teal-700">{formData.lockInPeriodValue || 1} {formData.lockInPeriodUnit || 'MONTHS'}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                  <span className="text-surface-textSecondary">Landlord / Owner E-Signature</span>
                  <span className="text-brand-navy font-bold text-right flex items-center gap-1.5">
                    {formData.ownerName ? (
                      <>
                        <span className="text-slate-800">{formData.ownerName}</span>
                        {formData.ownerSignature ? (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                            ✓ E-Sign Recorded
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold border border-amber-200">
                            Digital Stamp
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-500 italic">Auto Default Management</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-surface-textSecondary">Amenities</span>
                  <span className="text-brand-navy font-semibold text-right">
                    {formData.amenityIds?.length || 0} amenities configured
                  </span>
                </div>
              </div>

              {isSubmitting && submissionProgress && (
                <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-xs text-brand-teal flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0 text-brand-teal" />
                  <span className="font-semibold">{submissionProgress}</span>
                </div>
              )}
            </div>
          )}

          {/* Wizard Action Controls */}
          <div className="mt-8 pt-6 border-t border-surface-border flex items-center justify-between">
            {step > 1 ? (
              <Button variant="outline" size="md" onClick={handlePrevious} disabled={isSubmitting}>
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
            ) : (
              <Link href="/properties">
                <Button variant="outline" size="md">
                  Cancel
                </Button>
              </Link>
            )}

            {step < 6 ? (
              <Button variant="primary" size="md" onClick={handleNext} className="gap-1 font-semibold">
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={handleSubmit}
                isLoading={isSubmitting}
                className="gap-2 font-semibold shadow-sm"
              >
                <Building2 className="w-4 h-4" />
                Create Property & Initialize Inventory
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
