'use client';

import React, { useState, useRef, useEffect } from 'react';
import { getLocalDateString, formatAgreementDate } from '../../lib/date-utils';
import {
  FileSignature,
  CheckCircle2,
  ShieldCheck,
  X,
  RotateCcw,
  Building,
  User,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  AlertCircle,
  FileText,
  Lock,
  ChevronRight,
  PenTool,
  Clock,
  Check,
  Scale,
  Type,
  Users,
  MapPin,
  Keyboard,
} from 'lucide-react';

export interface AgreementSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignComplete: (signatureData: {
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
  }) => void;
  agreementData: {
    tenantName: string;
    tenantPhone?: string;
    tenantEmail?: string;
    tenantAadhaar?: string;
    tenantAddress?: string;
    ownerName?: string;
    ownerAddress?: string;
    ownerPhone?: string;
    ownerSignature?: string;
    residentSignature?: string;
    propertyName: string;
    propertyAddress?: string;
    unitOrBedName: string; // e.g. "Bed 102-A" or "Flat 102"
    sharingType?: string;
    propertyType: 'PG' | 'RENTAL_HOUSE';
    monthlyRent: number | string;
    securityDeposit?: number | string;
    roomNumber?: string;
    lockInMonths?: number;
    lockInPeriodMonths?: number;
    lockInPeriodValue?: number;
    lockInPeriodUnit?: 'DAYS' | 'MONTHS' | 'YEARS' | string;
    noticePeriodDays?: number;
    startDate?: string;
    endDate?: string;
    witnesses?: Array<{
      name?: string;
      date?: string;
      address?: string;
      signature?: string;
    }>;
  };
}

export type AgreementSignDetails = AgreementSignModalProps['agreementData'];

export function formatIdProofDisplay(docTypeOrFullString?: string | null, docNum?: string | null): string {
  if (!docTypeOrFullString && !docNum) return '';

  let str = (docTypeOrFullString || '').trim();
  let num = (docNum || '').trim();

  // If str is in "Name (Number)" format, extract both
  const match = str.match(/^([^(]+)\s*\(([^)]+)\)$/);
  if (match) {
    str = match[1].trim();
    if (!num) {
      num = match[2].trim();
    }
  }

  // If str contains "and" or ":", e.g. "Aadhaar and 987678987678" or "Aadhaar: 987678987678"
  if (str && !num && (str.includes(' and ') || str.includes(':'))) {
    const parts = str.split(/\s+and\s+|:\s*/);
    if (parts.length === 2) {
      str = parts[0].trim();
      num = parts[1].trim();
    }
  }

  // If str is purely numeric (or starts with ID:) and num is empty, treat str as doc number
  if (/^(ID:\s*)?\d{8,16}$/i.test(str) && !num) {
    num = str.replace(/^ID:\s*/i, '').trim();
    str = 'Aadhaar';
  }

  // Clean num of any "ID:" or existing outer parens
  num = num.replace(/^ID:\s*/i, '').replace(/^\((.*)\)$/, '$1').trim();

  // Standardize doc name
  let docName = str || 'Aadhaar';
  if (/^aadhaar/i.test(docName) || /^aadhar/i.test(docName)) {
    docName = 'Aadhar';
  } else if (/^pan/i.test(docName)) {
    docName = 'PAN';
  } else if (/^passport/i.test(docName)) {
    docName = 'Passport';
  } else if (/^voter/i.test(docName)) {
    docName = 'Voter ID';
  } else if (/^driv/i.test(docName)) {
    docName = 'Driving License';
  } else if (/^employ/i.test(docName) || /^corp/i.test(docName)) {
    docName = 'Employment ID';
  } else if (/^student/i.test(docName)) {
    docName = 'Student ID';
  } else {
    docName = docName.replace(/_/g, ' ').replace(/\s*Card\s*/i, '').trim();
    if (docName.length > 0) {
      docName = docName.charAt(0).toUpperCase() + docName.slice(1);
    } else {
      docName = 'Aadhar';
    }
  }

  if (num) {
    return `${docName} (${num})`;
  }

  return docName;
}

