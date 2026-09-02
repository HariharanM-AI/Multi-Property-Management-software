'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/lib/auth-context';
import { getLocalDateString, createLocalIsoString } from '@/lib/date-utils';
import {
  PropertyDto,
  PropertyType,
  PropertyStatus,
  FloorDto,
  RoomDto,
  BedDto,
  RentalUnitDto,
  RoomSharingType,
  BedStatus,
  RentalUnitStatus,
  STANDARD_AMENITIES_CATALOG,
  ApiResponse,
  TenantDto,
} from '@propertyos/types';
import { AgreementSignModal, AgreementSignDetails, formatIdProofDisplay } from '@/components/agreements/AgreementSignModal';
import {
  AgreementDocumentViewerModal,
  AgreementDocumentData,
} from '@/components/agreements/AgreementDocumentViewerModal';
import { downloadAgreementPdf } from '@/components/agreements/downloadAgreementPdf';
import {
  saveAgreementSignature,
  getAgreementSignature,
  getOrGenerateAgreementSignature,
  generateDigitalSignatureDataUrl,
} from '@/lib/agreementStorage';
import {
  Building2,
  BedDouble,
  Home,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
  Archive,
  RotateCcw,
  Edit,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  UploadCloud,
  Layers,
  Trash2,
  Wifi,
  Shield,
  UserCheck,
  UserPlus,
  UserMinus,
  Users,
  Shirt,
  Wind,
  Flame,
  Car,
  ArrowUpDown,
  Droplet,
  Bath,
  Dumbbell,
  Box,
  Tv,
  Utensils,
  Zap,
  Search,
  DoorOpen,
  Plus,
  X,
  Loader2,
  Info,
  Calendar,
  DollarSign,
  Key,
  Receipt,
  FileText,
  AlertTriangle,
  PhoneCall,
  Clock,
  Check,
  FileSignature,
  Share2,
  Send,
  Download,
  ExternalLink,
  MessageCircle,
  PenTool,
  Type,
  Globe,
  Tag,
  IndianRupee,
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

type RoomCategoryType = 'SINGLE' | 'DOUBLE' | 'TRIPLE' | 'FOUR_SHARING' | 'CUSTOM_NORMAL' | 'DORMITORY';

interface BuilderRoomItem {
  id: string;
  roomNumber: string;
  category: RoomCategoryType;
  sharingType: RoomSharingType;
  customBeds: number;
  isAc: boolean;
  baseRent: number;
  securityDeposit: number;
}

interface BuilderFloorItem {
  id: string;
  floorNumber: number;
  name: string;
  rooms: BuilderRoomItem[];
}

interface BuilderRentalHouseItem {
  id: string;
  houseNumber: string;
  bhkType: string;
  carpetAreaSqFt: number;
  superBuiltupAreaSqFt: number;
  furnishingStatus: string;
  monthlyRent: number;
  securityDeposit: number;
  maintenanceCharges: number;
}

interface BuilderRentalFloorItem {
  id: string;
  floorNumber: number;
  name: string;
  houses: BuilderRentalHouseItem[];
}

const BEDS_PER_SHARING_MAP: Record<string, number> = {
  SINGLE: 1,
  DOUBLE: 2,
  TRIPLE: 3,
  FOUR_SHARING: 4,
  DORMITORY: 8,
};

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params.id as string;
  const { isAuthenticated } = useAuth();

  const [property, setProperty] = useState<PropertyDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // Edit Property Details Modal State (Full Property Attributes)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editModalError, setEditModalError] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{
    name: string;
    propertyType: PropertyType;
    status: PropertyStatus;
    description: string;
    address: string;
    addressLine1: string;
    addressLine2: string;
    locality: string;
    city: string;
    district: string;
    state: string;
    country: string;
    postalCode: string;
    latitude?: number;
    longitude?: number;
    contactPhone: string;
    contactEmail: string;
    ownerName: string;
    ownerAddress: string;
    ownerPhone: string;
    ownerSignature: string;
    noticePeriodDays: number;
    lockInPeriodValue: number;
    lockInPeriodUnit: 'DAYS' | 'MONTHS' | 'YEARS';
    lockInMonths: number;
    amenityIds: string[];
  }>({
    name: '',
    propertyType: PropertyType.PG,
    status: PropertyStatus.ACTIVE,
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
    amenityIds: [],
  });

  // Edit Owner Signature State & Canvas Ref
  const [editOwnerSignMode, setEditOwnerSignMode] = useState<'draw' | 'type'>('draw');
  const [editOwnerTypedName, setEditOwnerTypedName] = useState('');
  const editOwnerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isEditOwnerDrawing, setIsEditOwnerDrawing] = useState(false);
  const [hasEditOwnerDrawn, setHasEditOwnerDrawn] = useState(false);

  // Paint existing owner signature onto edit modal canvas when open in draw mode
  useEffect(() => {
    if (
      isEditModalOpen &&
      editOwnerSignMode === 'draw' &&
      editFormData.ownerSignature &&
      !editFormData.ownerSignature.startsWith('TYPE:')
    ) {
      const canvas = editOwnerCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasEditOwnerDrawn(true);
      };
      img.src = editFormData.ownerSignature;
    }
  }, [isEditModalOpen, editOwnerSignMode, editFormData.ownerSignature]);

  const startEditOwnerDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = editOwnerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsEditOwnerDrawing(true);
    setHasEditOwnerDrawn(true);
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawEditOwner = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isEditOwnerDrawing) return;
    const canvas = editOwnerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopEditOwnerDrawing = () => {
    setIsEditOwnerDrawing(false);
    if (editOwnerCanvasRef.current && hasEditOwnerDrawn) {
      const sigData = editOwnerCanvasRef.current.toDataURL('image/png');
      setEditFormData((prev) => ({ ...prev, ownerSignature: sigData }));
    }
  };

  const clearEditOwnerCanvas = () => {
    const canvas = editOwnerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasEditOwnerDrawn(false);
    setEditFormData((prev) => ({ ...prev, ownerSignature: '' }));
  };

  const handleEditAmenityToggle = (amenityId: string) => {
    const current = editFormData.amenityIds || [];
    if (current.includes(amenityId)) {
      setEditFormData({ ...editFormData, amenityIds: current.filter((id) => id !== amenityId) });
    } else {
      setEditFormData({ ...editFormData, amenityIds: [...current, amenityId] });
    }
  };

  const handleOpenEditModal = () => {
    if (property) {
      const existingAmenityIds = (property.amenities || []).map((a: any) => {
        const match = STANDARD_AMENITIES_CATALOG.find((cat) => cat.name === a.name);
        return match ? match.id : a.id || a.name;
      });

      const currentSig = property.ownerSignature || '';
      if (currentSig.startsWith('TYPE:')) {
        setEditOwnerSignMode('type');
        setEditOwnerTypedName(currentSig.replace('TYPE:', ''));
      } else if (currentSig) {
        setEditOwnerSignMode('draw');
        setHasEditOwnerDrawn(true);
      } else {
        setEditOwnerSignMode('draw');
        setHasEditOwnerDrawn(false);
      }

      setEditFormData({
        name: property.name || '',
        propertyType: property.propertyType || PropertyType.PG,
        status: property.status || PropertyStatus.ACTIVE,
        description: property.description || '',
        address: property.address || '',
        addressLine1: property.addressLine1 || '',
        addressLine2: property.addressLine2 || '',
        locality: property.locality || '',
        city: property.city || '',
        district: property.district || '',
        state: property.state || '',
        country: property.country || 'India',
        postalCode: property.postalCode || '',
        latitude: property.latitude ?? undefined,
        longitude: property.longitude ?? undefined,
        contactPhone: property.contactPhone || '',
        contactEmail: property.contactEmail || '',
        ownerName: property.ownerName || '',
        ownerAddress: property.ownerAddress || '',
        ownerPhone: property.ownerPhone || '',
        ownerSignature: currentSig,
        noticePeriodDays: property.noticePeriodDays ?? 30,
        lockInPeriodValue: property.lockInPeriodValue ?? 1,
        lockInPeriodUnit: (property.lockInPeriodUnit as any) || 'MONTHS',
        lockInMonths: property.lockInMonths ?? 1,
        amenityIds: existingAmenityIds,
      });
      setEditModalError(null);
    }
    setIsEditModalOpen(true);
  };

  // Inventory State (Floors, Rooms, Beds for PG; Units for Rental)
  const [floors, setFloors] = useState<FloorDto[]>([]);
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [beds, setBeds] = useState<BedDto[]>([]);
  const [rentalUnits, setRentalUnits] = useState<RentalUnitDto[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  // PG Inventory Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [floorFilter, setFloorFilter] = useState('ALL');
  const [sharingFilter, setSharingFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // PG Bed Inspection Modal State
  const [selectedBed, setSelectedBed] = useState<BedDto | null>(null);
  const [selectedBedRoom, setSelectedBedRoom] = useState<RoomDto | null>(null);
  const [isUpdatingBed, setIsUpdatingBed] = useState(false);
  const [bedStatusFeedback, setBedStatusFeedback] = useState<string | null>(null);

  const [registeredTenants, setRegisteredTenants] = useState<TenantDto[]>([]);
  const [tenantSearchQuery, setTenantSearchQuery] = useState('');
  const [bedOccupantMap, setBedOccupantMap] = useState<
    Record<
      string,
      {
        tenantId?: string;
        tenantName: string;
        phone: string;
        email?: string;
        gender?: string;
        governmentId?: string;
        permanentAddress?: string;
        moveInDate: string;
        expectedCheckoutDate?: string;
        monthlyRent: number;
        securityDeposit: number;
        kycStatus: 'VERIFIED' | 'PENDING' | 'SUBMITTED';
        emergencyContactName?: string;
        emergencyContactPhone?: string;
        emergencyContactRelation?: string;
        notes?: string;
      }
    >
  >({});

  // Digital Agreement Pre-Check-In State (PG & Whole-Unit)
  const [isAgreementModalOpen, setIsAgreementModalOpen] = useState(false);
  const [executedAgreement, setExecutedAgreement] = useState<{
    signatureData: string;
    signatureType: 'DRAW' | 'TYPE' | 'CLICK_ACCEPT';
    signedAt: string;
    signerName: string;
  } | null>(null);
  const [bypassAgreementGracePeriod, setBypassAgreementGracePeriod] = useState(false);

  const [isRentalAgreementModalOpen, setIsRentalAgreementModalOpen] = useState(false);
  const [rentalExecutedAgreement, setRentalExecutedAgreement] = useState<{
    signatureData: string;
    signatureType: 'DRAW' | 'TYPE' | 'CLICK_ACCEPT';
    signedAt: string;
    signerName: string;
  } | null>(null);
  const [rentalBypassAgreementGracePeriod, setRentalBypassAgreementGracePeriod] = useState(false);

  const isRoomAcEquipped = (amenities?: string[] | null): boolean => {
    if (!amenities || !Array.isArray(amenities)) return false;
    return amenities.some((a) => {
      const s = (a || '').toLowerCase().trim();
      return s === 'ac' || s.includes('air conditioner') || s.includes('air conditioning') || s.includes('climate');
    });
  };

  const getRoomSecurityDeposit = (room: RoomDto | null | undefined, bedsList?: BedDto[]): number => {
    if (!room) return 20000;
    if ((room as any).securityDeposit && Number((room as any).securityDeposit) > 0) {
      return Number((room as any).securityDeposit);
    }
    if (room.amenities && Array.isArray(room.amenities)) {
      const depositTag = room.amenities.find((a) => typeof a === 'string' && a.startsWith('DEPOSIT:'));
      if (depositTag) {
        const val = Number(depositTag.replace('DEPOSIT:', '').trim());
        if (!isNaN(val) && val > 0) return val;
      }
    }
    if (bedsList && bedsList.length > 0) {
      const bedWithDeposit = bedsList.find((b) => (b as any).securityDeposit && Number((b as any).securityDeposit) > 0);
      if (bedWithDeposit) return Number((bedWithDeposit as any).securityDeposit);
    }
    if (Number(room.baseRent) > 0) {
      return Number(room.baseRent) * 2;
    }
    return 20000;
  };

  const calculateAge = (dobString?: string | null): string => {
    if (!dobString) return '';
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return '';
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age >= 0 ? String(age) : '';
  };

  const [checkInMode, setCheckInMode] = useState<'NEW' | 'EXISTING'>('NEW');
  const [selectedExistingTenantId, setSelectedExistingTenantId] = useState('');
  const [newTenantForm, setNewTenantForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    dateOfBirth: '',
    age: '',
    gender: 'Male',
    governmentIdType: 'Aadhaar Card',
    governmentIdNumber: '',
    documentFileName: '',
    documentFileSize: '',
    permanentAddress: '',
    permanentCity: '',
    permanentState: '',
    permanentPostalCode: '',
    occupation: '',
    employerOrCollege: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
  });
  const [checkInTerms, setCheckInTerms] = useState({
    moveInDate: getLocalDateString(),
    expectedCheckoutDate: '',
    agreedRent: 8500,
    securityDeposit: 17000,
    notes: '',
  });
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutSettlement, setCheckoutSettlement] = useState({
    moveOutDate: getLocalDateString(),
    deductions: 0,
    deductionReason: '',
    keyHandoverConfirmed: false,
    remarks: '',
  });
  const [submittingOccupancy, setSubmittingOccupancy] = useState(false);
  const [occupancyError, setOccupancyError] = useState<string | null>(null);
  const [occupancySuccess, setOccupancySuccess] = useState<string | null>(null);

  // Pre-Check-In Digital Agreement & E-Signature State
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [agreementSignatureMap, setAgreementSignatureMap] = useState<
    Record<
      string,
      {
        signerName: string;
        signerEmail?: string;
        signatureImage?: string;
        signedAt: string;
        agreementType: string;
        isSigned: boolean;
        witnesses?: Array<{
          name?: string;
          date?: string;
          address?: string;
          signature?: string;
        }>;
      }
    >
  >({});

  // Post-Allocation WhatsApp & PDF Delivery State
  const [postCheckInAgreement, setPostCheckInAgreement] = useState<{
    isOpen: boolean;
    tenantName: string;
    tenantPhone: string;
    tenantEmail?: string;
    unitName: string;
    propertyName: string;
    propertyAddress: string;
    monthlyRent: number;
    securityDeposit: number;
    agreementType: string;
    isSigned: boolean;
  } | null>(null);

  // Filled Agreement Document PDF Viewer Modal State
  const [viewingAgreementDoc, setViewingAgreementDoc] = useState<AgreementDocumentData | null>(null);
  const [isDownloadingPostCheckInPdf, setIsDownloadingPostCheckInPdf] = useState(false);

  const handleOpenAgreementSignModal = () => {
    setShowAgreementModal(true);
  };

  const handleAgreementSigned = (sigData: {
    signerName: string;
    signerEmail?: string;
    signatureImage?: string;
    signedAt: string;
    agreementType: string;
    witnesses?: Array<{
      name?: string;
      date?: string;
      address?: string;
      signature?: string;
    }>;
  }) => {
    const key = selectedBed ? selectedBed.id : selectedRentalUnit ? selectedRentalUnit.id : 'current';
    const bedId = selectedBed?.id;
    const unitId = selectedRentalUnit?.id;
    const unitName = selectedBed ? `Bed ${selectedBed.bedNumber}` : selectedRentalUnit?.unitNumber;

    saveAgreementSignature({
      ...sigData,
      isSigned: true,
      bedId,
      unitId,
      unitName,
      tenantName: sigData.signerName,
      propertyName: property?.name,
    });

    setAgreementSignatureMap((prev) => ({
      ...prev,
      [key]: {
        ...sigData,
        isSigned: true,
      },
    }));
    setShowAgreementModal(false);
  };

  // Full Room Details & Beds Management Modal State (PG)
  interface ManageRoomBedItem {
    id: string;
    bedNumber: string;
    status: BedStatus;
    monthlyRent: number;
    securityDeposit: number;
    isNew?: boolean;
  }
  const [editingRoom, setEditingRoom] = useState<RoomDto | null>(null);
  const [manageRoomForm, setManageRoomForm] = useState<{
    roomNumber: string;
    sharingCategory: RoomCategoryType;
    customBeds: number;
    baseRent: number;
    securityDeposit: number;
    isAc: boolean;
    bedsList: ManageRoomBedItem[];
    deletedBedIds: string[];
  }>({
    roomNumber: '',
    sharingCategory: 'DOUBLE',
    customBeds: 5,
    baseRent: 8500,
    securityDeposit: 17000,
    isAc: false,
    bedsList: [],
    deletedBedIds: [],
  });
  const [isSavingRoom, setIsSavingRoom] = useState(false);
  const [manageRoomFeedback, setManageRoomFeedback] = useState<string | null>(null);

  // Room & Floor Deletion Approval Modal States
  const [deletingRoom, setDeletingRoom] = useState<RoomDto | null>(null);
  const [isDeletingRoom, setIsDeletingRoom] = useState(false);
  const [deletingFloor, setDeletingFloor] = useState<FloorDto | null>(null);
  const [isDeletingFloor, setIsDeletingFloor] = useState(false);

  // Add Room to Floor State (PG Main View)
  const [addingRoomFloor, setAddingRoomFloor] = useState<FloorDto | null>(null);
  const [addRoomForm, setAddRoomForm] = useState<{
    roomNumber: string;
    category: RoomCategoryType;
    customBeds: number;
    baseRent: number;
    securityDeposit: number;
    isAc: boolean;
  }>({
    roomNumber: '',
    category: 'DOUBLE',
    customBeds: 5,
    baseRent: 8500,
    securityDeposit: 17000,
    isAc: false,
  });
  const [isSavingNewRoom, setIsSavingNewRoom] = useState(false);
  const [addRoomFeedback, setAddRoomFeedback] = useState<string | null>(null);

  // Selected Residential Unit & Check-In / Check-Out Modal State (Whole-Unit Rental)
  const [selectedRentalUnit, setSelectedRentalUnit] = useState<RentalUnitDto | null>(null);
  const [isCheckingOutRentalUnit, setIsCheckingOutRentalUnit] = useState(false);
  const [rentalCheckoutSettlement, setRentalCheckoutSettlement] = useState({
    moveOutDate: getLocalDateString(),
    deductions: 0,
    deductionReason: '',
    damageCharges: 0,
    keyHandoverConfirmed: false,
    remarks: '',
  });
  const [rentalCheckInMode, setRentalCheckInMode] = useState<'NEW' | 'EXISTING'>('NEW');
  const [selectedExistingRentalTenantId, setSelectedExistingRentalTenantId] = useState('');
  const [rentalNewTenantForm, setRentalNewTenantForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    dateOfBirth: '',
    age: '',
    gender: 'Male',
    governmentIdType: 'Aadhaar Card',
    governmentIdNumber: '',
    documentFileName: '',
    documentFileSize: '',
    permanentAddress: '',
    permanentCity: '',
    permanentState: '',
    permanentPostalCode: '',
    occupation: '',
    employerOrCollege: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
  });
  const [rentalTenantSearchQuery, setRentalTenantSearchQuery] = useState('');
  const [rentalCheckInTerms, setRentalCheckInTerms] = useState({
    startDate: getLocalDateString(),
    endDate: '',
    agreedRent: 25000,
    securityDeposit: 50000,
    maintenanceCharges: 2000,
    noticePeriodDays: 30,
    lockInMonths: 6,
    terms: '',
  });
  const [submittingRentalOccupancy, setSubmittingRentalOccupancy] = useState(false);
  const [rentalOccupancyError, setRentalOccupancyError] = useState<string | null>(null);
  const [rentalOccupancySuccess, setRentalOccupancySuccess] = useState<string | null>(null);

  const broadcastTenancyEvent = () => {
    try {
      const bc = new BroadcastChannel('propertyos_realtime_events');
      bc.postMessage({ type: 'TENANCY_CHANGED', timestamp: Date.now() });
      bc.close();
    } catch {}
    try {
      localStorage.setItem('propertyos_last_tenancy_event', String(Date.now()));
    } catch {}
  };

  // Add Single House to Floor Modal State
  const [addingHouseFloorNumber, setAddingHouseFloorNumber] = useState<number | null>(null);
  const [addHouseForm, setAddHouseForm] = useState({
    houseNumber: '',
    bhkType: '2BHK',
    carpetAreaSqFt: 1200,
    superBuiltupAreaSqFt: 1450,
    furnishingStatus: 'SEMI_FURNISHED',
    monthlyRent: 25000,
    securityDeposit: 50000,
    maintenanceCharges: 2000,
  });
  const [isSavingNewHouse, setIsSavingNewHouse] = useState(false);
  const [addHouseFeedback, setAddHouseFeedback] = useState<string | null>(null);

  // Edit House / Unit Specifications Modal State
  const [editingRentalUnit, setEditingRentalUnit] = useState<RentalUnitDto | null>(null);
  const [editRentalUnitForm, setEditRentalUnitForm] = useState({
    unitNumber: '',
    unitType: '2BHK',
    floorNumber: 1,
    carpetAreaSqFt: 1200,
    superBuiltupAreaSqFt: 1450,
    furnishingStatus: 'SEMI_FURNISHED',
    monthlyRent: 25000,
    securityDeposit: 50000,
    maintenanceCharges: 2000,
  });
  const [isSavingRentalUnitEdit, setIsSavingRentalUnitEdit] = useState(false);
  const [editRentalUnitFeedback, setEditRentalUnitFeedback] = useState<string | null>(null);

  // Delete Unit & Floor Modals
  const [deletingRentalUnit, setDeletingRentalUnit] = useState<RentalUnitDto | null>(null);
  const [isDeletingRentalUnit, setIsDeletingRentalUnit] = useState(false);
  const [deletingRentalFloorNumber, setDeletingRentalFloorNumber] = useState<number | null>(null);
  const [isDeletingRentalFloor, setIsDeletingRentalFloor] = useState(false);

  // Fetch registered tenants from backend & populate bedOccupantMap with active stays
  const fetchRegisteredTenants = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/tenants`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        const apiTenants: any[] = json.data || [];
        setRegisteredTenants(apiTenants);

        // Sync bedOccupantMap with real active stays from DB
        const freshOccupants: Record<string, any> = {};
        apiTenants.forEach((t: any) => {
          if (t.currentStay && t.currentStay.bedId) {
            const doc = t.documents?.find((d: any) => d.documentNumber) || t.documents?.[0];
            const docNum = doc?.documentNumber || t.governmentIdNumber || t.documentNumber || t.governmentId || t.idNumber;
            const docType = doc?.documentType || t.governmentIdType || 'Aadhaar';
            const formattedGovId = formatIdProofDisplay(docType, docNum);

            freshOccupants[t.currentStay.bedId] = {
              tenantId: t.id,
              tenantName: `${t.firstName} ${t.lastName === '—' ? '' : t.lastName}`.trim(),
              phone: t.phone,
              email: t.email || '',
              gender: t.gender || 'Male',
              governmentId: formattedGovId ? formattedGovId : (t.governmentIdNumber ? `ID: ${t.governmentIdNumber}` : ''),
              permanentAddress: t.permanentAddress || 'Resident Address',
              moveInDate: t.currentStay.checkInDate ? t.currentStay.checkInDate.split('T')[0] : '2026-08-01',
              monthlyRent: t.currentStay.monthlyRent || 8500,
              securityDeposit: Number(t.currentStay.securityDeposit) || 17000,
              kycStatus: 'VERIFIED',
              emergencyContactName: t.emergencyContactName || 'Emergency Contact',
              emergencyContactPhone: t.emergencyContactPhone || t.phone,
              emergencyContactRelation: t.emergencyContactRelation || 'Parent',
            };
          }
        });
        setBedOccupantMap(freshOccupants);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchRegisteredTenants();
    }
  }, [isAuthenticated, fetchRegisteredTenants]);

  // Eagerly fetch full tenant profile and documents when an existing tenant is selected
  useEffect(() => {
    const targetTenantId = selectedExistingTenantId || selectedExistingRentalTenantId;
    if (targetTenantId) {
      const ex = registeredTenants.find((t) => t.id === targetTenantId);
      if (ex && (!(ex as any).documents || (ex as any).documents.length === 0)) {
        fetch(`${API_BASE}/tenants/${targetTenantId}`, { credentials: 'include' })
          .then((res) => (res.ok ? res.json() : null))
          .then((json) => {
            if (json && json.data) {
              const fullTenant = json.data.tenant || json.data;
              const docs = json.data.documents || fullTenant.documents || [];
              setRegisteredTenants((prev) =>
                prev.map((t) => (t.id === targetTenantId ? { ...t, ...fullTenant, documents: docs } : t))
              );
            }
          })
          .catch(() => {});
      }
    }
  }, [selectedExistingTenantId, selectedExistingRentalTenantId, registeredTenants]);

  // Dedicated "Add Rooms & Beds" Full Builder Modal State (PG)
  const [showAddInventoryBuilderModal, setShowAddInventoryBuilderModal] = useState(false);
  const [builderFloors, setBuilderFloors] = useState<BuilderFloorItem[]>([]);
  const [builderSubmitting, setBuilderSubmitting] = useState(false);
  const [builderErrorMessage, setBuilderErrorMessage] = useState<string | null>(null);

  // Dedicated "Add Floors & Houses" Full Builder Modal State (Rental)
  const [showRentalBuilderModal, setShowRentalBuilderModal] = useState(false);
  const [builderRentalFloors, setBuilderRentalFloors] = useState<BuilderRentalFloorItem[]>([]);
  const [rentalBuilderSubmitting, setRentalBuilderSubmitting] = useState(false);
  const [rentalBuilderErrorMessage, setRentalBuilderErrorMessage] = useState<string | null>(null);

  // Whole-Unit Rental Search & Multi-Filters
  const [rentalSearchQuery, setRentalSearchQuery] = useState('');
  const [rentalFloorFilter, setRentalFloorFilter] = useState('ALL');
  const [rentalTypeFilter, setRentalTypeFilter] = useState('ALL');
  const [rentalStatusFilter, setRentalStatusFilter] = useState('ALL');

  const fetchProperty = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`${API_BASE}/properties/${propertyId}`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      const json: ApiResponse<PropertyDto> = await res.json();

      if (res.ok && json.success && json.data) {
        setProperty(json.data);
        const existingAmenityIds = (json.data.amenities || []).map((a: any) => {
          const match = STANDARD_AMENITIES_CATALOG.find((cat) => cat.name === a.name);
          return match ? match.id : a.id || a.name;
        });

        setEditFormData({
          name: json.data.name || '',
          propertyType: json.data.propertyType || PropertyType.PG,
          status: json.data.status || PropertyStatus.ACTIVE,
          description: json.data.description || '',
          address: json.data.address || '',
          addressLine1: json.data.addressLine1 || '',
          addressLine2: json.data.addressLine2 || '',
          locality: json.data.locality || '',
          city: json.data.city || '',
          district: json.data.district || '',
          state: json.data.state || '',
          country: json.data.country || 'India',
          postalCode: json.data.postalCode || '',
          latitude: json.data.latitude ?? undefined,
          longitude: json.data.longitude ?? undefined,
          contactPhone: json.data.contactPhone || '',
          contactEmail: json.data.contactEmail || '',
          ownerName: json.data.ownerName || '',
          ownerAddress: json.data.ownerAddress || '',
          ownerPhone: json.data.ownerPhone || '',
          ownerSignature: json.data.ownerSignature || '',
          noticePeriodDays: json.data.noticePeriodDays ?? 30,
          lockInPeriodValue: json.data.lockInPeriodValue ?? 1,
          lockInPeriodUnit: (json.data.lockInPeriodUnit as any) || 'MONTHS',
          lockInMonths: json.data.lockInMonths ?? 1,
          amenityIds: existingAmenityIds,
        });
      } else {
        setErrorMessage(json.error?.message || 'Property not found');
      }
    } catch {
      setErrorMessage('Network error while retrieving property');
    } finally {
      setIsLoading(false);
    }
  }, [propertyId]);

  const fetchInventory = useCallback(async () => {
    if (!propertyId) return;
    setInventoryLoading(true);

    try {
      if (property?.propertyType === PropertyType.PG) {
        // Fetch Floors
        const fRes = await fetch(`${API_BASE}/properties/${propertyId}/floors`, { credentials: 'include' });
        if (fRes.ok) {
          const fJson = await fRes.json();
          setFloors(fJson.data || []);
        }

        // Fetch Rooms
        const rRes = await fetch(`${API_BASE}/properties/${propertyId}/rooms`, { credentials: 'include' });
        if (rRes.ok) {
          const rJson = await rRes.json();
          setRooms(rJson.data || []);
        }

        // Fetch Beds
        const bRes = await fetch(`${API_BASE}/properties/${propertyId}/beds`, { credentials: 'include' });
        if (bRes.ok) {
          const bJson = await bRes.json();
          setBeds(bJson.data || []);
        }
      } else if (property?.propertyType === PropertyType.RENTAL_HOUSE) {
        // Fetch Units
        const uRes = await fetch(`${API_BASE}/properties/${propertyId}/units`, { credentials: 'include' });
        if (uRes.ok) {
          const uJson = await uRes.json();
          setRentalUnits(uJson.data || []);
        }
      }
    } catch {}
    setInventoryLoading(false);
  }, [propertyId, property?.propertyType]);

  useEffect(() => {
    if (isAuthenticated && propertyId) {
      fetchProperty();
    }
  }, [isAuthenticated, propertyId, fetchProperty]);

  useEffect(() => {
    if (property) {
      fetchInventory();
    }
  }, [property, fetchInventory]);

  // Close status dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUpdateStatus = async (newStatus: PropertyStatus) => {
    setIsStatusDropdownOpen(false);
    if (!property || newStatus === property.status) return;

    if (newStatus === PropertyStatus.ARCHIVED) {
      if (!confirm('Are you sure you want to archive this property? It will be hidden from active property operations.')) {
        return;
      }
    }

    setActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      let res: Response;
      if (newStatus === PropertyStatus.ARCHIVED) {
        res = await fetch(`${API_BASE}/properties/${propertyId}/archive`, {
          method: 'POST',
          credentials: 'include',
        });
      } else if (property.status === PropertyStatus.ARCHIVED) {
        // If restoring from ARCHIVED, first call restore then patch if necessary
        await fetch(`${API_BASE}/properties/${propertyId}/restore`, {
          method: 'POST',
          credentials: 'include',
        });
        res = await fetch(`${API_BASE}/properties/${propertyId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: newStatus }),
        });
      } else {
        res = await fetch(`${API_BASE}/properties/${propertyId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: newStatus }),
        });
      }

      const json: ApiResponse<PropertyDto> = await res.json();

      if (res.ok && json.success) {
        if (json.data) setProperty(json.data);
        const statusLabel =
          newStatus === PropertyStatus.ACTIVE
            ? 'Active'
            : newStatus === PropertyStatus.INACTIVE
            ? 'Inactive'
            : newStatus === PropertyStatus.UNDER_MAINTENANCE
            ? 'Under Maintenance'
            : 'Archived';
        setSuccessMessage(`Property status updated to ${statusLabel}.`);
        fetchProperty();
      } else {
        setErrorMessage(json.error?.message || 'Failed to update property status');
      }
    } catch {
      setErrorMessage('Network error while updating property status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async () => {
    await handleUpdateStatus(PropertyStatus.ARCHIVED);
  };

  const handleRestore = async () => {
    await handleUpdateStatus(PropertyStatus.ACTIVE);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setEditModalError(null);
    setErrorMessage(null);

    // Strict Validation for all Mandatory Fields
    if (!editFormData.name.trim() || editFormData.name.trim().length < 2) {
      setEditModalError('Property Name is required (at least 2 characters).');
      setActionLoading(false);
      return;
    }
    if (!editFormData.description?.trim() || editFormData.description.trim().length < 5) {
      setEditModalError('Property Description is required (at least 5 characters).');
      setActionLoading(false);
      return;
    }
    if (!editFormData.address?.trim() || editFormData.address.trim().length < 3) {
      setEditModalError('Street Address is required (at least 3 characters).');
      setActionLoading(false);
      return;
    }
    if (!editFormData.city?.trim() || editFormData.city.trim().length < 2) {
      setEditModalError('City is required.');
      setActionLoading(false);
      return;
    }
    if (!editFormData.state?.trim() || editFormData.state.trim().length < 2) {
      setEditModalError('State is required.');
      setActionLoading(false);
      return;
    }
    if (!editFormData.postalCode?.trim() || !/^[1-9][0-9]{5}$/.test(editFormData.postalCode.trim())) {
      setEditModalError('Please enter a valid 6-digit Indian PIN code (e.g. 560102).');
      setActionLoading(false);
      return;
    }
    if (!editFormData.contactPhone?.trim() || !/^[6-9]\d{9}$/.test(editFormData.contactPhone.trim())) {
      setEditModalError('Manager Contact Phone is required (must be a valid 10-digit Indian mobile number).');
      setActionLoading(false);
      return;
    }
    if (!editFormData.contactEmail?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editFormData.contactEmail.trim())) {
      setEditModalError('Manager Contact Email is required (valid email address).');
      setActionLoading(false);
      return;
    }
    if (editFormData.noticePeriodDays === undefined || editFormData.noticePeriodDays === null || Number(editFormData.noticePeriodDays) < 0) {
      setEditModalError('Notice Period Required is mandatory (must be 0 or more days).');
      setActionLoading(false);
      return;
    }
    if (editFormData.lockInPeriodValue === undefined || editFormData.lockInPeriodValue === null || Number(editFormData.lockInPeriodValue) < 0) {
      setEditModalError('Minimum Lock-In Period is mandatory (must be 0 or more).');
      setActionLoading(false);
      return;
    }
    if (!editFormData.ownerName?.trim() || editFormData.ownerName.trim().length < 2) {
      setEditModalError('Landlord / Property Owner Legal Name is required (at least 2 characters).');
      setActionLoading(false);
      return;
    }
    if (!editFormData.ownerPhone?.trim() || !/^[6-9]\d{9}$/.test(editFormData.ownerPhone.trim())) {
      setEditModalError('Owner WhatsApp / Contact Number is required (must be a valid 10-digit Indian mobile number).');
      setActionLoading(false);
      return;
    }
    if (!editFormData.ownerAddress?.trim() || editFormData.ownerAddress.trim().length < 5) {
      setEditModalError('Owner Office / Permanent Address is required (at least 5 characters).');
      setActionLoading(false);
      return;
    }

    const hasSignature = Boolean(
      editFormData.ownerSignature ||
      (editOwnerSignMode === 'type' && editOwnerTypedName.trim().length >= 2) ||
      (editOwnerSignMode === 'draw' && hasEditOwnerDrawn)
    );
    if (!hasSignature) {
      setEditModalError('Landlord / Property Owner Digital Signature is required. Please draw or type your signature.');
      setActionLoading(false);
      return;
    }

    try {
      const cleanPayload = {
        name: editFormData.name.trim(),
        status: editFormData.status,
        description: editFormData.description?.trim() || null,
        address: editFormData.address.trim(),
        addressLine1: editFormData.addressLine1?.trim() || null,
        addressLine2: editFormData.addressLine2?.trim() || null,
        locality: editFormData.locality?.trim() || null,
        city: editFormData.city.trim(),
        district: editFormData.district?.trim() || null,
        state: editFormData.state.trim(),
        country: editFormData.country?.trim() || 'India',
        postalCode: editFormData.postalCode.trim(),
        latitude: editFormData.latitude,
        longitude: editFormData.longitude,
        contactPhone: editFormData.contactPhone?.trim() || null,
        contactEmail: editFormData.contactEmail?.trim() || null,
        ownerName: editFormData.ownerName?.trim() || null,
        ownerAddress: editFormData.ownerAddress?.trim() || null,
        ownerPhone: editFormData.ownerPhone?.trim() || null,
        ownerSignature: editFormData.ownerSignature || (editOwnerSignMode === 'type' && editOwnerTypedName.trim() ? `TYPE:${editOwnerTypedName.trim()}` : null),
        noticePeriodDays: Number(editFormData.noticePeriodDays ?? 30),
        lockInPeriodValue: Number(editFormData.lockInPeriodValue ?? 1),
        lockInPeriodUnit: editFormData.lockInPeriodUnit || 'MONTHS',
        lockInMonths: editFormData.lockInPeriodUnit === 'YEARS' ? Number(editFormData.lockInPeriodValue || 1) * 12 : Number(editFormData.lockInPeriodValue || 1),
        amenityIds: editFormData.amenityIds || [],
      };

      const res = await fetch(`${API_BASE}/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(cleanPayload),
      });

      const json: ApiResponse<PropertyDto> = await res.json();

      if (res.ok && json.success && json.data) {
        setProperty(json.data);
        setIsEditModalOpen(false);
        setSuccessMessage('Property details updated successfully.');
        setErrorMessage(null);
        setEditModalError(null);
        fetchProperty();
      } else {
        const errDetail = json.error?.details?.[0]?.message || (typeof json.error?.details === 'object' ? Object.values(json.error.details).flat().join(', ') : null);
        setEditModalError(errDetail || json.error?.message || (json as any).message || 'Failed to update property details.');
      }
    } catch {
      setEditModalError('Network error while saving property details.');
    } finally {
      setActionLoading(false);
    }
  };

  // Bed Status & Check-In / Check-Out Lifecycle Management
  const handleOpenBedInspection = (bed: BedDto, room: RoomDto) => {
    setSelectedBed(bed);
    setSelectedBedRoom(room);
    setIsCheckingOut(false);
    setOccupancyError(null);
    setOccupancySuccess(null);
    setBedStatusFeedback(null);
    setCheckInMode('NEW');
    setSelectedExistingTenantId('');
    setTenantSearchQuery('');
    setIsAgreementModalOpen(false);
    setExecutedAgreement(null);
    setBypassAgreementGracePeriod(false);
    fetchRegisteredTenants();

    const roomBeds = beds.filter((b) => b.roomId === room.id);
    const bedRent = Number(bed.monthlyRent) || Number(room.baseRent) || 10000;
    const bedDeposit = getRoomSecurityDeposit(room, roomBeds);

    setNewTenantForm({
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      dateOfBirth: '',
      age: '',
      gender: 'Male',
      governmentIdType: 'Aadhaar Card',
      governmentIdNumber: '',
      documentFileName: '',
      documentFileSize: '',
      permanentAddress: '',
      permanentCity: '',
      permanentState: '',
      permanentPostalCode: '',
      occupation: '',
      employerOrCollege: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      emergencyContactRelation: '',
    });

    setCheckInTerms({
      moveInDate: getLocalDateString(),
      expectedCheckoutDate: '',
      agreedRent: bedRent,
      securityDeposit: bedDeposit,
      notes: '',
    });

    // If already marked occupied, look up real occupant from database / registeredTenants
    if (bed.status === BedStatus.OCCUPIED && !bedOccupantMap[bed.id]) {
      const matchingTenant: any = registeredTenants.find(
        (t: any) => t.currentStay?.bedId === bed.id
      );

      if (matchingTenant) {
        setBedOccupantMap((prev) => ({
          ...prev,
          [bed.id]: {
            tenantId: matchingTenant.id,
            tenantName: `${matchingTenant.firstName} ${matchingTenant.lastName === '—' ? '' : matchingTenant.lastName}`.trim(),
            phone: matchingTenant.phone,
            email: matchingTenant.email || '',
            gender: matchingTenant.gender || 'Male',
            governmentId: matchingTenant.governmentIdNumber ? `ID: ${matchingTenant.governmentIdNumber}` : '',
            permanentAddress: matchingTenant.permanentAddress || 'Resident Address',
            moveInDate: matchingTenant.currentStay?.checkInDate ? matchingTenant.currentStay.checkInDate.split('T')[0] : getLocalDateString(),
            monthlyRent: matchingTenant.currentStay?.monthlyRent || bedRent,
            securityDeposit: Number(matchingTenant.currentStay?.securityDeposit) || bedDeposit,
            kycStatus: 'VERIFIED',
            emergencyContactName: matchingTenant.emergencyContactName || 'Emergency Contact',
            emergencyContactPhone: matchingTenant.emergencyContactPhone || matchingTenant.phone,
            emergencyContactRelation: matchingTenant.emergencyContactRelation || 'Parent',
          },
        }));
      }
    }

    setCheckoutSettlement({
      moveOutDate: getLocalDateString(),
      deductions: 0,
      deductionReason: '',
      keyHandoverConfirmed: false,
      remarks: '',
    });
  };

  const handleUpdateBedStatus = async (newStatus: BedStatus) => {
    if (!selectedBed) return;
    setIsUpdatingBed(true);
    setBedStatusFeedback(null);

    try {
      const res = await fetch(`${API_BASE}/properties/${propertyId}/beds/${selectedBed.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setBeds((prev) => prev.map((b) => (b.id === selectedBed.id ? { ...b, status: newStatus } : b)));
        setSelectedBed((prev) => (prev ? { ...prev, status: newStatus } : null));
        setBedStatusFeedback(`Bed status updated to ${newStatus.replace('_', ' ')}`);

        // If marked available, clear occupant
        if (newStatus === BedStatus.AVAILABLE) {
          setBedOccupantMap((prev) => {
            const next = { ...prev };
            delete next[selectedBed.id];
            return next;
          });
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        setBedStatusFeedback(errJson.error?.message || 'Failed to update bed status.');
      }
    } catch {
      setBedStatusFeedback('Network error while updating bed status.');
    } finally {
      setIsUpdatingBed(false);
    }
  };

  // Complete Tenant Check-In Flow with Duplicate Occupancy Protection & Official ID
  const handleCompleteBedCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBed || !selectedBedRoom) return;

    setSubmittingOccupancy(true);
    setOccupancyError(null);

    try {
      let tenantName = '';
      let phone = '';
      let email = '';
      let gender = 'Male';
      let dateOfBirth = '';
      let governmentIdType = 'Aadhaar Card';
      let governmentIdNumber = '';
      let documentFileName = '';
      let permanentAddress = '';
      let permanentCity = '';
      let permanentState = '';
      let permanentPostalCode = '';
      let occupation = '';
      let employerOrCollege = '';
      let emergencyContactName = '';
      let emergencyContactPhone = '';
      let emergencyContactRelation = '';

      // =========================================================================
      // MANDATORY DIGITAL AGREEMENT CHECK
      // =========================================================================
      if (!agreementSignatureMap[selectedBed.id]?.isSigned) {
        setOccupancyError('Digital Tenancy Agreement (E-Sign) is mandatory. Please review and E-sign the agreement with the resident before assigning bed.');
        setSubmittingOccupancy(false);
        return;
      }

      if (checkInMode === 'NEW') {
        if (!newTenantForm.firstName.trim()) {
          setOccupancyError('Please enter the tenant Name.');
          setSubmittingOccupancy(false);
          return;
        }
        if (!newTenantForm.phone.trim() || newTenantForm.phone.replace(/\D/g, '').length < 10) {
          setOccupancyError('Please enter a valid 10-digit mobile number.');
          setSubmittingOccupancy(false);
          return;
        }
        if (!newTenantForm.dateOfBirth) {
          setOccupancyError('Date of Birth is mandatory. Please select the date of birth.');
          setSubmittingOccupancy(false);
          return;
        }
        if (!newTenantForm.governmentIdNumber.trim()) {
          setOccupancyError('Document / ID Number is mandatory. Please provide the official ID number.');
          setSubmittingOccupancy(false);
          return;
        }

        const rawName = newTenantForm.firstName.trim();
        const nameParts = rawName.split(/\s+/);
        let fName = nameParts[0];
        let lName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : (newTenantForm.lastName.trim() || '—');

        tenantName = `${fName} ${lName}`.trim();
        phone = newTenantForm.phone.trim();
        email = newTenantForm.email.trim();
        dateOfBirth = newTenantForm.dateOfBirth;
        gender = newTenantForm.gender || 'Male';
        governmentIdType = newTenantForm.governmentIdType || 'Aadhaar Card';
        governmentIdNumber = newTenantForm.governmentIdNumber.trim();
        documentFileName = newTenantForm.documentFileName;
        permanentAddress = newTenantForm.permanentAddress.trim() || 'Resident Address';
        permanentCity = newTenantForm.permanentCity.trim() || 'Bengaluru';
        permanentState = newTenantForm.permanentState.trim() || 'Karnataka';
        permanentPostalCode = newTenantForm.permanentPostalCode.trim() || '560001';
        occupation = newTenantForm.occupation.trim();
        employerOrCollege = newTenantForm.employerOrCollege.trim();
        emergencyContactName = newTenantForm.emergencyContactName.trim() || 'Emergency Contact';
        emergencyContactPhone = newTenantForm.emergencyContactPhone.trim() || phone;
        emergencyContactRelation = newTenantForm.emergencyContactRelation.trim() || 'Parent';
      } else {
        const existing = registeredTenants.find((t) => t.id === selectedExistingTenantId);
        if (!existing) {
          setOccupancyError('Please select a registered tenant from the list.');
          setSubmittingOccupancy(false);
          return;
        }
        tenantName = `${existing.firstName} ${existing.lastName}`;
        phone = existing.phone;
        email = existing.email || '';
        permanentAddress = existing.permanentAddress || 'Resident Address';
        permanentCity = existing.permanentCity || 'Bengaluru';
        permanentState = existing.permanentState || 'Karnataka';
        permanentPostalCode = existing.permanentPostalCode || '560001';
        emergencyContactName = existing.emergencyContactName || 'Emergency Contact';
        emergencyContactPhone = existing.emergencyContactPhone || phone;
        emergencyContactRelation = existing.emergencyContactRelation || 'Parent';
      }

      // =========================================================================
      // DUPLICATE OCCUPANCY CHECK: PREVENT SAME TENANT FROM OCCUPYING MULTIPLE BEDS
      // =========================================================================
      const normalizedTargetPhone = phone.replace(/\D/g, '');
      if (normalizedTargetPhone.length >= 10) {
        const targetLast10 = normalizedTargetPhone.slice(-10);
        for (const [otherBedId, existingOcc] of Object.entries(bedOccupantMap)) {
          if (otherBedId !== selectedBed.id && existingOcc && existingOcc.phone) {
            const existingDigits = existingOcc.phone.replace(/\D/g, '');
            if (existingDigits.slice(-10) === targetLast10) {
              const otherBed = beds.find((b) => b.id === otherBedId);
              const otherRoom = rooms.find((r) => r.id === otherBed?.roomId);
              setOccupancyError(
                `Double Occupancy Blocked: Tenant "${existingOcc.tenantName}" (Phone: ${existingOcc.phone}) is already actively occupying Bed ${otherBed?.bedNumber || otherBedId} in Room ${otherRoom?.roomNumber || 'Unknown'}. A single individual cannot occupy multiple beds simultaneously.`
              );
              setSubmittingOccupancy(false);
              return;
            }
          }
        }
      }

      let effectiveTenantId: string | null = null;

      // Save or update tenant in backend database if in NEW mode
      if (checkInMode === 'NEW') {
        const rawName = newTenantForm.firstName.trim();
        const nameParts = rawName.split(/\s+/);
        const fName = nameParts[0];
        const lName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : (newTenantForm.lastName.trim() || '—');

        try {
          const createTenantRes = await fetch(`${API_BASE}/tenants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              firstName: fName,
              lastName: lName,
              phone: phone,
              email: email || undefined,
              dateOfBirth: dateOfBirth ? new Date(dateOfBirth).toISOString() : undefined,
              gender: gender,
              documentType: governmentIdType || 'Aadhaar Card',
              documentNumber: governmentIdNumber ? governmentIdNumber.trim() : undefined,
              permanentAddress: permanentAddress,
              permanentCity: permanentCity,
              permanentState: permanentState,
              permanentPostalCode: permanentPostalCode,
              occupation: occupation || undefined,
              employerOrCollege: employerOrCollege || undefined,
              emergencyContactName: emergencyContactName,
              emergencyContactPhone: emergencyContactPhone,
              emergencyContactRelation: emergencyContactRelation,
            }),
          });
          if (createTenantRes.ok) {
            const createJson = await createTenantRes.json();
            effectiveTenantId = createJson.data?.id || null;
          }
        } catch (err) {
          console.error('Error creating tenant profile:', err);
        }
      } else {
        effectiveTenantId = selectedExistingTenantId;
      }

      // If we don't have effectiveTenantId yet (e.g. if already in DB), query by phone
      if (!effectiveTenantId && phone) {
        try {
          const searchRes = await fetch(`${API_BASE}/tenants?search=${encodeURIComponent(phone)}`, {
            credentials: 'include',
          });
          if (searchRes.ok) {
            const sJson = await searchRes.json();
            if (sJson.data && sJson.data.length > 0) {
              effectiveTenantId = sJson.data[0].id;
            }
          }
        } catch {}
      }

      // If we have effectiveTenantId, call assign-bed to atomically record stay history, set tenant ACTIVE, and lock bed
      if (effectiveTenantId) {
        try {
          const checkInIso = createLocalIsoString(checkInTerms.moveInDate);

          await fetch(`${API_BASE}/tenants/${effectiveTenantId}/assign-bed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              propertyId,
              bedId: selectedBed.id,
              monthlyRent: checkInTerms.agreedRent,
              securityDeposit: checkInTerms.securityDeposit,
              checkInDate: checkInIso,
            }),
          });
        } catch (err) {
          console.error('Error assigning bed in backend:', err);
        }
      } else {
        // Fallback direct bed status update
        await fetch(`${API_BASE}/properties/${propertyId}/beds/${selectedBed.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: BedStatus.OCCUPIED }),
        });
      }

      const occupantRecord = {
        tenantId: effectiveTenantId || selectedExistingTenantId || undefined,
        tenantName,
        phone,
        email,
        gender,
        governmentId: governmentIdNumber ? `${governmentIdType}: ${governmentIdNumber}` : '',
        permanentAddress: `${permanentAddress}, ${permanentCity}, ${permanentState} — ${permanentPostalCode}`,
        moveInDate: checkInTerms.moveInDate,
        expectedCheckoutDate: checkInTerms.expectedCheckoutDate,
        monthlyRent: checkInTerms.agreedRent,
        securityDeposit: checkInTerms.securityDeposit,
        kycStatus: 'VERIFIED' as const,
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactRelation,
        notes: checkInTerms.notes,
      };

      // Save agreement signature & witnesses to persistent storage
      const existingSig = agreementSignatureMap[selectedBed.id];
      const finalSigPkg = existingSig || getOrGenerateAgreementSignature({
        bedId: selectedBed.id,
        unitName: `Bed ${selectedBed.bedNumber}`,
        tenantName,
        tenantPhone: phone,
        emergencyContactName,
        emergencyContactPhone,
        moveInDate: checkInTerms.moveInDate,
      });
      saveAgreementSignature({
        ...finalSigPkg,
        bedId: selectedBed.id,
        unitName: `Bed ${selectedBed.bedNumber}`,
        tenantName,
        tenantPhone: phone,
        propertyName: property?.name,
      });

      setBedOccupantMap((prev) => ({
        ...prev,
        [selectedBed.id]: occupantRecord,
      }));

      // If checked in an existing registered tenant, mark them ACTIVE so they cannot be selected elsewhere
      if (checkInMode === 'EXISTING' && selectedExistingTenantId) {
        setRegisteredTenants((prev) =>
          prev.map((t) => (t.id === selectedExistingTenantId ? ({ ...t, status: 'ACTIVE' } as any) : t))
        );
      }

      // Also update bed rent in backend
      try {
        await fetch(`${API_BASE}/properties/${propertyId}/beds/${selectedBed.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ monthlyRent: checkInTerms.agreedRent }),
        });
      } catch {}

      setBeds((prev) =>
        prev.map((b) => (b.id === selectedBed.id ? { ...b, status: BedStatus.OCCUPIED, monthlyRent: checkInTerms.agreedRent } : b))
      );
      setSelectedBed((prev) => (prev ? { ...prev, status: BedStatus.OCCUPIED, monthlyRent: checkInTerms.agreedRent } : null));

      setOccupancySuccess(`Check-In complete! Bed ${selectedBed.bedNumber} is now Occupied by ${tenantName}.`);

      // Trigger post-allocation WhatsApp & PDF Delivery Modal
      setPostCheckInAgreement({
        isOpen: true,
        tenantName,
        tenantPhone: phone,
        tenantEmail: email,
        unitName: `Bed ${selectedBed.bedNumber} (Room ${selectedBedRoom?.roomNumber || '—'})`,
        propertyName: property?.name || 'Property',
        propertyAddress: property?.address || `${property?.city || 'Bengaluru'}, ${property?.state || 'Karnataka'}`,
        monthlyRent: checkInTerms.agreedRent,
        securityDeposit: checkInTerms.securityDeposit,
        agreementType: 'PG_AGREEMENT',
        isSigned: !!agreementSignatureMap[selectedBed.id]?.isSigned,
      });

      broadcastTenancyEvent();
      fetchInventory();
      fetchRegisteredTenants();
    } catch (err: any) {
      setOccupancyError(err?.message || 'Failed to complete check-in');
    } finally {
      setSubmittingOccupancy(false);
    }
  };

  // Check-Out Approval Flow (Owner Approval Step with Strict Key Handover Enforcement)
  const handleApproveCheckout = async () => {
    if (!selectedBed || !selectedBedRoom) return;

    if (!checkoutSettlement.keyHandoverConfirmed) {
      setOccupancyError('Room inspection approval and key handover confirmation checkbox is mandatory before finalizing check-out.');
      return;
    }

    setSubmittingOccupancy(true);
    setOccupancyError(null);

    try {
      const previousOccupant = bedOccupantMap[selectedBed.id];
      const occupantName = previousOccupant?.tenantName || 'Resident';
      const occPhone = previousOccupant?.phone ? previousOccupant.phone.replace(/\D/g, '').slice(-10) : '';

      // Find tenantId for this occupant if registered, and call vacate-bed
      const targetTenantId =
        previousOccupant?.tenantId ||
        (occPhone ? registeredTenants.find((t) => t.phone.replace(/\D/g, '').slice(-10) === occPhone)?.id : null);

      const checkOutIso = createLocalIsoString(checkoutSettlement.moveOutDate);

      if (targetTenantId) {
        try {
          await fetch(`${API_BASE}/tenants/${targetTenantId}/vacate-bed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              bedId: selectedBed.id,
              checkoutDate: checkOutIso,
            }),
          });
        } catch {}
      } else {
        // Fallback: direct vacate by bed ID in backend
        try {
          await fetch(`${API_BASE}/tenants/vacate-bed-by-bed/${selectedBed.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              checkoutDate: checkOutIso,
            }),
          });
        } catch {}
      }

      // Update Bed Status in backend to AVAILABLE
      await fetch(`${API_BASE}/properties/${propertyId}/beds/${selectedBed.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: BedStatus.AVAILABLE }),
      });

      setBedOccupantMap((prev) => {
        const copy = { ...prev };
        delete copy[selectedBed.id];
        return copy;
      });

      // Free up tenant in registeredTenants and register completed stay immediately
      setRegisteredTenants((prev) =>
        prev.map((t) => {
          const tPhone = t.phone ? t.phone.replace(/\D/g, '').slice(-10) : '';
          if ((targetTenantId && t.id === targetTenantId) || (occPhone && tPhone === occPhone)) {
            const prevStays = t.stayHistories || [];
            const updatedStays = [
              ...prevStays.filter((s: any) => s.bedId !== selectedBed.id),
              {
                id: `stay-${Date.now()}`,
                checkInDate: previousOccupant?.moveInDate || createLocalIsoString(),
                checkOutDate: checkoutSettlement.moveOutDate || createLocalIsoString(),
                monthlyRent: previousOccupant?.monthlyRent || selectedBed.monthlyRent,
                bedId: selectedBed.id,
                bedNumber: selectedBed.bedNumber,
                propertyId: propertyId,
                propertyName: property?.name || '',
              },
            ];
            return {
              ...t,
              status: 'CHECKED_OUT',
              currentStay: null,
              stayHistories: updatedStays,
            } as any;
          }
          return t;
        })
      );

      setBeds((prev) =>
        prev.map((b) => (b.id === selectedBed.id ? { ...b, status: BedStatus.AVAILABLE } : b))
      );
      setSelectedBed((prev) => (prev ? { ...prev, status: BedStatus.AVAILABLE } : null));
      setIsCheckingOut(false);

      setOccupancySuccess(`Check-out approved for ${occupantName}. Bed ${selectedBed.bedNumber} is now Available.`);
      broadcastTenancyEvent();
      fetchInventory();
      fetchRegisteredTenants();
    } catch {
      setOccupancyError('Failed to process check-out.');
    } finally {
      setSubmittingOccupancy(false);
    }
  };

  const getFormattedBedLabel = (roomNumber: string, bedNumber: string, index: number) => {
    const match = bedNumber.trim().match(/[-_ ]*([A-Za-z0-9]+)$/);
    const suffix = match && match[1] ? match[1] : String.fromCharCode(65 + index);
    const rNum = roomNumber.trim();
    return rNum ? `${rNum}-${suffix}` : `-${suffix}`;
  };

  const handleOpenManageRoom = (room: RoomDto) => {
    const roomBedsList = beds.filter((b) => b.roomId === room.id);
    const hasAc = isRoomAcEquipped(room.amenities);
    const deposit = getRoomSecurityDeposit(room, roomBedsList);

    let cat: RoomCategoryType = 'DOUBLE';
    const bedCount = roomBedsList.length;
    let customCount = bedCount || room.capacity || 2;

    if (room.sharingType === RoomSharingType.DORMITORY) {
      cat = 'DORMITORY';
      customCount = bedCount || room.capacity || 8;
    } else if (bedCount === 1) {
      cat = 'SINGLE';
      customCount = 1;
    } else if (bedCount === 2) {
      cat = 'DOUBLE';
      customCount = 2;
    } else if (bedCount === 3) {
      cat = 'TRIPLE';
      customCount = 3;
    } else if (bedCount === 4) {
      cat = 'FOUR_SHARING';
      customCount = 4;
    } else if (bedCount > 4) {
      cat = 'CUSTOM_NORMAL';
      customCount = bedCount;
    } else if (room.sharingType === RoomSharingType.SINGLE) {
      cat = 'SINGLE';
      customCount = 1;
    } else if (room.sharingType === RoomSharingType.DOUBLE) {
      cat = 'DOUBLE';
      customCount = 2;
    } else if (room.sharingType === RoomSharingType.TRIPLE) {
      cat = 'TRIPLE';
      customCount = 3;
    } else if (room.sharingType === RoomSharingType.FOUR_SHARING) {
      cat = 'FOUR_SHARING';
      customCount = 4;
    } else {
      cat = 'CUSTOM_NORMAL';
      customCount = room.capacity || 5;
    }

    setEditingRoom(room);
    setManageRoomForm({
      roomNumber: room.roomNumber,
      sharingCategory: cat,
      customBeds: customCount,
      baseRent: Number(room.baseRent) || 8500,
      securityDeposit: deposit,
      isAc: hasAc,
      bedsList: roomBedsList.map((b, idx) => {
        let bNum = (b.bedNumber || '').trim();
        const match = bNum.match(/[-_ ]*([A-Za-z0-9]+)$/);
        const suffix = match && match[1] ? match[1] : String.fromCharCode(65 + idx);
        const cleanBedNum = bNum.startsWith('-') || !bNum.includes('-') ? `${room.roomNumber}-${suffix}` : bNum;

        return {
          id: b.id,
          bedNumber: cleanBedNum,
          status: b.status,
          monthlyRent: Number(b.monthlyRent) || Number(room.baseRent) || 8500,
          securityDeposit: Number((b as any).securityDeposit) || deposit || 17000,
          isNew: false,
        };
      }),
      deletedBedIds: [],
    });
    setManageRoomFeedback(null);
  };

  const handleUpdateManageSharingType = (newCat: RoomCategoryType) => {
    if (!editingRoom) return;
    setManageRoomFeedback(null);

    let targetBedCount = 2;
    if (newCat === 'SINGLE') targetBedCount = 1;
    else if (newCat === 'DOUBLE') targetBedCount = 2;
    else if (newCat === 'TRIPLE') targetBedCount = 3;
    else if (newCat === 'FOUR_SHARING') targetBedCount = 4;
    else if (newCat === 'CUSTOM_NORMAL') targetBedCount = (manageRoomForm.customBeds && manageRoomForm.customBeds > 4) ? manageRoomForm.customBeds : 5;
    else if (newCat === 'DORMITORY') targetBedCount = (manageRoomForm.customBeds && manageRoomForm.customBeds >= 6) ? manageRoomForm.customBeds : 8;

    const currentBeds = [...manageRoomForm.bedsList];
    const occupiedCount = currentBeds.filter((b) => b.status === BedStatus.OCCUPIED).length;

    if (targetBedCount < occupiedCount) {
      setManageRoomFeedback(`Cannot reduce capacity to ${targetBedCount} beds because ${occupiedCount} beds are currently Occupied.`);
      return;
    }

    let updatedBeds: ManageRoomBedItem[] = [...currentBeds];
    let newDeletedIds = [...manageRoomForm.deletedBedIds];

    if (targetBedCount > currentBeds.length) {
      const roomNum = manageRoomForm.roomNumber.trim() || editingRoom.roomNumber;
      const existingBedNums = new Set(currentBeds.map((b) => b.bedNumber.trim().toUpperCase()));
      for (let i = currentBeds.length; i < targetBedCount; i++) {
        let suffixCode = 65 + i;
        let candidate = `${roomNum}-${String.fromCharCode(suffixCode)}`;
        while (existingBedNums.has(candidate.toUpperCase())) {
          suffixCode++;
          candidate = `${roomNum}-${String.fromCharCode(suffixCode)}`;
        }
        existingBedNums.add(candidate.toUpperCase());
        const tempId = `new-bed-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`;
        updatedBeds.push({
          id: tempId,
          bedNumber: candidate,
          status: BedStatus.AVAILABLE,
          monthlyRent: manageRoomForm.baseRent,
          securityDeposit: manageRoomForm.securityDeposit,
          isNew: true,
        });
      }
    } else if (targetBedCount < currentBeds.length) {
      const bedsToKeep: ManageRoomBedItem[] = [];
      const excess = currentBeds.length - targetBedCount;
      let removed = 0;

      for (let i = currentBeds.length - 1; i >= 0; i--) {
        const b = currentBeds[i];
        if (removed < excess && b.status !== BedStatus.OCCUPIED) {
          if (!b.isNew) newDeletedIds.push(b.id);
          removed++;
        } else {
          bedsToKeep.unshift(b);
        }
      }
      updatedBeds = bedsToKeep;
    }

    setManageRoomForm((prev) => ({
      ...prev,
      sharingCategory: newCat,
      customBeds: targetBedCount,
      bedsList: updatedBeds,
      deletedBedIds: newDeletedIds,
    }));
  };

  const handleUpdateManageCustomBeds = (newCount: number) => {
    if (!editingRoom) return;
    setManageRoomFeedback(null);

    // If empty/0 while typing, keep current beds and set customBeds to 0 so the user can type freely
    if (newCount === 0) {
      setManageRoomForm((prev) => ({
        ...prev,
        customBeds: 0,
      }));
      return;
    }

    const targetCount = Math.min(50, Math.max(1, newCount));

    const currentBeds = [...manageRoomForm.bedsList];
    const occupiedCount = currentBeds.filter((b) => b.status === BedStatus.OCCUPIED).length;

    if (targetCount < occupiedCount) {
      setManageRoomFeedback(`Cannot reduce capacity to ${targetCount} beds because ${occupiedCount} beds are currently Occupied.`);
      setManageRoomForm((prev) => ({
        ...prev,
        customBeds: newCount,
      }));
      return;
    }

    let updatedBeds: ManageRoomBedItem[] = [...currentBeds];
    let newDeletedIds = [...manageRoomForm.deletedBedIds];

    if (targetCount > currentBeds.length) {
      const roomNum = manageRoomForm.roomNumber.trim() || editingRoom.roomNumber;
      const existingBedNums = new Set(currentBeds.map((b) => b.bedNumber.trim().toUpperCase()));
      for (let i = currentBeds.length; i < targetCount; i++) {
        let suffixCode = 65 + i;
        let candidate = `${roomNum}-${String.fromCharCode(suffixCode)}`;
        while (existingBedNums.has(candidate.toUpperCase())) {
          suffixCode++;
          candidate = `${roomNum}-${String.fromCharCode(suffixCode)}`;
        }
        existingBedNums.add(candidate.toUpperCase());
        const tempId = `new-bed-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`;
        updatedBeds.push({
          id: tempId,
          bedNumber: candidate,
          status: BedStatus.AVAILABLE,
          monthlyRent: manageRoomForm.baseRent,
          securityDeposit: manageRoomForm.securityDeposit,
          isNew: true,
        });
      }
    } else if (targetCount < currentBeds.length) {
      const bedsToKeep: ManageRoomBedItem[] = [];
      const excess = currentBeds.length - targetCount;
      let removed = 0;

      for (let i = currentBeds.length - 1; i >= 0; i--) {
        const b = currentBeds[i];
        if (removed < excess && b.status !== BedStatus.OCCUPIED) {
          if (!b.isNew) newDeletedIds.push(b.id);
          removed++;
        } else {
          bedsToKeep.unshift(b);
        }
      }
      updatedBeds = bedsToKeep;
    }

    setManageRoomForm((prev) => ({
      ...prev,
      customBeds: targetCount,
      bedsList: updatedBeds,
      deletedBedIds: newDeletedIds,
    }));
  };

  const handleRemoveBedDirect = (bedItem: ManageRoomBedItem) => {
    if (bedItem.status === BedStatus.OCCUPIED) {
      const occ = bedOccupantMap[bedItem.id];
      setManageRoomFeedback(`Cannot remove Bed "${bedItem.bedNumber}" because it is currently Occupied by ${occ?.tenantName || 'Resident'}. Please check out or transfer the tenant first.`);
      return;
    }
    setManageRoomFeedback(null);

    setManageRoomForm((prev) => {
      // Remove ONLY this available bed — preserve all other existing bed numbers and resident identities intact!
      const remaining = prev.bedsList.filter((b) => b.id !== bedItem.id);

      let newCat: RoomCategoryType = prev.sharingCategory;
      if (remaining.length === 1) newCat = 'SINGLE';
      else if (remaining.length === 2) newCat = 'DOUBLE';
      else if (remaining.length === 3) newCat = 'TRIPLE';
      else if (remaining.length === 4) newCat = 'FOUR_SHARING';
      else if (remaining.length > 4 && newCat !== 'DORMITORY') newCat = 'CUSTOM_NORMAL';

      return {
        ...prev,
        sharingCategory: newCat,
        customBeds: remaining.length,
        bedsList: remaining,
        deletedBedIds: bedItem.isNew ? prev.deletedBedIds : [...prev.deletedBedIds, bedItem.id],
      };
    });
  };

  const handleSaveManageRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;

    if (!manageRoomForm.roomNumber.trim()) {
      setManageRoomFeedback('Please enter a valid Room Number.');
      return;
    }

    if (manageRoomForm.bedsList.length === 0) {
      setManageRoomFeedback('A room must have at least 1 bed. Please choose a sharing type with available beds.');
      return;
    }

    setIsSavingRoom(true);
    setManageRoomFeedback(null);

    try {
      // 1. Map sharingCategory to RoomSharingType
      const cat = manageRoomForm.sharingCategory;
      const count = manageRoomForm.bedsList.length;
      let sharingType = RoomSharingType.DOUBLE;
      if (cat === 'SINGLE' || count === 1) sharingType = RoomSharingType.SINGLE;
      else if (cat === 'DOUBLE' || count === 2) sharingType = RoomSharingType.DOUBLE;
      else if (cat === 'TRIPLE' || count === 3) sharingType = RoomSharingType.TRIPLE;
      else if ((cat === 'FOUR_SHARING' || cat === 'CUSTOM_NORMAL') && count === 4) sharingType = RoomSharingType.FOUR_SHARING;
      else if (cat === 'DORMITORY' || count >= 5) sharingType = RoomSharingType.DORMITORY;
      else sharingType = RoomSharingType.FOUR_SHARING;

      const baseAmenities = (editingRoom.amenities || []).filter(
        (a) => !isRoomAcEquipped([a]) && !a.startsWith('DEPOSIT:')
      );
      const depositTag = `DEPOSIT:${manageRoomForm.securityDeposit || 17000}`;
      const currentAmenities = manageRoomForm.isAc
        ? [...baseAmenities, 'Air Conditioner', 'AC', depositTag]
        : [...baseAmenities, depositTag];

      // Step 1: Delete removed beds from backend FIRST
      for (const bedId of manageRoomForm.deletedBedIds) {
        try {
          await fetch(`${API_BASE}/properties/${propertyId}/beds/${bedId}`, {
            method: 'DELETE',
            credentials: 'include',
          });
        } catch {}
      }

      // Step 2: Update room details in backend FIRST so room.capacity accommodates new beds
      const patchRoomRes = await fetch(`${API_BASE}/properties/${propertyId}/rooms/${editingRoom.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          roomNumber: manageRoomForm.roomNumber.trim(),
          sharingType,
          capacity: manageRoomForm.bedsList.length,
          baseRent: manageRoomForm.baseRent,
          amenities: currentAmenities,
        }),
      });

      if (!patchRoomRes.ok) {
        const errorJson = await patchRoomRes.json().catch(() => ({}));
        throw new Error(errorJson.message || errorJson.error?.message || `Failed to update room (Status ${patchRoomRes.status})`);
      }
      const patchRoomJson = await patchRoomRes.json();
      const savedRoom = patchRoomJson.data || {};

      // Step 3: Create new beds or update existing beds in backend
      const finalBedsForRoom: BedDto[] = [];
      for (const b of manageRoomForm.bedsList) {
        const bedRent = manageRoomForm.baseRent;
        const bedDeposit = manageRoomForm.securityDeposit;

        if (b.isNew) {
          try {
            const res = await fetch(`${API_BASE}/properties/${propertyId}/beds`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                roomId: editingRoom.id,
                bedNumber: b.bedNumber.trim(),
                monthlyRent: bedRent,
              }),
            });
            if (res.ok) {
              const j = await res.json();
              finalBedsForRoom.push({
                ...j.data,
                securityDeposit: bedDeposit,
              });
            } else {
              finalBedsForRoom.push({
                id: b.id,
                roomId: editingRoom.id,
                bedNumber: b.bedNumber.trim(),
                status: b.status,
                monthlyRent: bedRent,
                securityDeposit: bedDeposit,
                createdAt: new Date(),
                updatedAt: new Date(),
              } as unknown as BedDto);
            }
          } catch {
            finalBedsForRoom.push({
              id: b.id,
              roomId: editingRoom.id,
              bedNumber: b.bedNumber.trim(),
              status: b.status,
              monthlyRent: bedRent,
              securityDeposit: bedDeposit,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as unknown as BedDto);
          }
        } else {
          try {
            await fetch(`${API_BASE}/properties/${propertyId}/beds/${b.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                bedNumber: b.bedNumber.trim(),
                monthlyRent: bedRent,
              }),
            });
          } catch {}
          finalBedsForRoom.push({
            id: b.id,
            roomId: editingRoom.id,
            bedNumber: b.bedNumber.trim(),
            status: b.status,
            monthlyRent: bedRent,
            securityDeposit: bedDeposit,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as unknown as BedDto);
        }
      }

      // Step 4: Real-time state synchronization
      const updatedRoomData = {
        ...editingRoom,
        ...savedRoom,
        roomNumber: manageRoomForm.roomNumber.trim(),
        sharingType,
        capacity: manageRoomForm.bedsList.length,
        baseRent: manageRoomForm.baseRent,
        securityDeposit: manageRoomForm.securityDeposit,
        amenities: currentAmenities,
      };

      setRooms((prev) => prev.map((r) => (r.id === editingRoom.id ? (updatedRoomData as any) : r)));
      setBeds((prev) => {
        const withoutOldRoomBeds = prev.filter((b) => b.roomId !== editingRoom.id);
        return [...withoutOldRoomBeds, ...finalBedsForRoom];
      });

      // Synchronize occupant records for beds in this room with the new baseRent and securityDeposit
      setBedOccupantMap((prev) => {
        const next = { ...prev };
        for (const b of finalBedsForRoom) {
          if (next[b.id]) {
            next[b.id] = {
              ...next[b.id],
              monthlyRent: manageRoomForm.baseRent,
              securityDeposit: manageRoomForm.securityDeposit,
            };
          }
        }
        return next;
      });

      setSuccessMessage(`Room ${manageRoomForm.roomNumber} and its beds updated successfully.`);
      setEditingRoom(null);
      await fetchInventory();
    } catch (err: any) {
      setManageRoomFeedback(err.message || 'Error updating room and beds');
    } finally {
      setIsSavingRoom(false);
    }
  };

  // =========================================================================
  // ROOM & FLOOR DELETION HANDLERS (WITH OWNER APPROVAL DISCLAIMER MODALS)
  // =========================================================================
  const handlePromptDeleteRoom = (room: RoomDto) => {
    setDeletingRoom(room);
  };

  const handleConfirmDeleteRoom = async () => {
    if (!deletingRoom) return;
    setIsDeletingRoom(true);
    try {
      await fetch(`${API_BASE}/properties/${propertyId}/rooms/${deletingRoom.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setRooms((prev) => prev.filter((r) => r.id !== deletingRoom.id));
      setBeds((prev) => prev.filter((b) => b.roomId !== deletingRoom.id));
      setSuccessMessage(`Room ${deletingRoom.roomNumber} and its beds were permanently deleted.`);
      setDeletingRoom(null);
      fetchInventory();
    } catch {
      setErrorMessage('Failed to delete room. Please try again.');
    } finally {
      setIsDeletingRoom(false);
    }
  };

  const handlePromptDeleteFloor = (floor: FloorDto) => {
    setDeletingFloor(floor);
  };

  const handleConfirmDeleteFloor = async () => {
    if (!deletingFloor) return;
    setIsDeletingFloor(true);
    try {
      await fetch(`${API_BASE}/properties/${propertyId}/floors/${deletingFloor.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const floorRooms = rooms.filter((r) => r.floorId === deletingFloor.id);
      setFloors((prev) => prev.filter((f) => f.id !== deletingFloor.id));
      setRooms((prev) => prev.filter((r) => r.floorId !== deletingFloor.id));
      setBeds((prev) => prev.filter((b) => !floorRooms.some((r) => r.id === b.roomId)));
      setSuccessMessage(`${deletingFloor.name} and all its rooms were deleted.`);
      setDeletingFloor(null);
      fetchInventory();
    } catch {
      setErrorMessage('Failed to delete floor. Please try again.');
    } finally {
      setIsDeletingFloor(false);
    }
  };

  // =========================================================================
  // ADD ROOM TO SPECIFIC FLOOR HANDLERS
  // =========================================================================
  const handleOpenAddRoomModal = (floor: FloorDto) => {
    const floorRooms = rooms.filter((r) => r.floorId === floor.id);
    const count = floorRooms.length + 1;
    const suggestedRoomNumber = `${floor.floorNumber}${count < 10 ? '0' + count : count}`;

    setAddingRoomFloor(floor);
    setAddRoomForm({
      roomNumber: suggestedRoomNumber,
      category: 'DOUBLE',
      customBeds: 5,
      baseRent: 8500,
      securityDeposit: 17000,
      isAc: false,
    });
    setAddRoomFeedback(null);
  };

  const handleSaveNewRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingRoomFloor) return;

    if (!addRoomForm.roomNumber.trim()) {
      setAddRoomFeedback('Please enter a valid room number.');
      return;
    }

    if (Number(addRoomForm.baseRent) <= 0) {
      setAddRoomFeedback('Please enter a valid monthly rent per bed.');
      return;
    }

    setIsSavingNewRoom(true);
    setAddRoomFeedback(null);

    try {
      const cat = addRoomForm.category;
      let sharingType = RoomSharingType.DOUBLE;
      let bedCount = 2;

      if (cat === 'SINGLE') {
        sharingType = RoomSharingType.SINGLE;
        bedCount = 1;
      } else if (cat === 'DOUBLE') {
        sharingType = RoomSharingType.DOUBLE;
        bedCount = 2;
      } else if (cat === 'TRIPLE') {
        sharingType = RoomSharingType.TRIPLE;
        bedCount = 3;
      } else if (cat === 'FOUR_SHARING') {
        sharingType = RoomSharingType.FOUR_SHARING;
        bedCount = 4;
      } else if (cat === 'DORMITORY') {
        sharingType = RoomSharingType.DORMITORY;
        bedCount = addRoomForm.customBeds || 8;
      } else if (cat === 'CUSTOM_NORMAL') {
        sharingType = RoomSharingType.FOUR_SHARING;
        bedCount = addRoomForm.customBeds || 5;
      }

      // 1. Create Room in backend
      const roomRes = await fetch(`${API_BASE}/properties/${propertyId}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          floorId: addingRoomFloor.id,
          roomNumber: addRoomForm.roomNumber.trim(),
          sharingType,
          capacity: bedCount,
          baseRent: addRoomForm.baseRent,
          amenities: addRoomForm.isAc
            ? ['Air Conditioner', 'AC', `DEPOSIT:${addRoomForm.securityDeposit || 17000}`]
            : [`DEPOSIT:${addRoomForm.securityDeposit || 17000}`],
        }),
      });

      if (!roomRes.ok) {
        const errJson = await roomRes.json().catch(() => ({}));
        throw new Error(errJson.error?.message || 'Failed to create room in database');
      }

      const roomJson = await roomRes.json();
      const createdRoom = roomJson.data;

      // 2. Create Beds for this Room
      for (let i = 0; i < bedCount; i++) {
        const letterSuffix = String.fromCharCode(65 + i);
        try {
          await fetch(`${API_BASE}/properties/${propertyId}/beds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              roomId: createdRoom.id,
              bedNumber: `${addRoomForm.roomNumber.trim()}-${letterSuffix}`,
              monthlyRent: addRoomForm.baseRent,
            }),
          });
        } catch {}
      }

      setSuccessMessage(`Room ${addRoomForm.roomNumber} with ${bedCount} beds added to ${addingRoomFloor.name} successfully.`);
      setAddingRoomFloor(null);
      fetchInventory();
    } catch (err: any) {
      setAddRoomFeedback(err.message || 'Failed to add room');
    } finally {
      setIsSavingNewRoom(false);
    }
  };


  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm('Are you sure you want to remove this room and its bed records?')) return;
    try {
      const res = await fetch(`${API_BASE}/properties/${propertyId}/rooms/${roomId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setSuccessMessage('Room deleted successfully.');
        fetchInventory();
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert(errJson.error?.message || 'Failed to delete room');
      }
    } catch {
      alert('Network error');
    }
  };

  // =========================================================================
  // PG INVENTORY BUILDER HANDLERS (Same structure as Property Creation Step 5)
  // =========================================================================
  const getRoomBedCount = (room: BuilderRoomItem) => {
    if (room.category === 'CUSTOM_NORMAL' || room.category === 'DORMITORY') {
      return Math.max(1, Number(room.customBeds) || (room.category === 'DORMITORY' ? 8 : 5));
    }
    return BEDS_PER_SHARING_MAP[room.sharingType] || 1;
  };

  const handleOpenAddInventoryModal = () => {
    const validFloors = (floors || [])
      .map((f) => Number(f.floorNumber))
      .filter((n) => !isNaN(n) && isFinite(n));
    const nextFloorNum = validFloors.length > 0 ? Math.max(...validFloors) + 1 : 1;
    const initialFloor: BuilderFloorItem = {
      id: `floor-${Date.now()}`,
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
    setBuilderFloors([initialFloor]);
    setBuilderErrorMessage(null);
    setShowAddInventoryBuilderModal(true);
  };

  const handleAddBuilderFloor = () => {
    const validExisting = (floors || [])
      .map((f) => Number(f.floorNumber))
      .filter((n) => !isNaN(n) && isFinite(n));
    const startBase = validExisting.length > 0 ? Math.max(...validExisting) + 1 : 1;
    const nextFloorNum = startBase + builderFloors.length;

    const newFloor: BuilderFloorItem = {
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
    setBuilderFloors([...builderFloors, newFloor]);
  };

  const handleRemoveBuilderFloor = (floorId: string) => {
    if (builderFloors.length <= 1) return;
    const remaining = builderFloors.filter((f) => f.id !== floorId);

    const validExisting = (floors || [])
      .map((f) => Number(f.floorNumber))
      .filter((n) => !isNaN(n) && isFinite(n));
    const startBase = validExisting.length > 0 ? Math.max(...validExisting) + 1 : 1;

    const reorderedFloors = remaining.map((floor, floorIdx) => {
      const newFloorNum = startBase + floorIdx;
      const updatedRooms = floor.rooms.map((room, roomIdx) => {
        const count = roomIdx + 1;
        return {
          ...room,
          roomNumber: `${newFloorNum}${count < 10 ? '0' + count : count}`,
        };
      });
      return {
        ...floor,
        floorNumber: newFloorNum,
        name: newFloorNum === 0 ? 'Ground Floor' : `Floor ${newFloorNum}`,
        rooms: updatedRooms,
      };
    });

    setBuilderFloors(reorderedFloors);
  };

  const handleUpdateBuilderFloor = (floorId: string, field: 'name' | 'floorNumber', value: any) => {
    setBuilderFloors(
      builderFloors.map((f) => {
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

  const handleAddBuilderRoom = (floorId: string) => {
    setBuilderFloors(
      builderFloors.map((f) => {
        if (f.id === floorId) {
          const count = f.rooms.length + 1;
          const suggestedNumber = `${f.floorNumber}${count < 10 ? '0' + count : count}`;
          const newRoom: BuilderRoomItem = {
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

  const handleRemoveBuilderRoom = (floorId: string, roomId: string) => {
    setBuilderFloors(
      builderFloors.map((f) => {
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

  const handleUpdateBuilderRoom = (
    floorId: string,
    roomId: string,
    field: keyof BuilderRoomItem,
    value: any
  ) => {
    setBuilderFloors(
      builderFloors.map((f) => {
        if (f.id === floorId) {
          return {
            ...f,
            rooms: f.rooms.map((r) => {
              if (r.id === roomId) {
                const updated = { ...r, [field]: value };

                if (field === 'category') {
                  const cat = value as RoomCategoryType;
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
                    if (!r.customBeds || r.customBeds < 1) updated.customBeds = 5;
                  } else if (cat === 'DORMITORY') {
                    updated.sharingType = RoomSharingType.DORMITORY;
                    if (!r.customBeds || r.customBeds < 1) updated.customBeds = 8;
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

  const handleSaveBuilderInventory = async () => {
    setBuilderErrorMessage(null);
    if (builderFloors.length === 0) {
      setBuilderErrorMessage('Please add at least one floor level.');
      return;
    }

    for (const f of builderFloors) {
      if (!f.name.trim()) {
        setBuilderErrorMessage('All floor levels must have a valid floor name.');
        return;
      }
      if (f.rooms.length === 0) {
        setBuilderErrorMessage(`Floor "${f.name}" must contain at least one room.`);
        return;
      }
      for (const r of f.rooms) {
        if (!r.roomNumber.trim()) {
          setBuilderErrorMessage(`All rooms on "${f.name}" must have a valid room number.`);
          return;
        }
        if (Number(r.baseRent) <= 0) {
          setBuilderErrorMessage(`Room "${r.roomNumber}" on "${f.name}" must have a valid monthly rent.`);
          return;
        }
      }
    }

    setBuilderSubmitting(true);

    try {
      for (const floor of builderFloors) {
        // 1. Create Floor on backend
        const parsedFloorNumber = typeof floor.floorNumber === 'number' && !isNaN(floor.floorNumber) ? floor.floorNumber : (Number(floor.floorNumber) >= 0 ? Number(floor.floorNumber) : 1);
        const floorRes = await fetch(`${API_BASE}/properties/${propertyId}/floors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            floorNumber: parsedFloorNumber,
            name: floor.name.trim() || (parsedFloorNumber === 0 ? 'Ground Floor' : `Floor ${parsedFloorNumber}`),
          }),
        });

        const floorJson = await floorRes.json().catch(() => ({}));
        if (!floorRes.ok) {
          const errMsg = floorJson.error?.message || floorJson.message || `Failed to create floor level ${floor.floorNumber}.`;
          setBuilderErrorMessage(errMsg);
          setBuilderSubmitting(false);
          return;
        }

        const createdFloorId = floorJson.data?.id;
        if (!createdFloorId) {
          setBuilderErrorMessage(`Failed to retrieve ID for created floor ${floor.floorNumber}.`);
          setBuilderSubmitting(false);
          return;
        }

        // 2. Create each room on this floor
        for (const room of floor.rooms) {
          const bedCount = getRoomBedCount(room);
          const roomRes = await fetch(`${API_BASE}/properties/${propertyId}/rooms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              floorId: createdFloorId,
              roomNumber: room.roomNumber.trim(),
              sharingType: room.sharingType,
              capacity: bedCount,
              baseRent: Number(room.baseRent) || 8500,
              amenities: room.isAc
                ? ['Air Conditioner', 'AC', `DEPOSIT:${Number(room.securityDeposit) || 17000}`]
                : [`DEPOSIT:${Number(room.securityDeposit) || 17000}`],
              autoGenerateBeds: true,
            }),
          });

          const roomJson = await roomRes.json().catch(() => ({}));
          if (!roomRes.ok) {
            const errMsg = roomJson.error?.message || roomJson.message || `Failed to create room ${room.roomNumber}.`;
            setBuilderErrorMessage(errMsg);
            setBuilderSubmitting(false);
            return;
          }
        }
      }

      setShowAddInventoryBuilderModal(false);
      setSuccessMessage('Floors, rooms, and bed inventory generated successfully.');
      await fetchInventory();
      await fetchProperty();
    } catch {
      setBuilderErrorMessage('Network error while saving inventory records.');
    } finally {
      setBuilderSubmitting(false);
    }
  };

  // =========================================================================
  // RENTAL INVENTORY BUILDER & LIFECYCLE HANDLERS (Whole-Unit Residential)
  // =========================================================================
  const formatRentalUnitType = (unitType: string) => {
    if (!unitType) return 'Residential Unit';
    const u = unitType.toUpperCase();
    if (u === '1BHK' || u === '1_BHK' || u === '1 BHK') return '1 BHK Flat';
    if (u === '2BHK' || u === '2_BHK' || u === '2 BHK') return '2 BHK Flat';
    if (u === '3BHK' || u === '3_BHK' || u === '3 BHK') return '3 BHK Flat';
    if (u === '4BHK' || u === '4_BHK' || u === '4 BHK') return '4 BHK Flat';
    if (u === '1RK' || u === '1_RK' || u === '1 RK') return '1 RK Studio';
    if (u === 'VILLA' || u === 'INDEPENDENT HOUSE') return 'Independent Villa';
    if (u === 'PENTHOUSE') return 'Luxury Penthouse';
    if (u === 'DUPLEX') return 'Duplex House';
    if (u === 'STUDIO') return 'Studio Apartment';
    if (u === 'APARTMENT') return 'Apartment Unit';
    return unitType;
  };

  const formatFurnishingStatus = (status: string) => {
    if (!status) return 'Semi-Furnished';
    const s = status.toUpperCase();
    if (s === 'FULLY_FURNISHED' || s === 'FURNISHED') return 'Fully Furnished';
    if (s === 'SEMI_FURNISHED') return 'Semi Furnished';
    if (s === 'UNFURNISHED') return 'Unfurnished';
    return status.replace('_', ' ');
  };

  const getRentalFloorTitle = (floorNum: number | null | undefined) => {
    if (floorNum === 0 || floorNum === null || floorNum === undefined) return 'Ground Floor';
    return `Floor ${floorNum}`;
  };

  const handleSelectRentalUnit = (unit: RentalUnitDto) => {
    setSelectedRentalUnit(unit);
    setIsCheckingOutRentalUnit(false);
    setRentalOccupancyError(null);
    setRentalOccupancySuccess(null);
    setRentalCheckInMode('NEW');
    setSelectedExistingRentalTenantId('');
    setIsRentalAgreementModalOpen(false);
    setRentalExecutedAgreement(null);
    setRentalBypassAgreementGracePeriod(false);
    fetchRegisteredTenants();

    // Pre-fill terms
    const today = getLocalDateString();

    setRentalCheckInTerms({
      startDate: today,
      endDate: '',
      agreedRent: Number(unit.monthlyRent) || 25000,
      securityDeposit: Number(unit.securityDeposit) || 50000,
      maintenanceCharges: Number(unit.maintenanceCharges) || 0,
      noticePeriodDays: property?.noticePeriodDays ?? 30,
      lockInMonths: property?.lockInPeriodValue ?? property?.lockInMonths ?? 6,
      terms: '',
    });

    setRentalTenantSearchQuery('');

    setRentalNewTenantForm({
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      dateOfBirth: '',
      age: '',
      gender: 'Male',
      governmentIdType: 'Aadhaar Card',
      governmentIdNumber: '',
      documentFileName: '',
      documentFileSize: '',
      permanentAddress: '',
      permanentCity: '',
      permanentState: '',
      permanentPostalCode: '',
      occupation: '',
      employerOrCollege: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      emergencyContactRelation: '',
    });

    setRentalCheckoutSettlement({
      moveOutDate: today,
      deductions: 0,
      deductionReason: '',
      damageCharges: 0,
      keyHandoverConfirmed: false,
      remarks: '',
    });
  };

  const handleToggleRentalUnitMaintenance = async (targetStatus: RentalUnitStatus) => {
    if (!selectedRentalUnit) return;
    setRentalOccupancyError(null);
    try {
      const res = await fetch(`${API_BASE}/properties/${propertyId}/units/${selectedRentalUnit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: targetStatus }),
      });
      if (res.ok) {
        setSelectedRentalUnit({ ...selectedRentalUnit, status: targetStatus });
        setRentalUnits((prev) =>
          prev.map((u) => (u.id === selectedRentalUnit.id ? { ...u, status: targetStatus } : u))
        );
        setSuccessMessage(`Unit marked as ${targetStatus}`);
        fetchInventory();
      }
    } catch {
      setRentalOccupancyError('Failed to update status.');
    }
  };

  const handleCompleteRentalCheckIn = async () => {
    if (!selectedRentalUnit) return;
    setRentalOccupancyError(null);
    setRentalOccupancySuccess(null);
    setSubmittingRentalOccupancy(true);

    try {
      // =========================================================================
      // MANDATORY DIGITAL AGREEMENT CHECK
      // =========================================================================
      if (!agreementSignatureMap[selectedRentalUnit.id]?.isSigned) {
        setRentalOccupancyError('Digital Tenancy Agreement (E-Sign) is mandatory. Please review and E-sign the agreement with the resident before assigning unit.');
        setSubmittingRentalOccupancy(false);
        return;
      }

      let tenantIdToAssign = selectedExistingRentalTenantId;

      if (rentalCheckInMode === 'NEW') {
        if (!rentalNewTenantForm.firstName.trim() || !rentalNewTenantForm.phone.trim()) {
          setRentalOccupancyError('Please enter at least First Name and Phone Number.');
          setSubmittingRentalOccupancy(false);
          return;
        }
        if (!rentalNewTenantForm.dateOfBirth) {
          setRentalOccupancyError('Date of Birth is mandatory. Please select the date of birth.');
          setSubmittingRentalOccupancy(false);
          return;
        }
        if (!rentalNewTenantForm.governmentIdNumber.trim()) {
          setRentalOccupancyError('Document / ID Number is mandatory. Please provide the official ID number.');
          setSubmittingRentalOccupancy(false);
          return;
        }

        // 1. Create Tenant Profile
        const tenantPayload: any = {
          firstName: rentalNewTenantForm.firstName.trim(),
          lastName: rentalNewTenantForm.lastName.trim() || '—',
          phone: rentalNewTenantForm.phone.trim(),
          email: rentalNewTenantForm.email.trim() || undefined,
          gender: rentalNewTenantForm.gender || 'Male',
          dateOfBirth: rentalNewTenantForm.dateOfBirth ? new Date(rentalNewTenantForm.dateOfBirth).toISOString() : undefined,
          documentType: rentalNewTenantForm.governmentIdType || 'Aadhaar Card',
          documentNumber: rentalNewTenantForm.governmentIdNumber.trim(),
          permanentAddress: rentalNewTenantForm.permanentAddress.trim() || 'Not Provided',
          permanentCity: rentalNewTenantForm.permanentCity.trim() || 'Bengaluru',
          permanentState: rentalNewTenantForm.permanentState.trim() || 'Karnataka',
          permanentPostalCode: rentalNewTenantForm.permanentPostalCode.trim() || '560001',
          occupation: rentalNewTenantForm.occupation.trim() || undefined,
          employerOrCollege: rentalNewTenantForm.employerOrCollege.trim() || undefined,
          emergencyContactName: rentalNewTenantForm.emergencyContactName.trim() || `${rentalNewTenantForm.firstName.trim()} (Primary)`,
          emergencyContactPhone: rentalNewTenantForm.emergencyContactPhone.trim() || rentalNewTenantForm.phone.trim(),
          emergencyContactRelation: rentalNewTenantForm.emergencyContactRelation.trim() || 'Self',
        };

        const tenantRes = await fetch(`${API_BASE}/tenants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(tenantPayload),
        });

        if (!tenantRes.ok) {
          const errJson = await tenantRes.json().catch(() => ({}));
          setRentalOccupancyError(errJson.error?.message || errJson.message || 'Failed to create tenant profile.');
          setSubmittingRentalOccupancy(false);
          return;
        }

        const tenantJson = await tenantRes.json();
        tenantIdToAssign = tenantJson.data.id;
      }

      if (!tenantIdToAssign) {
        setRentalOccupancyError('Please select or create a resident for this unit.');
        setSubmittingRentalOccupancy(false);
        return;
      }

      // 2. Create Lease (Sets unit to OCCUPIED and creates active lease in DB)
      const startD = rentalCheckInTerms.startDate || getLocalDateString();
      let endD = rentalCheckInTerms.endDate;
      if (!endD) {
        const d = new Date(startD);
        d.setFullYear(d.getFullYear() + 1);
        endD = getLocalDateString(d);
      }

      const startIso = createLocalIsoString(startD);
      const endIso = createLocalIsoString(endD);

      const leaseRes = await fetch(`${API_BASE}/properties/${propertyId}/leases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          rentalUnitId: selectedRentalUnit.id,
          tenantId: tenantIdToAssign,
          startDate: startIso,
          endDate: endIso,
          monthlyRent: Number(rentalCheckInTerms.agreedRent) || Number(selectedRentalUnit.monthlyRent) || 25000,
          securityDeposit: Number(rentalCheckInTerms.securityDeposit) || Number(selectedRentalUnit.securityDeposit) || 50000,
          noticePeriodDays: Number(rentalCheckInTerms.noticePeriodDays) || 30,
          lockInMonths: Number(rentalCheckInTerms.lockInMonths) || 6,
          terms: rentalCheckInTerms.terms || undefined,
        }),
      });

      if (!leaseRes.ok) {
        const errJson = await leaseRes.json().catch(() => ({}));
        setRentalOccupancyError(errJson.error?.message || errJson.message || 'Failed to create lease.');
        setSubmittingRentalOccupancy(false);
        return;
      }

      setRentalOccupancySuccess('Check-in and lease allocation completed successfully!');
      
      const assignedTenantName = rentalCheckInMode === 'NEW'
        ? (rentalNewTenantForm.firstName ? `${rentalNewTenantForm.firstName} ${rentalNewTenantForm.lastName}`.trim() : 'Resident Tenant')
        : (registeredTenants.find((t) => t.id === tenantIdToAssign)?.firstName || 'Resident Tenant');

      const assignedTenantPhone = rentalCheckInMode === 'NEW'
        ? rentalNewTenantForm.phone
        : (registeredTenants.find((t) => t.id === tenantIdToAssign)?.phone || '');

      setPostCheckInAgreement({
        isOpen: true,
        tenantName: assignedTenantName,
        tenantPhone: assignedTenantPhone,
        tenantEmail: rentalNewTenantForm.email || '',
        unitName: `Flat / Unit ${selectedRentalUnit.unitNumber}`,
        propertyName: property?.name || 'Property',
        propertyAddress: property?.address || `${property?.city || 'Bengaluru'}, ${property?.state || 'Karnataka'}`,
        monthlyRent: Number(rentalCheckInTerms.agreedRent) || Number(selectedRentalUnit.monthlyRent) || 25000,
        securityDeposit: Number(rentalCheckInTerms.securityDeposit) || Number(selectedRentalUnit.securityDeposit) || 50000,
        agreementType: 'RENTAL_AGREEMENT',
        isSigned: !!agreementSignatureMap[selectedRentalUnit.id]?.isSigned,
      });

      broadcastTenancyEvent();
      setTimeout(() => {
        setSelectedRentalUnit(null);
        fetchInventory();
        fetchRegisteredTenants();
      }, 1000);
    } catch {
      setRentalOccupancyError('Network error while completing check-in.');
    } finally {
      setSubmittingRentalOccupancy(false);
    }
  };

  const handleApproveRentalCheckout = async () => {
    if (!selectedRentalUnit || !selectedRentalUnit.activeLease) return;
    if (!rentalCheckoutSettlement.keyHandoverConfirmed) {
      setRentalOccupancyError('Please confirm key handover and physical flat handover inspection.');
      return;
    }

    setRentalOccupancyError(null);
    setRentalOccupancySuccess(null);
    setSubmittingRentalOccupancy(true);

    try {
      // 1. Terminate Lease
      const checkoutTimestamp = createLocalIsoString(rentalCheckoutSettlement.moveOutDate);
      const leaseRes = await fetch(
        `${API_BASE}/properties/${propertyId}/leases/${selectedRentalUnit.activeLease.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            status: 'TERMINATED',
            endDate: checkoutTimestamp,
          }),
        }
      );

      if (!leaseRes.ok) {
        const errJson = await leaseRes.json();
        setRentalOccupancyError(errJson.error?.message || errJson.message || 'Failed to finalize lease settlement.');
        setSubmittingRentalOccupancy(false);
        return;
      }

      // 2. Ensure Unit Status is set to AVAILABLE
      await fetch(`${API_BASE}/properties/${propertyId}/units/${selectedRentalUnit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: RentalUnitStatus.AVAILABLE,
        }),
      });

      // 3. Immediately free up tenant in registeredTenants local state
      const targetTenantId = (selectedRentalUnit.activeLease as any)?.tenantId || (selectedRentalUnit.activeLease as any)?.tenant?.id;
      if (targetTenantId) {
        await fetch(`${API_BASE}/tenants/${targetTenantId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            status: 'CHECKED_OUT',
          }),
        }).catch(() => {});
        setRegisteredTenants((prev) =>
          prev.map((t) => {
            if (t.id === targetTenantId) {
              const updatedLeases = (t.leases || []).map((l: any) =>
                l.id === selectedRentalUnit.activeLease?.id || l.rentalUnitId === selectedRentalUnit.id
                  ? { ...l, status: 'TERMINATED' }
                  : l
              );
              // Ensure this property is in leases if not already
              if (!updatedLeases.some((l: any) => l.rentalUnitId === selectedRentalUnit.id)) {
                updatedLeases.push({
                  id: selectedRentalUnit.activeLease?.id || `lease-${Date.now()}`,
                  status: 'TERMINATED',
                  startDate: selectedRentalUnit.activeLease?.startDate || new Date().toISOString(),
                  endDate: rentalCheckoutSettlement.moveOutDate || new Date().toISOString(),
                  monthlyRent: Number(selectedRentalUnit.monthlyRent),
                  rentalUnitId: selectedRentalUnit.id,
                  unitNumber: selectedRentalUnit.unitNumber,
                  propertyId: propertyId,
                  propertyName: property?.name || '',
                });
              }
              return {
                ...t,
                status: 'INACTIVE',
                currentLease: null,
                leases: updatedLeases,
              } as any;
            }
            return t;
          })
        );
      }

      setRentalOccupancySuccess('Check-out finalized and unit released to Available!');
      setSelectedRentalUnit((prev) => (prev ? { ...prev, status: RentalUnitStatus.AVAILABLE, activeLease: null } : null));
      setIsCheckingOutRentalUnit(false);
      broadcastTenancyEvent();
      fetchInventory();
      fetchRegisteredTenants();
    } catch {
      setRentalOccupancyError('Network error during check-out.');
    } finally {
      setSubmittingRentalOccupancy(false);
    }
  };

  const handleOpenRentalBuilderModal = () => {
    const validFloors = (rentalDistinctFloors || []).filter((n) => typeof n === 'number' && !isNaN(n) && isFinite(n));
    const nextFloorNum = validFloors.length > 0 ? Math.max(...validFloors) + 1 : 1;
    const initialFloor: BuilderRentalFloorItem = {
      id: `floor-${Date.now()}`,
      floorNumber: nextFloorNum,
      name: nextFloorNum === 0 ? 'Ground Floor' : `Floor ${nextFloorNum}`,
      houses: [
        {
          id: `house-${Date.now()}-1`,
          houseNumber: `Flat ${nextFloorNum}01`,
          bhkType: '2BHK',
          carpetAreaSqFt: 1200,
          superBuiltupAreaSqFt: 1450,
          furnishingStatus: 'SEMI_FURNISHED',
          monthlyRent: 25000,
          securityDeposit: 50000,
          maintenanceCharges: 2000,
        },
        {
          id: `house-${Date.now()}-2`,
          houseNumber: `Flat ${nextFloorNum}02`,
          bhkType: '2BHK',
          carpetAreaSqFt: 1200,
          superBuiltupAreaSqFt: 1450,
          furnishingStatus: 'SEMI_FURNISHED',
          monthlyRent: 25000,
          securityDeposit: 50000,
          maintenanceCharges: 2000,
        },
      ],
    };
    setBuilderRentalFloors([initialFloor]);
    setRentalBuilderErrorMessage(null);
    setShowRentalBuilderModal(true);
  };

  const handleAddRentalBuilderFloor = () => {
    const validExisting = (rentalDistinctFloors || []).filter(
      (n) => typeof n === 'number' && !isNaN(n) && isFinite(n)
    );
    const startBase = validExisting.length > 0 ? Math.max(...validExisting) + 1 : 1;
    const nextNum = startBase + builderRentalFloors.length;

    const newFloor: BuilderRentalFloorItem = {
      id: `floor-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      floorNumber: nextNum,
      name: nextNum === 0 ? 'Ground Floor' : `Floor ${nextNum}`,
      houses: [
        {
          id: `house-${Date.now()}-1`,
          houseNumber: `Flat ${nextNum}01`,
          bhkType: '2BHK',
          carpetAreaSqFt: 1200,
          superBuiltupAreaSqFt: 1450,
          furnishingStatus: 'SEMI_FURNISHED',
          monthlyRent: 25000,
          securityDeposit: 50000,
          maintenanceCharges: 2000,
        },
        {
          id: `house-${Date.now()}-2`,
          houseNumber: `Flat ${nextNum}02`,
          bhkType: '2BHK',
          carpetAreaSqFt: 1200,
          superBuiltupAreaSqFt: 1450,
          furnishingStatus: 'SEMI_FURNISHED',
          monthlyRent: 25000,
          securityDeposit: 50000,
          maintenanceCharges: 2000,
        },
      ],
    };
    setBuilderRentalFloors([...builderRentalFloors, newFloor]);
  };

  const handleRemoveRentalBuilderFloor = (floorId: string) => {
    if (builderRentalFloors.length <= 1) return;
    const remaining = builderRentalFloors.filter((f) => f.id !== floorId);

    const validExisting = (rentalDistinctFloors || []).filter(
      (n) => typeof n === 'number' && !isNaN(n) && isFinite(n)
    );
    const startBase = validExisting.length > 0 ? Math.max(...validExisting) + 1 : 1;

    const reorderedFloors = remaining.map((floor, floorIdx) => {
      const newFloorNum = startBase + floorIdx;
      const updatedHouses = floor.houses.map((house, houseIdx) => {
        const count = houseIdx + 1;
        return {
          ...house,
          houseNumber: `Flat ${newFloorNum}${count < 10 ? '0' + count : count}`,
        };
      });
      return {
        ...floor,
        floorNumber: newFloorNum,
        name: newFloorNum === 0 ? 'Ground Floor' : `Floor ${newFloorNum}`,
        houses: updatedHouses,
      };
    });

    setBuilderRentalFloors(reorderedFloors);
  };

  const handleUpdateRentalBuilderFloor = (floorId: string, field: 'name' | 'floorNumber', value: any) => {
    setBuilderRentalFloors(
      builderRentalFloors.map((f) => {
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

  const handleAddRentalBuilderHouse = (floorId: string) => {
    setBuilderRentalFloors(
      builderRentalFloors.map((f) => {
        if (f.id === floorId) {
          const count = f.houses.length + 1;
          const suggested = `Flat ${f.floorNumber}${count < 10 ? '0' + count : count}`;
          const newHouse: BuilderRentalHouseItem = {
            id: `house-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            houseNumber: suggested,
            bhkType: '2BHK',
            carpetAreaSqFt: 1200,
            superBuiltupAreaSqFt: 1450,
            furnishingStatus: 'SEMI_FURNISHED',
            monthlyRent: 25000,
            securityDeposit: 50000,
            maintenanceCharges: 2000,
          };
          return { ...f, houses: [...f.houses, newHouse] };
        }
        return f;
      })
    );
  };

  const handleRemoveRentalBuilderHouse = (floorId: string, houseId: string) => {
    setBuilderRentalFloors(
      builderRentalFloors.map((f) => {
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

  const handleUpdateRentalBuilderHouse = (
    floorId: string,
    houseId: string,
    field: keyof BuilderRentalHouseItem,
    value: any
  ) => {
    setBuilderRentalFloors(
      builderRentalFloors.map((f) => {
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

  const handleSaveRentalBuilderInventory = async () => {
    setRentalBuilderErrorMessage(null);
    if (builderRentalFloors.length === 0) {
      setRentalBuilderErrorMessage('Please add at least one floor.');
      return;
    }

    for (const f of builderRentalFloors) {
      if (f.houses.length === 0) {
        setRentalBuilderErrorMessage(`Floor "${f.name}" must contain at least one house/flat.`);
        return;
      }
      for (const h of f.houses) {
        if (!h.houseNumber.trim()) {
          setRentalBuilderErrorMessage(`All houses on "${f.name}" must have a valid house/flat number.`);
          return;
        }
        if (Number(h.monthlyRent) <= 0) {
          setRentalBuilderErrorMessage(`House "${h.houseNumber}" must have a valid monthly rent.`);
          return;
        }
      }
    }

    setRentalBuilderSubmitting(true);

    try {
      for (const floor of builderRentalFloors) {
        const parsedFloorNumber = typeof floor.floorNumber === 'number' && !isNaN(floor.floorNumber) ? floor.floorNumber : (Number(floor.floorNumber) >= 0 ? Number(floor.floorNumber) : 1);
        for (const house of floor.houses) {
          const res = await fetch(`${API_BASE}/properties/${propertyId}/units`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              unitNumber: house.houseNumber.trim(),
              unitType: house.bhkType,
              floorNumber: parsedFloorNumber,
              carpetAreaSqFt: Number(house.carpetAreaSqFt) || undefined,
              superBuiltupAreaSqFt: Number(house.superBuiltupAreaSqFt) || undefined,
              furnishingStatus: house.furnishingStatus || 'SEMI_FURNISHED',
              monthlyRent: Number(house.monthlyRent) || 25000,
              securityDeposit: Number(house.securityDeposit) || 50000,
              maintenanceCharges: Number(house.maintenanceCharges) || 0,
            }),
          });

          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            const errMsg = json.error?.message || json.message || `Failed to create house ${house.houseNumber}.`;
            setRentalBuilderErrorMessage(errMsg);
            setRentalBuilderSubmitting(false);
            return;
          }
        }
      }

      setShowRentalBuilderModal(false);
      setSuccessMessage('Residential units and floors generated successfully.');
      await fetchInventory();
      await fetchProperty();
    } catch {
      setRentalBuilderErrorMessage('Network error while adding rental units.');
    } finally {
      setRentalBuilderSubmitting(false);
    }
  };

  // Add Single House to Existing Floor
  const handleOpenAddHouseToFloor = (floorNumber: number) => {
    setAddingHouseFloorNumber(floorNumber);
    const existingOnFloor = rentalUnits.filter((u) => (u.floorNumber ?? 1) === floorNumber);
    const count = existingOnFloor.length + 1;
    const suggested = `Flat ${floorNumber}${count < 10 ? '0' + count : count}`;
    setAddHouseForm({
      houseNumber: suggested,
      bhkType: '2BHK',
      carpetAreaSqFt: 1200,
      superBuiltupAreaSqFt: 1450,
      furnishingStatus: 'SEMI_FURNISHED',
      monthlyRent: 25000,
      securityDeposit: 50000,
      maintenanceCharges: 2000,
    });
    setAddHouseFeedback(null);
  };

  const handleSaveSingleHouseToFloor = async () => {
    if (addingHouseFloorNumber === null) return;
    if (!addHouseForm.houseNumber.trim()) {
      setAddHouseFeedback('Please enter a house / flat number.');
      return;
    }
    if (Number(addHouseForm.monthlyRent) <= 0) {
      setAddHouseFeedback('Monthly rent must be greater than 0.');
      return;
    }

    setIsSavingNewHouse(true);
    setAddHouseFeedback(null);

    try {
      const res = await fetch(`${API_BASE}/properties/${propertyId}/units`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          unitNumber: addHouseForm.houseNumber.trim(),
          unitType: addHouseForm.bhkType,
          floorNumber: addingHouseFloorNumber,
          carpetAreaSqFt: Number(addHouseForm.carpetAreaSqFt) || undefined,
          superBuiltupAreaSqFt: Number(addHouseForm.superBuiltupAreaSqFt) || undefined,
          furnishingStatus: addHouseForm.furnishingStatus || 'SEMI_FURNISHED',
          monthlyRent: Number(addHouseForm.monthlyRent) || 25000,
          securityDeposit: Number(addHouseForm.securityDeposit) || 50000,
          maintenanceCharges: Number(addHouseForm.maintenanceCharges) || 0,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        setAddHouseFeedback(errJson.error?.message || errJson.message || 'Failed to add house unit.');
        setIsSavingNewHouse(false);
        return;
      }

      setSuccessMessage(`House unit "${addHouseForm.houseNumber.trim()}" created successfully.`);
      setAddingHouseFloorNumber(null);
      fetchInventory();
    } catch {
      setAddHouseFeedback('Network error while saving house unit.');
    } finally {
      setIsSavingNewHouse(false);
    }
  };

  // Edit House / Unit Specifications
  const handleOpenEditRentalUnit = (unit: RentalUnitDto) => {
    setEditingRentalUnit(unit);
    setEditRentalUnitForm({
      unitNumber: unit.unitNumber,
      unitType: unit.unitType || '2BHK',
      floorNumber: unit.floorNumber ?? 1,
      carpetAreaSqFt: Number(unit.carpetAreaSqFt) || 1200,
      superBuiltupAreaSqFt: Number(unit.superBuiltupAreaSqFt) || 1450,
      furnishingStatus: unit.furnishingStatus || 'SEMI_FURNISHED',
      monthlyRent: Number(unit.monthlyRent) || 25000,
      securityDeposit: Number(unit.securityDeposit) || 50000,
      maintenanceCharges: Number(unit.maintenanceCharges) || 0,
    });
    setEditRentalUnitFeedback(null);
  };

  const handleSaveRentalUnitEdit = async () => {
    if (!editingRentalUnit) return;
    if (!editRentalUnitForm.unitNumber.trim()) {
      setEditRentalUnitFeedback('Please enter a house / flat number.');
      return;
    }
    if (Number(editRentalUnitForm.monthlyRent) <= 0) {
      setEditRentalUnitFeedback('Monthly rent must be greater than 0.');
      return;
    }

    setIsSavingRentalUnitEdit(true);
    setEditRentalUnitFeedback(null);

    try {
      const res = await fetch(`${API_BASE}/properties/${propertyId}/units/${editingRentalUnit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          unitNumber: editRentalUnitForm.unitNumber.trim(),
          unitType: editRentalUnitForm.unitType,
          floorNumber: Number(editRentalUnitForm.floorNumber) || 1,
          carpetAreaSqFt: Number(editRentalUnitForm.carpetAreaSqFt) || undefined,
          superBuiltupAreaSqFt: Number(editRentalUnitForm.superBuiltupAreaSqFt) || undefined,
          furnishingStatus: editRentalUnitForm.furnishingStatus || 'SEMI_FURNISHED',
          monthlyRent: Number(editRentalUnitForm.monthlyRent) || 25000,
          securityDeposit: Number(editRentalUnitForm.securityDeposit) || 50000,
          maintenanceCharges: Number(editRentalUnitForm.maintenanceCharges) || 0,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        setEditRentalUnitFeedback(errJson.error?.message || errJson.message || 'Failed to update house specifications.');
        setIsSavingRentalUnitEdit(false);
        return;
      }

      setSuccessMessage(`Unit "${editRentalUnitForm.unitNumber.trim()}" specifications updated.`);
      setEditingRentalUnit(null);
      fetchInventory();
    } catch {
      setEditRentalUnitFeedback('Network error while saving changes.');
    } finally {
      setIsSavingRentalUnitEdit(false);
    }
  };

  // Delete House / Unit
  const handleOpenDeleteRentalUnit = (unit: RentalUnitDto) => {
    setDeletingRentalUnit(unit);
  };

  const handleConfirmDeleteRentalUnit = async () => {
    if (!deletingRentalUnit) return;
    setIsDeletingRentalUnit(true);

    try {
      const res = await fetch(`${API_BASE}/properties/${propertyId}/units/${deletingRentalUnit.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        setSuccessMessage(`Unit "${deletingRentalUnit.unitNumber}" removed.`);
        setDeletingRentalUnit(null);
        fetchInventory();
      }
    } catch {} finally {
      setIsDeletingRentalUnit(false);
    }
  };

  // Agreement Details Helper Computations for Digital E-Signing
  const getPgAgreementDetails = (): AgreementSignDetails => {
    let tName = 'New Resident';
    let tPhone = '';
    let tEmail = '';
    let tAddress = '';
    let tAadhaar = '';

    if (checkInMode === 'NEW') {
      const raw = newTenantForm.firstName.trim();
      const parts = raw.split(/\s+/);
      const fName = parts[0] || 'Resident';
      const lName = parts.length > 1 ? parts.slice(1).join(' ') : (newTenantForm.lastName.trim() || '');
      tName = `${fName} ${lName}`.trim();
      tPhone = newTenantForm.phone.trim();
      tEmail = newTenantForm.email.trim();

      const addrParts = [
        newTenantForm.permanentAddress.trim(),
        newTenantForm.permanentCity.trim(),
        newTenantForm.permanentState.trim(),
        newTenantForm.permanentPostalCode.trim(),
      ].filter(Boolean);
      tAddress = addrParts.join(', ');

      const docType = newTenantForm.governmentIdType.trim() || 'Aadhaar';
      const docNum = newTenantForm.governmentIdNumber.trim();
      tAadhaar = formatIdProofDisplay(docType, docNum);
    } else {
      const found: any = registeredTenants.find((t) => t.id === selectedExistingTenantId);
      if (found) {
        tName = `${found.firstName} ${found.lastName === '—' ? '' : found.lastName}`.trim();
        tPhone = found.phone || '';
        tEmail = found.email || '';

        const addrParts = [
          found.permanentAddress,
          found.permanentCity,
          found.permanentState,
          found.permanentPostalCode,
        ].filter(Boolean);
        tAddress = addrParts.join(', ');

        const doc = found.documents && found.documents.length > 0 ? found.documents[0] : null;
        const docType = doc?.documentType || found.governmentIdType || 'Aadhaar';
        const docNum = doc?.documentNumber || found.governmentIdNumber || found.aadhaarNumber || '';
        tAadhaar = formatIdProofDisplay(docType, docNum);
      }
    }

    const existingSig = selectedBed ? agreementSignatureMap[selectedBed.id]?.signatureImage : undefined;
    const existingWitnesses = selectedBed ? agreementSignatureMap[selectedBed.id]?.witnesses : undefined;

    return {
      tenantName: tName || 'Resident',
      tenantPhone: tPhone,
      tenantEmail: tEmail,
      tenantAddress: tAddress || undefined,
      tenantAadhaar: tAadhaar || undefined,
      ownerName: property?.ownerName || `${property?.name || 'PG Facility'} Management`,
      ownerAddress: fullPropertyAddress || property?.address || '',
      ownerPhone: property?.contactPhone || '',
      ownerSignature: property?.ownerSignature || 'DIGITAL_STAMP_DEFAULT',
      residentSignature: existingSig,
      witnesses: existingWitnesses,
      propertyName: property?.name || 'PG Facility',
      propertyAddress: fullPropertyAddress || property?.address || '',
      propertyType: 'PG',
      unitOrBedName: selectedBed ? `Bed ${selectedBed.bedNumber}` : 'Bed Allocation',
      roomNumber: selectedBedRoom?.roomNumber || '',
      sharingType: selectedBedRoom?.sharingType,
      monthlyRent: Number(checkInTerms.agreedRent) || Number(selectedBed?.monthlyRent) || 8500,
      securityDeposit: Number(checkInTerms.securityDeposit) || Number((selectedBedRoom as any)?.securityDeposit) || 17000,
      startDate: checkInTerms.moveInDate || getLocalDateString(),
      endDate: checkInTerms.expectedCheckoutDate || undefined,
      noticePeriodDays: property?.noticePeriodDays ?? 30,
      lockInMonths: property?.lockInPeriodValue ?? property?.lockInMonths ?? 1,
      lockInPeriodValue: property?.lockInPeriodValue ?? property?.lockInMonths ?? 1,
      lockInPeriodUnit: property?.lockInPeriodUnit || 'MONTHS',
    };
  };

  const getRentalAgreementDetails = (): AgreementSignDetails => {
    let tName = 'New Resident';
    let tPhone = '';
    let tEmail = '';
    let tAddress = '';
    let tAadhaar = '';

    if (rentalCheckInMode === 'NEW') {
      tName = `${rentalNewTenantForm.firstName} ${rentalNewTenantForm.lastName}`.trim();
      tPhone = rentalNewTenantForm.phone.trim();
      tEmail = rentalNewTenantForm.email.trim();

      const addrParts = [
        rentalNewTenantForm.permanentAddress.trim(),
        rentalNewTenantForm.permanentCity.trim(),
        rentalNewTenantForm.permanentState.trim(),
        rentalNewTenantForm.permanentPostalCode.trim(),
      ].filter(Boolean);
      tAddress = addrParts.join(', ');

      const docType = rentalNewTenantForm.governmentIdType.trim() || 'Aadhaar';
      const docNum = rentalNewTenantForm.governmentIdNumber.trim();
      tAadhaar = formatIdProofDisplay(docType, docNum);
    } else {
      const found: any = registeredTenants.find((t) => t.id === selectedExistingRentalTenantId);
      if (found) {
        tName = `${found.firstName} ${found.lastName === '—' ? '' : found.lastName}`.trim();
        tPhone = found.phone || '';
        tEmail = found.email || '';

        const addrParts = [
          found.permanentAddress,
          found.permanentCity,
          found.permanentState,
          found.permanentPostalCode,
        ].filter(Boolean);
        tAddress = addrParts.join(', ');

        const doc = found.documents && found.documents.length > 0 ? found.documents[0] : null;
        const docType = doc?.documentType || found.governmentIdType || 'Aadhaar';
        const docNum = doc?.documentNumber || found.governmentIdNumber || found.aadhaarNumber || '';
        tAadhaar = formatIdProofDisplay(docType, docNum);
      }
    }

    const existingSig = selectedRentalUnit ? agreementSignatureMap[selectedRentalUnit.id]?.signatureImage : undefined;
    const existingWitnesses = selectedRentalUnit ? agreementSignatureMap[selectedRentalUnit.id]?.witnesses : undefined;

    return {
      tenantName: tName || 'Resident',
      tenantPhone: tPhone,
      tenantEmail: tEmail,
      tenantAddress: tAddress || undefined,
      tenantAadhaar: tAadhaar || undefined,
      ownerName: property?.ownerName || `${property?.name || 'Residential Property'} Landlord`,
      ownerAddress: fullPropertyAddress || property?.address || '',
      ownerPhone: property?.contactPhone || '',
      ownerSignature: property?.ownerSignature || 'DIGITAL_STAMP_DEFAULT',
      residentSignature: existingSig,
      witnesses: existingWitnesses,
      propertyName: property?.name || 'Residential Property',
      propertyAddress: fullPropertyAddress || property?.address || '',
      propertyType: 'RENTAL_HOUSE',
      unitOrBedName: selectedRentalUnit?.unitNumber || 'Rental Flat',
      monthlyRent: Number(rentalCheckInTerms.agreedRent) || Number(selectedRentalUnit?.monthlyRent) || 25000,
      securityDeposit: Number(rentalCheckInTerms.securityDeposit) || Number(selectedRentalUnit?.securityDeposit) || 50000,
      startDate: rentalCheckInTerms.startDate || getLocalDateString(),
      endDate: rentalCheckInTerms.endDate || undefined,
      noticePeriodDays: Number(rentalCheckInTerms.noticePeriodDays) || property?.noticePeriodDays || 30,
      lockInMonths: Number(rentalCheckInTerms.lockInMonths) || property?.lockInPeriodValue || property?.lockInMonths || 6,
      lockInPeriodValue: Number(rentalCheckInTerms.lockInMonths) || property?.lockInPeriodValue || property?.lockInMonths || 6,
      lockInPeriodUnit: property?.lockInPeriodUnit || 'MONTHS',
    };
  };

  // Delete Floor
  const handleOpenDeleteRentalFloor = (floorNumber: number) => {
    setDeletingRentalFloorNumber(floorNumber);
  };

  const handleConfirmDeleteRentalFloor = async () => {
    if (deletingRentalFloorNumber === null) return;
    setIsDeletingRentalFloor(true);

    try {
      const unitsOnFloor = rentalUnits.filter((u) => (u.floorNumber ?? 1) === deletingRentalFloorNumber);
      for (const u of unitsOnFloor) {
        await fetch(`${API_BASE}/properties/${propertyId}/units/${u.id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
      }

      setSuccessMessage(`Floor ${deletingRentalFloorNumber} and its units removed.`);
      setDeletingRentalFloorNumber(null);
      fetchInventory();
    } catch {} finally {
      setIsDeletingRentalFloor(false);
    }
  };

  const formatSharingLabel = (type: string, capacity?: number) => {
    if (type === 'SINGLE' || capacity === 1) return 'Single Sharing (1 Bed)';
    if (type === 'DOUBLE' || capacity === 2) return 'Double Sharing (2 Beds)';
    if (type === 'TRIPLE' || capacity === 3) return 'Triple Sharing (3 Beds)';
    if (type === 'FOUR_SHARING' && (!capacity || capacity === 4)) return 'Quad Sharing (4 Beds)';
    if (type === 'DORMITORY') return `Dormitory (${capacity || 8} Beds)`;
    if (capacity && capacity > 0) return `Custom Room (${capacity} Beds)`;
    return `${type.replace('_', ' ')} Sharing`;
  };

  const fullPropertyAddress = [
    property?.addressLine1,
    property?.addressLine2,
    property?.locality,
    property?.city,
    property?.state ? `${property.state}${property?.postalCode ? ` — ${property.postalCode}` : ''}` : property?.postalCode,
  ].filter(Boolean).join(', ') || property?.address || `${property?.city || 'Bengaluru'}, ${property?.state || 'Karnataka'}`;

  if (isLoading) {
    return (
      <AppShell activePath="/properties">
        <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
          <div className="h-8 bg-slate-100 rounded w-1/3" />
          <div className="h-48 bg-slate-100 rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64 bg-slate-100 rounded-2xl" />
            <div className="h-64 bg-slate-100 rounded-2xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!property) {
    return (
      <AppShell activePath="/properties">
        <div className="max-w-4xl mx-auto p-12 bg-brand-white rounded-2xl border border-surface-border text-center space-y-4">
          <AlertCircle className="w-8 h-8 text-brand-navy mx-auto" />
          <h2 className="text-lg font-bold text-brand-navy">Property Not Found</h2>
          <p className="text-xs text-surface-textSecondary">
            {errorMessage || 'The requested property could not be located or belongs to another organization.'}
          </p>
          <Link href="/properties">
            <Button variant="primary" size="sm">
              Back to Properties
            </Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const isPG = property.propertyType === PropertyType.PG;
  const isArchived = property.status === PropertyStatus.ARCHIVED;

  // PG Inventory Metrics (Real-time Live Calculations)
  const totalBeds = beds.length;
  const occupiedBeds = beds.filter((b) => b.status === BedStatus.OCCUPIED).length;
  const availableBeds = beds.filter((b) => b.status === BedStatus.AVAILABLE).length;
  const reservedBeds = beds.filter((b) => b.status === BedStatus.RESERVED).length;
  const maintenanceBeds = beds.filter((b) => b.status === BedStatus.MAINTENANCE).length;
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  const totalPgMonthlyRent = beds.reduce((acc, b) => {
    const occ = bedOccupantMap[b.id];
    if (occ?.monthlyRent) return acc + Number(occ.monthlyRent);
    const room = rooms.find((r) => r.id === b.roomId);
    const bedRent = Number(b.monthlyRent) || (room ? Number(room.baseRent) : 8500);
    return acc + bedRent;
  }, 0);

  const totalPgSecurityDeposit = beds.reduce((acc, b) => {
    const occ = bedOccupantMap[b.id];
    if (occ?.securityDeposit) return acc + Number(occ.securityDeposit);
    const room = rooms.find((r) => r.id === b.roomId);
    const deposit = getRoomSecurityDeposit(room, [b]);
    return acc + deposit;
  }, 0);

  // Filtered PG Rooms
  const filteredRooms = rooms.filter((r) => {
    const matchesSearch =
      r.roomNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.sharingType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSharing = sharingFilter === 'ALL' || r.sharingType === sharingFilter;
    const matchesFloor = floorFilter === 'ALL' || r.floorId === floorFilter;

    if (statusFilter !== 'ALL') {
      const roomBeds = beds.filter((b) => b.roomId === r.id);
      const hasStatus = roomBeds.some((b) => b.status === statusFilter);
      return matchesSearch && matchesSharing && matchesFloor && hasStatus;
    }
    return matchesSearch && matchesSharing && matchesFloor;
  });

  // Rental Units Metrics & Multi-Filters
  const rentalDistinctFloors = Array.from(new Set(rentalUnits.map((u) => u.floorNumber ?? 1))).sort((a, b) => a - b);
  const rentalFloorsCount = rentalDistinctFloors.length;
  const totalRentalUnits = rentalUnits.length;
  const vacantUnits = rentalUnits.filter((u) => u.status === RentalUnitStatus.AVAILABLE).length;
  const occupiedUnits = rentalUnits.filter((u) => u.status === RentalUnitStatus.OCCUPIED).length;
  const maintenanceUnits = rentalUnits.filter((u) => u.status === RentalUnitStatus.MAINTENANCE).length;
  const rentalOccupancyRate = totalRentalUnits > 0 ? Math.round((occupiedUnits / totalRentalUnits) * 100) : 0;
  const totalMonthlyRentRoll = rentalUnits.reduce((acc, u) => acc + (Number(u.monthlyRent) || 0), 0);
  const totalDepositRoll = rentalUnits.reduce((acc, u) => acc + (Number(u.securityDeposit) || 0), 0);

  const filteredRentalUnits = rentalUnits.filter((u) => {
    const tenantName = u.activeLease?.tenant ? `${u.activeLease.tenant.firstName} ${u.activeLease.tenant.lastName}` : '';
    const matchesSearch =
      u.unitNumber.toLowerCase().includes(rentalSearchQuery.toLowerCase()) ||
      u.unitType.toLowerCase().includes(rentalSearchQuery.toLowerCase()) ||
      tenantName.toLowerCase().includes(rentalSearchQuery.toLowerCase());
    const matchesStatus = rentalStatusFilter === 'ALL' || u.status === rentalStatusFilter;
    const matchesFloor = rentalFloorFilter === 'ALL' || String(u.floorNumber ?? 1) === rentalFloorFilter;
    const matchesType = rentalTypeFilter === 'ALL' || u.unitType.toUpperCase().includes(rentalTypeFilter.toUpperCase());
    return matchesSearch && matchesStatus && matchesFloor && matchesType;
  });

  // Rental Builder Calculations
  const builderRentalTotalHouses = builderRentalFloors.reduce((acc, f) => acc + f.houses.length, 0);
  const builderRentalMonthlyRent = builderRentalFloors.reduce(
    (acc, f) => acc + f.houses.reduce((hAcc, h) => hAcc + (Number(h.monthlyRent) || 0), 0),
    0
  );
  const builderRentalSecurityDeposit = builderRentalFloors.reduce(
    (acc, f) => acc + f.houses.reduce((hAcc, h) => hAcc + (Number(h.securityDeposit) || 0), 0),
    0
  );

  // Builder Calculations
  const builderTotalRooms = builderFloors.reduce((acc, f) => acc + f.rooms.length, 0);
  const builderTotalBeds = builderFloors.reduce(
    (acc, f) => acc + f.rooms.reduce((rAcc, r) => rAcc + getRoomBedCount(r), 0),
    0
  );
  const builderMonthlyRent = builderFloors.reduce(
    (acc, f) =>
      acc +
      f.rooms.reduce(
        (rAcc, r) => rAcc + getRoomBedCount(r) * (Number(r.baseRent) || 0),
        0
      ),
    0
  );
  const builderSecurityDeposit = builderFloors.reduce(
    (acc, f) =>
      acc +
      f.rooms.reduce(
        (rAcc, r) => rAcc + getRoomBedCount(r) * (Number(r.securityDeposit) || 0),
        0
      ),
    0
  );

  // Sorted floors for grouped display
  const sortedFloors = [...floors].sort((a, b) => a.floorNumber - b.floorNumber);

  return (
    <AppShell activePath="/properties">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation Breadcrumb & Back Button */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-surface-textSecondary">
            <Link href="/properties" className="hover:text-brand-navy font-medium">
              Properties
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-brand-navy font-semibold">{property.name}</span>
          </div>

          <BackButton fallbackHref="/properties" label="Back to Properties" />
        </div>

        {/* Feedback Messages */}
        {successMessage && (
          <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-xs text-brand-teal flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-teal-700 hover:text-teal-900">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-300 text-xs text-brand-navy flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-slate-600 hover:text-slate-900">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Property Header Banner */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 shadow-2xs ${
                  isPG
                    ? 'bg-teal-50 text-teal-800 border-teal-200'
                    : 'bg-blue-50 text-blue-800 border-blue-200'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                {isPG ? 'PG / Co-Living Operating Model' : 'Whole-Unit Rental Operating Model'}
              </span>
              {isArchived && (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-300">
                  Archived
                </span>
              )}
            </div>
            <h1 className="text-3xl font-extrabold text-brand-navy tracking-tight">{property.name}</h1>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <MapPin className={`w-4 h-4 ${isPG ? 'text-brand-teal' : 'text-blue-600'} shrink-0`} />
              <span className="font-medium">
                {property.address}, {property.locality ? `${property.locality}, ` : ''}
                {property.city}, {property.state} — {property.postalCode}
              </span>
            </div>
          </div>

          {/* Header Action Controls */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(true)}
              className="gap-2 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs px-3.5 py-2 h-9 rounded-xl cursor-pointer"
            >
              <Edit className={`w-4 h-4 ${isPG ? 'text-brand-teal' : 'text-blue-600'}`} />
              <span>Edit Details</span>
            </Button>

            {/* Property Status Dropdown Options Button */}
            <div ref={statusDropdownRef} className="relative">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setIsStatusDropdownOpen((prev) => !prev)}
                className={`inline-flex items-center gap-2 text-xs font-bold px-3.5 py-2 h-9 rounded-xl border shadow-2xs transition cursor-pointer select-none ${
                  property.status === PropertyStatus.ACTIVE
                    ? (isPG ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/70' : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100/70')
                    : property.status === PropertyStatus.INACTIVE
                    ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/70'
                    : property.status === PropertyStatus.UNDER_MAINTENANCE
                    ? 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100/70'
                    : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    property.status === PropertyStatus.ACTIVE
                      ? (isPG ? 'bg-emerald-500 ring-2 ring-emerald-300 animate-pulse' : 'bg-blue-500 ring-2 ring-blue-300 animate-pulse')
                      : property.status === PropertyStatus.INACTIVE
                      ? 'bg-amber-500'
                      : property.status === PropertyStatus.UNDER_MAINTENANCE
                      ? 'bg-orange-500'
                      : 'bg-slate-400'
                  }`}
                />
                <span>
                  {property.status === PropertyStatus.ACTIVE
                    ? 'Active'
                    : property.status === PropertyStatus.INACTIVE
                    ? 'Inactive'
                    : property.status === PropertyStatus.UNDER_MAINTENANCE
                    ? 'Under Maintenance'
                    : 'Archived'}
                </span>
                {actionLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin ml-0.5 opacity-70" />
                ) : (
                  <ChevronDown
                    className={`w-3.5 h-3.5 opacity-60 transition-transform duration-200 ${
                      isStatusDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                )}
              </button>

              {/* Dropdown Menu */}
              {isStatusDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3.5 py-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Property Status
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(PropertyStatus.ACTIVE)}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-xs text-left transition cursor-pointer ${
                      property.status === PropertyStatus.ACTIVE
                        ? (isPG ? 'bg-emerald-50 text-emerald-900 font-bold' : 'bg-blue-50 text-blue-900 font-bold')
                        : 'text-slate-700 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isPG ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-blue-500 ring-2 ring-blue-200'}`} />
                      <span>Active</span>
                    </div>
                    {property.status === PropertyStatus.ACTIVE && (
                      <Check className={`w-3.5 h-3.5 ${isPG ? 'text-emerald-600' : 'text-blue-600'}`} />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(PropertyStatus.INACTIVE)}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-xs text-left transition cursor-pointer ${
                      property.status === PropertyStatus.INACTIVE
                        ? 'bg-amber-50 text-amber-900 font-bold'
                        : 'text-slate-700 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-amber-200" />
                      <span>Inactive</span>
                    </div>
                    {property.status === PropertyStatus.INACTIVE && (
                      <Check className="w-3.5 h-3.5 text-amber-600" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(PropertyStatus.UNDER_MAINTENANCE)}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-xs text-left transition cursor-pointer ${
                      property.status === PropertyStatus.UNDER_MAINTENANCE
                        ? 'bg-orange-50 text-orange-900 font-bold'
                        : 'text-slate-700 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-500 ring-2 ring-orange-200" />
                      <span>Under Maintenance</span>
                    </div>
                    {property.status === PropertyStatus.UNDER_MAINTENANCE && (
                      <Check className="w-3.5 h-3.5 text-orange-600" />
                    )}
                  </button>

                  <div className="my-1 border-t border-slate-100" />

                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(PropertyStatus.ARCHIVED)}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-xs text-left transition cursor-pointer ${
                      property.status === PropertyStatus.ARCHIVED
                        ? 'bg-slate-100 text-slate-900 font-bold'
                        : 'text-slate-600 hover:bg-rose-50 hover:text-rose-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                      <span>Archived</span>
                    </div>
                    {property.status === PropertyStatus.ARCHIVED && (
                      <Check className="w-3.5 h-3.5 text-slate-600" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2-Column Overview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1: Location & Contacts */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-brand-navy flex items-center gap-2 pb-2 border-b border-slate-100">
              <div className={`w-7 h-7 rounded-lg ${isPG ? 'bg-teal-50 text-brand-teal border border-teal-100' : 'bg-blue-50 text-blue-600 border border-blue-100'} flex items-center justify-center`}>
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <span>Location & Contact Details</span>
            </h3>
            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Full Address</span>
                <p className="text-slate-800 font-medium leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                  {property.address}
                  {property.addressLine1 && `, ${property.addressLine1}`}
                  {property.addressLine2 && `, ${property.addressLine2}`}
                  <br />
                  {property.locality && `${property.locality}, `}
                  {property.city}, {property.state} — {property.postalCode}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                  <Phone className={`w-4 h-4 ${isPG ? 'text-brand-teal' : 'text-blue-600'} shrink-0`} />
                  <span className="text-slate-800 font-semibold truncate">
                    {property.contactPhone || 'No phone registered'}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                  <Mail className={`w-4 h-4 ${isPG ? 'text-brand-teal' : 'text-blue-600'} shrink-0`} />
                  <span className="text-slate-800 font-semibold truncate">
                    {property.contactEmail || 'No email registered'}
                  </span>
                </div>
              </div>

              {/* Tenancy Terms & Owner Badge */}
              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Tenancy Agreement Terms</span>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80">
                    <span className="text-[10px] font-bold text-amber-900 block uppercase tracking-wider">Notice Period</span>
                    <span className="text-sm font-extrabold text-slate-900 mt-0.5 block">{property.noticePeriodDays ?? 30} Days</span>
                  </div>
                  <div className={`p-3 rounded-xl ${isPG ? 'bg-teal-50/60 border border-teal-200/80' : 'bg-blue-50/60 border border-blue-200/80'}`}>
                    <span className={`text-[10px] font-bold ${isPG ? 'text-teal-900' : 'text-blue-900'} block uppercase tracking-wider`}>Min Lock-In</span>
                    <span className="text-sm font-extrabold text-slate-900 mt-0.5 block">{property.lockInPeriodValue ?? 1} {property.lockInPeriodUnit || 'MONTHS'}</span>
                  </div>
                </div>
                {property.ownerName && (
                  <div className="flex items-center justify-between text-xs pt-1.5 px-1">
                    <span className="text-slate-500 font-medium">Owner: <strong className="text-slate-900">{property.ownerName}</strong></span>
                    {property.ownerSignature && (
                      <span className={`text-[11px] font-bold ${isPG ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-blue-800 bg-blue-50 border-blue-200'} px-2.5 py-0.5 rounded-full border flex items-center gap-1`}>
                        <CheckCircle2 className={`w-3 h-3 ${isPG ? 'text-emerald-600' : 'text-blue-600'}`} />
                        Digital Stamp
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Column 2 & 3: Amenities Catalog */}
          <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-brand-navy flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg ${isPG ? 'bg-teal-50 text-brand-teal border border-teal-100' : 'bg-blue-50 text-blue-600 border border-blue-100'} flex items-center justify-center`}>
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <span>Configured Amenities ({property.amenities?.length || 0})</span>
              </h3>
            </div>

            {property.amenities && property.amenities.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {property.amenities.map((pa) => {
                  const catalogItem = STANDARD_AMENITIES_CATALOG.find((a) => a.name === pa.name);
                  const Icon = catalogItem ? ICON_MAP[catalogItem.icon] || Sparkles : Sparkles;

                  return (
                    <div
                      key={pa.id}
                      className={`p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70 ${isPG ? 'hover:border-brand-teal/40 hover:bg-teal-50/30' : 'hover:border-blue-400 hover:bg-blue-50/30'} transition flex items-center gap-3 shadow-2xs group`}
                    >
                      <div className={`w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center ${isPG ? 'text-brand-teal group-hover:border-teal-200' : 'text-blue-600 group-hover:border-blue-200'} shrink-0 shadow-2xs`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 truncate">
                        {pa.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center">
                No specific amenities registered for this property yet.
              </p>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* DEDICATED INVENTORY HUB (BEDS & ROOMS OR RENTAL UNITS)                    */}
        {/* ========================================================================= */}
        {isPG ? (
          /* PG BEDS & ROOMS MANAGEMENT HUB */
          <div className="space-y-6">
            {/* Live Metrics Grid (2x4 Grid of Modern Field Boxes) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Floors</span>
                  <div className="w-7 h-7 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center border border-slate-200">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-slate-900 tracking-tight">{floors.length}</p>
                  <span className="text-xs text-slate-500 font-medium">Configured Levels</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Rooms</span>
                  <div className="w-7 h-7 rounded-lg bg-teal-50 text-brand-teal flex items-center justify-center border border-teal-100">
                    <DoorOpen className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-slate-900 tracking-tight">{rooms.length}</p>
                  <span className="text-xs text-slate-500 font-medium">Active Rooms</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Beds</span>
                  <div className="w-7 h-7 rounded-lg bg-teal-50 text-brand-teal flex items-center justify-center border border-teal-100">
                    <BedDouble className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-extrabold text-brand-teal tracking-tight">{totalBeds}</p>
                    <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                      {occupancyRate}%
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">Total Capacity</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-emerald-200/90 bg-gradient-to-b from-emerald-50/30 to-white shadow-2xs hover:shadow-xs transition space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Available</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-emerald-700 tracking-tight">{availableBeds}</p>
                  <span className="text-xs text-emerald-600 font-medium">Ready to occupy</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-blue-200/90 bg-gradient-to-b from-blue-50/30 to-white shadow-2xs hover:shadow-xs transition space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Occupied</span>
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
                    <UserCheck className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-blue-700 tracking-tight">{occupiedBeds}</p>
                  <span className="text-xs text-blue-600 font-medium">Active residents</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-rose-200/90 bg-gradient-to-b from-rose-50/30 to-white shadow-2xs hover:shadow-xs transition space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Maintenance</span>
                  <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200">
                    <AlertCircle className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-rose-700 tracking-tight">{maintenanceBeds}</p>
                  <span className="text-xs text-rose-600 font-medium">Under repair</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Monthly Rent</span>
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                    <IndianRupee className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div>
                  <p className="text-xl font-extrabold text-brand-navy tracking-tight truncate">₹{totalPgMonthlyRent.toLocaleString('en-IN')}</p>
                  <span className="text-xs text-slate-500 font-medium">Gross rent / month</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Security Deposit</span>
                  <div className="w-7 h-7 rounded-lg bg-teal-50 text-brand-teal flex items-center justify-center border border-teal-100">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div>
                  <p className="text-xl font-extrabold text-teal-800 tracking-tight truncate">₹{totalPgSecurityDeposit.toLocaleString('en-IN')}</p>
                  <span className="text-xs text-slate-500 font-medium">Held deposit</span>
                </div>
              </div>
            </div>

            {/* Inventory Container */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-6">
              {/* Header & Actions Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-brand-teal flex items-center justify-center font-bold border border-teal-100 shadow-2xs">
                    <BedDouble className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      Beds & Rooms Management
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure floor structures, inspect bed states, and manage sharing room capacities
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleOpenAddInventoryModal}
                    className="gap-2 text-xs font-bold shadow-2xs px-4 py-2 h-9 rounded-xl"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Floor</span>
                  </Button>
                </div>
              </div>

              {/* Filters Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200/70">
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search room number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal w-full shadow-2xs font-medium"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Floor Filter */}
                  <select
                    value={floorFilter}
                    onChange={(e) => setFloorFilter(e.target.value)}
                    className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-teal/30 shadow-2xs"
                  >
                    <option value="ALL">All Floors</option>
                    {sortedFloors.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>

                  {/* Sharing Filter */}
                  <select
                    value={sharingFilter}
                    onChange={(e) => setSharingFilter(e.target.value)}
                    className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-teal/30 shadow-2xs"
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
                    className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-teal/30 shadow-2xs"
                  >
                    <option value="ALL">All Bed Statuses</option>
                    <option value="AVAILABLE">Has Available Bed</option>
                    <option value="OCCUPIED">Has Occupied Bed</option>
                    <option value="RESERVED">Has Reserved Bed</option>
                    <option value="MAINTENANCE">Has Maintenance Bed</option>
                  </select>
                </div>
              </div>

              {/* Rooms & Beds Separated by Floor Headers */}
              {inventoryLoading ? (
                <div className="p-12 flex justify-center items-center text-slate-400 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-brand-teal" />
                  <span className="text-xs">Loading rooms & bed inventory...</span>
                </div>
              ) : floors.length === 0 ? (
                <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 text-brand-teal flex items-center justify-center mx-auto shadow-2xs">
                    <Layers className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">No Floors Configured</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Start setting up inventory by adding floors and rooms.
                  </p>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleOpenAddInventoryModal}
                    className="gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Add Floor
                  </Button>
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="p-10 text-center text-slate-400 space-y-2">
                  <DoorOpen className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs">No rooms found matching the selected filters.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {sortedFloors.map((floor) => {
                    const floorRooms = filteredRooms.filter((r) => r.floorId === floor.id);
                    if (floorRooms.length === 0) return null;

                    const floorBeds = beds.filter((b) => floorRooms.some((r) => r.id === b.roomId));
                    const floorAvailableBeds = floorBeds.filter((b) => b.status === BedStatus.AVAILABLE).length;
                    const floorRentTotal = floorBeds.reduce((acc, b) => {
                      const room = rooms.find((r) => r.id === b.roomId);
                      const bedRent = Number(b.monthlyRent) || (room ? Number(room.baseRent) : 0) || (bedOccupantMap[b.id]?.monthlyRent ? Number(bedOccupantMap[b.id]?.monthlyRent) : 8500);
                      return acc + bedRent;
                    }, 0);
                    const floorDepositTotal = floorBeds.reduce((acc, b) => {
                      const room = rooms.find((r) => r.id === b.roomId);
                      const bedDeposit = Number((b as any)?.securityDeposit) || (room ? Number((room as any)?.securityDeposit) : 0) || (bedOccupantMap[b.id]?.securityDeposit ? Number(bedOccupantMap[b.id]?.securityDeposit) : 17000);
                      return acc + bedDeposit;
                    }, 0);

                    return (
                      <div key={floor.id} className="space-y-4">
                        {/* FLOOR HEADER SECTION */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-brand-teal flex items-center justify-center font-bold text-xs shadow-2xs">
                              <Layers className="w-4 h-4" />
                            </div>
                            <h4 className="text-sm font-extrabold text-slate-900 tracking-tight">{floor.name}</h4>
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
                              {floorRooms.length} {floorRooms.length === 1 ? 'Room' : 'Rooms'} • {floorBeds.length} Beds ({floorAvailableBeds} Available)
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-xs flex-wrap justify-between sm:justify-end">
                            <div className="flex items-center gap-3 text-xs bg-white px-3.5 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                              <span className="text-slate-500 font-medium">
                                Rent Roll: <strong className="text-brand-navy font-bold">₹{floorRentTotal.toLocaleString('en-IN')}/mo</strong>
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-500 font-medium">
                                Deposit: <strong className="text-teal-800 font-bold">₹{floorDepositTotal.toLocaleString('en-IN')}</strong>
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenAddRoomModal(floor)}
                                className="gap-1.5 text-xs font-bold text-brand-teal border-teal-200 bg-white hover:bg-teal-50 px-3 py-1.5 h-8 rounded-xl shadow-2xs shrink-0"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Room</span>
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handlePromptDeleteFloor(floor)}
                                title={`Delete ${floor.name}`}
                                className="gap-1.5 text-xs font-bold text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 bg-white px-3 py-1.5 h-8 rounded-xl border border-slate-200 shadow-2xs shrink-0 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                <span>Delete Floor</span>
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* ROOMS GRID FOR THIS SPECIFIC FLOOR (Spacious 2-Column Clean Layout) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {floorRooms.map((room) => {
                            const roomBeds = beds.filter((b) => b.roomId === room.id);
                            const hasAc = isRoomAcEquipped(room.amenities);
                            const roomTotalRent = roomBeds.reduce((acc, b) => {
                              const bedRent = Number(b.monthlyRent) || Number(room.baseRent) || (bedOccupantMap[b.id]?.monthlyRent ? Number(bedOccupantMap[b.id]?.monthlyRent) : 8500);
                              return acc + bedRent;
                            }, 0);
                            const availableCountInRoom = roomBeds.filter((b) => b.status === BedStatus.AVAILABLE).length;
                            const occupiedCountInRoom = roomBeds.filter((b) => b.status === BedStatus.OCCUPIED).length;
                            const roomCapacityDisplay = roomBeds.length || room.capacity;
                            const roomDepositAmount = getRoomSecurityDeposit(room, roomBeds);
                            const roomBaseBedRate = Number(room.baseRent) || Math.round(roomTotalRent / (roomBeds.length || 1));

                            return (
                              <div
                                key={room.id}
                                className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-brand-teal/50 transition-all duration-200 flex flex-col justify-between overflow-hidden"
                              >
                                {/* MAIN CARD CONTENT */}
                                <div className="p-5 pb-4 space-y-4">
                                  {/* Header Row: Square White Room Box + Tags on Left, Pricing Block on Right */}
                                  <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                                    {/* Left: Square White Room Box + Sharing & AC Badges */}
                                    <div className="flex items-center gap-3.5">
                                      {/* Square White Room Number Box (Bigger Size) */}
                                      <div className="w-16 h-16 rounded-2xl bg-white border-2 border-slate-300/90 text-slate-900 font-mono flex flex-col items-center justify-center shadow-xs shrink-0">
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 leading-none">Room</span>
                                        <span className="text-xl font-black leading-tight mt-0.5">{room.roomNumber}</span>
                                      </div>

                                      {/* Room Sharing & AC Badges (No repeated room number, no floor number) */}
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 shadow-2xs">
                                          {formatSharingLabel(room.sharingType, roomCapacityDisplay)}
                                        </span>
                                        {hasAc ? (
                                          <span className="inline-flex items-center gap-1 text-[11px] text-sky-800 bg-sky-50 px-2.5 py-1 rounded-lg font-bold border border-sky-200 shadow-2xs">
                                            ❄️ AC Equipped
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg font-semibold border border-slate-200 shadow-2xs">
                                            💨 Non-AC
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Right: Monthly Rent, Security Deposit & Base Rent in Top Right Corner */}
                                    <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                                      {/* Monthly Rent Primary Pill */}
                                      <div className="bg-teal-50/90 border border-teal-200/90 px-3.5 py-1.5 rounded-xl shadow-2xs">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-teal-900 block">Total Monthly Rent</span>
                                        <span className="text-base font-black text-teal-800 block leading-tight">
                                          ₹{roomTotalRent.toLocaleString('en-IN')}<span className="text-[11px] font-normal text-teal-700">/month</span>
                                        </span>
                                      </div>
                                      {/* Security Deposit & Base Rent */}
                                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium pt-0.5">
                                        <span>Deposit: <strong className="text-slate-800 font-bold">₹{roomDepositAmount.toLocaleString('en-IN')}/bed</strong></span>
                                        <span className="text-slate-300">•</span>
                                        <span>Rent: <strong className="text-slate-800 font-bold">₹{roomBaseBedRate.toLocaleString('en-IN')}/bed</strong></span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Capacity & Occupancy Status Strip */}
                                  <div className="flex items-center justify-between text-xs bg-slate-50/90 px-3.5 py-2.5 rounded-xl border border-slate-200/80">
                                    <div className="flex items-center gap-3">
                                      <span className="font-semibold text-slate-600">
                                        Total Capacity: <strong className="text-slate-900">{roomCapacityDisplay} {roomCapacityDisplay === 1 ? 'Bed' : 'Beds'}</strong>
                                      </span>
                                      <span className="text-slate-300">•</span>
                                      <span className="font-semibold text-blue-700 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                                        <span>{occupiedCountInRoom} Occupied</span>
                                      </span>
                                    </div>
                                    <span className={`font-bold flex items-center gap-1.5 ${availableCountInRoom > 0 ? 'text-emerald-700' : 'text-slate-600'}`}>
                                      <span className={`w-2 h-2 rounded-full ${availableCountInRoom > 0 ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                      <span>{availableCountInRoom} Available ({roomBeds.length > 0 ? Math.round((availableCountInRoom / roomBeds.length) * 100) : 0}% vacant)</span>
                                    </span>
                                  </div>

                                  {/* Bed Management Matrix (Clean, Highly Visible) */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                      <span>Beds Matrix ({roomBeds.length} Beds)</span>
                                      <span className="text-[10px] text-slate-400 lowercase font-medium">click any bed to assign or inspect</span>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                      {roomBeds.map((bed) => {
                                        const isAvail = bed.status === BedStatus.AVAILABLE;
                                        const isOcc = bed.status === BedStatus.OCCUPIED;
                                        const isMaint = bed.status === BedStatus.MAINTENANCE;
                                        const isRes = bed.status === BedStatus.RESERVED;
                                        const occupant = bedOccupantMap[bed.id];

                                        let cardStyle = 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-400';
                                        if (isAvail) {
                                          cardStyle = 'bg-emerald-50/60 border-emerald-200/90 text-emerald-950 hover:border-emerald-500 hover:bg-emerald-100/60';
                                        } else if (isOcc) {
                                          cardStyle = 'bg-blue-50/70 border-blue-200/90 text-blue-950 hover:border-blue-500 hover:bg-blue-100/60';
                                        } else if (isRes) {
                                          cardStyle = 'bg-amber-50/70 border-amber-200/90 text-amber-950 hover:border-amber-500 hover:bg-amber-100/60';
                                        } else if (isMaint) {
                                          cardStyle = 'bg-rose-50/70 border-rose-200/90 text-rose-950 hover:border-rose-500 hover:bg-rose-100/60';
                                        }

                                        return (
                                          <button
                                            key={bed.id}
                                            type="button"
                                            onClick={() => handleOpenBedInspection(bed, room)}
                                            className={`p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer active:scale-98 shadow-2xs group flex flex-col justify-between min-h-[72px] ${cardStyle}`}
                                          >
                                            {/* Bed Number & Status Dot */}
                                            <div className="flex items-center justify-between w-full">
                                              <span className="font-mono font-black text-xs text-slate-900 bg-white/90 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-2xs">
                                                {bed.bedNumber}
                                              </span>
                                              <span
                                                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                                  isAvail ? 'bg-emerald-500' : isOcc ? 'bg-blue-600' : isMaint ? 'bg-rose-500' : 'bg-amber-500'
                                                }`}
                                              />
                                            </div>

                                            {/* Occupant Name or Assign Action */}
                                            <div className="mt-2 flex items-center justify-between w-full">
                                              {isOcc ? (
                                                <div className="truncate">
                                                  <span className="text-[11px] font-bold text-blue-950 block truncate">
                                                    {occupant?.tenantName || 'Occupied Bed'}
                                                  </span>
                                                  <span className="text-[9px] font-bold uppercase tracking-wider text-blue-700">Occupied</span>
                                                </div>
                                              ) : isAvail ? (
                                                <div className="flex items-center justify-between w-full">
                                                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Vacant</span>
                                                  <span className="text-[10px] font-extrabold text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200 shadow-2xs group-hover:bg-emerald-600 group-hover:text-white transition">
                                                    + Assign
                                                  </span>
                                                </div>
                                              ) : isMaint ? (
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800">Under Repair</span>
                                              ) : (
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Reserved</span>
                                              )}
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>

                                {/* ROOM CARD BOTTOM CONTROLS & ACTIONS (Equal Sized Full-Width Edit & Delete Buttons) */}
                                <div className="p-3.5 bg-slate-50/80 border-t border-slate-100">
                                  <div className="grid grid-cols-2 gap-3 w-full">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleOpenManageRoom(room)}
                                      className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-slate-700 hover:text-brand-teal hover:border-brand-teal bg-white shadow-2xs rounded-xl transition"
                                    >
                                      <Edit className="w-4 h-4 text-brand-teal" />
                                      <span>Edit Room</span>
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handlePromptDeleteRoom(room)}
                                      title={`Delete Room ${room.roomNumber}`}
                                      className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 bg-white shadow-2xs rounded-xl transition"
                                    >
                                      <Trash2 className="w-4 h-4 text-rose-500" />
                                      <span>Delete Room</span>
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* WHOLE-UNIT RENTAL HOUSES & UNITS MANAGEMENT HUB */
          <div className="space-y-6">
            {/* Live Metrics Grid (2x4 Grid of Modern Field Boxes) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Floors</span>
                  <div className="w-7 h-7 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center border border-slate-200">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-slate-900 tracking-tight">{rentalFloorsCount}</p>
                  <span className="text-xs text-slate-500 font-medium">Configured Levels</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Houses</span>
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                    <Home className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-blue-700 tracking-tight">{totalRentalUnits}</p>
                  <span className="text-xs text-slate-500 font-medium">Total Units</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-emerald-200/90 bg-gradient-to-b from-emerald-50/30 to-white shadow-2xs hover:shadow-xs transition space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Available</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-emerald-700 tracking-tight">{vacantUnits}</p>
                  <span className="text-xs text-emerald-600 font-medium">Ready for lease</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-blue-200/90 bg-gradient-to-b from-blue-50/30 to-white shadow-2xs hover:shadow-xs transition space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Occupied</span>
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
                    <UserCheck className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-extrabold text-blue-700 tracking-tight">{occupiedUnits}</p>
                    <span className="text-xs font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      {rentalOccupancyRate}%
                    </span>
                  </div>
                  <span className="text-xs text-blue-600 font-medium">Active leases</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-rose-200/90 bg-gradient-to-b from-rose-50/30 to-white shadow-2xs hover:shadow-xs transition space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Maintenance</span>
                  <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200">
                    <AlertCircle className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-rose-700 tracking-tight">{maintenanceUnits}</p>
                  <span className="text-xs text-rose-600 font-medium">Under repair</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Occupancy Rate</span>
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-slate-900 tracking-tight">{rentalOccupancyRate}%</p>
                  <span className="text-xs text-slate-500 font-medium">Lease efficiency</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Monthly Rent</span>
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                    <IndianRupee className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div>
                  <p className="text-xl font-extrabold text-brand-navy tracking-tight truncate">₹{totalMonthlyRentRoll.toLocaleString('en-IN')}</p>
                  <span className="text-xs text-slate-500 font-medium">Gross roll / month</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Security Deposit</span>
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div>
                  <p className="text-xl font-extrabold text-blue-800 tracking-tight truncate">₹{totalDepositRoll.toLocaleString('en-IN')}</p>
                  <span className="text-xs text-slate-500 font-medium">Held deposit</span>
                </div>
              </div>
            </div>

            {/* Inventory Container */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-6">
              {/* Header & Actions Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold border border-blue-200 shadow-2xs">
                    <Home className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      Residential Houses & Units
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure floor structures, inspect unit specifications, manage lease agreements, and resident check-ins
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleOpenRentalBuilderModal}
                    className="gap-2 text-xs font-bold shadow-2xs px-4 py-2 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Floor</span>
                  </Button>
                </div>
              </div>

              {/* Filters Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200/70">
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search unit, BHK type, or resident..."
                    value={rentalSearchQuery}
                    onChange={(e) => setRentalSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 w-full shadow-2xs font-medium"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Floor Filter */}
                  <select
                    value={rentalFloorFilter}
                    onChange={(e) => setRentalFloorFilter(e.target.value)}
                    className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 shadow-2xs"
                  >
                    <option value="ALL">All Floors</option>
                    {rentalDistinctFloors.map((fNum) => (
                      <option key={fNum} value={String(fNum)}>
                        {getRentalFloorTitle(fNum)}
                      </option>
                    ))}
                  </select>

                  {/* BHK Type Filter */}
                  <select
                    value={rentalTypeFilter}
                    onChange={(e) => setRentalTypeFilter(e.target.value)}
                    className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 shadow-2xs"
                  >
                    <option value="ALL">All House Types</option>
                    <option value="1RK">1 RK Studio</option>
                    <option value="1BHK">1 BHK Flat</option>
                    <option value="2BHK">2 BHK Flat</option>
                    <option value="3BHK">3 BHK Flat</option>
                    <option value="4BHK">4 BHK Flat</option>
                    <option value="VILLA">Independent Villa</option>
                    <option value="PENTHOUSE">Luxury Penthouse</option>
                    <option value="DUPLEX">Duplex House</option>
                  </select>

                  {/* Status Filter */}
                  <select
                    value={rentalStatusFilter}
                    onChange={(e) => setRentalStatusFilter(e.target.value)}
                    className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 shadow-2xs"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="AVAILABLE">Available (Ready)</option>
                    <option value="OCCUPIED">Occupied (Active)</option>
                    <option value="MAINTENANCE">Maintenance (Repair)</option>
                  </select>
                </div>
              </div>

              {/* Floor-by-Floor Grouped Residential Houses Grid */}
              {inventoryLoading ? (
                <div className="p-12 flex justify-center items-center text-slate-400 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  <span className="text-xs font-medium">Loading residential units & floors...</span>
                </div>
              ) : rentalUnits.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-2xs border border-blue-200">
                    <Home className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">No Residential Units Configured</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Start setting up whole-unit inventory by adding floors and houses.
                  </p>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleOpenRentalBuilderModal}
                    className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold"
                  >
                    <Plus className="w-4 h-4" />
                    Add Floor
                  </Button>
                </div>
              ) : filteredRentalUnits.length === 0 ? (
                <div className="p-10 text-center text-slate-400 space-y-2">
                  <Home className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs">No residential units match the selected search or filter criteria.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {rentalDistinctFloors.map((floorNum) => {
                    const floorUnits = filteredRentalUnits.filter((u) => (u.floorNumber ?? 1) === floorNum);
                    if (floorUnits.length === 0) return null;

                    const floorAvailable = floorUnits.filter((u) => u.status === RentalUnitStatus.AVAILABLE).length;
                    const floorOccupied = floorUnits.filter((u) => u.status === RentalUnitStatus.OCCUPIED).length;
                    const floorRentTotal = floorUnits.reduce((acc, u) => acc + (Number(u.monthlyRent) || 0), 0);
                    const floorDepositTotal = floorUnits.reduce((acc, u) => acc + (Number(u.securityDeposit) || 0), 0);

                    return (
                      <div key={floorNum} className="space-y-4">
                        {/* Floor Header Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/90 shadow-2xs">
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="w-8 h-8 rounded-xl bg-white text-slate-700 flex items-center justify-center font-bold text-xs border border-slate-200 shadow-2xs">
                              <Layers className="w-4 h-4 text-blue-600" />
                            </div>
                            <h4 className="text-sm font-extrabold text-slate-900 tracking-tight">
                              {getRentalFloorTitle(floorNum)}
                            </h4>
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              {floorUnits.length} {floorUnits.length === 1 ? 'House' : 'Houses'} ({floorAvailable} Available • {floorOccupied} Occupied)
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs flex-wrap justify-between sm:justify-end">
                            <div className="flex items-center gap-3 text-xs bg-white px-3.5 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                              <span className="text-slate-500 font-medium">
                                Rent Roll: <strong className="text-slate-800 font-bold">₹{floorRentTotal.toLocaleString('en-IN')}/mo</strong>
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-500 font-medium">
                                Deposit: <strong className="text-slate-800 font-bold">₹{floorDepositTotal.toLocaleString('en-IN')}</strong>
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenAddHouseToFloor(floorNum)}
                                className="gap-1.5 text-xs font-bold text-blue-600 border-blue-200 bg-blue-50/60 hover:bg-blue-600 hover:text-white px-3.5 py-2 h-9 rounded-xl shadow-2xs shrink-0 transition cursor-pointer"
                              >
                                <Plus className="w-4 h-4" />
                                <span>Add House</span>
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenDeleteRentalFloor(floorNum)}
                                title={`Delete ${getRentalFloorTitle(floorNum)}`}
                                className="gap-1.5 text-xs font-bold text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 bg-white px-3 py-1.5 h-9 rounded-xl border border-slate-200 shadow-2xs shrink-0 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                <span>Delete Floor</span>
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Grid of Residential House Cards (Spacious 2-Column Clean Layout Matching PG) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {floorUnits.map((unit) => {
                            const isOccupied = unit.status === RentalUnitStatus.OCCUPIED;
                            const isAvailable = unit.status === RentalUnitStatus.AVAILABLE;
                            const isMaintenance = unit.status === RentalUnitStatus.MAINTENANCE;
                            const tenant = unit.activeLease?.tenant;
                            const displayUnitNumber = unit.unitNumber.replace(/^(flat|unit|house|room)\s*/i, '').trim() || unit.unitNumber;

                            return (
                              <div
                                key={unit.id}
                                className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-blue-400 transition-all duration-200 flex flex-col justify-between overflow-hidden"
                              >
                                {/* MAIN CARD CONTENT */}
                                <div className="p-5 pb-4 space-y-4">
                                  {/* Header Row: Square White House Number Box + Tags on Left, Pricing Block on Right */}
                                  <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                                    {/* Left: Square White Flat Box + BHK & Specs Badges */}
                                    <div className="flex items-center gap-3.5">
                                      {/* Square White Flat Box (Matching PG Room Box) */}
                                      <div className="w-16 h-16 rounded-2xl bg-white border-2 border-slate-300/90 text-slate-900 font-mono flex flex-col items-center justify-center shadow-xs shrink-0 px-1">
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 leading-none">Flat</span>
                                        <span className={`font-black leading-tight mt-0.5 tracking-tight text-slate-900 truncate max-w-full text-center ${displayUnitNumber.length > 4 ? 'text-sm' : 'text-xl'}`}>
                                          {displayUnitNumber}
                                        </span>
                                      </div>

                                      {/* BHK & Specs Badges */}
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 shadow-2xs">
                                          {formatRentalUnitType(unit.unitType)}
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg font-semibold border border-slate-200 shadow-2xs">
                                           {unit.carpetAreaSqFt ? `${unit.carpetAreaSqFt} sq.ft` : '1,200 sq.ft'} • {formatFurnishingStatus(unit.furnishingStatus || 'SEMI_FURNISHED')}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Right: Monthly Rent, Security Deposit & Maintenance in Top Right Corner */}
                                    <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                                      {/* Monthly Rent Primary Pill */}
                                      <div className="bg-blue-50/90 border border-blue-200/90 px-3.5 py-1.5 rounded-xl shadow-2xs">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-blue-900 block">Total Monthly Rent</span>
                                        <span className="text-base font-black text-blue-800 block leading-tight">
                                          ₹{Number(unit.monthlyRent).toLocaleString('en-IN')}<span className="text-[11px] font-normal text-blue-600">/month</span>
                                        </span>
                                      </div>
                                      {/* Security Deposit & Maintenance */}
                                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium pt-0.5">
                                        <span>Deposit: <strong className="text-slate-800 font-bold">₹{Number(unit.securityDeposit).toLocaleString('en-IN')}</strong></span>
                                        {Number(unit.maintenanceCharges) > 0 && (
                                          <>
                                            <span className="text-slate-300">•</span>
                                            <span>Maintenance: <strong className="text-slate-800 font-bold">₹{Number(unit.maintenanceCharges).toLocaleString('en-IN')}</strong></span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Middle Status & Occupancy / Assign Tenant Strip */}
                                  {isOccupied ? (
                                    <div
                                      onClick={() => handleSelectRentalUnit(unit)}
                                      className="p-3.5 rounded-xl border border-blue-200/90 bg-blue-50/70 hover:bg-blue-100/70 text-blue-950 transition flex items-center justify-between shadow-2xs cursor-pointer"
                                    >
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                          {tenant ? `${tenant.firstName[0]}${tenant.lastName !== '—' && tenant.lastName ? tenant.lastName[0] : ''}` : 'R'}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold text-blue-950 truncate">
                                            {tenant ? `${tenant.firstName} ${tenant.lastName === '—' ? '' : tenant.lastName}`.trim() : 'Active Resident'}
                                          </p>
                                          <p className="text-[11px] text-blue-700 font-medium truncate">
                                            {tenant?.phone || 'Leased Resident'}
                                          </p>
                                        </div>
                                      </div>

                                      <span className="text-[11px] font-bold bg-white text-blue-700 px-2.5 py-1 rounded-lg border border-blue-200 shrink-0 shadow-2xs">
                                        {unit.activeLease?.startDate ? `Since ${String(unit.activeLease.startDate).split('T')[0]}` : 'Active Lease'}
                                      </span>
                                    </div>
                                  ) : isAvailable ? (
                                    <div
                                      onClick={() => handleSelectRentalUnit(unit)}
                                      className="p-3.5 rounded-xl border border-blue-200/90 bg-blue-50/60 hover:bg-blue-100/70 hover:border-blue-500 text-blue-950 transition flex items-center justify-between shadow-2xs cursor-pointer group/assign"
                                    >
                                      <div className="flex items-center gap-2.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                                        <span className="text-xs font-bold text-blue-900">Vacant & Ready for Move-In</span>
                                      </div>
                                      <span className="text-xs font-extrabold text-blue-700 bg-white px-3.5 py-1.5 rounded-lg border border-blue-200 shadow-2xs group-hover/assign:bg-blue-600 group-hover/assign:text-white transition flex items-center gap-1.5">
                                        <UserPlus className="w-4 h-4" />
                                        <span>+ Assign Tenant</span>
                                      </span>
                                    </div>
                                  ) : (
                                    <div
                                      onClick={() => handleSelectRentalUnit(unit)}
                                      className="p-3.5 rounded-xl border border-rose-200/90 bg-rose-50/70 text-rose-950 flex items-center justify-between shadow-2xs cursor-pointer"
                                    >
                                      <div className="flex items-center gap-2.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                                        <span className="text-xs font-bold text-rose-900">Under Maintenance & Repair</span>
                                      </div>
                                      <span className="text-xs font-bold bg-white text-rose-700 px-3 py-1 rounded-lg border border-rose-200 shadow-2xs">
                                        Inspect Flat
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* FLAT CARD BOTTOM CONTROLS & ACTIONS (Equal Sized Full-Width Edit & Delete Buttons Matching PG) */}
                                <div className="p-3.5 bg-slate-50/80 border-t border-slate-100">
                                  <div className="grid grid-cols-2 gap-3 w-full">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenEditRentalUnit(unit);
                                      }}
                                      className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-slate-700 hover:text-blue-600 hover:border-blue-300 bg-white shadow-2xs rounded-xl transition cursor-pointer"
                                    >
                                      <Edit className="w-3.5 h-3.5 text-slate-500" />
                                      <span>Edit Flat</span>
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenDeleteRentalUnit(unit);
                                      }}
                                      className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:border-rose-300 bg-white shadow-2xs rounded-xl transition cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                      <span>Delete Flat</span>
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MEDIA SECTION */}
        <div className="bg-brand-white rounded-2xl border border-surface-border p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-brand-navy">Property Media & Documents</h3>
              <p className="text-xs text-surface-textSecondary mt-0.5">
                Upload photos, floor plans, and property compliance certificates (JPEG, PNG, WEBP, PDF).
              </p>
            </div>
          </div>

          <div className="p-8 rounded-2xl border-2 border-dashed border-slate-200 bg-surface-subtle text-center space-y-2">
            <UploadCloud className="w-8 h-8 text-brand-teal mx-auto" />
            <p className="text-xs font-semibold text-brand-navy">Drag & drop files or click to upload</p>
            <p className="text-[11px] text-surface-textSecondary max-w-sm mx-auto">
              Images up to 5 MB, Documents up to 25 MB. Server-side UUID file renaming and MIME validation enforced.
            </p>
          </div>
        </div>

        {/* EDIT DETAILS MODAL - FULL PROPERTY ATTRIBUTES */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/60 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col animate-in zoom-in-95 overflow-hidden text-slate-800">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-50 text-brand-teal flex items-center justify-center border border-teal-200 shadow-2xs font-bold">
                    <Edit className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Edit Property Details</h3>
                    <p className="text-xs text-slate-500">
                      Update basic information, full address, contacts, owner digital signature, and amenities.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <form onSubmit={handleUpdate} className="flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                  {/* Modal In-Line Error Alert */}
                  {editModalError && (
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-900 flex items-center justify-between gap-2 shadow-2xs animate-in fade-in">
                      <div className="flex items-center gap-2.5">
                        <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
                        <span>{editModalError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditModalError(null)}
                        className="text-rose-500 hover:text-rose-800 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  
                  {/* SECTION 1: BASIC INFORMATION */}
                  <div className="p-5 rounded-2xl bg-slate-50/60 border border-slate-200/80 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-brand-teal" />
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          1. Basic Information
                        </h4>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {property?.propertyType === PropertyType.PG ? 'PG / Co-Living Operating Model' : 'Whole-Unit Residential Model'}
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Property Display Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editFormData.name}
                        onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                        placeholder="e.g. GreenGlen PG Residency"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Property Description / Overview <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={editFormData.description}
                        onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                        placeholder="Brief overview of the property, landmarks, features or rules (min 5 characters)..."
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* SECTION 2: LOCATION & FULL ADDRESS */}
                  <div className="p-5 rounded-2xl bg-slate-50/60 border border-slate-200/80 space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2.5">
                      <MapPin className="w-4 h-4 text-brand-teal" />
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        2. Location & Full Postal Address
                      </h4>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Full Display Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editFormData.address}
                        onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                        placeholder="e.g. #42, 14th Main Road, Sector 4, HSR Layout"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Street / Address Line 1
                        </label>
                        <input
                          type="text"
                          value={editFormData.addressLine1}
                          onChange={(e) => setEditFormData({ ...editFormData, addressLine1: e.target.value })}
                          placeholder="e.g. 14th Main Road"
                          className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Landmark / Suite / Line 2
                        </label>
                        <input
                          type="text"
                          value={editFormData.addressLine2}
                          onChange={(e) => setEditFormData({ ...editFormData, addressLine2: e.target.value })}
                          placeholder="e.g. Near BDA Complex"
                          className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Locality / Area
                        </label>
                        <input
                          type="text"
                          value={editFormData.locality}
                          onChange={(e) => setEditFormData({ ...editFormData, locality: e.target.value })}
                          placeholder="e.g. HSR Layout"
                          className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          City <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={editFormData.city}
                          onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                          placeholder="e.g. Bengaluru"
                          className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          State <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={editFormData.state}
                          onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}
                          placeholder="e.g. Karnataka"
                          className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          PIN Code <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={editFormData.postalCode}
                          onChange={(e) => setEditFormData({ ...editFormData, postalCode: e.target.value })}
                          placeholder="e.g. 560102"
                          className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: MANAGEMENT & HELPDESK CONTACTS */}
                  <div className="p-5 rounded-2xl bg-slate-50/60 border border-slate-200/80 space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2.5">
                      <Phone className="w-4 h-4 text-brand-teal" />
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        3. Property Management & Helpdesk Contact
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Contact Phone / Reception Number <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
                          <input
                            type="tel"
                            required
                            value={editFormData.contactPhone}
                            onChange={(e) => setEditFormData({ ...editFormData, contactPhone: e.target.value })}
                            placeholder="e.g. 9845012345 (10 digits)"
                            className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Contact Email / Inquiries <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
                          <input
                            type="email"
                            required
                            value={editFormData.contactEmail}
                            onChange={(e) => setEditFormData({ ...editFormData, contactEmail: e.target.value })}
                            placeholder="e.g. manager@property.in"
                            className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-brand-teal focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 4: STANDARD TENANCY AGREEMENT TERMS & RULES */}
                  <div className="p-5 rounded-2xl bg-amber-50/40 border border-amber-200/90 space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-amber-200/70 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                          <Shield className="w-4.5 h-4.5 text-amber-700" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">
                            4. Standard Tenancy Agreement Terms & Rules
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
                          Notice Period Required (Days) <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="365"
                            required
                            value={editFormData.noticePeriodDays ?? 30}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                noticePeriodDays: e.target.value === '' ? ('' as any) : Math.max(0, parseInt(e.target.value, 10) || 0),
                              })
                            }
                            placeholder="e.g. 30"
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-brand-teal focus:outline-none"
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
                          Minimum Lock-In Period <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="120"
                            required
                            value={editFormData.lockInPeriodValue ?? 1}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                lockInPeriodValue: e.target.value === '' ? ('' as any) : Math.max(0, parseInt(e.target.value, 10) || 0),
                              })
                            }
                            placeholder="e.g. 1"
                            className="w-24 px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 text-center focus:ring-2 focus:ring-brand-teal focus:outline-none"
                          />
                          <select
                            value={editFormData.lockInPeriodUnit || 'MONTHS'}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                lockInPeriodUnit: e.target.value as 'DAYS' | 'MONTHS' | 'YEARS',
                              })
                            }
                            className="flex-1 px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-teal focus:outline-none"
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

                  {/* SECTION 5: LANDLORD / OWNER PROFILE & DIGITAL SIGNATURE */}
                  <div className="p-5 rounded-2xl bg-teal-50/40 border border-teal-200/90 space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-teal-200/70 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-teal-100 text-brand-teal flex items-center justify-center font-bold">
                          <FileSignature className="w-4.5 h-4.5 text-teal-700" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">
                            5. Landlord / Property Owner Profile & Legal Digital Signature
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            Pre-embedded automatically onto all digital tenancy agreements generated for this property.
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        MTA 2021 Ready
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Owner / Landlord Legal Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={editFormData.ownerName}
                          onChange={(e) => setEditFormData({ ...editFormData, ownerName: e.target.value })}
                          placeholder="e.g. Ramesh Chandra (Owner)"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Owner WhatsApp / Phone Number <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          value={editFormData.ownerPhone}
                          onChange={(e) => setEditFormData({ ...editFormData, ownerPhone: e.target.value })}
                          placeholder="e.g. 9876543210 (10 digits)"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Owner Office / Permanent Address <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={editFormData.ownerAddress}
                          onChange={(e) => setEditFormData({ ...editFormData, ownerAddress: e.target.value })}
                          placeholder="e.g. #12, 5th Cross, Indiranagar"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal"
                        />
                      </div>
                    </div>

                    {/* Owner Signature Canvas Pad */}
                    <div className="pt-2 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <PenTool className="w-3.5 h-3.5 text-brand-teal" />
                        Owner Digital Signature (Drawn or Typed) <span className="text-red-500">*</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setEditOwnerSignMode('draw')}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                              editOwnerSignMode === 'draw' ? 'bg-brand-teal text-white' : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            Draw Pad
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditOwnerSignMode('type')}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                              editOwnerSignMode === 'type' ? 'bg-brand-teal text-white' : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            Type Script
                          </button>
                          {editOwnerSignMode === 'draw' && (
                            <button
                              type="button"
                              onClick={clearEditOwnerCanvas}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Clear & Redraw
                            </button>
                          )}
                        </div>
                      </div>

                      {editOwnerSignMode === 'draw' ? (
                        <div className="space-y-2">
                          <div className="border-2 border-dashed border-teal-300 rounded-xl bg-white relative overflow-hidden shadow-2xs">
                            <canvas
                              ref={editOwnerCanvasRef}
                              width={600}
                              height={120}
                              onMouseDown={startEditOwnerDrawing}
                              onMouseMove={drawEditOwner}
                              onMouseUp={stopEditOwnerDrawing}
                              onMouseLeave={stopEditOwnerDrawing}
                              onTouchStart={startEditOwnerDrawing}
                              onTouchMove={drawEditOwner}
                              onTouchEnd={stopEditOwnerDrawing}
                              className="w-full h-28 cursor-crosshair touch-none bg-transparent"
                            />
                            {!hasEditOwnerDrawn && !editFormData.ownerSignature && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs italic">
                                ✍️ Sign inside this box to set or update landlord legal signature...
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editOwnerTypedName}
                            onChange={(e) => {
                              setEditOwnerTypedName(e.target.value);
                              setEditFormData((prev) => ({
                                ...prev,
                                ownerSignature: e.target.value ? `TYPE:${e.target.value}` : '',
                              }));
                            }}
                            placeholder="Type your official legal signature name..."
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-serif focus:ring-2 focus:ring-brand-teal focus:outline-none"
                          />
                          <div className="p-3 bg-white border border-teal-200 rounded-xl text-center font-serif italic text-xl text-brand-teal shadow-2xs">
                            {editOwnerTypedName || 'Signature Preview'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SECTION 5: PROPERTY AMENITIES & FACILITIES */}
                  <div className="p-5 rounded-2xl bg-slate-50/60 border border-slate-200/80 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-brand-teal" />
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          5. Configured Amenities & Inclusions ({editFormData.amenityIds?.length || 0})
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">Click any facility to toggle</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {STANDARD_AMENITIES_CATALOG.map((amenity) => {
                        const isSelected = editFormData.amenityIds?.includes(amenity.id);
                        const Icon = ICON_MAP[amenity.icon] || Sparkles;

                        return (
                          <div
                            key={amenity.id}
                            onClick={() => handleEditAmenityToggle(amenity.id)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all duration-150 flex flex-col justify-between select-none ${
                              isSelected
                                ? 'border-brand-teal bg-teal-50/50 text-brand-navy shadow-2xs font-semibold'
                                : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <Icon className={`w-4.5 h-4.5 ${isSelected ? 'text-brand-teal' : 'text-slate-400'}`} />
                              {isSelected && <CheckCircle2 className="w-4 h-4 text-brand-teal" />}
                            </div>
                            <div className="mt-2.5">
                              <p className="text-xs font-bold leading-snug">{amenity.name}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{amenity.category}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>

                {/* Sticky Modal Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-3 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-5 py-2 text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={actionLoading}
                    className="px-6 py-2 text-xs font-bold rounded-xl shadow-sm bg-brand-teal hover:bg-teal-700 text-white flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Save All Changes
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BED MANAGEMENT & CHECK-IN / CHECK-OUT LIFECYCLE MODAL                    */}
        {/* ========================================================================= */}
        {selectedBed && selectedBedRoom && (
          <div className="fixed inset-0 z-50 bg-brand-navy/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-brand-teal flex items-center justify-center font-bold shadow-2xs">
                    <BedDouble className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">
                        Bed {selectedBed.bedNumber} • Room {selectedBedRoom.roomNumber}
                      </h3>
                      <span
                        className={`font-bold px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wide ${
                          selectedBed.status === BedStatus.AVAILABLE
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : selectedBed.status === BedStatus.OCCUPIED
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : selectedBed.status === BedStatus.MAINTENANCE
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {selectedBed.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatSharingLabel(selectedBedRoom.sharingType, selectedBedRoom.capacity)} • ₹{Number(selectedBed.monthlyRent || selectedBedRoom.baseRent).toLocaleString('en-IN')}/mo
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedBed(null);
                    setIsCheckingOut(false);
                    setOccupancyError(null);
                    setOccupancySuccess(null);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Success Banner */}
              {occupancySuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center gap-2 animate-in fade-in shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{occupancySuccess}</span>
                </div>
              )}

              {/* Error Banner */}
              {occupancyError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold flex items-center gap-2 animate-in fade-in shrink-0">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{occupancyError}</span>
                </div>
              )}

              {/* Modal Scrollable Body */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {selectedBed.status === BedStatus.OCCUPIED ? (
                  /* ========================================================================= */
                  /* CASE 1: OCCUPIED BED — VIEW OCCUPANT DETAILS & INITIATE CHECK-OUT        */
                  /* ========================================================================= */
                  isCheckingOut ? (
                    /* SUB-VIEW: CHECK-OUT APPROVAL & SETTLEMENT STEP (ADDITIONAL OWNER APPROVAL) */
                    <div className="space-y-4 animate-in fade-in">
                      <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 space-y-2">
                        <div className="flex items-center gap-2 font-bold text-amber-800 text-sm">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span>Check-Out Approval & Security Deposit Settlement</span>
                        </div>
                        <p className="text-slate-700 leading-relaxed">
                          You are reviewing the move-out settlement for <strong>{bedOccupantMap[selectedBed.id]?.tenantName || 'Resident'}</strong> from <strong>Bed {selectedBed.bedNumber}</strong>.
                          Please confirm deposit settlement and key return before granting final owner approval.
                        </p>
                      </div>

                      {/* Settlement Form */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">Move-Out Date</label>
                            <input
                              type="date"
                              value={checkoutSettlement.moveOutDate}
                              onChange={(e) => setCheckoutSettlement({ ...checkoutSettlement, moveOutDate: e.target.value })}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-brand-teal"
                            />
                          </div>

                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">Security Deposit Held</label>
                            <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-800">
                              ₹{(bedOccupantMap[selectedBed.id]?.securityDeposit || 17000).toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">Deductions / Damage Charges (₹)</label>
                            <input
                              type="number"
                              min="0"
                              value={checkoutSettlement.deductions === 0 ? '' : checkoutSettlement.deductions}
                              placeholder="0"
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCheckoutSettlement({
                                  ...checkoutSettlement,
                                  deductions: val === '' ? 0 : Number(val),
                                });
                              }}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-rose-700 focus:ring-1 focus:ring-rose-500"
                            />
                          </div>

                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">Net Refund to Tenant</label>
                            <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg font-bold text-emerald-800 text-sm">
                              ₹{Math.max(0, (bedOccupantMap[selectedBed.id]?.securityDeposit || 17000) - (Number(checkoutSettlement.deductions) || 0)).toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Deduction Reason / Notes (if any)</label>
                          <input
                            type="text"
                            placeholder="e.g. Painting touch-up / electricity settlement"
                            value={checkoutSettlement.deductionReason}
                            onChange={(e) => setCheckoutSettlement({ ...checkoutSettlement, deductionReason: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-brand-teal"
                          />
                        </div>

                        <div className="pt-2">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={checkoutSettlement.keyHandoverConfirmed}
                              onChange={(e) => setCheckoutSettlement({ ...checkoutSettlement, keyHandoverConfirmed: e.target.checked })}
                              className="w-4 h-4 rounded text-brand-teal focus:ring-brand-teal border-slate-300"
                            />
                            <span className="font-semibold text-slate-800">
                              Room inspection verified & physical key/access card received <span className="text-rose-500">*</span>
                            </span>
                          </label>
                          {!checkoutSettlement.keyHandoverConfirmed && (
                            <p className="text-[11px] text-amber-700 font-medium flex items-center gap-1 mt-1.5 pl-6">
                              <Info className="w-3.5 h-3.5 shrink-0" />
                              <span>You must verify the room inspection & key handover confirmation checkbox above to enable check-out approval.</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsCheckingOut(false)}
                        >
                          Cancel / Back
                        </Button>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={!checkoutSettlement.keyHandoverConfirmed || submittingOccupancy}
                          isLoading={submittingOccupancy}
                          onClick={handleApproveCheckout}
                          className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold gap-1.5 shadow-xs"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Approve & Finalize Check-Out
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* OCCUPIED TENANT PROFILE DETAILS VIEW */
                    <div className="space-y-4 animate-in fade-in">
                      {/* Resident Profile Card */}
                      <div className={`p-4 rounded-xl border ${isPG ? 'border-teal-200 bg-teal-50/40' : 'border-blue-200 bg-blue-50/40'} space-y-4`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-full ${isPG ? 'bg-brand-teal' : 'bg-blue-600'} text-white flex items-center justify-center font-bold text-base shadow-sm`}>
                              {bedOccupantMap[selectedBed.id]?.tenantName
                                ? bedOccupantMap[selectedBed.id].tenantName.substring(0, 2).toUpperCase()
                                : 'HM'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-base font-bold text-slate-900">
                                  {bedOccupantMap[selectedBed.id]?.tenantName || 'Hariharan M'}
                                </h4>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Verified KYC
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-600 mt-1 flex-wrap">
                                <span className="inline-flex items-center gap-1 font-medium">
                                  <Phone className="w-3.5 h-3.5 text-brand-teal" />
                                  {bedOccupantMap[selectedBed.id]?.phone || '+91 98765 43210'}
                                </span>
                                {bedOccupantMap[selectedBed.id]?.email && (
                                  <span className="inline-flex items-center gap-1 text-slate-500">
                                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                                    {bedOccupantMap[selectedBed.id].email}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const occ = bedOccupantMap[selectedBed.id];
                                if (!occ) return;
                                const sigPkg = getOrGenerateAgreementSignature({
                                  bedId: selectedBed.id,
                                  tenantName: occ.tenantName,
                                  tenantPhone: occ.phone,
                                  unitName: `Bed ${selectedBed.bedNumber}`,
                                  emergencyContactName: occ.emergencyContactName,
                                  emergencyContactPhone: occ.emergencyContactPhone,
                                  moveInDate: occ.moveInDate,
                                });
                                const baseDetails = isPG ? getPgAgreementDetails() : getRentalAgreementDetails();
                                setViewingAgreementDoc({
                                  ...baseDetails,
                                  tenantName: occ.tenantName,
                                  tenantPhone: occ.phone,
                                  tenantEmail: occ.email || undefined,
                                  tenantAddress: occ.permanentAddress || undefined,
                                  tenantAadhaar: occ.governmentId || undefined,
                                  propertyName: property?.name || 'Property',
                                  propertyAddress: fullPropertyAddress,
                                  unitOrBedName: `Bed ${selectedBed.bedNumber} (Room ${selectedBedRoom?.roomNumber || '—'})`,
                                  propertyType: isPG ? 'PG' : 'RENTAL_HOUSE',
                                  monthlyRent: occ.monthlyRent,
                                  securityDeposit: occ.securityDeposit,
                                  lockInMonths: property?.lockInMonths ?? 1,
                                  lockInPeriodValue: property?.lockInPeriodValue ?? property?.lockInMonths ?? 1,
                                  lockInPeriodUnit: (property?.lockInPeriodUnit as any) || 'MONTHS',
                                  noticePeriodDays: property?.noticePeriodDays ?? 30,
                                  ownerName: property?.ownerName || 'Arun Sharma',
                                  ownerPhone: property?.ownerPhone || property?.contactPhone || '+91 98765 43210',
                                  ownerAddress: property?.ownerAddress || fullPropertyAddress,
                                  ownerSignature: property?.ownerSignature || generateDigitalSignatureDataUrl(property?.ownerName || 'Arun Sharma', 'Authorized Landlord / Owner'),
                                  residentSignature: sigPkg.signatureImage,
                                  sharingType: selectedBedRoom?.sharingType,
                                  witnesses: sigPkg.witnesses,
                                  signedAt: sigPkg.signedAt || occ.moveInDate || new Date().toISOString(),
                                  status: 'OCCUPIED',
                                });
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition shadow-2xs cursor-pointer"
                              title="View & Download Tenancy Agreement PDF"
                            >
                              <FileText className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Agreement PDF</span>
                            </button>
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${isPG ? 'bg-teal-100 text-teal-800 border border-teal-200' : 'bg-blue-100 text-blue-800 border border-blue-200'}`}>
                              Active Resident
                            </span>
                          </div>
                        </div>

                        {/* Additional Details Grid */}
                        <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-3 border-t ${isPG ? 'border-teal-100' : 'border-blue-100'} text-xs`}>
                          <div className={`bg-white p-2.5 rounded-lg border ${isPG ? 'border-teal-100' : 'border-blue-100'}`}>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Check-In Date</span>
                            <span className="font-bold text-slate-800">{bedOccupantMap[selectedBed.id]?.moveInDate || '2026-08-01'}</span>
                          </div>

                          <div className={`bg-white p-2.5 rounded-lg border ${isPG ? 'border-teal-100' : 'border-blue-100'}`}>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Agreed Monthly Rent</span>
                            <span className="font-bold text-brand-teal">₹{(bedOccupantMap[selectedBed.id]?.monthlyRent || Number(selectedBed.monthlyRent || selectedBedRoom.baseRent)).toLocaleString('en-IN')}/mo</span>
                          </div>

                          <div className={`bg-white p-2.5 rounded-lg border ${isPG ? 'border-teal-100' : 'border-blue-100'}`}>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Deposit Held</span>
                            <span className="font-bold text-teal-700">₹{(bedOccupantMap[selectedBed.id]?.securityDeposit || 17000).toLocaleString('en-IN')}</span>
                          </div>

                          <div className={`bg-white p-2.5 rounded-lg border ${isPG ? 'border-teal-100' : 'border-blue-100'} col-span-2 sm:col-span-1`}>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Rent Dues</span>
                            <span className="font-bold text-emerald-700">₹0 (All Cleared)</span>
                          </div>

                          <div className={`bg-white p-2.5 rounded-lg border ${isPG ? 'border-teal-100' : 'border-blue-100'} col-span-2`}>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Emergency Contact</span>
                            <span className="font-medium text-slate-800">
                              {bedOccupantMap[selectedBed.id]?.emergencyContactName || 'Murugan (Father)'} • {bedOccupantMap[selectedBed.id]?.emergencyContactPhone || '+91 98401 23456'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Check-Out Action Banner */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h5 className="text-xs font-bold text-slate-900">Tenant Moving Out?</h5>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Initiate settlement review and release this bed back to Available status with owner approval.
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsCheckingOut(true)}
                          className="gap-1.5 text-xs font-bold text-rose-700 border-rose-300 bg-rose-50 hover:bg-rose-100 whitespace-nowrap shrink-0"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                          Check Out Tenant
                        </Button>
                      </div>
                    </div>
                  )
                ) : (
                  /* ========================================================================= */
                  /* CASE 2: AVAILABLE BED — DIRECT CHECK-IN & TENANT ALLOCATION FORM          */
                  /* ========================================================================= */
                  <div className="space-y-4">
                    {/* Quick Status Bar */}
                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                      <div>
                        <span className="text-slate-500 font-medium">Bed Readiness: </span>
                        <span className={`font-bold ${selectedBed.status === BedStatus.MAINTENANCE ? 'text-rose-700' : 'text-emerald-700'}`}>
                          {selectedBed.status === BedStatus.MAINTENANCE ? 'Under Maintenance' : 'Ready for Immediate Check-In'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedBed.status === BedStatus.AVAILABLE ? (
                          <button
                            type="button"
                            onClick={() => handleUpdateBedStatus(BedStatus.MAINTENANCE)}
                            disabled={isUpdatingBed}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold rounded-lg text-[11px] transition"
                          >
                            Put in Maintenance
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUpdateBedStatus(BedStatus.AVAILABLE)}
                            disabled={isUpdatingBed}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold rounded-lg text-[11px] transition"
                          >
                            Mark Available
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Check-In Header & Mode Switcher */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                          <UserPlus className="w-4 h-4 text-brand-teal" />
                          Tenant Check-In & Bed Allocation
                        </h4>
                        <span className="text-[11px] text-slate-500">Auto-updates bed to Occupied</span>
                      </div>

                      {/* Mode Selection Tabs */}
                      <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => setCheckInMode('NEW')}
                          className={`py-1.5 rounded-lg transition ${
                            checkInMode === 'NEW'
                              ? 'bg-white text-brand-navy shadow-xs'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          + Onboard New Tenant
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCheckInMode('EXISTING');
                            fetchRegisteredTenants();
                          }}
                          className={`py-1.5 rounded-lg transition ${
                            checkInMode === 'EXISTING'
                              ? 'bg-white text-brand-navy shadow-xs'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Select Registered Tenant
                        </button>
                      </div>
                    </div>

                    {/* Check-In Form */}
                    <form onSubmit={handleCompleteBedCheckIn} className="space-y-4 text-xs">
                      {checkInMode === 'NEW' ? (
                        <div className="space-y-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                          {/* SECTION 1: PERSONAL INFORMATION */}
                          <div>
                            <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 pb-1 border-b border-slate-200">
                              Personal Information
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">
                                  First Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. Rahul"
                                  value={newTenantForm.firstName}
                                  onChange={(e) => setNewTenantForm({ ...newTenantForm, firstName: e.target.value })}
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                                />
                              </div>

                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">
                                  Last Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. Sharma"
                                  value={newTenantForm.lastName}
                                  onChange={(e) => setNewTenantForm({ ...newTenantForm, lastName: e.target.value })}
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-3">
                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">
                                  Phone Number <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="tel"
                                  required
                                  placeholder="10-digit mobile number"
                                  value={newTenantForm.phone}
                                  onChange={(e) => setNewTenantForm({ ...newTenantForm, phone: e.target.value })}
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                                />
                              </div>

                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">Email Address</label>
                                <input
                                  type="email"
                                  placeholder="rahul@example.com"
                                  value={newTenantForm.email}
                                  onChange={(e) => setNewTenantForm({ ...newTenantForm, email: e.target.value })}
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                                />
                              </div>

                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">
                                  Date of Birth <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="date"
                                  required
                                  value={newTenantForm.dateOfBirth}
                                  onChange={(e) => {
                                    const dob = e.target.value;
                                    setNewTenantForm({
                                      ...newTenantForm,
                                      dateOfBirth: dob,
                                      age: calculateAge(dob),
                                    });
                                  }}
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                                />
                              </div>

                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">
                                  Age <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  required
                                  min="1"
                                  max="120"
                                  placeholder="e.g. 24"
                                  value={newTenantForm.age}
                                  onChange={(e) => setNewTenantForm({ ...newTenantForm, age: e.target.value })}
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal font-mono"
                                />
                              </div>
                            </div>
                          </div>

                          {/* SECTION 2: OFFICIAL PROOF & GOVERNMENT ID */}
                          <div>
                            <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 pb-1 border-b border-slate-200">
                              Official Proof & Government ID
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">
                                  Official Document Type <span className="text-rose-500">*</span>
                                </label>
                                <select
                                  value={newTenantForm.governmentIdType}
                                  onChange={(e) => setNewTenantForm({ ...newTenantForm, governmentIdType: e.target.value })}
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                                >
                                  <option value="Aadhaar Card">Aadhaar Card (UIDAI)</option>
                                  <option value="PAN Card">PAN Card (Income Tax Dept)</option>
                                  <option value="Passport">Passport</option>
                                  <option value="Driving License">Driving License</option>
                                  <option value="Voter ID">Voter ID (Election Commission)</option>
                                  <option value="Student / Corporate ID">Student / Corporate ID</option>
                                </select>
                              </div>

                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">
                                  Document / ID Number <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. XXXX-XXXX-4892 / ABCDE1234F"
                                  value={newTenantForm.governmentIdNumber}
                                  onChange={(e) => setNewTenantForm({ ...newTenantForm, governmentIdNumber: e.target.value })}
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal font-mono"
                                />
                              </div>
                            </div>

                            {/* Document File Upload */}
                            <div className="mt-3">
                              <label className="font-semibold text-slate-700 block mb-1">
                                Upload Official Proof Document (Aadhaar / Passport / ID)
                              </label>
                              <div className="border-2 border-dashed border-slate-300 rounded-xl p-3.5 bg-white hover:border-brand-teal/50 transition text-center">
                                <input
                                  type="file"
                                  id="proof-document-upload"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      setNewTenantForm({
                                        ...newTenantForm,
                                        documentFileName: file.name,
                                        documentFileSize: `${(file.size / 1024).toFixed(1)} KB`,
                                      });
                                    }
                                  }}
                                />
                                {newTenantForm.documentFileName ? (
                                  <div className="flex items-center justify-between bg-teal-50/70 p-2 rounded-lg border border-teal-200 text-left">
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded bg-teal-100 text-brand-teal flex items-center justify-center font-bold">
                                        <FileSignature className="w-3.5 h-3.5" />
                                      </div>
                                      <div>
                                        <p className="text-xs font-bold text-slate-800">{newTenantForm.documentFileName}</p>
                                        <p className="text-[10px] text-slate-500">{newTenantForm.documentFileSize} • Ready for verification</p>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setNewTenantForm({ ...newTenantForm, documentFileName: '', documentFileSize: '' })}
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <label
                                    htmlFor="proof-document-upload"
                                    className="cursor-pointer flex flex-col items-center justify-center gap-1"
                                  >
                                    <UploadCloud className="w-5 h-5 text-brand-teal" />
                                    <span className="text-xs font-bold text-brand-navy">
                                      Click to upload document or browse files
                                    </span>
                                    <span className="text-[10px] text-slate-400">PDF, JPG, PNG up to 10MB</span>
                                  </label>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* SECTION 3: PERMANENT ADDRESS */}
                          <div>
                            <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 pb-1 border-b border-slate-200">
                              Permanent Address
                            </h5>
                            <div className="space-y-3">
                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">
                                  Street Address <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="House No, Street, Landmark"
                                  value={newTenantForm.permanentAddress}
                                  onChange={(e) => setNewTenantForm({ ...newTenantForm, permanentAddress: e.target.value })}
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                                />
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                  <label className="font-semibold text-slate-700 block mb-1">
                                    City <span className="text-rose-500">*</span>
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="e.g. Bengaluru"
                                    value={newTenantForm.permanentCity}
                                    onChange={(e) => setNewTenantForm({ ...newTenantForm, permanentCity: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                                  />
                                </div>

                                <div>
                                  <label className="font-semibold text-slate-700 block mb-1">
                                    State <span className="text-rose-500">*</span>
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="e.g. Karnataka"
                                    value={newTenantForm.permanentState}
                                    onChange={(e) => setNewTenantForm({ ...newTenantForm, permanentState: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                                  />
                                </div>

                                <div>
                                  <label className="font-semibold text-slate-700 block mb-1">
                                    Postal Code <span className="text-rose-500">*</span>
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="e.g. 560001"
                                    value={newTenantForm.permanentPostalCode}
                                    onChange={(e) => setNewTenantForm({ ...newTenantForm, permanentPostalCode: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* SECTION 4: PROFESSIONAL / EDUCATION DETAILS */}
                          <div>
                            <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 pb-1 border-b border-slate-200">
                              Professional / Education Details
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">Occupation</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Software Engineer / Student"
                                  value={newTenantForm.occupation}
                                  onChange={(e) => setNewTenantForm({ ...newTenantForm, occupation: e.target.value })}
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                                />
                              </div>

                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">Employer or College Name</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Infosys / RV College"
                                  value={newTenantForm.employerOrCollege}
                                  onChange={(e) => setNewTenantForm({ ...newTenantForm, employerOrCollege: e.target.value })}
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                                />
                              </div>
                            </div>
                          </div>

                          {/* SECTION 5: EMERGENCY CONTACT DETAILS */}
                          <div>
                            <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 pb-1 border-b border-slate-200">
                              Emergency Contact Details
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">
                                  Contact Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. Ramesh Sharma"
                                  value={newTenantForm.emergencyContactName}
                                  onChange={(e) => setNewTenantForm({ ...newTenantForm, emergencyContactName: e.target.value })}
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                                />
                              </div>

                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">
                                  Contact Phone <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="tel"
                                  required
                                  placeholder="e.g. 9876543210"
                                  value={newTenantForm.emergencyContactPhone}
                                  onChange={(e) => setNewTenantForm({ ...newTenantForm, emergencyContactPhone: e.target.value })}
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                                />
                              </div>

                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">
                                  Relationship <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. Father / Mother"
                                  value={newTenantForm.emergencyContactRelation}
                                  onChange={(e) => setNewTenantForm({ ...newTenantForm, emergencyContactRelation: e.target.value })}
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-brand-teal"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="font-semibold text-slate-800 block text-xs">
                                Search & Choose Registered Tenant <span className="text-rose-500">*</span>
                              </label>
                              <p className="text-[11px] text-slate-500">
                                Select an unoccupied resident from previous stays or registered directory.
                              </p>
                            </div>
                          </div>

                          {/* Live Search Input */}
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              value={tenantSearchQuery}
                              onChange={(e) => setTenantSearchQuery(e.target.value)}
                              placeholder="Search by name, phone (+91), or email..."
                              className="w-full pl-8 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-teal"
                            />
                            {tenantSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setTenantSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Filtered Registered Tenants List */}
                          {(() => {
                            // 1. Identify all phones and IDs that are currently occupying ANY bed or unit
                            const occupiedPhoneSet = new Set<string>();
                            const occupiedTenantIdSet = new Set<string>();

                            registeredTenants.forEach((t: any) => {
                              if (t.currentStay || t.currentLease) {
                                if (t.phone) occupiedPhoneSet.add(t.phone.replace(/\D/g, '').slice(-10));
                                if (t.id) occupiedTenantIdSet.add(t.id);
                              }
                            });

                            Object.values(bedOccupantMap).forEach((occ: any) => {
                              if (occ.phone) occupiedPhoneSet.add(occ.phone.replace(/\D/g, '').slice(-10));
                              if (occ.tenantId) occupiedTenantIdSet.add(occ.tenantId);
                            });

                            // 2. Filter tenants who belong to THIS specific property and are unoccupied
                            const propertyTenants = registeredTenants.filter((t: any) => {
                              const belongsToThisProperty =
                                (t.stayHistories && t.stayHistories.some((s: any) => s.propertyId === propertyId)) ||
                                (t.leases && t.leases.some((l: any) => l.propertyId === propertyId || l.rentalUnit?.propertyId === propertyId)) ||
                                t.currentStay?.propertyId === propertyId ||
                                t.currentLease?.propertyId === propertyId ||
                                (t as any).propertyId === propertyId;

                              if (!belongsToThisProperty) return false;

                              // Must be unoccupied
                              const p = t.phone ? t.phone.replace(/\D/g, '').slice(-10) : '';
                              const isOccupied = (p && occupiedPhoneSet.has(p)) || occupiedTenantIdSet.has(t.id);
                              return !isOccupied;
                            });

                            const filteredTenants = propertyTenants.filter((t) => {
                              if (!tenantSearchQuery.trim()) return true;
                              const q = tenantSearchQuery.toLowerCase();
                              const fullName = `${t.firstName} ${t.lastName}`.toLowerCase();
                              const phone = t.phone.toLowerCase();
                              const email = (t.email || '').toLowerCase();
                              return fullName.includes(q) || phone.includes(q) || email.includes(q);
                            });

                            if (propertyTenants.length === 0) {
                              return (
                                <div className="p-4 bg-white rounded-lg border border-slate-200 text-xs text-slate-500 text-center space-y-1.5">
                                  <p className="font-semibold text-slate-700">No existing tenants found for {property?.name || 'this property'}</p>
                                  <p className="text-[11px]">Only previous or registered residents of this property appear here. To check in a new resident, please click <strong>"+ Onboard New Tenant"</strong> above.</p>
                                </div>
                              );
                            }

                            if (filteredTenants.length === 0) {
                              return (
                                <div className="p-4 bg-white rounded-lg border border-slate-200 text-xs text-slate-500 text-center space-y-1">
                                  <p className="font-semibold text-slate-700">No tenants match "{tenantSearchQuery}"</p>
                                  <p className="text-[11px]">Try clearing search or switch to "+ Onboard New Tenant".</p>
                                </div>
                              );
                            }

                            return (
                              <div className="space-y-2">
                                <div className="text-[11px] font-semibold text-slate-600 flex items-center justify-between pb-1">
                                  <span>
                                    Previous / Registered Residents of {property?.name || 'This Property'} ({propertyTenants.length})
                                  </span>
                                </div>

                                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                  {filteredTenants.map((t) => {
                                    const isSelected = selectedExistingTenantId === t.id;
                                    const initials = `${t.firstName.charAt(0)}${t.lastName ? t.lastName.charAt(0) : ''}`.toUpperCase();
                                    return (
                                      <div
                                        key={t.id}
                                        onClick={() => {
                                          if (selectedExistingTenantId === t.id) {
                                            setSelectedExistingTenantId('');
                                          } else {
                                            setSelectedExistingTenantId(t.id);
                                            const roomBeds = selectedBedRoom ? beds.filter((b) => b.roomId === selectedBedRoom.id) : undefined;
                                            const rDeposit = getRoomSecurityDeposit(selectedBedRoom, roomBeds);
                                            const rRent = Number(selectedBed?.monthlyRent || selectedBedRoom?.baseRent) || 10000;
                                            setCheckInTerms((prev) => ({
                                              ...prev,
                                              agreedRent: rRent,
                                              securityDeposit: rDeposit,
                                            }));
                                          }
                                        }}
                                        className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                                          isSelected
                                            ? 'bg-teal-50/80 border-brand-teal ring-1 ring-brand-teal shadow-2xs'
                                            : 'bg-white border-slate-200 hover:border-brand-teal/40 hover:bg-slate-50/50'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <div
                                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                              isSelected ? 'bg-brand-teal text-white' : 'bg-slate-100 text-slate-700'
                                            }`}
                                          >
                                            {initials}
                                          </div>
                                          <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <h5 className="text-xs font-bold text-slate-900 truncate">
                                                {t.firstName} {t.lastName === '—' ? '' : t.lastName}
                                              </h5>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5 truncate">
                                              <span className="font-medium text-slate-700">{t.phone}</span>
                                              {t.email && <span className="truncate">• {t.email}</span>}
                                            </div>
                                          </div>
                                        </div>

                                        <button
                                          type="button"
                                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 ${
                                            isSelected
                                              ? 'bg-brand-teal text-white'
                                              : 'bg-slate-100 text-slate-700 hover:bg-teal-50 hover:text-brand-teal'
                                          }`}
                                        >
                                          {isSelected ? 'Selected' : 'Select'}
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* SECTION 6: CHECK-IN & FINANCIAL TERMS */}
                      <div className="bg-teal-50/40 p-3.5 rounded-xl border border-teal-200 space-y-3">
                        <span className="text-[11px] font-bold text-brand-teal block border-b border-teal-200 pb-1.5">
                          Check-In Dates & Financial Terms
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">
                              Check-In / Move-In Date <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="date"
                              required
                              value={checkInTerms.moveInDate}
                              onChange={(e) => setCheckInTerms({ ...checkInTerms, moveInDate: e.target.value })}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-1 focus:ring-brand-teal"
                            />
                          </div>

                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">Expected Checkout Date</label>
                            <input
                              type="date"
                              value={checkInTerms.expectedCheckoutDate}
                              onChange={(e) => setCheckInTerms({ ...checkInTerms, expectedCheckoutDate: e.target.value })}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-brand-teal"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">
                              Agreed Monthly Rent <span className="text-rose-500">*</span> (₹/mo)
                            </label>
                            <input
                              type="number"
                              min="1"
                              required
                              value={checkInTerms.agreedRent === 0 ? '' : checkInTerms.agreedRent}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const v = e.target.value;
                                setCheckInTerms({ ...checkInTerms, agreedRent: v === '' ? 0 : Number(v) });
                              }}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-brand-teal focus:ring-1 focus:ring-brand-teal"
                            />
                          </div>

                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">
                              Security Deposit <span className="text-rose-500">*</span> (₹)
                            </label>
                            <input
                              type="number"
                              min="0"
                              required
                              value={checkInTerms.securityDeposit === 0 ? '' : checkInTerms.securityDeposit}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const v = e.target.value;
                                setCheckInTerms({ ...checkInTerms, securityDeposit: v === '' ? 0 : Number(v) });
                              }}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-teal-800 focus:ring-1 focus:ring-brand-teal"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Special Notes / Preferences</label>
                          <input
                            type="text"
                            placeholder="e.g. Needs upper bunk, Vegetarian mess preference"
                            value={checkInTerms.notes}
                            onChange={(e) => setCheckInTerms({ ...checkInTerms, notes: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-brand-teal"
                          />
                        </div>
                      </div>

                      {/* SECTION 7: TENANCY AGREEMENT & DIGITAL SIGNATURE */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-teal-50 text-brand-teal flex items-center justify-center border border-teal-100 shrink-0">
                              <FileSignature className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900">
                                Tenancy Agreement & Legal Compliance <span className="text-rose-500">*</span>
                              </h4>
                              <p className="text-[11px] text-slate-500">
                                Digital lease execution under Model Tenancy Act
                              </p>
                            </div>
                          </div>

                          {!agreementSignatureMap[selectedBed.id]?.isSigned && (
                            <button
                              type="button"
                              onClick={handleOpenAgreementSignModal}
                              className="px-4 py-2 bg-brand-teal hover:bg-teal-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shrink-0 transition shadow-2xs cursor-pointer"
                            >
                              <FileSignature className="w-3.5 h-3.5" />
                              <span>Review & E-Sign Agreement</span>
                            </button>
                          )}
                        </div>

                        {/* If Signed, show signed details card with View/Re-sign buttons */}
                        {agreementSignatureMap[selectedBed.id]?.isSigned && (
                          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-emerald-900 truncate">
                                  Signed by {agreementSignatureMap[selectedBed.id]?.signerName}
                                </span>
                                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                                  Verified
                                </span>
                              </div>
                              <p className="text-[11px] text-emerald-700">
                                Signed on {new Date(agreementSignatureMap[selectedBed.id]?.signedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(agreementSignatureMap[selectedBed.id]?.signedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  const signDetails = getPgAgreementDetails();
                                  setViewingAgreementDoc({
                                    ...signDetails,
                                    tenantPhone: signDetails.tenantPhone || '',
                                    ownerName: property?.ownerName || 'Arun Sharma',
                                    ownerPhone: property?.ownerPhone || property?.contactPhone || '+91 98765 43210',
                                    ownerAddress: property?.ownerAddress || fullPropertyAddress,
                                    ownerSignature: property?.ownerSignature || generateDigitalSignatureDataUrl(property?.ownerName || 'Arun Sharma', 'Authorized Landlord / Owner'),
                                    residentSignature: agreementSignatureMap[selectedBed.id]?.signatureImage || `SIGNED:${agreementSignatureMap[selectedBed.id]?.signerName}`,
                                    sharingType: selectedBedRoom?.sharingType,
                                    noticePeriodDays: property?.noticePeriodDays ?? 30,
                                    startDate: getLocalDateString(),
                                    lockInPeriodValue: property?.lockInPeriodValue ?? property?.lockInMonths ?? 1,
                                    lockInPeriodUnit: property?.lockInPeriodUnit || 'MONTHS',
                                    witnesses: agreementSignatureMap[selectedBed.id]?.witnesses,
                                  });
                                }}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>View Agreement</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleOpenAgreementSignModal}
                                className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 font-bold border border-emerald-300 rounded-lg text-xs transition shadow-2xs cursor-pointer"
                              >
                                Re-Sign
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Form Action Buttons */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedBed(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          variant="primary"
                          size="sm"
                          isLoading={submittingOccupancy}
                          className="font-bold gap-1.5 shadow-sm"
                        >
                          <UserCheck className="w-4 h-4" />
                          Complete Check-In & Assign Bed
                        </Button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MANAGE ROOM DETAILS & BEDS MODAL (ADD/REMOVE BEDS, CHANGE SPECS & RENT)  */}
        {/* ========================================================================= */}
        {editingRoom && (
          <div className="fixed inset-0 z-50 bg-brand-navy/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-5 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-brand-teal flex items-center justify-center font-bold border border-teal-100">
                    <DoorOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Manage Room {editingRoom.roomNumber} & Beds
                    </h3>
                    <p className="text-xs text-slate-500">
                      Update room configuration, add/remove beds, and adjust individual pricing
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingRoom(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Feedback Alert */}
              {manageRoomFeedback && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{manageRoomFeedback}</span>
                </div>
              )}

              {/* Form Body */}
              <form onSubmit={handleSaveManageRoom} className="space-y-4 text-xs overflow-y-auto pr-1">
                {/* Room Basic Details */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block border-b border-slate-200 pb-1">
                    Room Specifications
                  </span>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Room Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={manageRoomForm.roomNumber}
                        onChange={(e) => {
                          const newRoomNum = e.target.value;
                          setManageRoomForm((prev) => ({
                            ...prev,
                            roomNumber: newRoomNum,
                            bedsList: prev.bedsList.map((b, idx) => ({
                              ...b,
                              bedNumber: getFormattedBedLabel(newRoomNum, b.bedNumber, idx),
                            })),
                          }));
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-1 focus:ring-brand-teal"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Sharing Type</label>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={manageRoomForm.sharingCategory}
                          onChange={(e) => handleUpdateManageSharingType(e.target.value as RoomCategoryType)}
                          className="w-full min-w-0 px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-brand-teal"
                        >
                          <option value="SINGLE">Single Sharing (1 Bed)</option>
                          <option value="DOUBLE">Double Sharing (2 Beds)</option>
                          <option value="TRIPLE">Triple Sharing (3 Beds)</option>
                          <option value="FOUR_SHARING">Four Sharing (4 Beds)</option>
                          <option value="CUSTOM_NORMAL">Custom Beds (Room)</option>
                          <option value="DORMITORY">Custom Dormitory (Hall)</option>
                        </select>

                        {(manageRoomForm.sharingCategory === 'CUSTOM_NORMAL' || manageRoomForm.sharingCategory === 'DORMITORY') && (
                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              type="number"
                              min="1"
                              max="50"
                              value={manageRoomForm.customBeds === 0 ? '' : manageRoomForm.customBeds}
                              onFocus={(e) => e.target.select()}
                              onBlur={() => {
                                if (manageRoomForm.customBeds === 0) {
                                  setManageRoomForm((prev) => ({
                                    ...prev,
                                    customBeds: Math.max(1, prev.bedsList.length),
                                  }));
                                }
                              }}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === '') {
                                  handleUpdateManageCustomBeds(0);
                                } else {
                                  const num = parseInt(v, 10);
                                  handleUpdateManageCustomBeds(isNaN(num) ? 0 : Math.min(50, Math.max(0, num)));
                                }
                              }}
                              placeholder="e.g. 10"
                              className="w-14 px-1.5 py-2 border rounded-lg text-xs font-bold text-center bg-teal-50 border-teal-300 text-brand-teal focus:outline-none focus:ring-1 focus:ring-brand-teal"
                            />
                            <span className="text-[10px] font-bold text-teal-700">Beds</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Base Rent (₹/bed/mo) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="500"
                        required
                        value={manageRoomForm.baseRent === 0 ? '' : manageRoomForm.baseRent}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const v = e.target.value;
                          const val = v === '' ? 0 : Number(v);
                          setManageRoomForm((prev) => ({
                            ...prev,
                            baseRent: val,
                            bedsList: prev.bedsList.map((b) => ({
                              ...b,
                              monthlyRent: b.monthlyRent === prev.baseRent ? val : b.monthlyRent,
                            })),
                          }));
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-brand-teal focus:ring-1 focus:ring-brand-teal"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Security Deposit (₹) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={manageRoomForm.securityDeposit === 0 ? '' : manageRoomForm.securityDeposit}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const v = e.target.value;
                          setManageRoomForm({ ...manageRoomForm, securityDeposit: v === '' ? 0 : Number(v) });
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-teal-800 focus:ring-1 focus:ring-brand-teal"
                      />
                    </div>
                  </div>

                  {/* AC Climate Toggle */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800 block">Air Conditioning (AC)</span>
                      <span className="text-[10px] text-slate-500">Enable if room is equipped with dedicated AC unit</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setManageRoomForm({ ...manageRoomForm, isAc: !manageRoomForm.isAc })}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition border ${
                        manageRoomForm.isAc
                          ? 'bg-sky-50 text-sky-700 border-sky-300'
                          : 'bg-slate-100 text-slate-600 border-slate-300'
                      }`}
                    >
                      {manageRoomForm.isAc ? '❄️ AC Equipped' : '💨 Non-AC'}
                    </button>
                  </div>
                </div>

                {/* Beds Management Section */}
                <div className="bg-teal-50/40 p-3.5 rounded-xl border border-teal-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-brand-teal uppercase tracking-wider block">
                          Beds In This Room
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-teal-100/80 text-brand-teal text-[10px] font-bold font-mono">
                          {manageRoomForm.bedsList.length} Beds
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Generated automatically from Sharing Type. You can rename bed labels, add extra beds, or remove beds.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const nextIndex = manageRoomForm.bedsList.length;
                        const roomNum = manageRoomForm.roomNumber.trim() || editingRoom.roomNumber;
                        const existingBedNums = new Set(manageRoomForm.bedsList.map((b) => b.bedNumber.trim().toUpperCase()));
                        let suffixCode = 65;
                        let candidate = `${roomNum}-${String.fromCharCode(suffixCode)}`;
                        while (existingBedNums.has(candidate.toUpperCase())) {
                          suffixCode++;
                          candidate = `${roomNum}-${String.fromCharCode(suffixCode)}`;
                        }
                        const tempId = `new-bed-${Date.now()}-${nextIndex}`;
                        const newBedList = [
                          ...manageRoomForm.bedsList,
                          {
                            id: tempId,
                            bedNumber: candidate,
                            status: BedStatus.AVAILABLE,
                            monthlyRent: manageRoomForm.baseRent,
                            securityDeposit: manageRoomForm.securityDeposit,
                            isNew: true,
                          },
                        ];
                        let newCat: RoomCategoryType = manageRoomForm.sharingCategory;
                        if (newBedList.length === 1) newCat = 'SINGLE';
                        else if (newBedList.length === 2) newCat = 'DOUBLE';
                        else if (newBedList.length === 3) newCat = 'TRIPLE';
                        else if (newBedList.length === 4) newCat = 'FOUR_SHARING';
                        else if (newBedList.length > 4 && newCat !== 'DORMITORY') newCat = 'CUSTOM_NORMAL';

                        setManageRoomForm((prev) => ({
                          ...prev,
                          sharingCategory: newCat,
                          customBeds: newBedList.length,
                          bedsList: newBedList,
                        }));
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold text-brand-teal bg-white hover:bg-teal-50 border border-teal-200 rounded-lg transition flex items-center gap-1 shadow-2xs cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Bed</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {manageRoomForm.bedsList.map((bed, index) => (
                      <div
                        key={bed.id}
                        className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border border-teal-100 shadow-2xs hover:border-brand-teal/40 transition gap-3"
                      >
                        {/* Bed Icon, Label Input, and Status */}
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-teal-50 text-brand-teal flex items-center justify-center font-bold text-xs border border-teal-100 shrink-0">
                            <BedDouble className="w-4 h-4" />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-500">Bed:</span>
                            <input
                              type="text"
                              value={bed.bedNumber}
                              onChange={(e) => {
                                const val = e.target.value;
                                setManageRoomForm((prev) => ({
                                  ...prev,
                                  bedsList: prev.bedsList.map((b) => (b.id === bed.id ? { ...b, bedNumber: val } : b)),
                                }));
                              }}
                              placeholder={`Bed ${index + 1}`}
                              className="w-24 px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs font-bold text-slate-800 text-center focus:bg-white focus:ring-1 focus:ring-brand-teal focus:outline-none"
                            />
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                              bed.status === BedStatus.AVAILABLE
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : bed.status === BedStatus.OCCUPIED
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}
                          >
                            {bed.status}
                          </span>
                        </div>

                        {/* Remove Bed Trash Button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveBedDirect(bed)}
                          title={bed.status === BedStatus.OCCUPIED ? 'Cannot delete occupied bed' : 'Remove bed'}
                          disabled={bed.status === BedStatus.OCCUPIED}
                          className={`p-1.5 rounded-lg transition border ${
                            bed.status === BedStatus.OCCUPIED
                              ? 'text-slate-300 border-transparent cursor-not-allowed'
                              : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 border-transparent hover:border-rose-200'
                          }`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingRoom(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isSavingRoom}
                    className="font-bold gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Save Room & Bed Changes
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ADD ROOM TO FLOOR MODAL (MAIN VIEW)                                       */}
        {/* ========================================================================= */}
        {addingRoomFloor && (
          <div className="fixed inset-0 z-50 bg-brand-navy/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-brand-teal flex items-center justify-center font-bold border border-teal-100">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Add New Room to {addingRoomFloor.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Level {addingRoomFloor.floorNumber} • Configure room structure & beds
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAddingRoomFloor(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Feedback Alert */}
              {addRoomFeedback && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{addRoomFeedback}</span>
                </div>
              )}

              {/* Form Body */}
              <form onSubmit={handleSaveNewRoom} className="space-y-4 text-xs">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Room Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={addRoomForm.roomNumber}
                        onChange={(e) => setAddRoomForm({ ...addRoomForm, roomNumber: e.target.value })}
                        placeholder="e.g. 104"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-1 focus:ring-brand-teal"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Sharing Type</label>
                      <select
                        value={addRoomForm.category}
                        onChange={(e) => setAddRoomForm({ ...addRoomForm, category: e.target.value as RoomCategoryType })}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-brand-teal"
                      >
                        <option value="SINGLE">Single (1 Bed)</option>
                        <option value="DOUBLE">Double (2 Beds)</option>
                        <option value="TRIPLE">Triple (3 Beds)</option>
                        <option value="FOUR_SHARING">Four Sharing (4 Beds)</option>
                        <option value="CUSTOM_NORMAL">Custom Beds</option>
                        <option value="DORMITORY">Custom Dormitory</option>
                      </select>
                    </div>
                  </div>

                  {(addRoomForm.category === 'CUSTOM_NORMAL' || addRoomForm.category === 'DORMITORY') && (
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Number of Custom Beds <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={addRoomForm.customBeds === 0 ? '' : addRoomForm.customBeds}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAddRoomForm({ ...addRoomForm, customBeds: v === '' ? 0 : Math.max(1, Number(v)) });
                        }}
                        placeholder="e.g. 5"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-brand-teal focus:ring-1 focus:ring-brand-teal"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Base Rent (₹/bed/mo) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="500"
                        required
                        value={addRoomForm.baseRent === 0 ? '' : addRoomForm.baseRent}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAddRoomForm({ ...addRoomForm, baseRent: v === '' ? 0 : Number(v) });
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-brand-teal focus:ring-1 focus:ring-brand-teal"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Security Deposit (₹) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={addRoomForm.securityDeposit === 0 ? '' : addRoomForm.securityDeposit}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAddRoomForm({ ...addRoomForm, securityDeposit: v === '' ? 0 : Number(v) });
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-teal-800 focus:ring-1 focus:ring-brand-teal"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800 block">Air Conditioning (AC)</span>
                      <span className="text-[10px] text-slate-500">Enable if room is AC equipped</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAddRoomForm({ ...addRoomForm, isAc: !addRoomForm.isAc })}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition border ${
                        addRoomForm.isAc
                          ? 'bg-sky-50 text-sky-700 border-sky-300'
                          : 'bg-slate-100 text-slate-600 border-slate-300'
                      }`}
                    >
                      {addRoomForm.isAc ? '❄️ AC Equipped' : '💨 Non-AC'}
                    </button>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAddingRoomFloor(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isSavingNewRoom}
                    className="font-bold gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Add Room to Floor
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DELETE ROOM APPROVAL & CONFIRMATION MODAL                                 */}
        {/* ========================================================================= */}
        {deletingRoom && (() => {
          const roomBedsForDelete = beds.filter((b) => b.roomId === deletingRoom.id);
          const occupiedCountInRoom = roomBedsForDelete.filter((b) => b.status === BedStatus.OCCUPIED).length;

          return (
            <div className="fixed inset-0 z-[70] bg-brand-navy/60 backdrop-blur-2xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
                <div className="flex items-center gap-2.5 text-rose-600">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold border border-rose-100">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {occupiedCountInRoom > 0 ? 'Cannot Delete Room' : 'Confirm Room Deletion'}
                    </h4>
                    <p className="text-xs text-slate-500">Room {deletingRoom.roomNumber} ({roomBedsForDelete.length} Beds)</p>
                  </div>
                </div>

                {occupiedCountInRoom > 0 ? (
                  <div className="space-y-3">
                    <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-amber-800">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Active Occupants Present ({occupiedCountInRoom} Bed{occupiedCountInRoom > 1 ? 's' : ''} Occupied)</span>
                      </div>
                      <p className="leading-relaxed text-slate-700">
                        Room <strong>{deletingRoom.roomNumber}</strong> currently has <strong>{occupiedCountInRoom} active resident{occupiedCountInRoom > 1 ? 's' : ''}</strong> checked in. You must check out or transfer all residents before deleting this room.
                      </p>
                    </div>

                    <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => setDeletingRoom(null)}
                      >
                        Understood
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      <strong>Disclaimer:</strong> Are you sure you want to permanently delete <strong>Room {deletingRoom.roomNumber}</strong> and all its <strong>{roomBedsForDelete.length} bed(s)</strong>?
                      This room will be permanently removed from this floor's inventory. This action cannot be undone.
                    </p>
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingRoom(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        isLoading={isDeletingRoom}
                        onClick={handleConfirmDeleteRoom}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                      >
                        Confirm & Delete Room
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ========================================================================= */}
        {/* DELETE FLOOR APPROVAL & CONFIRMATION MODAL                                */}
        {/* ========================================================================= */}
        {deletingFloor && (() => {
          const floorRoomsForDelete = rooms.filter((r) => r.floorId === deletingFloor.id);
          const floorBedsForDelete = beds.filter((b) => floorRoomsForDelete.some((r) => r.id === b.roomId));
          const occupiedCountOnFloor = floorBedsForDelete.filter((b) => b.status === BedStatus.OCCUPIED).length;

          return (
            <div className="fixed inset-0 z-[70] bg-brand-navy/60 backdrop-blur-2xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
                <div className="flex items-center gap-2.5 text-rose-600">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold border border-rose-100">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {occupiedCountOnFloor > 0 ? 'Cannot Delete Floor' : 'Confirm Floor Deletion'}
                    </h4>
                    <p className="text-xs text-slate-500">{deletingFloor.name}</p>
                  </div>
                </div>

                {occupiedCountOnFloor > 0 ? (
                  <div className="space-y-3">
                    <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-amber-800">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Active Occupants Present ({occupiedCountOnFloor} Bed{occupiedCountOnFloor > 1 ? 's' : ''} Occupied)</span>
                      </div>
                      <p className="leading-relaxed text-slate-700">
                        <strong>{deletingFloor.name}</strong> currently has <strong>{occupiedCountOnFloor} active resident{occupiedCountOnFloor > 1 ? 's' : ''}</strong> residing across {floorRoomsForDelete.length} room(s). You must check out or vacate all occupants before deleting this entire floor.
                      </p>
                    </div>

                    <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => setDeletingFloor(null)}
                      >
                        Understood
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      <strong>Disclaimer:</strong> Are you sure you want to permanently delete <strong>{deletingFloor.name}</strong> along with all its <strong>{floorRoomsForDelete.length} room(s) and {floorBedsForDelete.length} bed(s)</strong>?
                      This action will remove this level from the property inventory and cannot be undone.
                    </p>
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingFloor(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        isLoading={isDeletingFloor}
                        onClick={handleConfirmDeleteFloor}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                      >
                        Confirm & Delete Floor
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ========================================================================= */}
        {/* DEDICATED "ADD FLOOR" BUILDER MODAL (SAME AS PROPERTY CREATION)          */}
        {/* ========================================================================= */}
        {showAddInventoryBuilderModal && (
          <div className="fixed inset-0 z-50 bg-brand-navy/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full p-6 space-y-6 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-brand-teal flex items-center justify-center font-bold border border-teal-100 shadow-2xs">
                    <BedDouble className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Add Floor — Inventory Setup
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure floor levels, sharing room structures, AC climate, rent, and deposits
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddBuilderFloor}
                    className="gap-1.5 text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Floor
                  </Button>
                  <button
                    onClick={() => setShowAddInventoryBuilderModal(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {builderErrorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2 shrink-0">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{builderErrorMessage}</span>
                </div>
              )}

              {/* Scrollable Floors & Rooms Content */}
              <div className="flex-1 overflow-y-auto space-y-5 pr-1">
                {builderFloors.length === 0 ? (
                  <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-3">
                    <Layers className="w-8 h-8 mx-auto text-slate-300" />
                    <h4 className="text-sm font-bold text-slate-800">No Floors Added Yet</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Click the button below to add your first floor level and start defining rooms.
                    </p>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleAddBuilderFloor}
                      className="gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      Add First Floor
                    </Button>
                  </div>
                ) : (
                  builderFloors.map((floor) => {
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
                        className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-4 shadow-2xs"
                      >
                        {/* Floor Card Header */}
                        <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-2.5 shadow-2xs">
                          {/* Top Row: Floor Level + Floor Name on the left, Add Room + Delete Floor on the right */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-brand-teal flex items-center justify-center font-bold text-xs shrink-0">
                                <Layers className="w-4 h-4" />
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Floor Level:</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="50"
                                  value={floor.floorNumber}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const val = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
                                    handleUpdateBuilderFloor(floor.id, 'floorNumber', val);
                                  }}
                                  className="w-16 px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-teal text-center"
                                />
                              </div>
                            </div>

                            {/* Right side: Add Room & Delete Floor buttons */}
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddBuilderRoom(floor.id)}
                                className="text-xs gap-1.5 font-semibold border-teal-200 text-brand-teal bg-teal-50/50 hover:bg-teal-100 whitespace-nowrap shrink-0 px-3 py-1.5 h-8"
                              >
                                <Plus className="w-3.5 h-3.5 shrink-0" />
                                <span>Add Room</span>
                              </Button>
                              <button
                                type="button"
                                onClick={() => handleRemoveBuilderFloor(floor.id)}
                                title="Remove Floor"
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Bottom Row: Room & Bed Metrics Badge placed below Floor Level & Floor Name */}
                          <div className="flex items-center">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-brand-teal border border-teal-200 inline-flex items-center">
                              {floor.rooms.length} {floor.rooms.length === 1 ? 'Room' : 'Rooms'} • {floorBedCount} Beds Ready (₹{floorRentTotal.toLocaleString('en-IN')}/mo • ₹{floorDepositTotal.toLocaleString('en-IN')} Dep.)
                            </span>
                          </div>
                        </div>

                        {/* Rooms Table */}
                        <div className="w-full bg-white rounded-lg border border-slate-200 shadow-2xs p-3">
                          <table className="w-full text-left text-xs border-collapse table-fixed">
                            <thead>
                              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="pb-2.5 pl-1 w-[13%]">Room No.</th>
                                <th className="pb-2.5 w-[31%]">Sharing Type / Beds</th>
                                <th className="pb-2.5 w-[14%]">Climate</th>
                                <th className="pb-2.5 w-[14%]">Rent / Bed (₹)</th>
                                <th className="pb-2.5 w-[14%]">Deposit / Bed (₹)</th>
                                <th className="pb-2.5 pr-1 text-right w-[14%]">Total Rent & Dep.</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {floor.rooms.map((room) => {
                                const bedCount = getRoomBedCount(room);
                                const totalRent = bedCount * (Number(room.baseRent) || 0);
                                const totalDeposit = bedCount * (Number(room.securityDeposit) || 0);

                                return (
                                  <tr key={room.id} className="hover:bg-slate-50/60 transition">
                                    {/* Room Number */}
                                    <td className="py-2.5 pl-1 align-middle">
                                      <input
                                        type="text"
                                        value={room.roomNumber}
                                        onChange={(e) =>
                                          handleUpdateBuilderRoom(floor.id, room.id, 'roomNumber', e.target.value)
                                        }
                                        placeholder="101"
                                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-teal"
                                      />
                                    </td>

                                    {/* Sharing Type & Custom Bed Count */}
                                    <td className="py-2.5 pr-2 align-middle">
                                      <div className="flex items-center gap-1.5 w-full">
                                        <select
                                          value={room.category}
                                          onChange={(e) =>
                                            handleUpdateBuilderRoom(floor.id, room.id, 'category', e.target.value)
                                          }
                                          className="flex-1 min-w-0 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-teal truncate"
                                        >
                                          <option value="SINGLE">Single (1 Bed)</option>
                                          <option value="DOUBLE">Double (2 Beds)</option>
                                          <option value="TRIPLE">Triple (3 Beds)</option>
                                          <option value="FOUR_SHARING">Quad (4 Beds)</option>
                                          <option value="CUSTOM_NORMAL">Custom Beds</option>
                                          <option value="DORMITORY">Custom Dormitory</option>
                                        </select>

                                        {(room.category === 'DORMITORY' || room.category === 'CUSTOM_NORMAL') && (
                                          <div className="flex items-center gap-1 shrink-0">
                                            <input
                                              type="number"
                                              min="1"
                                              max="50"
                                              value={room.customBeds === 0 ? '' : room.customBeds}
                                              onFocus={(e) => e.target.select()}
                                              onChange={(e) => {
                                                const v = e.target.value;
                                                handleUpdateBuilderRoom(
                                                  floor.id,
                                                  room.id,
                                                  'customBeds',
                                                  v === '' ? 0 : Math.max(1, Number(v))
                                                );
                                              }}
                                              placeholder="e.g. 5"
                                              title="Enter bed count"
                                              className="w-14 px-1.5 py-1.5 bg-amber-50 border border-amber-300 rounded text-xs font-bold text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-500 text-center"
                                            />
                                            <span className="text-[10px] font-bold text-slate-400">beds</span>
                                          </div>
                                        )}
                                      </div>
                                    </td>

                                    {/* Climate */}
                                    <td className="py-2.5 pr-2 align-middle">
                                      <select
                                        value={room.isAc ? 'AC' : 'NON_AC'}
                                        onChange={(e) =>
                                          handleUpdateBuilderRoom(floor.id, room.id, 'isAc', e.target.value === 'AC')
                                        }
                                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-teal"
                                      >
                                        <option value="NON_AC">💨 Non-AC</option>
                                        <option value="AC">❄️ AC</option>
                                      </select>
                                    </td>

                                    {/* Rent per Bed */}
                                    <td className="py-2.5 pr-2 align-middle">
                                      <input
                                        type="number"
                                        min="500"
                                        step="500"
                                        value={room.baseRent === 0 ? '' : room.baseRent}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          handleUpdateBuilderRoom(floor.id, room.id, 'baseRent', v === '' ? 0 : Number(v));
                                        }}
                                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-teal"
                                      />
                                    </td>

                                    {/* Deposit per Bed */}
                                    <td className="py-2.5 pr-2 align-middle">
                                      <input
                                        type="number"
                                        min="0"
                                        step="500"
                                        value={room.securityDeposit === 0 ? '' : room.securityDeposit}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          handleUpdateBuilderRoom(
                                            floor.id,
                                            room.id,
                                            'securityDeposit',
                                            v === '' ? 0 : Number(v)
                                          );
                                        }}
                                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-teal"
                                      />
                                    </td>

                                    {/* Total Room Revenue & Action */}
                                    <td className="py-2.5 pr-1 text-right align-middle">
                                      <div className="flex items-center justify-end gap-2.5">
                                        <div className="text-right leading-tight">
                                          <span className="font-bold text-brand-teal text-xs block whitespace-nowrap">
                                            ₹{totalRent.toLocaleString('en-IN')}<span className="text-[10px] text-slate-400 font-normal">/mo</span>
                                          </span>
                                          <span className="text-[10px] font-semibold text-teal-700 block whitespace-nowrap">
                                            ₹{totalDeposit.toLocaleString('en-IN')}<span className="text-[9px] text-slate-400 font-normal"> dep</span>
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveBuilderRoom(floor.id, room.id)}
                                          disabled={floor.rooms.length <= 1}
                                          title={
                                            floor.rooms.length <= 1
                                              ? 'Floor must have at least one room'
                                              : 'Remove Room'
                                          }
                                          className="p-1 text-slate-300 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-300 transition shrink-0"
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
                  })
                )}
              </div>

              {/* Summary Strip (Both Rent and Deposit) */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shrink-0 text-xs">
                <div className="flex items-center gap-3 text-slate-700 flex-wrap">
                  <span>
                    Floors to Add: <strong className="text-slate-900">{builderFloors.length}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Rooms to Add: <strong className="text-slate-900">{builderTotalRooms}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Beds to Add: <strong className="text-brand-teal">{builderTotalBeds}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <span className="text-slate-500">Est. Additional Monthly Rent: </span>
                    <strong className="text-brand-teal font-bold text-sm">
                      ₹{builderMonthlyRent.toLocaleString('en-IN')}/mo
                    </strong>
                  </div>
                  <span>•</span>
                  <div>
                    <span className="text-slate-500">Est. Additional Security Deposit: </span>
                    <strong className="text-teal-700 font-bold text-sm">
                      ₹{builderSecurityDeposit.toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddInventoryBuilderModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  isLoading={builderSubmitting}
                  onClick={handleSaveBuilderInventory}
                  className="font-semibold shadow-xs"
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DEDICATED RENTAL FLOORS & HOUSES BUILDER MODAL                            */}
        {/* ========================================================================= */}
        
        {showRentalBuilderModal && (
          <div className="fixed inset-0 z-50 bg-brand-navy/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full p-6 space-y-6 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold border border-blue-200 shadow-2xs">
                    <Home className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Add Floor — Inventory Setup
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure residential floor levels, flats, BHK specifications, rent, and deposits
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddRentalBuilderFloor}
                    className="gap-1.5 text-xs font-semibold border-blue-200 text-blue-600 bg-blue-50/60 hover:bg-blue-600 hover:text-white transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Floor
                  </Button>
                  <button
                    onClick={() => setShowRentalBuilderModal(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {rentalBuilderErrorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2 shrink-0">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{rentalBuilderErrorMessage}</span>
                </div>
              )}

              {/* Scrollable Floors & Houses Content */}
              <div className="flex-1 overflow-y-auto space-y-5 pr-1">
                {builderRentalFloors.length === 0 ? (
                  <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-3">
                    <Layers className="w-8 h-8 mx-auto text-slate-300" />
                    <h4 className="text-sm font-bold text-slate-800">No Floors Added Yet</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Click the button below to add your first floor level and start defining residential houses.
                    </p>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleAddRentalBuilderFloor}
                      className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold"
                    >
                      <Plus className="w-4 h-4" />
                      Add First Floor
                    </Button>
                  </div>
                ) : (
                  builderRentalFloors.map((floor) => {
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
                        className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-4 shadow-2xs"
                      >
                        {/* Floor Card Header */}
                        <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-2.5 shadow-2xs">
                          {/* Top Row: Floor Level on the left, Add House + Delete Floor on the right */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                                <Layers className="w-4 h-4" />
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Floor Level:</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="50"
                                  value={floor.floorNumber}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const val = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
                                    handleUpdateRentalBuilderFloor(floor.id, 'floorNumber', val);
                                  }}
                                  className="w-16 px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                                />
                              </div>
                            </div>

                            {/* Right side: Add House & Delete Floor buttons */}
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddRentalBuilderHouse(floor.id)}
                                className="text-xs gap-1.5 font-semibold border-blue-200 text-blue-600 bg-blue-50/60 hover:bg-blue-600 hover:text-white whitespace-nowrap shrink-0 px-3 py-1.5 h-8 transition"
                              >
                                <Plus className="w-3.5 h-3.5 shrink-0" />
                                <span>Add House</span>
                              </Button>
                              <button
                                type="button"
                                onClick={() => handleRemoveRentalBuilderFloor(floor.id)}
                                title="Remove Floor"
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Bottom Row: House Metrics Badge placed below Floor Level */}
                          <div className="flex items-center">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 inline-flex items-center">
                              {floor.houses.length} {floor.houses.length === 1 ? 'House' : 'Houses'} Ready (₹{floorRentTotal.toLocaleString('en-IN')}/mo • ₹{floorDepositTotal.toLocaleString('en-IN')} Dep.)
                            </span>
                          </div>
                        </div>

                        {/* Houses Table */}
                        <div className="w-full bg-white rounded-lg border border-slate-200 shadow-2xs p-3">
                          <table className="w-full text-left text-xs border-collapse table-fixed">
                            <thead>
                              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="pb-2.5 pl-1 w-[18%]">House / Flat No.</th>
                                <th className="pb-2.5 w-[26%]">House Type</th>
                                <th className="pb-2.5 w-[18%]">Monthly Rent (₹)</th>
                                <th className="pb-2.5 w-[18%]">Security Deposit (₹)</th>
                                <th className="pb-2.5 pr-1 text-right w-[20%]">Total Rent & Dep.</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {floor.houses.map((house) => {
                                const totalRent = Number(house.monthlyRent) || 0;
                                const totalDeposit = Number(house.securityDeposit) || 0;

                                return (
                                  <tr key={house.id} className="hover:bg-slate-50/60 transition">
                                    {/* House Number */}
                                    <td className="py-2.5 pl-1 align-middle">
                                      <input
                                        type="text"
                                        value={house.houseNumber}
                                        onChange={(e) =>
                                          handleUpdateRentalBuilderHouse(floor.id, house.id, 'houseNumber', e.target.value)
                                        }
                                        placeholder="Flat 101"
                                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      />
                                    </td>

                                    {/* House Type */}
                                    <td className="py-2.5 pr-2 align-middle">
                                      <select
                                        value={house.bhkType}
                                        onChange={(e) =>
                                          handleUpdateRentalBuilderHouse(floor.id, house.id, 'bhkType', e.target.value)
                                        }
                                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      >
                                        <option value="1RK">1 RK Studio</option>
                                        <option value="1BHK">1 BHK Flat</option>
                                        <option value="2BHK">2 BHK Flat</option>
                                        <option value="3BHK">3 BHK Flat</option>
                                        <option value="4BHK">4 BHK Flat</option>
                                        <option value="VILLA">Independent Villa</option>
                                        <option value="PENTHOUSE">Luxury Penthouse</option>
                                        <option value="DUPLEX">Duplex House</option>
                                      </select>
                                    </td>

                                    {/* Monthly Rent */}
                                    <td className="py-2.5 pr-2 align-middle">
                                      <input
                                        type="number"
                                        min="1000"
                                        step="500"
                                        value={house.monthlyRent === 0 ? '' : house.monthlyRent}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) =>
                                          handleUpdateRentalBuilderHouse(
                                            floor.id,
                                            house.id,
                                            'monthlyRent',
                                            e.target.value === '' ? 0 : Number(e.target.value)
                                          )
                                        }
                                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      />
                                    </td>

                                    {/* Security Deposit */}
                                    <td className="py-2.5 pr-2 align-middle">
                                      <input
                                        type="number"
                                        min="0"
                                        step="1000"
                                        value={house.securityDeposit === 0 ? '' : house.securityDeposit}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) =>
                                          handleUpdateRentalBuilderHouse(
                                            floor.id,
                                            house.id,
                                            'securityDeposit',
                                            e.target.value === '' ? 0 : Number(e.target.value)
                                          )
                                        }
                                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      />
                                    </td>

                                    {/* Total Rent & Dep. + Delete Action */}
                                    <td className="py-2.5 pr-1 text-right align-middle">
                                      <div className="flex items-center justify-end gap-2.5">
                                        <div className="text-right leading-tight">
                                          <span className="font-bold text-blue-700 text-xs block whitespace-nowrap">
                                            ₹{totalRent.toLocaleString('en-IN')}<span className="text-[10px] text-slate-400 font-normal">/mo</span>
                                          </span>
                                          <span className="text-[10px] font-semibold text-blue-900 block whitespace-nowrap">
                                            ₹{totalDeposit.toLocaleString('en-IN')}<span className="text-[9px] text-slate-400 font-normal"> dep</span>
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveRentalBuilderHouse(floor.id, house.id)}
                                          disabled={floor.houses.length <= 1}
                                          title={
                                            floor.houses.length <= 1
                                              ? 'Floor must have at least one house'
                                              : 'Remove House'
                                          }
                                          className="p-1 text-slate-300 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-300 transition shrink-0"
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
                  })
                )}
              </div>

              {/* Summary Strip (Both Rent and Deposit) */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shrink-0 text-xs">
                <div className="flex items-center gap-3 text-slate-700 flex-wrap">
                  <span>
                    Floors to Add: <strong className="text-slate-900">{builderRentalFloors.length}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Houses to Add: <strong className="text-slate-900">{builderRentalTotalHouses}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <span className="text-slate-500">Est. Additional Monthly Rent: </span>
                    <strong className="text-blue-700 font-bold text-sm">
                      ₹{builderRentalMonthlyRent.toLocaleString('en-IN')}/mo
                    </strong>
                  </div>
                  <span>•</span>
                  <div>
                    <span className="text-slate-500">Est. Additional Security Deposit: </span>
                    <strong className="text-blue-900 font-bold text-sm">
                      ₹{builderRentalSecurityDeposit.toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRentalBuilderModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  isLoading={rentalBuilderSubmitting}
                  onClick={handleSaveRentalBuilderInventory}
                  className="font-semibold shadow-xs bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* RESIDENTIAL UNIT MANAGEMENT & LEASE LIFECYCLE MODAL (OCCUPIED & AVAILABLE) */}
        {/* ========================================================================= */}
        {selectedRentalUnit && (
          <div className="fixed inset-0 z-50 bg-brand-navy/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95">
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm border shadow-2xs ${
                      selectedRentalUnit.status === RentalUnitStatus.OCCUPIED
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : selectedRentalUnit.status === RentalUnitStatus.AVAILABLE
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    <Home className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">
                        {selectedRentalUnit.unitNumber.replace(/^(flat|unit|house|room)\s*/i, '').trim()
                          ? `Flat ${selectedRentalUnit.unitNumber.replace(/^(flat|unit|house|room)\s*/i, '').trim()}`
                          : selectedRentalUnit.unitNumber}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {formatRentalUnitType(selectedRentalUnit.unitType)}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          selectedRentalUnit.status === RentalUnitStatus.OCCUPIED
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : selectedRentalUnit.status === RentalUnitStatus.AVAILABLE
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {selectedRentalUnit.status === RentalUnitStatus.OCCUPIED
                          ? 'Occupied'
                          : selectedRentalUnit.status === RentalUnitStatus.AVAILABLE
                          ? 'Available'
                          : 'Maintenance'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {getRentalFloorTitle(selectedRentalUnit.floorNumber)} • {selectedRentalUnit.carpetAreaSqFt ? `${selectedRentalUnit.carpetAreaSqFt} sq.ft` : '1,200 sq.ft'} • {formatFurnishingStatus(selectedRentalUnit.furnishingStatus || 'SEMI_FURNISHED')}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedRentalUnit(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Feedback Alerts */}
              {rentalOccupancyError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2 shrink-0">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{rentalOccupancyError}</span>
                </div>
              )}

              {rentalOccupancySuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{rentalOccupancySuccess}</span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto space-y-5 pr-1 text-xs">
                {/* CASE A: OCCUPIED UNIT VIEW */}
                {selectedRentalUnit.status === RentalUnitStatus.OCCUPIED ? (
                  <div className="space-y-5">
                    {/* Active Resident Profile Card */}
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Active Resident Information
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <ShieldCheck className="w-3 h-3" />
                          KYC Verified
                        </span>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-2xs">
                          {selectedRentalUnit.activeLease?.tenant
                            ? `${selectedRentalUnit.activeLease.tenant.firstName[0]}${
                                selectedRentalUnit.activeLease.tenant.lastName !== '—' && selectedRentalUnit.activeLease.tenant.lastName
                                  ? selectedRentalUnit.activeLease.tenant.lastName[0]
                                  : ''
                              }`
                            : 'R'}
                        </div>
                        <div className="space-y-1 flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {selectedRentalUnit.activeLease?.tenant
                              ? `${selectedRentalUnit.activeLease.tenant.firstName} ${
                                  selectedRentalUnit.activeLease.tenant.lastName === '—'
                                    ? ''
                                    : selectedRentalUnit.activeLease.tenant.lastName
                                }`.trim()
                              : 'Active Resident'}
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 pt-1">
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-medium truncate">
                                {selectedRentalUnit.activeLease?.tenant?.phone || '+91 98765 43210'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-medium truncate">
                                {selectedRentalUnit.activeLease?.tenant?.email || 'tenant@propertyos.com'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-medium truncate">
                                Govt ID: Aadhaar Card Verified
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-medium truncate">
                                {selectedRentalUnit.activeLease?.tenant?.permanentAddress || 'Permanent Address on record'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Lease Agreement & Financial Overview */}
                    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Lease Agreement & Financial Terms
                        </span>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          Active Lease
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-semibold block">Agreed Rent</span>
                          <span className="text-xs font-bold text-slate-900">
                            ₹{Number(selectedRentalUnit.activeLease?.monthlyRent || selectedRentalUnit.monthlyRent).toLocaleString('en-IN')}/mo
                          </span>
                        </div>

                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-semibold block">Security Deposit</span>
                          <span className="text-xs font-bold text-blue-700">
                            ₹{Number(selectedRentalUnit.activeLease?.securityDeposit || selectedRentalUnit.securityDeposit).toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-semibold block">Lease Start</span>
                          <span className="text-xs font-bold text-slate-800">
                            {selectedRentalUnit.activeLease?.startDate
                              ? String(selectedRentalUnit.activeLease.startDate).split('T')[0]
                              : '2026-08-01'}
                          </span>
                        </div>

                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-semibold block">Lease End</span>
                          <span className="text-xs font-bold text-slate-800">
                            {selectedRentalUnit.activeLease?.endDate
                              ? String(selectedRentalUnit.activeLease.endDate).split('T')[0]
                              : '2027-07-31'}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 pt-1 text-[11px] text-slate-600">
                        <div>
                          Notice Period: <strong className="text-slate-800">{selectedRentalUnit.activeLease?.noticePeriodDays || 30} days</strong>
                        </div>
                        <div>
                          Lock-in Period: <strong className="text-slate-800">{selectedRentalUnit.activeLease?.lockInMonths || 6} months</strong>
                        </div>
                        <div>
                          Rent Dues: <strong className="text-emerald-700">₹0 (Cleared)</strong>
                        </div>
                      </div>
                    </div>

                    {/* Check-Out & Settlement Workflow */}
                    <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 space-y-3">
                      {!isCheckingOutRentalUnit ? (
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h5 className="font-bold text-slate-900">Resident Moving Out?</h5>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Initiate settlement refund, record utility/damage deductions, and release flat to Available.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => setIsCheckingOutRentalUnit(true)}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-bold gap-1.5 shrink-0 shadow-xs"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                            Check Out Resident
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4 pt-1">
                          <div className="flex items-center justify-between pb-2 border-b border-rose-200">
                            <h5 className="font-bold text-rose-900 flex items-center gap-1.5">
                              <Receipt className="w-4 h-4 text-rose-600" />
                              Resident Check-Out & Final Settlement Approval
                            </h5>
                            <button
                              type="button"
                              onClick={() => setIsCheckingOutRentalUnit(false)}
                              className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline"
                            >
                              Cancel
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="font-semibold text-slate-700 block mb-1">
                                Official Move-Out Date <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="date"
                                value={rentalCheckoutSettlement.moveOutDate}
                                onChange={(e) =>
                                  setRentalCheckoutSettlement({
                                    ...rentalCheckoutSettlement,
                                    moveOutDate: e.target.value,
                                  })
                                }
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-rose-500"
                              />
                            </div>

                            <div>
                              <label className="font-semibold text-slate-700 block mb-1">
                                Utility / Rent Deductions (₹)
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={rentalCheckoutSettlement.deductions}
                                onChange={(e) =>
                                  setRentalCheckoutSettlement({
                                    ...rentalCheckoutSettlement,
                                    deductions: Number(e.target.value) || 0,
                                  })
                                }
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-rose-500"
                              />
                            </div>

                            <div>
                              <label className="font-semibold text-slate-700 block mb-1">
                                Property Damage Charges (₹)
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={rentalCheckoutSettlement.damageCharges}
                                onChange={(e) =>
                                  setRentalCheckoutSettlement({
                                    ...rentalCheckoutSettlement,
                                    damageCharges: Number(e.target.value) || 0,
                                  })
                                }
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-rose-500"
                              />
                            </div>

                            <div>
                              <label className="font-semibold text-slate-700 block mb-1">
                                Net Deposit Refund (₹)
                              </label>
                              <div className="w-full px-2.5 py-1.5 bg-emerald-50 border border-emerald-300 rounded text-xs font-bold text-emerald-800 flex items-center justify-between">
                                <span>Total Refund:</span>
                                <span>
                                  ₹{Math.max(
                                    0,
                                    Number(selectedRentalUnit.activeLease?.securityDeposit || selectedRentalUnit.securityDeposit) -
                                      rentalCheckoutSettlement.deductions -
                                      rentalCheckoutSettlement.damageCharges
                                  ).toLocaleString('en-IN')}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Key Handover Confirmation */}
                          <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 text-xs">
                              <input
                                type="checkbox"
                                checked={rentalCheckoutSettlement.keyHandoverConfirmed}
                                onChange={(e) =>
                                  setRentalCheckoutSettlement({
                                    ...rentalCheckoutSettlement,
                                    keyHandoverConfirmed: e.target.checked,
                                  })
                                }
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                              />
                              <span>Confirm Key Handover & Physical Flat Inspection</span>
                            </label>
                            <p className="text-[11px] text-slate-500 pl-6">
                              Verify all keys have been returned, meter readings verified, and no unauthorized structural damages exist.
                            </p>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-rose-200">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setIsCheckingOutRentalUnit(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              isLoading={submittingRentalOccupancy}
                              onClick={handleApproveRentalCheckout}
                              className="bg-rose-600 hover:bg-rose-700 font-bold gap-1.5"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Approve & Finalize Check-Out
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* CASE B: AVAILABLE / MAINTENANCE UNIT VIEW */
                  <div className="space-y-5">
                    {/* Readiness Bar */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
                      <div>
                        <span className="font-bold text-slate-800 block text-xs">Unit Readiness State</span>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {selectedRentalUnit.status === RentalUnitStatus.AVAILABLE
                            ? 'Flat is vacant and ready for immediate resident lease onboarding.'
                            : 'Flat is under maintenance/repair. Mark available when inspection is complete.'}
                        </p>
                      </div>

                      {selectedRentalUnit.status === RentalUnitStatus.AVAILABLE ? (
                        <button
                          type="button"
                          onClick={() => handleToggleRentalUnitMaintenance(RentalUnitStatus.MAINTENANCE)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition shrink-0"
                        >
                          Put in Maintenance
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleRentalUnitMaintenance(RentalUnitStatus.AVAILABLE)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition shrink-0"
                        >
                          Mark Available
                        </button>
                      )}
                    </div>

                    {/* Check-In Header & Mode Switcher */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                          <UserPlus className="w-4 h-4 text-blue-600" />
                          Tenant Check-In & House Allocation
                        </h4>
                        <span className="text-[11px] text-slate-500">Auto-updates flat to Occupied</span>
                      </div>

                      {/* Mode Selection Tabs */}
                      <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => setRentalCheckInMode('NEW')}
                          className={`py-1.5 rounded-lg transition ${
                            rentalCheckInMode === 'NEW'
                              ? 'bg-white text-brand-navy shadow-xs'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          + Onboard New Tenant
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRentalCheckInMode('EXISTING');
                            fetchRegisteredTenants();
                          }}
                          className={`py-1.5 rounded-lg transition ${
                            rentalCheckInMode === 'EXISTING'
                              ? 'bg-white text-brand-navy shadow-xs'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Select Registered Tenant
                        </button>
                      </div>
                    </div>

                    {/* Check-In Form */}
                    <form onSubmit={handleCompleteRentalCheckIn} className="space-y-4 text-xs">
                      {rentalCheckInMode === 'NEW' ? (
                        <div className="space-y-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                          {/* SECTION 1: PERSONAL INFORMATION */}
                          <div>
                            <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 pb-1 border-b border-slate-200">
                              Personal Information
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">
                                  First Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. Rajesh"
                                  value={rentalNewTenantForm.firstName}
                                  onChange={(e) =>
                                    setRentalNewTenantForm({ ...rentalNewTenantForm, firstName: e.target.value })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-blue-500"
                                />
                              </div>

                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">
                                  Last Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. Kumar"
                                  value={rentalNewTenantForm.lastName}
                                  onChange={(e) =>
                                    setRentalNewTenantForm({ ...rentalNewTenantForm, lastName: e.target.value })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-3">
                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">
                                  Phone Number <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="tel"
                                  required
                                  placeholder="10-digit mobile number"
                                  value={rentalNewTenantForm.phone}
                                  onChange={(e) =>
                                    setRentalNewTenantForm({ ...rentalNewTenantForm, phone: e.target.value })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-blue-500"
                                />
                              </div>

                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">Email Address</label>
                                <input
                                  type="email"
                                  placeholder="rajesh@example.com"
                                  value={rentalNewTenantForm.email}
                                  onChange={(e) =>
                                    setRentalNewTenantForm({ ...rentalNewTenantForm, email: e.target.value })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-blue-500"
                                />
                              </div>

                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">
                                  Date of Birth <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="date"
                                  required
                                  value={rentalNewTenantForm.dateOfBirth}
                                  onChange={(e) => {
                                    const dob = e.target.value;
                                    setRentalNewTenantForm({
                                      ...rentalNewTenantForm,
                                      dateOfBirth: dob,
                                      age: calculateAge(dob),
                                    });
                                  }}
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-blue-500"
                                />
                              </div>

                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">
                                  Age <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  required
                                  min="1"
                                  max="120"
                                  placeholder="e.g. 28"
                                  value={rentalNewTenantForm.age}
                                  onChange={(e) =>
                                    setRentalNewTenantForm({ ...rentalNewTenantForm, age: e.target.value })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-blue-500 font-mono"
                                />
                              </div>
                            </div>
                          </div>

                          {/* SECTION 2: OFFICIAL PROOF & GOVERNMENT ID */}
                          <div>
                            <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 pb-1 border-b border-slate-200">
                              Official Proof & Government ID
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">
                                  Official Document Type <span className="text-rose-500">*</span>
                                </label>
                                <select
                                  value={rentalNewTenantForm.governmentIdType}
                                  onChange={(e) =>
                                    setRentalNewTenantForm({
                                      ...rentalNewTenantForm,
                                      governmentIdType: e.target.value,
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-blue-500"
                                >
                                  <option value="Aadhaar Card">Aadhaar Card (UIDAI)</option>
                                  <option value="PAN Card">PAN Card (Income Tax Dept)</option>
                                  <option value="Passport">Passport</option>
                                  <option value="Driving License">Driving License</option>
                                  <option value="Voter ID">Voter ID (Election Commission)</option>
                                  <option value="Student / Corporate ID">Student / Corporate ID</option>
                                </select>
                              </div>

                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">
                                  Document / ID Number <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. XXXX-XXXX-4892 / ABCDE1234F"
                                  value={rentalNewTenantForm.governmentIdNumber}
                                  onChange={(e) =>
                                    setRentalNewTenantForm({
                                      ...rentalNewTenantForm,
                                      governmentIdNumber: e.target.value,
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-blue-500 font-mono"
                                />
                              </div>
                            </div>

                            {/* Document File Upload */}
                            <div className="mt-3">
                              <label className="font-semibold text-slate-700 block mb-1">
                                Upload Official Proof Document (Aadhaar / Passport / ID)
                              </label>
                              <div className="border-2 border-dashed border-slate-300 rounded-xl p-3.5 bg-white hover:border-blue-400 transition text-center">
                                <input
                                  type="file"
                                  id="rental-proof-document-upload"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      setRentalNewTenantForm({
                                        ...rentalNewTenantForm,
                                        documentFileName: file.name,
                                        documentFileSize: `${(file.size / 1024).toFixed(1)} KB`,
                                      });
                                    }
                                  }}
                                />
                                {rentalNewTenantForm.documentFileName ? (
                                  <div className="flex items-center justify-between bg-blue-50/70 p-2 rounded-lg border border-blue-200 text-left">
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                                        <FileSignature className="w-3.5 h-3.5" />
                                      </div>
                                      <div>
                                        <p className="text-xs font-bold text-slate-800">{rentalNewTenantForm.documentFileName}</p>
                                        <p className="text-[10px] text-slate-500">{rentalNewTenantForm.documentFileSize} • Ready for verification</p>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setRentalNewTenantForm({
                                          ...rentalNewTenantForm,
                                          documentFileName: '',
                                          documentFileSize: '',
                                        })
                                      }
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <label
                                    htmlFor="rental-proof-document-upload"
                                    className="cursor-pointer flex flex-col items-center justify-center gap-1"
                                  >
                                    <UploadCloud className="w-5 h-5 text-blue-600" />
                                    <span className="text-xs font-bold text-brand-navy">
                                      Click to upload document or browse files
                                    </span>
                                    <span className="text-[10px] text-slate-400">PDF, JPG, PNG up to 10MB</span>
                                  </label>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* SECTION 3: PERMANENT ADDRESS */}
                          <div>
                            <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 pb-1 border-b border-slate-200">
                              Permanent Address
                            </h5>
                            <div className="space-y-3">
                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">
                                  Street Address <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="House No, Street, Landmark"
                                  value={rentalNewTenantForm.permanentAddress}
                                  onChange={(e) =>
                                    setRentalNewTenantForm({
                                      ...rentalNewTenantForm,
                                      permanentAddress: e.target.value,
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-blue-500"
                                />
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                  <label className="font-semibold text-slate-700 block mb-1">
                                    City <span className="text-rose-500">*</span>
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="e.g. Bengaluru"
                                    value={rentalNewTenantForm.permanentCity}
                                    onChange={(e) =>
                                      setRentalNewTenantForm({
                                        ...rentalNewTenantForm,
                                        permanentCity: e.target.value,
                                      })
                                    }
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>

                                <div>
                                  <label className="font-semibold text-slate-700 block mb-1">
                                    State <span className="text-rose-500">*</span>
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="e.g. Karnataka"
                                    value={rentalNewTenantForm.permanentState}
                                    onChange={(e) =>
                                      setRentalNewTenantForm({
                                        ...rentalNewTenantForm,
                                        permanentState: e.target.value,
                                      })
                                    }
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>

                                <div>
                                  <label className="font-semibold text-slate-700 block mb-1">
                                    Postal Code <span className="text-rose-500">*</span>
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="e.g. 560001"
                                    value={rentalNewTenantForm.permanentPostalCode}
                                    onChange={(e) =>
                                      setRentalNewTenantForm({
                                        ...rentalNewTenantForm,
                                        permanentPostalCode: e.target.value,
                                      })
                                    }
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* SECTION 4: PROFESSIONAL / EDUCATION DETAILS */}
                          <div>
                            <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 pb-1 border-b border-slate-200">
                              Professional / Education Details
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">Occupation</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Software Engineer / Consultant"
                                  value={rentalNewTenantForm.occupation}
                                  onChange={(e) =>
                                    setRentalNewTenantForm({
                                      ...rentalNewTenantForm,
                                      occupation: e.target.value,
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-blue-500"
                                />
                              </div>

                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">Employer or Company Name</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Google / Microsoft"
                                  value={rentalNewTenantForm.employerOrCollege}
                                  onChange={(e) =>
                                    setRentalNewTenantForm({
                                      ...rentalNewTenantForm,
                                      employerOrCollege: e.target.value,
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                          </div>

                          {/* SECTION 5: EMERGENCY CONTACT DETAILS */}
                          <div>
                            <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 pb-1 border-b border-slate-200">
                              Emergency Contact Details
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">
                                  Contact Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. Suresh Kumar"
                                  value={rentalNewTenantForm.emergencyContactName}
                                  onChange={(e) =>
                                    setRentalNewTenantForm({
                                      ...rentalNewTenantForm,
                                      emergencyContactName: e.target.value,
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-blue-500"
                                />
                              </div>

                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">
                                  Contact Phone <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="tel"
                                  required
                                  placeholder="e.g. 9876543210"
                                  value={rentalNewTenantForm.emergencyContactPhone}
                                  onChange={(e) =>
                                    setRentalNewTenantForm({
                                      ...rentalNewTenantForm,
                                      emergencyContactPhone: e.target.value,
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-blue-500"
                                />
                              </div>

                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">
                                  Relationship <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. Father / Spouse"
                                  value={rentalNewTenantForm.emergencyContactRelation}
                                  onChange={(e) =>
                                    setRentalNewTenantForm({
                                      ...rentalNewTenantForm,
                                      emergencyContactRelation: e.target.value,
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="font-semibold text-slate-800 block text-xs">
                                Search & Choose Registered Resident <span className="text-rose-500">*</span>
                              </label>
                              <p className="text-[11px] text-slate-500">
                                Select an unoccupied resident from previous stays or registered directory.
                              </p>
                            </div>
                          </div>

                          {/* Live Search Input */}
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              value={rentalTenantSearchQuery}
                              onChange={(e) => setRentalTenantSearchQuery(e.target.value)}
                              placeholder="Search by name, phone (+91), or email..."
                              className="w-full pl-8 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            {rentalTenantSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setRentalTenantSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Filtered Registered Tenants List */}
                          {(() => {
                            const occupiedPhoneSet = new Set<string>();
                            const occupiedTenantIdSet = new Set<string>();

                            registeredTenants.forEach((t: any) => {
                              if (t.currentStay || t.currentLease) {
                                if (t.phone) occupiedPhoneSet.add(t.phone.replace(/\D/g, '').slice(-10));
                                if (t.id) occupiedTenantIdSet.add(t.id);
                              }
                            });

                            rentalUnits.forEach((u) => {
                              if (u.status === RentalUnitStatus.OCCUPIED && u.activeLease?.tenant) {
                                if (u.activeLease.tenant.phone)
                                  occupiedPhoneSet.add(u.activeLease.tenant.phone.replace(/\D/g, '').slice(-10));
                                if (u.activeLease.tenant.id)
                                  occupiedTenantIdSet.add(u.activeLease.tenant.id);
                              }
                            });

                            const propertyTenants = registeredTenants.filter((t: any) => {
                              const belongsToThisProperty =
                                (t.stayHistories && t.stayHistories.some((s: any) => s.propertyId === propertyId)) ||
                                (t.leases && t.leases.some((l: any) => l.propertyId === propertyId || l.rentalUnit?.propertyId === propertyId)) ||
                                t.currentStay?.propertyId === propertyId ||
                                t.currentLease?.propertyId === propertyId ||
                                (t as any).propertyId === propertyId;

                              if (!belongsToThisProperty) return false;

                              const p = t.phone ? t.phone.replace(/\D/g, '').slice(-10) : '';
                              const isOccupied = (p && occupiedPhoneSet.has(p)) || occupiedTenantIdSet.has(t.id);
                              return !isOccupied;
                            });

                            const filteredTenants = propertyTenants.filter((t) => {
                              if (!rentalTenantSearchQuery.trim()) return true;
                              const q = rentalTenantSearchQuery.toLowerCase();
                              const fullName = `${t.firstName} ${t.lastName}`.toLowerCase();
                              const phone = t.phone.toLowerCase();
                              const email = (t.email || '').toLowerCase();
                              return fullName.includes(q) || phone.includes(q) || email.includes(q);
                            });

                            if (propertyTenants.length === 0) {
                              return (
                                <div className="p-4 bg-white rounded-lg border border-slate-200 text-xs text-slate-500 text-center space-y-1.5">
                                  <p className="font-semibold text-slate-700">No existing tenants found for {property?.name || 'this property'}</p>
                                  <p className="text-[11px]">Only previous or registered residents of this property appear here. To check in a new resident, please click <strong>"+ Onboard New Tenant"</strong> above.</p>
                                </div>
                              );
                            }

                            if (filteredTenants.length === 0) {
                              return (
                                <div className="p-4 bg-white rounded-lg border border-slate-200 text-xs text-slate-500 text-center space-y-1">
                                  <p className="font-semibold text-slate-700">No tenants match "{rentalTenantSearchQuery}"</p>
                                  <p className="text-[11px]">Try clearing search or switch to "+ Onboard New Tenant".</p>
                                </div>
                              );
                            }

                            return (
                              <div className="space-y-2">
                                <div className="text-[11px] font-semibold text-slate-600 flex items-center justify-between pb-1">
                                  <span>
                                    Previous / Registered Residents of {property?.name || 'This Property'} ({propertyTenants.length})
                                  </span>
                                </div>

                                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                  {filteredTenants.map((t) => {
                                    const isSelected = selectedExistingRentalTenantId === t.id;
                                    const initials = `${t.firstName.charAt(0)}${t.lastName ? t.lastName.charAt(0) : ''}`.toUpperCase();
                                    return (
                                      <div
                                        key={t.id}
                                        onClick={() => {
                                          if (selectedExistingRentalTenantId === t.id) {
                                            setSelectedExistingRentalTenantId('');
                                          } else {
                                            setSelectedExistingRentalTenantId(t.id);
                                            setRentalCheckInTerms((prev) => ({
                                              ...prev,
                                              agreedRent: Number(selectedRentalUnit.monthlyRent) || 25000,
                                              securityDeposit: Number(selectedRentalUnit.securityDeposit) || 50000,
                                            }));
                                          }
                                        }}
                                        className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                                          isSelected
                                            ? 'bg-blue-50/80 border-blue-600 ring-1 ring-blue-600 shadow-2xs'
                                            : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/50'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <div
                                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                              isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                                            }`}
                                          >
                                            {initials}
                                          </div>
                                          <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <h5 className="text-xs font-bold text-slate-900 truncate">
                                                {t.firstName} {t.lastName === '—' ? '' : t.lastName}
                                              </h5>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5 truncate">
                                              <span className="font-medium text-slate-700">{t.phone}</span>
                                              {t.email && <span className="truncate">• {t.email}</span>}
                                            </div>
                                          </div>
                                        </div>

                                        <button
                                          type="button"
                                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 ${
                                            isSelected
                                              ? 'bg-blue-600 text-white'
                                              : 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-600'
                                          }`}
                                        >
                                          {isSelected ? 'Selected' : 'Select'}
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* SECTION 6: CHECK-IN & FINANCIAL TERMS */}
                      <div className="bg-blue-50/40 p-3.5 rounded-xl border border-blue-200 space-y-3">
                        <span className="text-[11px] font-bold text-blue-800 block border-b border-blue-200 pb-1.5">
                          Check-In Dates & Financial Terms
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">
                              Check-In / Move-In Date <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="date"
                              required
                              value={rentalCheckInTerms.startDate}
                              onChange={(e) =>
                                setRentalCheckInTerms({ ...rentalCheckInTerms, startDate: e.target.value })
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">
                              Expected Lease End Date
                            </label>
                            <input
                              type="date"
                              value={rentalCheckInTerms.endDate}
                              onChange={(e) =>
                                setRentalCheckInTerms({ ...rentalCheckInTerms, endDate: e.target.value })
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">
                              Agreed Monthly Rent <span className="text-rose-500">*</span> (₹/mo)
                            </label>
                            <input
                              type="number"
                              min="1"
                              required
                              value={rentalCheckInTerms.agreedRent === 0 ? '' : rentalCheckInTerms.agreedRent}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const v = e.target.value;
                                setRentalCheckInTerms({
                                  ...rentalCheckInTerms,
                                  agreedRent: v === '' ? 0 : Number(v),
                                });
                              }}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-blue-900 focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          <div>
                            <label className="font-semibold text-slate-700 block mb-1">
                              Security Deposit <span className="text-rose-500">*</span> (₹)
                            </label>
                            <input
                              type="number"
                              min="0"
                              required
                              value={rentalCheckInTerms.securityDeposit === 0 ? '' : rentalCheckInTerms.securityDeposit}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const v = e.target.value;
                                setRentalCheckInTerms({
                                  ...rentalCheckInTerms,
                                  securityDeposit: v === '' ? 0 : Number(v),
                                });
                              }}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-blue-800 focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Special Notes / Preferences</label>
                          <input
                            type="text"
                            placeholder="e.g. 1 Year Agreement, 2 Car Parking Slots allocated"
                            value={rentalCheckInTerms.terms}
                            onChange={(e) =>
                              setRentalCheckInTerms({ ...rentalCheckInTerms, terms: e.target.value })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {/* SECTION 7: TENANCY AGREEMENT & DIGITAL SIGNATURE */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
                              <FileSignature className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900">
                                Tenancy Agreement & Legal Compliance <span className="text-rose-500">*</span>
                              </h4>
                              <p className="text-[11px] text-slate-500">
                                Digital lease execution under Model Tenancy Act
                              </p>
                            </div>
                          </div>

                          {!agreementSignatureMap[selectedRentalUnit.id]?.isSigned && (
                            <button
                              type="button"
                              onClick={handleOpenAgreementSignModal}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shrink-0 transition shadow-2xs cursor-pointer"
                            >
                              <FileSignature className="w-3.5 h-3.5" />
                              <span>Review & E-Sign Agreement</span>
                            </button>
                          )}
                        </div>

                        {/* If Signed, show signed details card with View/Re-sign buttons */}
                        {agreementSignatureMap[selectedRentalUnit.id]?.isSigned && (
                          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-blue-950 truncate">
                                  Signed by {agreementSignatureMap[selectedRentalUnit.id]?.signerName}
                                </span>
                                <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                                  Verified
                                </span>
                              </div>
                              <p className="text-[11px] text-blue-700">
                                Signed on {new Date(agreementSignatureMap[selectedRentalUnit.id]?.signedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(agreementSignatureMap[selectedRentalUnit.id]?.signedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  const signDetails = getRentalAgreementDetails();
                                  setViewingAgreementDoc({
                                    ...signDetails,
                                    tenantPhone: signDetails.tenantPhone || '',
                                    ownerName: property?.ownerName || 'Property Landlord',
                                    ownerPhone: property?.contactPhone || '',
                                    ownerAddress: fullPropertyAddress,
                                    ownerSignature: property?.ownerSignature || 'DIGITAL_STAMP_DEFAULT',
                                    residentSignature: agreementSignatureMap[selectedRentalUnit.id]?.signatureImage || `SIGNED:${agreementSignatureMap[selectedRentalUnit.id]?.signerName}`,
                                    noticePeriodDays: Number(rentalCheckInTerms.noticePeriodDays) || property?.noticePeriodDays || 30,
                                    lockInPeriodValue: Number(rentalCheckInTerms.lockInMonths) || property?.lockInPeriodValue || 6,
                                    lockInPeriodUnit: 'MONTHS',
                                    witnesses: agreementSignatureMap[selectedRentalUnit.id]?.witnesses,
                                  });
                                }}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>View Agreement</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleOpenAgreementSignModal}
                                className="px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-700 font-bold border border-blue-300 rounded-lg text-xs transition shadow-2xs cursor-pointer"
                              >
                                Re-Sign
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Footer */}
                      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedRentalUnit(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          variant="primary"
                          size="sm"
                          isLoading={submittingRentalOccupancy}
                          className="font-semibold shadow-xs bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Complete Check-In & Assign Unit
                        </Button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ADD SINGLE HOUSE TO FLOOR MODAL                                           */}
        {/* ========================================================================= */}
        {addingHouseFloorNumber !== null && (
          <div className="fixed inset-0 z-50 bg-brand-navy/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold border border-blue-200 shadow-2xs">
                    <Home className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Add House / Unit — {getRentalFloorTitle(addingHouseFloorNumber)}
                    </h3>
                    <p className="text-xs text-slate-500">Configure house number, BHK type, area, and rent</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAddingHouseFloorNumber(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {addHouseFeedback && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{addHouseFeedback}</span>
                </div>
              )}

              <form onSubmit={(e) => { e.preventDefault(); handleSaveSingleHouseToFloor(); }} className="space-y-4 text-xs">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        House / Flat No. <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={addHouseForm.houseNumber}
                        onChange={(e) => setAddHouseForm({ ...addHouseForm, houseNumber: e.target.value })}
                        placeholder="e.g. Flat 101"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">House Type</label>
                      <select
                        value={addHouseForm.bhkType}
                        onChange={(e) => setAddHouseForm({ ...addHouseForm, bhkType: e.target.value })}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="1RK">1 RK Studio</option>
                        <option value="1BHK">1 BHK Flat</option>
                        <option value="2BHK">2 BHK Flat</option>
                        <option value="3BHK">3 BHK Flat</option>
                        <option value="4BHK">4 BHK Flat</option>
                        <option value="VILLA">Independent Villa</option>
                        <option value="PENTHOUSE">Luxury Penthouse</option>
                        <option value="DUPLEX">Duplex House</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Carpet Area (sq.ft)</label>
                      <input
                        type="number"
                        min="100"
                        value={addHouseForm.carpetAreaSqFt}
                        onChange={(e) => setAddHouseForm({ ...addHouseForm, carpetAreaSqFt: Number(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Furnishing Status</label>
                      <select
                        value={addHouseForm.furnishingStatus}
                        onChange={(e) => setAddHouseForm({ ...addHouseForm, furnishingStatus: e.target.value as any })}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="UNFURNISHED">Unfurnished</option>
                        <option value="SEMI_FURNISHED">Semi Furnished</option>
                        <option value="FULLY_FURNISHED">Fully Furnished</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Monthly Rent (₹/mo) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1000"
                        required
                        value={addHouseForm.monthlyRent === 0 ? '' : addHouseForm.monthlyRent}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const v = e.target.value;
                          const num = v === '' ? 0 : Number(v);
                          setAddHouseForm({
                            ...addHouseForm,
                            monthlyRent: num,
                          });
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-blue-900 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Security Deposit (₹) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={addHouseForm.securityDeposit === 0 ? '' : addHouseForm.securityDeposit}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAddHouseForm({ ...addHouseForm, securityDeposit: v === '' ? 0 : Number(v) });
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-blue-800 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAddingHouseFloorNumber(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isSavingNewHouse}
                    className="font-bold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Add House
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* EDIT FLAT / HOUSE SPECIFICATIONS MODAL                                     */}
        {/* ========================================================================= */}
        {editingRentalUnit && (
          <div className="fixed inset-0 z-50 bg-brand-navy/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 text-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold border border-blue-200 shadow-2xs">
                    <Home className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Edit Flat Specifications — {editingRentalUnit.unitNumber.replace(/^(flat|unit|house|room)\s*/i, '').trim()
                        ? `Flat ${editingRentalUnit.unitNumber.replace(/^(flat|unit|house|room)\s*/i, '').trim()}`
                        : editingRentalUnit.unitNumber}
                    </h3>
                    <p className="text-xs text-slate-500">Update house specifications, area, rent, and deposit</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingRentalUnit(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {editRentalUnitFeedback && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{editRentalUnitFeedback}</span>
                </div>
              )}

              <form onSubmit={(e) => { e.preventDefault(); handleSaveRentalUnitEdit(); }} className="space-y-4 text-xs">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        House / Flat No. <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editRentalUnitForm.unitNumber}
                        onChange={(e) => setEditRentalUnitForm({ ...editRentalUnitForm, unitNumber: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">House Type</label>
                      <select
                        value={editRentalUnitForm.unitType}
                        onChange={(e) => setEditRentalUnitForm({ ...editRentalUnitForm, unitType: e.target.value })}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="1RK">1 RK Studio</option>
                        <option value="1BHK">1 BHK Flat</option>
                        <option value="2BHK">2 BHK Flat</option>
                        <option value="3BHK">3 BHK Flat</option>
                        <option value="4BHK">4 BHK Flat</option>
                        <option value="VILLA">Independent Villa</option>
                        <option value="PENTHOUSE">Luxury Penthouse</option>
                        <option value="DUPLEX">Duplex House</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Floor Level</label>
                      <input
                        type="number"
                        min="0"
                        value={editRentalUnitForm.floorNumber}
                        onChange={(e) => setEditRentalUnitForm({ ...editRentalUnitForm, floorNumber: Number(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Furnishing Status</label>
                      <select
                        value={editRentalUnitForm.furnishingStatus}
                        onChange={(e) => setEditRentalUnitForm({ ...editRentalUnitForm, furnishingStatus: e.target.value as any })}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="UNFURNISHED">Unfurnished</option>
                        <option value="SEMI_FURNISHED">Semi Furnished</option>
                        <option value="FULLY_FURNISHED">Fully Furnished</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Carpet Area (sq.ft)</label>
                      <input
                        type="number"
                        min="100"
                        value={editRentalUnitForm.carpetAreaSqFt || ''}
                        onChange={(e) => setEditRentalUnitForm({ ...editRentalUnitForm, carpetAreaSqFt: Number(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Maintenance (₹/mo)</label>
                      <input
                        type="number"
                        min="0"
                        value={editRentalUnitForm.maintenanceCharges === 0 ? '' : editRentalUnitForm.maintenanceCharges}
                        onChange={(e) => setEditRentalUnitForm({ ...editRentalUnitForm, maintenanceCharges: e.target.value === '' ? 0 : Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Monthly Rent (₹) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1000"
                        required
                        value={editRentalUnitForm.monthlyRent === 0 ? '' : editRentalUnitForm.monthlyRent}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setEditRentalUnitForm({ ...editRentalUnitForm, monthlyRent: e.target.value === '' ? 0 : Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-blue-900 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Security Deposit (₹) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={editRentalUnitForm.securityDeposit === 0 ? '' : editRentalUnitForm.securityDeposit}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setEditRentalUnitForm({ ...editRentalUnitForm, securityDeposit: e.target.value === '' ? 0 : Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-blue-800 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingRentalUnit(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isSavingRentalUnitEdit}
                    className="font-bold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DELETE FLAT CONFIRMATION MODAL                                            */}
        {/* ========================================================================= */}
        {deletingRentalUnit && (
          <div className="fixed inset-0 z-50 bg-brand-navy/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 text-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold border border-rose-100 shadow-2xs shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Delete Flat {deletingRentalUnit.unitNumber}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {getRentalFloorTitle(deletingRentalUnit.floorNumber)} • {formatRentalUnitType(deletingRentalUnit.unitType)}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed bg-rose-50/50 p-3.5 rounded-xl border border-rose-100">
                Are you sure you want to permanently delete <strong>{deletingRentalUnit.unitNumber}</strong>? This action cannot be undone.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDeletingRentalUnit(null)}
                  disabled={isDeletingRentalUnit}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  isLoading={isDeletingRentalUnit}
                  onClick={handleConfirmDeleteRentalUnit}
                  className="font-bold gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Flat
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DELETE FLOOR CONFIRMATION MODAL (RENTAL)                                   */}
        {/* ========================================================================= */}
        {deletingRentalFloorNumber !== null && (
          <div className="fixed inset-0 z-50 bg-brand-navy/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 text-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold border border-rose-100 shadow-2xs shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Delete {getRentalFloorTitle(deletingRentalFloorNumber)}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Permanently remove floor and all its residential flats
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed bg-rose-50/50 p-3.5 rounded-xl border border-rose-100">
                Are you sure you want to delete <strong>{getRentalFloorTitle(deletingRentalFloorNumber)}</strong> and all houses located on this floor? This action is permanent.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDeletingRentalFloorNumber(null)}
                  disabled={isDeletingRentalFloor}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  isLoading={isDeletingRentalFloor}
                  onClick={handleConfirmDeleteRentalFloor}
                  className="font-bold gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Floor
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* POST-ALLOCATION WHATSAPP & PDF DELIVERY MODAL                              */}
        {/* ========================================================================= */}
        {postCheckInAgreement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 text-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold border border-emerald-200">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Allocation & Tenancy Executed!
                    </h3>
                    <p className="text-xs text-slate-500">
                      {postCheckInAgreement.unitName} • {postCheckInAgreement.tenantName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPostCheckInAgreement(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 bg-teal-50/50 rounded-xl border border-teal-200 space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>Digital Agreement Document:</span>
                  <span className="text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-bold border border-emerald-300">
                    {postCheckInAgreement.isSigned ? 'Dual Signed & Executed' : 'MTA 2021 Formatted'}
                  </span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  The tenancy agreement has been automatically generated with landlord signature and resident details. A permanent legal copy is stored in the <strong>Tenant Profile Documents</strong>.
                </p>
              </div>

              {/* Action Buttons: 1st View Document, 2nd Download PDF */}
              <div className="space-y-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const key = selectedBed ? selectedBed.id : selectedRentalUnit ? selectedRentalUnit.id : 'current';
                    const sig = agreementSignatureMap[key];
                    const baseDetails = isPG ? getPgAgreementDetails() : getRentalAgreementDetails();
                    setViewingAgreementDoc({
                      ...baseDetails,
                      tenantName: postCheckInAgreement.tenantName,
                      tenantPhone: postCheckInAgreement.tenantPhone,
                      tenantEmail: postCheckInAgreement.tenantEmail,
                      propertyName: postCheckInAgreement.propertyName,
                      propertyAddress: fullPropertyAddress,
                      unitOrBedName: postCheckInAgreement.unitName,
                      propertyType: isPG ? 'PG' : 'RENTAL_HOUSE',
                      monthlyRent: postCheckInAgreement.monthlyRent,
                      ownerName: property?.ownerName || 'Arun Sharma',
                      ownerPhone: property?.ownerPhone || property?.contactPhone || '+91 98765 43210',
                      ownerAddress: property?.ownerAddress || fullPropertyAddress,
                      ownerSignature: property?.ownerSignature || generateDigitalSignatureDataUrl(property?.ownerName || 'Arun Sharma', 'Authorized Landlord / Owner'),
                      residentSignature: sig?.signatureImage || `SIGNED:${postCheckInAgreement.tenantName}`,
                      sharingType: selectedBedRoom?.sharingType,
                      witnesses: sig?.witnesses,
                    });
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-50 text-black font-bold text-sm flex items-center justify-center gap-2 border-2 border-black shadow-xs transition cursor-pointer"
                >
                  <FileText className="w-5 h-5 text-black" />
                  <span>View Filled Agreement Document (PDF)</span>
                </button>

                <button
                  type="button"
                  disabled={isDownloadingPostCheckInPdf}
                  onClick={async () => {
                    setIsDownloadingPostCheckInPdf(true);
                    try {
                      const key = selectedBed ? selectedBed.id : selectedRentalUnit ? selectedRentalUnit.id : 'current';
                      const sig = agreementSignatureMap[key];
                      const baseDetails = isPG ? getPgAgreementDetails() : getRentalAgreementDetails();
                      const agreementDocData: AgreementDocumentData = {
                        ...baseDetails,
                        tenantName: postCheckInAgreement.tenantName,
                        tenantPhone: postCheckInAgreement.tenantPhone,
                        tenantEmail: postCheckInAgreement.tenantEmail,
                        propertyName: postCheckInAgreement.propertyName,
                        propertyAddress: fullPropertyAddress,
                        unitOrBedName: postCheckInAgreement.unitName,
                        propertyType: isPG ? 'PG' : 'RENTAL_HOUSE',
                        monthlyRent: postCheckInAgreement.monthlyRent,
                        securityDeposit: postCheckInAgreement.securityDeposit,
                        ownerName: property?.ownerName || 'Arun Sharma',
                        ownerPhone: property?.ownerPhone || property?.contactPhone || '+91 98765 43210',
                        ownerAddress: property?.ownerAddress || fullPropertyAddress,
                        ownerSignature: property?.ownerSignature || generateDigitalSignatureDataUrl(property?.ownerName || 'Arun Sharma', 'Authorized Landlord / Owner'),
                        residentSignature: sig?.signatureImage || `SIGNED:${postCheckInAgreement.tenantName}`,
                        sharingType: selectedBedRoom?.sharingType,
                        witnesses: sig?.witnesses,
                      };
                      await downloadAgreementPdf(agreementDocData);
                    } catch (err) {
                      console.error('Failed to download PDF:', err);
                    } finally {
                      setIsDownloadingPostCheckInPdf(false);
                    }
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isDownloadingPostCheckInPdf ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Downloading Agreement PDF...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      <span>Download Agreement (PDF)</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setPostCheckInAgreement(null)}
                  className="font-bold text-sm px-6 py-2.5 shadow-sm"
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DIGITAL TENANCY AGREEMENT E-SIGN MODAL                                    */}
        {/* ========================================================================= */}
        {showAgreementModal && (
          <AgreementSignModal
            isOpen={showAgreementModal}
            onClose={() => setShowAgreementModal(false)}
            onSignComplete={handleAgreementSigned}
            agreementData={isPG ? getPgAgreementDetails() : getRentalAgreementDetails()}
          />
        )}

        {/* ========================================================================= */}
        {/* FILLED TENANCY AGREEMENT DOCUMENT PDF VIEWER MODAL                        */}
        {/* ========================================================================= */}
        {viewingAgreementDoc && (
          <AgreementDocumentViewerModal
            isOpen={!!viewingAgreementDoc}
            onClose={() => setViewingAgreementDoc(null)}
            agreementData={viewingAgreementDoc}
          />
        )}
      </div>
    </AppShell>
  );
}