export function AgreementSignModal({
  isOpen,
  onClose,
  onSignComplete,
  agreementData,
}: AgreementSignModalProps) {
  const isPG = agreementData.propertyType === 'PG';

  // Dynamic Theme Colors: PG (Teal) vs House Rental (Blue)
  const strokeColor = isPG ? '#0f766e' : '#2563eb';
  const theme = {
    primaryBg: isPG ? 'bg-brand-teal hover:bg-teal-700' : 'bg-blue-600 hover:bg-blue-700',
    primaryText: isPG ? 'text-brand-teal' : 'text-blue-600',
    primaryBorder: isPG ? 'border-teal-200' : 'border-blue-200',
    primaryBorderFocus: isPG ? 'focus:ring-brand-teal' : 'focus:ring-blue-500',
    primaryLightBg: isPG ? 'bg-teal-50/70' : 'bg-blue-50/70',
    primaryBadgeBg: isPG ? 'bg-teal-100/90 text-teal-800 border-teal-200' : 'bg-blue-50 text-blue-800 border-blue-200',
    cardBorder: isPG ? 'border-teal-300' : 'border-blue-300',
    cardLightBorder: isPG ? 'border-teal-200' : 'border-blue-200',
    canvasBorder: isPG ? 'border-teal-400/80' : 'border-blue-400/80',
    depositText: isPG ? 'text-emerald-800' : 'text-blue-900',
    allocatedText: isPG ? 'text-brand-teal' : 'text-blue-700',
    checkboxBg: isPG ? 'bg-teal-50/80 border-teal-200/90' : 'bg-blue-50/80 border-blue-200/90',
    checkboxInput: isPG ? 'text-brand-teal focus:ring-brand-teal' : 'text-blue-600 focus:ring-blue-500',
    preAuthBadge: isPG ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-blue-100 text-blue-800 border-blue-300',
  };

  // Primary Tenant Signature state
  const [signMode, setSignMode] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState(agreementData.tenantName || '');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [currentSignatureImage, setCurrentSignatureImage] = useState<string | undefined>(agreementData.residentSignature);

  // Witness 1 State
  const [w1SignMode, setW1SignMode] = useState<'draw' | 'type'>('draw');
  const [w1Name, setW1Name] = useState(agreementData.witnesses?.[0]?.name || '');
  const [w1Date, setW1Date] = useState(agreementData.witnesses?.[0]?.date ? getLocalDateString(agreementData.witnesses[0].date) : getLocalDateString());
  const [w1Address, setW1Address] = useState(agreementData.witnesses?.[0]?.address || '');
  const [w1TypedSignature, setW1TypedSignature] = useState('');
  const [w1DrawnSignature, setW1DrawnSignature] = useState('');
  const w1CanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isW1Drawing, setIsW1Drawing] = useState(false);
  const [hasW1Drawn, setHasW1Drawn] = useState(false);

  // Witness 2 State
  const [w2SignMode, setW2SignMode] = useState<'draw' | 'type'>('draw');
  const [w2Name, setW2Name] = useState(agreementData.witnesses?.[1]?.name || '');
  const [w2Date, setW2Date] = useState(agreementData.witnesses?.[1]?.date ? getLocalDateString(agreementData.witnesses[1].date) : getLocalDateString());
  const [w2Address, setW2Address] = useState(agreementData.witnesses?.[1]?.address || '');
  const [w2TypedSignature, setW2TypedSignature] = useState('');
  const [w2DrawnSignature, setW2DrawnSignature] = useState('');
  const w2CanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isW2Drawing, setIsW2Drawing] = useState(false);
  const [hasW2Drawn, setHasW2Drawn] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
      setCurrentSignatureImage(agreementData.residentSignature);

      if (agreementData.residentSignature) {
        if (agreementData.residentSignature.startsWith('TYPE:')) {
          setSignMode('type');
          setTypedName(agreementData.residentSignature.replace('TYPE:', ''));
          setHasDrawn(true);
          setTermsAccepted(true);
        } else {
          setSignMode('draw');
          setTypedName(agreementData.tenantName || '');
          setHasDrawn(true);
          setTermsAccepted(true);
        }
      } else {
        setTypedName(agreementData.tenantName || '');
        setTermsAccepted(false);
        setHasDrawn(false);
        setSignMode('draw');
      }

      // Initialize witnesses if present
      if (agreementData.witnesses?.[0]) {
        const w1 = agreementData.witnesses[0];
        setW1Name(w1.name || '');
        setW1Date(w1.date ? getLocalDateString(w1.date) : getLocalDateString());
        setW1Address(w1.address || '');
        if (w1.signature?.startsWith('TYPE:')) {
          setW1SignMode('type');
          setW1TypedSignature(w1.signature.replace('TYPE:', ''));
          setW1DrawnSignature('');
          setHasW1Drawn(true);
        } else if (w1.signature?.startsWith('data:image')) {
          setW1SignMode('draw');
          setW1DrawnSignature(w1.signature);
          setW1TypedSignature('');
          setHasW1Drawn(true);
        } else if (w1.signature) {
          setW1SignMode('type');
          setW1TypedSignature(w1.signature.replace(/^WITNESS:/i, ''));
          setW1DrawnSignature('');
          setHasW1Drawn(true);
        } else {
          setW1SignMode('draw');
          setW1DrawnSignature('');
          setW1TypedSignature('');
          setHasW1Drawn(false);
        }
      } else {
        setW1Name('');
        setW1Date(getLocalDateString());
        setW1Address('');
        setW1SignMode('draw');
        setW1DrawnSignature('');
        setW1TypedSignature('');
        setHasW1Drawn(false);
      }

      if (agreementData.witnesses?.[1]) {
        const w2 = agreementData.witnesses[1];
        setW2Name(w2.name || '');
        setW2Date(w2.date ? getLocalDateString(w2.date) : getLocalDateString());
        setW2Address(w2.address || '');
        if (w2.signature?.startsWith('TYPE:')) {
          setW2SignMode('type');
          setW2TypedSignature(w2.signature.replace('TYPE:', ''));
          setW2DrawnSignature('');
          setHasW2Drawn(true);
        } else if (w2.signature?.startsWith('data:image')) {
          setW2SignMode('draw');
          setW2DrawnSignature(w2.signature);
          setW2TypedSignature('');
          setHasW2Drawn(true);
        } else if (w2.signature) {
          setW2SignMode('type');
          setW2TypedSignature(w2.signature.replace(/^WITNESS:/i, ''));
          setW2DrawnSignature('');
          setHasW2Drawn(true);
        } else {
          setW2SignMode('draw');
          setW2DrawnSignature('');
          setW2TypedSignature('');
          setHasW2Drawn(false);
        }
      } else {
        setW2Name('');
        setW2Date(getLocalDateString());
        setW2Address('');
        setW2SignMode('draw');
        setW2DrawnSignature('');
        setW2TypedSignature('');
        setHasW2Drawn(false);
      }
    }
  }, [isOpen, agreementData.tenantName, agreementData.residentSignature, agreementData.witnesses]);

  // Load existing signature onto canvas when modal opens in draw mode
  useEffect(() => {
    if (
      isOpen &&
      signMode === 'draw' &&
      currentSignatureImage &&
      !currentSignatureImage.startsWith('TYPE:')
    ) {
      const timer = setTimeout(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setHasDrawn(true);
        };
        img.src = currentSignatureImage;
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [isOpen, signMode, currentSignatureImage]);

  // Load existing Witness 1 signature onto canvas when modal opens in draw mode
  useEffect(() => {
    if (
      isOpen &&
      w1SignMode === 'draw' &&
      w1DrawnSignature &&
      w1DrawnSignature.startsWith('data:image')
    ) {
      const timer = setTimeout(() => {
        const canvas = w1CanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setHasW1Drawn(true);
        };
        img.src = w1DrawnSignature;
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [isOpen, w1SignMode, w1DrawnSignature]);

  // Load existing Witness 2 signature onto canvas when modal opens in draw mode
  useEffect(() => {
    if (
      isOpen &&
      w2SignMode === 'draw' &&
      w2DrawnSignature &&
      w2DrawnSignature.startsWith('data:image')
    ) {
      const timer = setTimeout(() => {
        const canvas = w2CanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setHasW2Drawn(true);
        };
        img.src = w2DrawnSignature;
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [isOpen, w2SignMode, w2DrawnSignature]);

  // Tenant Canvas Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      if (canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        setCurrentSignatureImage(dataUrl);
        setHasDrawn(true);
      }
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setHasDrawn(false);
    setCurrentSignatureImage(undefined);
  };

  // Witness 1 Drawing Handlers
  const startW1Drawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = w1CanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsW1Drawing(true);
    setHasW1Drawn(true);
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawW1 = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isW1Drawing) return;
    const canvas = w1CanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopW1Drawing = () => {
    if (isW1Drawing) {
      setIsW1Drawing(false);
      const canvas = w1CanvasRef.current;
      if (canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        setW1DrawnSignature(dataUrl);
        setHasW1Drawn(true);
      }
    }
  };

  const clearW1Canvas = () => {
    const canvas = w1CanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setHasW1Drawn(false);
    setW1DrawnSignature('');
  };

  // Witness 2 Drawing Handlers
  const startW2Drawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = w2CanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsW2Drawing(true);
    setHasW2Drawn(true);
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawW2 = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isW2Drawing) return;
    const canvas = w2CanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopW2Drawing = () => {
    if (isW2Drawing) {
      setIsW2Drawing(false);
      const canvas = w2CanvasRef.current;
      if (canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        setW2DrawnSignature(dataUrl);
        setHasW2Drawn(true);
      }
    }
  };

  const clearW2Canvas = () => {
    const canvas = w2CanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setHasW2Drawn(false);
    setW2DrawnSignature('');
  };

  const handleExecuteSignature = async () => {
    if (!termsAccepted) return;
    setIsSubmitting(true);

    let signatureImage = '';
    if (signMode === 'draw') {
      if (canvasRef.current && hasDrawn) {
        signatureImage = canvasRef.current.toDataURL('image/png');
      } else if (currentSignatureImage) {
        signatureImage = currentSignatureImage;
      }
    } else if (signMode === 'type') {
      signatureImage = `TYPE:${typedName.trim() || agreementData.tenantName}`;
    }

    try {
      const witnessesPayload = [];

      // Process Witness 1
      let finalW1Sig = '';
      if (w1SignMode === 'type') {
        const typeVal = w1TypedSignature.trim() || w1Name.trim();
        if (typeVal) {
          finalW1Sig = `TYPE:${typeVal}`;
        }
      } else if (w1SignMode === 'draw') {
        if (w1CanvasRef.current && hasW1Drawn) {
          finalW1Sig = w1CanvasRef.current.toDataURL('image/png');
        } else if (w1DrawnSignature) {
          finalW1Sig = w1DrawnSignature;
        }
      }

      if (w1Name.trim() || w1Address.trim() || finalW1Sig) {
        witnessesPayload.push({
          name: w1Name.trim(),
          date: w1Date ? formatAgreementDate(w1Date) : formatAgreementDate(new Date()),
          address: w1Address.trim(),
          signature: finalW1Sig || (w1Name.trim() ? `WITNESS:${w1Name.trim()}` : undefined),
        });
      }

      // Process Witness 2
      let finalW2Sig = '';
      if (w2SignMode === 'type') {
        const typeVal = w2TypedSignature.trim() || w2Name.trim();
        if (typeVal) {
          finalW2Sig = `TYPE:${typeVal}`;
        }
      } else if (w2SignMode === 'draw') {
        if (w2CanvasRef.current && hasW2Drawn) {
          finalW2Sig = w2CanvasRef.current.toDataURL('image/png');
        } else if (w2DrawnSignature) {
          finalW2Sig = w2DrawnSignature;
        }
      }

      if (w2Name.trim() || w2Address.trim() || finalW2Sig) {
        witnessesPayload.push({
          name: w2Name.trim(),
          date: w2Date ? formatAgreementDate(w2Date) : formatAgreementDate(new Date()),
          address: w2Address.trim(),
          signature: finalW2Sig || (w2Name.trim() ? `WITNESS:${w2Name.trim()}` : undefined),
        });
      }

      await onSignComplete({
        signerName: typedName.trim() || agreementData.tenantName,
        signerEmail: agreementData.tenantEmail,
        signatureImage: signatureImage || undefined,
        signedAt: new Date().toISOString(),
        agreementType: isPG ? 'PG_AGREEMENT' : 'RENTAL_AGREEMENT',
        witnesses: witnessesPayload.length > 0 ? witnessesPayload : undefined,
      });
    } catch {
      // Handled upstream
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Numeric Formats
  const numericRent =
    typeof agreementData.monthlyRent === 'number'
      ? agreementData.monthlyRent
      : Number(String(agreementData.monthlyRent).replace(/[^\d.]/g, '')) || 0;

  const numericDeposit =
    typeof agreementData.securityDeposit === 'number'
      ? agreementData.securityDeposit
      : Number(String(agreementData.securityDeposit).replace(/[^\d.]/g, '')) || numericRent * 2;

  const formattedRentNumber = numericRent.toLocaleString('en-IN');
  const formattedDepositNumber = numericDeposit.toLocaleString('en-IN');

  const ownerDisplayName = agreementData.ownerName || `${agreementData.propertyName} Management`;
  const ownerDisplayAddress =
    agreementData.ownerAddress || agreementData.propertyAddress || 'Registered Property Office';
  const tenantDisplayAddress =
    agreementData.tenantAddress || 'Address on record / Verified via Government Photo ID';
  const propertyDisplayAddress =
    agreementData.propertyAddress || `${agreementData.propertyName}, Tamilnadu — 123456`;

  // Parse City from property address
  const cityMatch = propertyDisplayAddress.match(/(?:,\s*)([A-Za-z\s]+)(?:,\s*[A-Za-z\s]+—|\s*-\s*\d+)/);
  const executionCity = cityMatch ? cityMatch[1].trim() : 'coimbatore';

  // Execution Date
  const execDateBase = agreementData.startDate ? new Date(agreementData.startDate) : new Date();
  const execDateSafe = isNaN(execDateBase.getTime()) ? new Date() : execDateBase;
  const execDay = String(execDateSafe.getDate()).padStart(2, '0');
  const execMonth = execDateSafe.toLocaleString('en-IN', { month: 'long' });
  const execYear = String(execDateSafe.getFullYear());
  const execYearShort = execYear.slice(-2);
  const executedDateFormatted = formatAgreementDate(agreementData.startDate || new Date());

  // Start and End Date formatting
  const parseDateFormatted = (dateStr?: string) => {
    return formatAgreementDate(dateStr) || formatAgreementDate(new Date());
  };

  const formattedStartDate = parseDateFormatted(agreementData.startDate);
  const formattedEndDate = agreementData.endDate
    ? parseDateFormatted(agreementData.endDate)
    : (() => {
        const start = agreementData.startDate ? new Date(agreementData.startDate) : new Date();
        const end = new Date(start);
        end.setMonth(end.getMonth() + 11);
        end.setDate(end.getDate() - 1);
        return `${String(end.getDate()).padStart(2, '0')}/${String(end.getMonth() + 1).padStart(2, '0')}/${end.getFullYear()}`;
      })();

  const tenancyPeriodLabel = (() => {
    const sDate = agreementData.startDate ? new Date(agreementData.startDate) : new Date();
    let eDate: Date;
    if (agreementData.endDate) {
      eDate = new Date(agreementData.endDate);
    } else {
      eDate = new Date(sDate);
      eDate.setMonth(eDate.getMonth() + 11);
      eDate.setDate(eDate.getDate() - 1);
    }

    if (isNaN(sDate.getTime()) || isNaN(eDate.getTime())) {
      return '11 Months';
    }

    const diffMs = eDate.getTime() - sDate.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays >= 325 && diffDays <= 345) {
      return '11 Months';
    }
    if (diffDays >= 360 && diffDays <= 366) {
      return '12 Months (1 Year)';
    }

    const startYear = sDate.getFullYear();
    const startMonth = sDate.getMonth();
    const startDay = sDate.getDate();

    const endYear = eDate.getFullYear();
    const endMonth = eDate.getMonth();
    const endDay = eDate.getDate();

    const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth);
    const adjustedMonths = (endDay >= startDay - 2) ? totalMonths : totalMonths - 1;

    if (adjustedMonths === 11) return '11 Months';
    if (adjustedMonths === 12) return '12 Months (1 Year)';
    if (adjustedMonths > 12 && adjustedMonths % 12 === 0) {
      const yrs = adjustedMonths / 12;
      return `${yrs} ${yrs === 1 ? 'Year' : 'Years'}`;
    }
    if (adjustedMonths > 0) return `${adjustedMonths} Months`;
    if (diffDays > 0) return `${diffDays} Days`;
    return '11 Months';
  })();

  // ID Proof Extraction
  const rawId = agreementData.tenantAadhaar || '5489-3231-3231';
  const isPan = /PAN/i.test(rawId);
  const isVoter = /VOTER/i.test(rawId);
  const isDL = /DRIVING|DL/i.test(rawId);
  const isAadhaar = !isPan && !isVoter && !isDL;
  const cleanIdNumber = rawId.replace(/^(Aadhaar|PAN|Voter ID|Driving License)\s*[:\-]?\s*/i, '').trim() || '5489-3231-3231';

  // Unit and Sharing Labels
  const formattedUnit = agreementData.unitOrBedName.replace(/^(flat|unit|house|room)\s*/i, '').trim();
  const unitLabel = isPG ? agreementData.unitOrBedName : `Flat ${formattedUnit || agreementData.unitOrBedName}`;
  const rentedFullAddress = `${unitLabel}, ${propertyDisplayAddress}`;
  const sharingDisplay = agreementData.sharingType
    ? agreementData.sharingType
    : isPG
    ? 'Single / Double Sharing'
    : 'Full Residential Unit';

  const noticeDays = agreementData.noticePeriodDays ?? 30;
  const lockInValue = agreementData.lockInPeriodValue ?? agreementData.lockInMonths ?? 1;
  const rawUnit = (agreementData.lockInPeriodUnit || 'MONTHS').toUpperCase();
  const lockInUnitDisplay = rawUnit.startsWith('DAY')
    ? (lockInValue === 1 ? 'Day' : 'Days')
    : rawUnit.startsWith('YEAR')
    ? (lockInValue === 1 ? 'Year' : 'Years')
    : (lockInValue === 1 ? 'Month' : 'Months');

  const isSignatureProvided =
    (signMode === 'draw' && (hasDrawn || Boolean(currentSignatureImage))) ||
    (signMode === 'type' && typedName.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl max-h-[96vh] rounded-2xl shadow-2xl border border-slate-300 flex flex-col overflow-hidden text-slate-900">
        
        {/* ========================================================================= */}
        {/* MODAL CONTROL HEADER */}
        {/* ========================================================================= */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${isPG ? 'bg-teal-500/20 border-teal-400/40 text-teal-300' : 'bg-blue-500/20 border-blue-400/40 text-blue-300'} border flex items-center justify-center font-bold shadow-xs`}>
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                {isPG ? 'Paying Guest Accommodation Agreement' : 'Residential Rent Agreement'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Official Digital Agreement & Direct E-Signature for <strong className="text-white font-semibold">{agreementData.tenantName}</strong> • {unitLabel}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* OFFICIAL A4 DOCUMENT BODY WITH INTEGRATED SIGNATURES & WITNESSES */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200/80">
          <div
            className="bg-white max-w-[880px] mx-auto rounded-none sm:rounded-xl shadow-xl border border-slate-300 p-8 sm:p-14 space-y-8 text-slate-950 font-sans leading-normal"
            style={{ minHeight: '1100px' }}
          >
            
            {/* =================================================================== */}
            {/* DOCUMENT HEADER */}
            {/* =================================================================== */}
            <div className="text-center space-y-2 pb-2">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-slate-100 text-slate-800 text-xs sm:text-sm font-bold mb-1">
                <Scale className={`w-4 h-4 ${theme.primaryText}`} />
                Official Tenancy Contract Format
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-wider text-slate-950 uppercase">
                {isPG ? 'PAYING GUEST ACCOMMODATION AGREEMENT' : 'RESIDENTIAL RENT AGREEMENT'}
              </h1>
              <p className="text-base sm:text-[15.5px] text-slate-900 font-medium italic max-w-2xl mx-auto leading-relaxed">
                {isPG
                  ? 'This digital agreement is executed electronically and serves as a legally binding document between the Owner and the Paying Guest.'
                  : 'This lease agreement is governed under the Indian Contract Act, 1872 and the Transfer of Property Act, 1882 and this digital agreement is executed electronically and serves as a legally binding document between the Landlord and the Tenant.'}
              </p>
            </div>

            {/* =================================================================== */}
            {/* OPENING RECITALS */}
            {/* =================================================================== */}
            <div className="text-base sm:text-[16px] text-slate-950 font-medium text-justify leading-relaxed">
              {isPG ? (
                <p>
                  This Paying Guest Accommodation Agreement is entered into on this{' '}
                  <span className="font-bold">{execDay}</span> day of{' '}
                  <span className="font-bold">{execMonth}</span>, 20
                  <span className="font-bold">{execYearShort}</span> by and between the party
                  detailed as <strong>PG Owner/Manager</strong> and the party detailed as{' '}
                  <strong>PG Resident/Tenant</strong> in the schedule below. The expressions 'Owner' and
                  'Resident' shall mean and include their respective heirs, successors, legal representatives and
                  assigns.
                </p>
              ) : (
                <p>
                  This Rent Agreement is made and executed at{' '}
                  <span className="font-bold">{executionCity}</span> on this{' '}
                  <span className="font-bold">{execDay}</span> day of{' '}
                  <span className="font-bold">{execMonth}</span>, 20
                  <span className="font-bold">{execYearShort}</span> by and between the party
                  detailed as <strong>Landlord/Lessor</strong> and the party detailed as{' '}
                  <strong>Tenant/Lessee</strong> in the schedule below. The expressions 'Landlord' and 'Tenant'
                  shall mean and include their respective heirs, successors, legal representatives, and assigns.
                </p>
              )}
            </div>

            {/* =================================================================== */}
            {/* SCHEDULE OF PARTIES & PROPERTY DETAILS TABLE (EXACT 11 ROWS) */}
            {/* =================================================================== */}
            <div className="space-y-3 pt-1">
              <h2 className="text-base sm:text-lg font-black text-slate-950 uppercase tracking-wide">
                SCHEDULE OF PARTIES & PROPERTY DETAILS
              </h2>

              <div className="border-2 border-slate-900 overflow-hidden rounded-md">
                <table className="w-full text-base sm:text-[15.5px] text-left border-collapse">
                  <tbody>
                    {/* Row 1 */}
                    <tr className="border-b border-slate-900">
                      <td className="p-3.5 sm:p-4 font-black text-slate-950 w-[36%] align-top border-r-2 border-slate-900 bg-slate-100/90">
                        1. {isPG ? 'Owner Name:' : 'Landlord Name:'}
                      </td>
                      <td className="p-3.5 sm:p-4 font-bold text-slate-950">{ownerDisplayName}</td>
                    </tr>

                    {/* Row 2 */}
                    <tr className="border-b border-slate-900">
                      <td className="p-3.5 sm:p-4 font-black text-slate-950 align-top border-r-2 border-slate-900 bg-slate-100/90">
                        2. {isPG ? 'Resident Name:' : 'Landlord Address:'}
                      </td>
                      <td className="p-3.5 sm:p-4 text-slate-950 font-semibold">
                        {isPG ? agreementData.tenantName : ownerDisplayAddress}
                      </td>
                    </tr>

                    {/* Row 3 */}
                    <tr className="border-b border-slate-900">
                      <td className="p-3.5 sm:p-4 font-black text-slate-950 align-top border-r-2 border-slate-900 bg-slate-100/90">
                        3. {isPG ? 'Resident Permanent Address:' : 'Tenant Name:'}
                      </td>
                      <td className="p-3.5 sm:p-4 text-slate-950 font-semibold">
                        {isPG ? tenantDisplayAddress : agreementData.tenantName}
                      </td>
                    </tr>

                    {/* Row 4 */}
                    <tr className="border-b border-slate-900">
                      <td className="p-3.5 sm:p-4 font-black text-slate-950 align-top border-r-2 border-slate-900 bg-slate-100/90">
                        4. {isPG ? 'PG Property Address:' : 'Tenant Permanent Address:'}
                      </td>
                      <td className="p-3.5 sm:p-4 text-slate-950 font-semibold">
                        {isPG ? propertyDisplayAddress : tenantDisplayAddress}
                      </td>
                    </tr>

                    {/* Row 5 */}
                    <tr className="border-b border-slate-900">
                      <td className="p-3.5 sm:p-4 font-black text-slate-950 align-top border-r-2 border-slate-900 bg-slate-100/90">
                        5. {isPG ? 'Allocated Room/Bed No:' : 'ID Proof Provided:'}
                      </td>
                      <td className="p-3.5 sm:p-4 text-slate-950">
                        {isPG ? (
                          <span className="font-bold">
                            {agreementData.unitOrBedName} ({sharingDisplay})
                          </span>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-4">
                              <span>Aadhaar [{isAadhaar ? '✓' : ' '}]</span>
                              <span>PAN [{isPan ? '✓' : ' '}]</span>
                              <span>Voter ID [{isVoter ? '✓' : ' '}]</span>
                              <span>Driving License [{isDL ? '✓' : ' '}]</span>
                            </div>
                            <div>
                              <span className="font-bold">No:</span> {cleanIdNumber}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Row 6 */}
                    <tr className="border-b border-slate-900">
                      <td className="p-3.5 sm:p-4 font-black text-slate-950 align-top border-r-2 border-slate-900 bg-slate-100/90">
                        6. {isPG ? 'ID Proof Provided:' : 'Rented Property Address:'}
                      </td>
                      <td className="p-3.5 sm:p-4 text-slate-950">
                        {isPG ? (
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-4">
                              <span>Aadhaar [{isAadhaar ? '✓' : ' '}]</span>
                              <span>PAN [{isPan ? '✓' : ' '}]</span>
                              <span>Voter ID [{isVoter ? '✓' : ' '}]</span>
                              <span>Driving License [{isDL ? '✓' : ' '}]</span>
                            </div>
                            <div>
                              <span className="font-bold">No:</span> {cleanIdNumber}
                            </div>
                          </div>
                        ) : (
                          <span className="font-semibold">{rentedFullAddress}</span>
                        )}
                      </td>
                    </tr>

                    {/* Row 7 */}
                    <tr className="border-b border-slate-900">
                      <td className="p-3.5 sm:p-4 font-black text-slate-950 align-top border-r-2 border-slate-900 bg-slate-100/90">
                        7. {isPG ? 'Monthly PG Rent:' : 'Monthly Rent Amount:'}
                      </td>
                      <td className="p-3.5 sm:p-4 text-slate-950">
                        <span className="font-black">Rs. {formattedRentNumber}/-</span> Payment Due Date: By 5th of each month.
                      </td>
                    </tr>

                    {/* Row 8 */}
                    <tr className="border-b border-slate-900">
                      <td className="p-3.5 sm:p-4 font-black text-slate-950 align-top border-r-2 border-slate-900 bg-slate-100/90">
                        8. Security Deposit Amount:
                      </td>
                      <td className="p-3.5 sm:p-4 text-slate-950">
                        <span className="font-black">Rs. {formattedDepositNumber}/-</span> (Refundable subject to terms)
                      </td>
                    </tr>

                    {/* Row 9 */}
                    <tr className="border-b border-slate-900">
                      <td className="p-3.5 sm:p-4 font-black text-slate-950 align-top border-r-2 border-slate-900 bg-slate-100/90">
                        9. {isPG ? 'Agreement Start Date:' : 'Agreement Tenancy Period:'}
                      </td>
                      <td className="p-3.5 sm:p-4 text-slate-950">
                        {isPG ? (
                          <span className="font-bold">{formattedStartDate}</span>
                        ) : (
                          <span>
                            {tenancyPeriodLabel} (Commencing: <strong className="font-black">{formattedStartDate}</strong> to{' '}
                            <strong className="font-black">{formattedEndDate}</strong>)
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Row 10 */}
                    <tr className="border-b border-slate-900">
                      <td className="p-3.5 sm:p-4 font-black text-slate-950 align-top border-r-2 border-slate-900 bg-slate-100/90">
                        10. Notice Period Required:
                      </td>
                      <td className="p-3.5 sm:p-4 text-slate-950">
                        <span className="font-black">{noticeDays}</span>{' '}
                        {isPG
                          ? 'Days minimum written/verbal notice before vacating'
                          : 'Days standard written/verbal notice from either side.'}
                      </td>
                    </tr>

                    {/* Row 11 */}
                    <tr>
                      <td className="p-3.5 sm:p-4 font-black text-slate-950 align-top border-r-2 border-slate-900 bg-slate-100/90">
                        11. Stay / Lock-In Bracket:
                      </td>
                      <td className="p-3.5 sm:p-4 text-slate-950">
                        <span className="font-black">{lockInValue}</span> {lockInUnitDisplay} fixed duration
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* =================================================================== */}
            {/* TERMS AND CONDITIONS (EXACT 10 CLAUSES) */}
            {/* =================================================================== */}
            <div className="space-y-3 pt-2">
              <h2 className="text-base sm:text-lg font-black text-slate-950 uppercase tracking-wide">
                TERMS AND CONDITIONS
              </h2>

              {isPG ? (
                <div className="space-y-3.5 text-base sm:text-[15px] text-slate-950 font-medium text-justify leading-relaxed">
                  <p>
                    <strong className="font-black text-black">1. Rent and Payment:</strong> The Resident agrees to pay the stipulated Monthly PG Rent on or before the due date mentioned in the schedule above. Late payments may attract a fixed daily penalty fee as determined by the Owner.
                  </p>
                  <p>
                    <strong className="font-black text-black">2. Inclusions & Facilities:</strong> The monthly rent covers utility features explicitly agreed upon, such as standard electricity allocation, water supply, Wi-Fi connectivity, housekeeping services, and routine meals (if specified under house rules).
                  </p>
                  <p>
                    <strong className="font-black text-black">3. Security Deposit Protection:</strong> The Security Deposit paid by the Resident is interest-free and refundable strictly at the time of final checkout, subject to full clearance of all outstanding dues, fulfillment of the required notice period, and complete verification against property damage.
                  </p>
                  <p>
                    <strong className="font-black text-black">4. Notice Period & Lock-in:</strong> The Resident must serve the minimum required notice period before vacating the premises. Failure to do so will result in the immediate forfeiture of the security deposit. If a lock-in period applies, vacating early will cause automated deposit forfeiture.
                  </p>
                  <p>
                    <strong className="font-black text-black">5. Verification Documents:</strong> The Resident must provide valid copies of a Government-issued Photo ID (Aadhaar, Passport, Voter ID) and verification from their employer or educational institution before moving in. These records shall be used for law enforcement and local police verification tracking compliance.
                  </p>
                  <p>
                    <strong className="font-black text-black">6. Rules and Curfew Timings:</strong> The Resident must strictly adhere to the house rules, including curfew timings (if applicable). No outside guests or visitors of the opposite sex are allowed inside the private rooms without prior explicit authorization from the Management.
                  </p>
                  <p>
                    <strong className="font-black text-black">7. Cleanliness and Maintenance:</strong> Residents are responsible for keeping their allocated rooms, beds, and shared common areas tidy. Any physical damage caused to the building, furniture, fixtures, or electronic appliances by the Resident will be charged directly to them or deducted from the deposit.
                  </p>
                  <p>
                    <strong className="font-black text-black">8. Prohibited Activities:</strong> Consumption of alcohol, smoking, illegal substances/drugs, gambling, or playing loud music causing disturbance to other residents is strictly prohibited inside the PG premises. Violation will lead to immediate summary eviction without refund.
                  </p>
                  <p>
                    <strong className="font-black text-black">9. Landlord Right of Inspection:</strong> The Owner/Manager reserves the right to enter and inspect the allocated rooms for structural health, safety, maintenance tracking, or cleanliness inspections after providing a reasonable advance notification to the Resident.
                  </p>
                  <p>
                    <strong className="font-black text-black">10. Termination & Summary Eviction:</strong> The Owner reserves the absolute right to terminate this accommodation agreement and evict the Resident with a short 24 hours' notice in the event of gross misconduct, non-payment of rent, or breach of any terms listed in this legal framework.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5 text-base sm:text-[15px] text-slate-950 font-medium text-justify leading-relaxed">
                  <p>
                    <strong className="font-black text-black">1. Rent and Payment Outlay:</strong> The Tenant agrees to pay the stipulated Monthly Rent to the Landlord on or before the due date mentioned in the schedule. Any delay beyond the due date may attract a late payment penalty charge as mutually settled or specified by the Landlord.
                  </p>
                  <p>
                    <strong className="font-black text-black">2. Security Deposit Protection:</strong> The interest-free Security Deposit shall be maintained by the Landlord and refunded strictly at the time of physical handover of the premises, subject to the complete clearance of outstanding electricity, water, utility bills, and verification against physical property damage.
                  </p>
                  <p>
                    <strong className="font-black text-black">3. 11-Month Term & Renewal:</strong> This lease is valid for 11 months, renewable upon mutual consent with standard 5% to 8% rent revision.
                  </p>
                  <p>
                    <strong className="font-black text-black">4. Utility Bills & Maintenance:</strong> Tenant shall pay electricity, water, and local society maintenance charges directly as per meter readings.
                  </p>
                  <p>
                    <strong className="font-black text-black">5. Statutory Verification:</strong> Tenant agrees to submit identity proofs and cooperate with statutory tenant police verification.
                  </p>
                  <p>
                    <strong className="font-black text-black">6. Cleanliness, Internal Maintenance & Structural Safety:</strong> The Tenant shall maintain the rented flat/house in a clean, hygienic, and tenantable condition. The Tenant shall not make structural alterations, pierce walls excessively, or remodel layout schemes without written administrative consent from the Landlord. Any deliberate or negligent asset damage will be deducted from the security deposit.
                  </p>
                  <p>
                    <strong className="font-black text-black">7. Lawful Usage & Structural Boundaries:</strong> The premises shall be strictly utilized for quiet residential deployment only. The Tenant shall not sublet, assign, or share the premises with secondary parties. Prohibited or illegal acts, heavy commercial trade routing, or storage of hazardous flammable material is completely barred.
                  </p>
                  <p>
                    <strong className="font-black text-black">8. Peaceful Enjoyment & Nuisance Controls:</strong> The Tenant shall respect local housing community guidelines, avoiding loud noise, public disturbance, or disruptive behavior that alters the peaceful enjoyment of surrounding neighbors.
                  </p>
                  <p>
                    <strong className="font-black text-black">9. Landlord Right of Entry & Formal Inspection:</strong> In accordance with standard model tenancy frameworks, the Landlord reserves the right to enter and inspect the structural health of the premises after extending a mandatory 24-hour advance warning notification notice to the Tenant.
                  </p>
                  <p>
                    <strong className="font-black text-black">10. Default, Termination and Summary Eviction:</strong> If the Tenant defaults on rent payments for two consecutive months, or breaches any essential clause of this legal framework, the Landlord retains an absolute right to terminate this lease contract and issue a summary 24-hour eviction instruction.
                  </p>
                </div>
              )}
            </div>

            {/* =================================================================== */}
            {/* 4x1 FULL-WIDTH STACKED SIGNATURES & WITNESSES (EVERYTHING BIGGER) */}
            {/* =================================================================== */}
            <div className="space-y-6 pt-6 border-t-2 border-slate-900">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-950 uppercase tracking-wide">
                  DECLARATION & DIGITAL SIGNATURES
                </h2>
                <p className="text-base sm:text-[15px] text-slate-950 font-medium mt-1.5 leading-relaxed">
                  {isPG
                    ? 'IN WITNESS WHEREOF, the parties have electronically signed this agreement to express mutual consent. I have read, understood, and agreed to abide by the above-mentioned terms, conditions, and house rules of the PG accommodation.'
                    : 'IN WITNESS WHEREOF, the Landlord and Tenant have executed this Residential Rent Agreement with verified legal digital signatures directly below, in full presence of the undersigned independent witnesses.'}
                </p>
              </div>

              {/* 4x1 Stacked Cards: Owner Signature -> Tenant Signature -> Witness 1 -> Witness 2 */}
              <div className="space-y-6 pt-2">
                
                {/* ================================================================= */}
                {/* 1. OWNER / LANDLORD SIGNATURE BLOCK (FULL WIDTH - BIGGER) */}
                {/* ================================================================= */}
                <div className="p-6 rounded-2xl border-2 border-slate-300 bg-slate-50/90 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <Building className="w-4 h-4 text-slate-700" />
                      {isPG ? 'Signature of the Owner / Manager' : 'Signature of the Landlord / Lessor'}
                    </span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
                      <ShieldCheck className="w-4 h-4" />
                      Verified Landlord Stamp
                    </span>
                  </div>

                  <div className="h-32 sm:h-40 rounded-xl bg-white border-2 border-slate-300 p-4 flex items-center justify-center shadow-inner">
                    {agreementData.ownerSignature && agreementData.ownerSignature.startsWith('data:image') ? (
                      <img
                        src={agreementData.ownerSignature}
                        alt="Owner Signature"
                        className="max-h-32 max-w-full object-contain"
                      />
                    ) : (
                      <div className="text-center">
                        <div className="font-serif italic text-2xl sm:text-3xl text-blue-900 font-bold tracking-wide">
                          {ownerDisplayName}
                        </div>
                        <div className="text-xs font-mono text-slate-500 mt-1.5">
                          Digitally Verified & Stamped on {executedDateFormatted} • Section 65B Indian Evidence Act
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-xs sm:text-sm text-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-slate-200/80 pt-3">
                    <div><strong>Legal Name:</strong> {ownerDisplayName}</div>
                    <div><strong>Execution Date:</strong> {executedDateFormatted}</div>
                  </div>
                </div>

                {/* ================================================================= */}
                {/* 2. RESIDENT / TENANT SIGNATURE BLOCK (FULL WIDTH - BIGGER) */}
                {/* ================================================================= */}
                <div className={`p-6 rounded-2xl border-2 ${theme.cardBorder} ${theme.primaryLightBg} space-y-4 shadow-sm`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <PenTool className={`w-4 h-4 ${theme.primaryText}`} />
                      {isPG ? 'Signature of the Resident' : 'Signature of the Tenant / Lessee'}
                      <span className="text-rose-500 font-bold">*</span>
                    </span>

                    {/* Big Mode Toggle */}
                    <div className="flex items-center bg-white rounded-xl border border-slate-300 p-1 text-xs font-bold shadow-2xs self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setSignMode('draw')}
                        className={`px-4 py-1.5 rounded-lg transition inline-flex items-center gap-1.5 ${
                          signMode === 'draw' ? `${theme.primaryBg} text-white shadow-2xs` : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <PenTool className="w-3.5 h-3.5" />
                        <span>Draw Pad</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSignMode('type')}
                        className={`px-4 py-1.5 rounded-lg transition inline-flex items-center gap-1.5 ${
                          signMode === 'type' ? `${theme.primaryBg} text-white shadow-2xs` : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Keyboard className="w-3.5 h-3.5" />
                        <span>Type Name</span>
                      </button>
                    </div>
                  </div>

                  {/* Big Draw Canvas or Type Input */}
                  {signMode === 'draw' ? (
                    <div className="space-y-2">
                      <div className="relative rounded-2xl bg-white border-2 border-slate-300 overflow-hidden shadow-inner">
                        <canvas
                          ref={canvasRef}
                          width={800}
                          height={160}
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                          className="w-full h-44 sm:h-52 touch-none bg-white block"
                          style={{
                            cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='%230f172a' stroke='%23ffffff' stroke-width='1.5'%3E%3Cpath d='M17.8 2.2a2.5 2.5 0 0 1 3.5 3.5L8.5 18.5 2 22l3.5-6.5L17.8 2.2z'/%3E%3Cpath d='m15 5 4 4' stroke='%23ffffff' fill='none'/%3E%3Ccircle cx='2.5' cy='21.5' r='1.5' fill='%232563eb'/%3E%3C/svg%3E") 2 22, crosshair`,
                          }}
                        />
                        {!hasDrawn && !currentSignatureImage && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs sm:text-sm italic">
                            Draw your signature here with mouse or finger (Large Full-Width Pad)
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={clearCanvas}
                          className="absolute top-2.5 right-2.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 border border-slate-300 shadow-2xs cursor-pointer transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Clear & Redraw
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={typedName}
                        onChange={(e) => {
                          setTypedName(e.target.value);
                          setHasDrawn(e.target.value.trim().length > 0);
                        }}
                        placeholder="Type full legal name as signature"
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-2xs"
                      />
                      <div className="h-28 sm:h-36 rounded-2xl bg-white border-2 border-slate-300 flex items-center justify-center font-serif italic text-3xl sm:text-4xl text-blue-900 font-bold px-4 truncate shadow-inner">
                        {typedName.trim() || agreementData.tenantName}
                      </div>
                    </div>
                  )}

                  <div className="text-xs sm:text-sm text-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-slate-200/80 pt-3">
                    <div><strong>Signer Name:</strong> {agreementData.tenantName}</div>
                    <div><strong>Execution Date:</strong> {executedDateFormatted}</div>
                  </div>
                </div>

                {/* ================================================================= */}
                {/* 3. WITNESS 1 BLOCK (FULL WIDTH - BIGGER & CLEAN RESTRUCTURED) */}
                {/* ================================================================= */}
                <div className="p-6 rounded-2xl border-2 border-slate-200 bg-slate-50/80 space-y-4 shadow-sm hover:border-slate-300 transition">
                  <div className="flex items-center justify-between font-extrabold text-slate-900 text-sm sm:text-base pb-2 border-b border-slate-200">
                    <span className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-600" />
                      WITNESS 1
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Top Row: Full Name + Date */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={w1Name}
                          onChange={(e) => setW1Name(e.target.value)}
                          placeholder="e.g. Ramesh Kumar"
                          className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 font-medium shadow-2xs"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Date of Witnessing
                        </label>
                        <input
                          type="date"
                          value={w1Date}
                          onChange={(e) => setW1Date(e.target.value)}
                          className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 font-medium shadow-2xs"
                        />
                      </div>
                    </div>

                    {/* Bottom Row: Full Width Long Address Field */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Permanent / Work Address
                      </label>
                      <input
                        type="text"
                        value={w1Address}
                        onChange={(e) => setW1Address(e.target.value)}
                        placeholder="e.g. #12, 14th Main Road, Sector 4, Coimbatore, Tamil Nadu"
                        className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 font-medium shadow-2xs"
                      />
                    </div>

                    {/* Witness 1 Signature Pad (Full Width & Larger) */}
                    <div className="pt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <PenTool className="w-3.5 h-3.5 text-slate-500" />
                          Witness 1 Signature Pad
                        </label>
                        <div className="flex items-center bg-white rounded-lg border border-slate-300 p-0.5 text-xs font-semibold shadow-2xs">
                          <button
                            type="button"
                            onClick={() => setW1SignMode('draw')}
                            className={`px-3.5 py-1 rounded-md transition inline-flex items-center gap-1.5 ${
                              w1SignMode === 'draw' ? `${theme.primaryBg} text-white shadow-2xs` : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <PenTool className="w-3 h-3" />
                            <span>Draw Pad</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setW1SignMode('type')}
                            className={`px-3.5 py-1 rounded-md transition inline-flex items-center gap-1.5 ${
                              w1SignMode === 'type' ? `${theme.primaryBg} text-white shadow-2xs` : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <Keyboard className="w-3 h-3" />
                            <span>Type Name</span>
                          </button>
                        </div>
                      </div>

                      {w1SignMode === 'draw' ? (
                        <div className="relative rounded-xl bg-white border-2 border-slate-300 overflow-hidden shadow-inner">
                          <canvas
                            ref={w1CanvasRef}
                            width={800}
                            height={130}
                            onMouseDown={startW1Drawing}
                            onMouseMove={drawW1}
                            onMouseUp={stopW1Drawing}
                            onMouseLeave={stopW1Drawing}
                            onTouchStart={startW1Drawing}
                            onTouchMove={drawW1}
                            onTouchEnd={stopW1Drawing}
                            className="w-full h-36 sm:h-44 touch-none bg-white block"
                            style={{
                              cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='%230f172a' stroke='%23ffffff' stroke-width='1.5'%3E%3Cpath d='M17.8 2.2a2.5 2.5 0 0 1 3.5 3.5L8.5 18.5 2 22l3.5-6.5L17.8 2.2z'/%3E%3Cpath d='m15 5 4 4' stroke='%23ffffff' fill='none'/%3E%3Ccircle cx='2.5' cy='21.5' r='1.5' fill='%232563eb'/%3E%3C/svg%3E") 2 22, crosshair`,
                            }}
                          />
                          {!hasW1Drawn && !w1DrawnSignature && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs sm:text-sm italic">
                              Draw Witness 1 signature here with mouse or finger
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={clearW1Canvas}
                            className="absolute top-2.5 right-2.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 border border-slate-300 shadow-2xs cursor-pointer transition"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Clear & Redraw
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={w1TypedSignature}
                            onChange={(e) => setW1TypedSignature(e.target.value)}
                            placeholder={w1Name.trim() ? `Type signature name (e.g. ${w1Name})` : "Type witness signature name"}
                            className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-slate-400 shadow-2xs"
                          />
                          <div className="h-24 sm:h-28 rounded-xl bg-white border-2 border-slate-300 flex items-center justify-center font-serif italic text-2xl sm:text-3xl text-blue-900 font-bold px-4 truncate shadow-inner">
                            {w1TypedSignature.trim() || w1Name.trim() || 'Type signature name above'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ================================================================= */}
                {/* 4. WITNESS 2 BLOCK (FULL WIDTH - BIGGER & CLEAN RESTRUCTURED) */}
                {/* ================================================================= */}
                <div className="p-6 rounded-2xl border-2 border-slate-200 bg-slate-50/80 space-y-4 shadow-sm hover:border-slate-300 transition">
                  <div className="flex items-center justify-between font-extrabold text-slate-900 text-sm sm:text-base pb-2 border-b border-slate-200">
                    <span className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-600" />
                      WITNESS 2
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Top Row: Full Name + Date */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={w2Name}
                          onChange={(e) => setW2Name(e.target.value)}
                          placeholder="e.g. Priya Sundaram"
                          className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 font-medium shadow-2xs"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Date of Witnessing
                        </label>
                        <input
                          type="date"
                          value={w2Date}
                          onChange={(e) => setW2Date(e.target.value)}
                          className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 font-medium shadow-2xs"
                        />
                      </div>
                    </div>

                    {/* Bottom Row: Full Width Long Address Field */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Permanent / Work Address
                      </label>
                      <input
                        type="text"
                        value={w2Address}
                        onChange={(e) => setW2Address(e.target.value)}
                        placeholder="e.g. #45, 5th Cross, Indiranagar, Bengaluru, Karnataka"
                        className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 font-medium shadow-2xs"
                      />
                    </div>

                    {/* Witness 2 Signature Pad (Full Width & Larger) */}
                    <div className="pt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <PenTool className="w-3.5 h-3.5 text-slate-500" />
                          Witness 2 Signature Pad
                        </label>
                        <div className="flex items-center bg-white rounded-lg border border-slate-300 p-0.5 text-xs font-semibold shadow-2xs">
                          <button
                            type="button"
                            onClick={() => setW2SignMode('draw')}
                            className={`px-3.5 py-1 rounded-md transition inline-flex items-center gap-1.5 ${
                              w2SignMode === 'draw' ? `${theme.primaryBg} text-white shadow-2xs` : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <PenTool className="w-3 h-3" />
                            <span>Draw Pad</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setW2SignMode('type')}
                            className={`px-3.5 py-1 rounded-md transition inline-flex items-center gap-1.5 ${
                              w2SignMode === 'type' ? `${theme.primaryBg} text-white shadow-2xs` : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <Keyboard className="w-3 h-3" />
                            <span>Type Name</span>
                          </button>
                        </div>
                      </div>

                      {w2SignMode === 'draw' ? (
                        <div className="relative rounded-xl bg-white border-2 border-slate-300 overflow-hidden shadow-inner">
                          <canvas
                            ref={w2CanvasRef}
                            width={800}
                            height={130}
                            onMouseDown={startW2Drawing}
                            onMouseMove={drawW2}
                            onMouseUp={stopW2Drawing}
                            onMouseLeave={stopW2Drawing}
                            onTouchStart={startW2Drawing}
                            onTouchMove={drawW2}
                            onTouchEnd={stopW2Drawing}
                            className="w-full h-36 sm:h-44 touch-none bg-white block"
                            style={{
                              cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='%230f172a' stroke='%23ffffff' stroke-width='1.5'%3E%3Cpath d='M17.8 2.2a2.5 2.5 0 0 1 3.5 3.5L8.5 18.5 2 22l3.5-6.5L17.8 2.2z'/%3E%3Cpath d='m15 5 4 4' stroke='%23ffffff' fill='none'/%3E%3Ccircle cx='2.5' cy='21.5' r='1.5' fill='%232563eb'/%3E%3C/svg%3E") 2 22, crosshair`,
                            }}
                          />
                          {!hasW2Drawn && !w2DrawnSignature && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs sm:text-sm italic">
                              Draw Witness 2 signature here with mouse or finger
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={clearW2Canvas}
                            className="absolute top-2.5 right-2.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 border border-slate-300 shadow-2xs transition cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Clear & Redraw
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={w2TypedSignature}
                            onChange={(e) => setW2TypedSignature(e.target.value)}
                            placeholder={w2Name.trim() ? `Type signature name (e.g. ${w2Name})` : "Type witness signature name"}
                            className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-slate-400 shadow-2xs"
                          />
                          <div className="h-24 sm:h-28 rounded-xl bg-white border-2 border-slate-300 flex items-center justify-center font-serif italic text-2xl sm:text-3xl text-blue-900 font-bold px-4 truncate shadow-inner">
                            {w2TypedSignature.trim() || w2Name.trim() || 'Type signature name above'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* Digital Evidence Certification Line */}
              <div className="pt-3 text-[11px] text-slate-400 font-mono flex items-center justify-between border-t border-slate-200">
                <span>Model Tenancy Act 2021 Formatted Document</span>
                <span>Section 65B Indian Evidence Act Compliant Electronic Record</span>
              </div>
            </div>

          </div>
        </div>

        {/* ========================================================================= */}
        {/* STICKY BOTTOM ACTION BAR */}
        {/* ========================================================================= */}
        <div className="p-4 sm:px-8 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 shadow-lg">
          <label className="flex items-center gap-3 cursor-pointer select-none text-base sm:text-[15px] font-semibold text-slate-950">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className={`w-5 h-5 rounded border-slate-300 ${theme.checkboxInput} cursor-pointer`}
            />
            <span>
              I, <strong className="text-black font-black">{agreementData.tenantName}</strong>, confirm that I have read, understood and agree to all 10 terms and schedule details of this agreement.
            </span>
          </label>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={!termsAccepted || !isSignatureProvided || isSubmitting}
              onClick={handleExecuteSignature}
              className={`px-7 py-3 rounded-xl text-sm font-bold text-white transition shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${theme.primaryBg}`}
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{isSubmitting ? 'Signing...' : 'Sign & Finalize Agreement'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
