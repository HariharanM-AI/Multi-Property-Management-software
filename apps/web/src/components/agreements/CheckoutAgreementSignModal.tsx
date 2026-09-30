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
  Lock,
  PenTool,
  Users,
  KeyRound,
  Receipt,
  Keyboard,
} from 'lucide-react';
import { CheckoutAgreementData } from '../../lib/agreementStorage';

export interface CheckoutAgreementSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignComplete: (signatureData: {
    signerName: string;
    signerEmail?: string;
    signatureImage?: string;
    signedAt: string;
    initialDeposit: number;
    deductions: number;
    deductionReason?: string;
    netRefund: number;
    transactionRef: string;
    paymentMode: string;
    keyHandoverConfirmed: boolean;
    witnesses?: Array<{
      name?: string;
      date?: string;
      address?: string;
      signature?: string;
    }>;
  }) => void;
  settlementData: {
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
    unitOrBedName: string;
    sharingType?: string;
    propertyType: 'PG' | 'RENTAL_HOUSE';
    originalStartDate?: string;
    checkOutDate?: string;
    initialDeposit: number;
    deductions: number;
    deductionReason?: string;
    netRefund?: number;
    transactionRef?: string;
    paymentMode?: string;
    keyHandoverConfirmed?: boolean;
    witnesses?: Array<{
      name?: string;
      date?: string;
      address?: string;
      signature?: string;
    }>;
  };
}

export function CheckoutAgreementSignModal({
  isOpen,
  onClose,
  onSignComplete,
  settlementData,
}: CheckoutAgreementSignModalProps) {
  const isPG = settlementData.propertyType === 'PG';

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
    canvasBorder: isPG ? 'border-teal-400/80' : 'border-blue-400/80',
    checkboxBg: isPG ? 'bg-teal-50/80 border-teal-200/90' : 'bg-blue-50/80 border-blue-200/90',
    checkboxInput: isPG ? 'text-brand-teal focus:ring-brand-teal' : 'text-blue-600 focus:ring-blue-500',
    accentText: isPG ? 'text-teal-900' : 'text-blue-900',
  };

  // Primary Tenant Signature state
  const [signMode, setSignMode] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState(settlementData.tenantName || '');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Settlement Fields (Editable/Confirmable in modal - NO fake dummy defaults)
  const [deductions, setDeductions] = useState<number>(settlementData.deductions || 0);
  const [deductionReason, setDeductionReason] = useState<string>(settlementData.deductionReason || '');
  const initialDep = settlementData.initialDeposit || (isPG ? 17000 : 50000);
  const calculatedNetRefund = Math.max(0, initialDep - deductions);

  const [transactionRef, setTransactionRef] = useState<string>(settlementData.transactionRef || '');
  const [paymentMode, setPaymentMode] = useState<string>(settlementData.paymentMode || 'BANK_TRANSFER');
  const [keyHandoverConfirmed, setKeyHandoverConfirmed] = useState<boolean>(
    settlementData.keyHandoverConfirmed ?? true
  );

  // Canvas ref & drawing states for Tenant
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [currentSignatureImage, setCurrentSignatureImage] = useState<string | undefined>('');

  // Witness 1 State (NO dummy defaults like 'Suresh Babu' or '#45, MG Road')
  const [w1SignMode, setW1SignMode] = useState<'draw' | 'type'>('draw');
  const [w1Name, setW1Name] = useState(settlementData.witnesses?.[0]?.name || '');
  const [w1Date, setW1Date] = useState(
    settlementData.witnesses?.[0]?.date
      ? getLocalDateString(settlementData.witnesses[0].date)
      : getLocalDateString()
  );
  const [w1Address, setW1Address] = useState(settlementData.witnesses?.[0]?.address || '');
  const [w1TypedSignature, setW1TypedSignature] = useState('');
  const [w1DrawnSignature, setW1DrawnSignature] = useState('');
  const w1CanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isW1Drawing, setIsW1Drawing] = useState(false);
  const [hasW1Drawn, setHasW1Drawn] = useState(false);

  // Witness 2 State (NO dummy defaults like 'Mithun Kumar' or '#12, Indiranagar')
  const [w2SignMode, setW2SignMode] = useState<'draw' | 'type'>('draw');
  const [w2Name, setW2Name] = useState(settlementData.witnesses?.[1]?.name || '');
  const [w2Date, setW2Date] = useState(
    settlementData.witnesses?.[1]?.date
      ? getLocalDateString(settlementData.witnesses[1].date)
      : getLocalDateString()
  );
  const [w2Address, setW2Address] = useState(settlementData.witnesses?.[1]?.address || '');
  const [w2TypedSignature, setW2TypedSignature] = useState('');
  const [w2DrawnSignature, setW2DrawnSignature] = useState('');
  const w2CanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isW2Drawing, setIsW2Drawing] = useState(false);
  const [hasW2Drawn, setHasW2Drawn] = useState(false);

  // Modal lifecycle & state synchronization (Preserves filled values / re-signing)
  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
      setDeductions(settlementData.deductions || 0);
      setDeductionReason(settlementData.deductionReason || '');
      setTransactionRef(settlementData.transactionRef || '');
      setPaymentMode(settlementData.paymentMode || 'BANK_TRANSFER');
      setKeyHandoverConfirmed(settlementData.keyHandoverConfirmed ?? true);

      // User requested: "If i open this image page, i want to sign newly, it should not contain the signature which i have put in the previous check-out attempt."
      // Always start resident signature clean & fresh for a new signature
      setCurrentSignatureImage('');
      setTypedName('');
      setHasDrawn(false);
      setTermsAccepted(false);
      setSignMode('draw');

      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
      setTimeout(() => {
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
        }
      }, 50);

      // Initialize Witness 1
      if (settlementData.witnesses?.[0]) {
        const w1 = settlementData.witnesses[0];
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

      // Initialize Witness 2
      if (settlementData.witnesses?.[1]) {
        const w2 = settlementData.witnesses[1];
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
  }, [isOpen, settlementData]);


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

  // Primary Tenant Drawing Handlers
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
    ctx.lineWidth = 3;
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
        setW1DrawnSignature(canvas.toDataURL('image/png'));
        setHasW1Drawn(true);
      }
    }
  };

  const clearW1Canvas = () => {
    const canvas = w1CanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
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
    ctx.lineWidth = 3;
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
        setW2DrawnSignature(canvas.toDataURL('image/png'));
        setHasW2Drawn(true);
      }
    }
  };

  const clearW2Canvas = () => {
    const canvas = w2CanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
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
      signatureImage = `TYPE:${typedName.trim() || settlementData.tenantName}`;
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
        signerName: typedName.trim() || settlementData.tenantName,
        signerEmail: settlementData.tenantEmail,
        signatureImage: signatureImage || undefined,
        signedAt: new Date().toISOString(),
        initialDeposit: initialDep,
        deductions: deductions,
        deductionReason: deductionReason.trim() || undefined,
        netRefund: calculatedNetRefund,
        transactionRef: transactionRef.trim(),
        paymentMode: paymentMode,
        keyHandoverConfirmed: keyHandoverConfirmed,
        witnesses: witnessesPayload.length > 0 ? witnessesPayload : undefined,
      });
    } catch {
      // Handled upstream
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl max-h-[94vh] rounded-2xl shadow-2xl border border-slate-300 flex flex-col overflow-hidden text-slate-900">
        {/* ========================================================================= */}
        {/* MODAL HEADER */}
        {/* ========================================================================= */}
        <div className="px-7 py-5 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-xl ${
                isPG
                  ? 'bg-teal-500/20 border-teal-400/40 text-teal-300'
                  : 'bg-blue-500/20 border-blue-400/40 text-blue-300'
              } border flex items-center justify-center font-bold shadow-xs`}
            >
              <FileSignature className="w-5.5 h-5.5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base sm:text-lg font-extrabold text-white tracking-wide">
                  {isPG
                    ? 'PG Property Handover & Deposit Settlement Agreement'
                    : 'Residential Property Handover & Deposit Settlement Agreement'}
                </h3>
                <span className="px-2.5 py-0.5 rounded text-[11px] font-extrabold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  Check-Out Legal Execution
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Official Digital Agreement & Direct E-Signature for{' '}
                <strong className="text-slate-200">{settlementData.tenantName || 'Resident'}</strong> •{' '}
                {settlementData.unitOrBedName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* MODAL BODY (SCROLLABLE) */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-7 space-y-6">
          {/* Summary Schedule Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Occupant / Resident Box */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 text-xs shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Resident / Vacating Tenant
              </span>
              <p className="font-extrabold text-slate-900 text-base">{settlementData.tenantName}</p>
              <p className="text-slate-700 text-xs sm:text-sm flex items-center gap-1.5 font-medium">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {settlementData.tenantPhone || 'Phone on Record'}
              </p>
              <p className="text-slate-500 text-xs truncate">
                {settlementData.tenantAddress || 'Address on Record'}
              </p>
            </div>

            {/* Property & Unit Box */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 text-xs shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Property & Allocated Unit
              </span>
              <p className="font-extrabold text-slate-900 text-base">{settlementData.propertyName}</p>
              <p className="text-slate-800 font-bold text-xs sm:text-sm flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                {settlementData.unitOrBedName}
              </p>
              <p className="text-slate-500 text-xs truncate">
                {settlementData.propertyAddress || 'Address on record'}
              </p>
            </div>

            {/* Landlord / Owner Box */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 text-xs shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Owner / Landlord
              </span>
              <p className="font-extrabold text-slate-900 text-base">
                {settlementData.ownerName || 'Property Management'}
              </p>
              <p className="text-slate-700 text-xs sm:text-sm flex items-center gap-1.5 font-medium">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {settlementData.ownerPhone || 'Phone on record'}
              </p>
              <p className="text-emerald-700 font-semibold text-xs flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Authorized Signature Verified
              </p>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 1. DEPOSIT SETTLEMENT & FINANCIAL BREAKDOWN (CLAUSE 3) */}
          {/* ========================================================================= */}
          <div className="p-6 sm:p-7 rounded-2xl border-2 border-slate-200 bg-slate-50/80 space-y-5 shadow-xs hover:border-slate-300 transition">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <h4 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Receipt className={`w-4.5 h-4.5 ${theme.primaryText}`} />
                <span>Clause 3: Security Deposit Settlement & Refund Arithmetic</span>
              </h4>
              <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-lg shadow-2xs">
                Move-In: {formatAgreementDate(settlementData.originalStartDate || '2026-08-01')} → Check-Out:{' '}
                {formatAgreementDate(settlementData.checkOutDate || getLocalDateString())}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  1. Initial Deposit Held
                </span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
                  ₹{initialDep.toLocaleString('en-IN')}
                </span>
                <p className="text-xs text-slate-500 mt-1">As per original check-in schedule</p>
              </div>

              <div className="bg-white p-4.5 rounded-2xl border border-rose-200 shadow-2xs">
                <span className="text-xs font-bold text-rose-600 uppercase tracking-wider block mb-1.5">
                  2. Authorized Deductions (₹)
                </span>
                <input
                  type="number"
                  readOnly
                  tabIndex={-1}
                  value={deductions}
                  placeholder="0"
                  className="w-full text-xl sm:text-2xl font-black text-rose-700 font-mono bg-rose-50/50 border border-rose-300 rounded-xl px-3 py-1.5 select-none focus:outline-none cursor-default"
                />
                <p className="text-xs text-rose-500 mt-1">Paint, repair, utility settlement</p>
              </div>

              <div className="bg-emerald-50 p-4.5 rounded-2xl border border-emerald-300 shadow-2xs">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block mb-1.5">
                  3. Net Refund Payable (₹)
                </span>
                <span className="text-xl sm:text-2xl font-black text-emerald-900 font-mono tracking-tight">
                  ₹{calculatedNetRefund.toLocaleString('en-IN')}
                </span>
                <p className="text-xs text-emerald-700 mt-1">Full clearance / zero balance</p>
              </div>
            </div>

            {/* Deduction Reason & Transaction Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4.5 text-xs pt-1">
              <div>
                <label className="text-xs sm:text-sm font-bold text-slate-800 block mb-1.5">
                  Deduction Justification / Inspection Notes
                </label>
                <input
                  type="text"
                  value={deductionReason}
                  onChange={(e) => setDeductionReason(e.target.value)}
                  placeholder="e.g. Painting touch-up / utility bill clearance or zero dues"
                  className="w-full px-4 py-3 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-slate-400 shadow-2xs"
                />
              </div>

              <div>
                <label className="text-xs sm:text-sm font-bold text-slate-800 block mb-1.5">
                  Bank Transfer / Cheque Transaction Reference
                </label>
                <div className="flex items-center gap-2.5">
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="px-3.5 py-3 bg-white border border-slate-300 rounded-xl text-slate-800 font-bold text-xs sm:text-sm shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <option value="BANK_TRANSFER">NEFT / IMPS</option>
                    <option value="UPI">UPI</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CASH">Cash</option>
                  </select>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="e.g. UTR / IMPS / Cheque reference number"
                    className="flex-1 px-4 py-3 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 font-mono font-medium shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Key Handover Checkbox */}
            <div className="p-4 sm:p-4.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <label className="flex items-center gap-3 cursor-pointer font-bold text-slate-800 text-xs sm:text-sm">
                <input
                  type="checkbox"
                  checked={keyHandoverConfirmed}
                  onChange={(e) => setKeyHandoverConfirmed(e.target.checked)}
                  className={`w-4.5 h-4.5 rounded ${theme.checkboxInput}`}
                />
                <span className="flex items-center gap-2">
                  <KeyRound className="w-4.5 h-4.5 text-amber-600" />
                  <span>
                    Clause 1 Compliance: Physical Key Handover & Clean Vacant Possession Confirmed
                  </span>
                </span>
              </label>
              <p className="text-xs text-slate-500 pl-7.5 mt-1">
                All physical keys, access cards, and remotes have been delivered back to the Landlord/Manager.
              </p>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 2. SIGNATURE OF THE RESIDENT (MATCHES IMAGE 2 & 3 DESIGN) */}
          {/* ========================================================================= */}
          <div className="p-6 sm:p-7 rounded-2xl border-2 border-slate-200 bg-slate-50/80 space-y-5 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between font-black text-slate-900 text-base sm:text-lg pb-3 border-b border-slate-200">
              <span className="flex items-center gap-2.5">
                <PenTool className="w-5 h-5 text-slate-600" />
                <span>Signature of the Resident</span>
                <span className="text-rose-500 font-bold">*</span>
              </span>

              {/* Mode Switcher Buttons */}
              <div className="flex items-center bg-white rounded-xl border border-slate-300 p-1 text-xs sm:text-sm font-bold shadow-2xs">
                <button
                  type="button"
                  onClick={() => setSignMode('draw')}
                  className={`px-4 py-1.5 rounded-lg transition inline-flex items-center gap-1.5 ${
                    signMode === 'draw'
                      ? `${theme.primaryBg} text-white shadow-2xs`
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>Draw Pad</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSignMode('type')}
                  className={`px-4 py-1.5 rounded-lg transition inline-flex items-center gap-1.5 ${
                    signMode === 'type'
                      ? `${theme.primaryBg} text-white shadow-2xs`
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Keyboard className="w-3.5 h-3.5" />
                  <span>Type Name</span>
                </button>
              </div>
            </div>

            {signMode === 'draw' ? (
              <div className="space-y-2">
                <div className="relative rounded-2xl bg-white border-2 border-slate-300 overflow-hidden shadow-inner">
                  <canvas
                    ref={canvasRef}
                    width={900}
                    height={200}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-52 sm:h-60 touch-none bg-white block"
                    style={{
                      cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='%230f172a' stroke='%23ffffff' stroke-width='1.5'%3E%3Cpath d='M17.8 2.2a2.5 2.5 0 0 1 3.5 3.5L8.5 18.5 2 22l3.5-6.5L17.8 2.2z'/%3E%3Cpath d='m15 5 4 4' stroke='%23ffffff' fill='none'/%3E%3Ccircle cx='2.5' cy='21.5' r='1.5' fill='%232563eb'/%3E%3C/svg%3E") 2 22, crosshair`,
                    }}
                  />
                  {!hasDrawn && !currentSignatureImage && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs sm:text-sm font-medium italic">
                      Draw your signature here with mouse or finger (Large Full-Width Pad)
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="absolute top-3 right-3 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold flex items-center gap-2 border border-slate-300 shadow-2xs cursor-pointer transition"
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
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white shadow-2xs"
                />
                <div className={`h-32 sm:h-40 rounded-2xl bg-white border-2 border-slate-300 flex items-center justify-center font-serif italic text-3xl sm:text-4xl ${theme.accentText} font-bold px-4 truncate shadow-inner`}>
                  {typedName.trim() || settlementData.tenantName}
                </div>
              </div>
            )}

            <div className="text-xs sm:text-sm text-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-slate-200/80 pt-3.5">
              <div>
                <strong>Signer Name:</strong> {settlementData.tenantName}
              </div>
              <div>
                <strong>Execution Date:</strong> {formatAgreementDate(settlementData.checkOutDate || new Date())}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 3. WITNESS 1 BLOCK (FULL WIDTH - MATCHES IMAGE 2 DESIGN) */}
          {/* ========================================================================= */}
          <div className="p-6 sm:p-7 rounded-2xl border-2 border-slate-200 bg-slate-50/80 space-y-5 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between font-black text-slate-900 text-base sm:text-lg pb-3 border-b border-slate-200">
              <span className="flex items-center gap-2.5">
                <User className="w-4.5 h-4.5 text-slate-600" />
                WITNESS 1
              </span>
            </div>

            <div className="space-y-4.5">
              {/* Top Row: Full Name + Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4.5">
                <div>
                  <label className="text-xs sm:text-sm font-bold text-slate-700 block mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={w1Name}
                    onChange={(e) => setW1Name(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-4 py-3 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 font-medium shadow-2xs"
                  />
                </div>

                <div>
                  <label className="text-xs sm:text-sm font-bold text-slate-700 block mb-1.5">
                    Date of Witnessing
                  </label>
                  <input
                    type="date"
                    value={w1Date}
                    onChange={(e) => setW1Date(e.target.value)}
                    className="w-full px-4 py-3 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 font-medium shadow-2xs"
                  />
                </div>
              </div>

              {/* Bottom Row: Full Width Long Address Field */}
              <div>
                <label className="text-xs sm:text-sm font-bold text-slate-700 block mb-1.5">
                  Permanent / Work Address
                </label>
                <input
                  type="text"
                  value={w1Address}
                  onChange={(e) => setW1Address(e.target.value)}
                  placeholder="e.g. #12, 14th Main Road, Sector 4, Coimbatore, Tamil Nadu"
                  className="w-full px-4 py-3 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 font-medium shadow-2xs"
                />
              </div>

              {/* Witness 1 Signature Pad */}
              <div className="pt-2 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-1.5">
                    <PenTool className="w-4 h-4 text-slate-500" />
                    <span>Witness 1 Signature Pad</span>
                  </label>

                  {/* Mode switcher for Witness 1 */}
                  <div className="flex items-center bg-white rounded-xl border border-slate-300 p-1 text-xs font-bold shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setW1SignMode('draw')}
                      className={`px-3 py-1 rounded-lg transition inline-flex items-center gap-1 ${
                        w1SignMode === 'draw'
                          ? `${theme.primaryBg} text-white shadow-2xs`
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <PenTool className="w-3 h-3" />
                      <span>Draw</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setW1SignMode('type')}
                      className={`px-3 py-1 rounded-lg transition inline-flex items-center gap-1 ${
                        w1SignMode === 'type'
                          ? `${theme.primaryBg} text-white shadow-2xs`
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Keyboard className="w-3 h-3" />
                      <span>Type</span>
                    </button>
                  </div>
                </div>

                {w1SignMode === 'draw' ? (
                  <div className="relative rounded-2xl bg-white border-2 border-slate-300 overflow-hidden shadow-inner">
                    <canvas
                      ref={w1CanvasRef}
                      width={900}
                      height={160}
                      onMouseDown={startW1Drawing}
                      onMouseMove={drawW1}
                      onMouseUp={stopW1Drawing}
                      onMouseLeave={stopW1Drawing}
                      onTouchStart={startW1Drawing}
                      onTouchMove={drawW1}
                      onTouchEnd={stopW1Drawing}
                      className="w-full h-44 sm:h-52 touch-none bg-white block"
                      style={{
                        cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='%230f172a' stroke='%23ffffff' stroke-width='1.5'%3E%3Cpath d='M17.8 2.2a2.5 2.5 0 0 1 3.5 3.5L8.5 18.5 2 22l3.5-6.5L17.8 2.2z'/%3E%3Cpath d='m15 5 4 4' stroke='%23ffffff' fill='none'/%3E%3Ccircle cx='2.5' cy='21.5' r='1.5' fill='%232563eb'/%3E%3C/svg%3E") 2 22, crosshair`,
                      }}
                    />
                    {!hasW1Drawn && !w1DrawnSignature && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs sm:text-sm font-medium italic">
                        Draw Witness 1 signature here with mouse or finger
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={clearW1Canvas}
                      className="absolute top-3 right-3 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold flex items-center gap-1.5 border border-slate-300 shadow-2xs cursor-pointer transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Clear & Redraw
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <input
                      type="text"
                      value={w1TypedSignature}
                      onChange={(e) => setW1TypedSignature(e.target.value)}
                      placeholder={w1Name.trim() ? `Type signature name (e.g. ${w1Name})` : 'Type witness signature name'}
                      className="w-full px-4 py-3 text-sm rounded-xl border border-slate-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-slate-400 shadow-2xs"
                    />
                    <div className={`h-28 sm:h-32 rounded-xl bg-white border-2 border-slate-300 flex items-center justify-center font-serif italic text-2xl sm:text-3xl ${theme.accentText} font-bold px-4 truncate shadow-inner`}>
                      {w1TypedSignature.trim() || w1Name.trim() || 'Type signature name above'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 4. WITNESS 2 BLOCK (FULL WIDTH - MATCHES IMAGE 3 DESIGN) */}
          {/* ========================================================================= */}
          <div className="p-6 sm:p-7 rounded-2xl border-2 border-slate-200 bg-slate-50/80 space-y-5 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between font-black text-slate-900 text-base sm:text-lg pb-3 border-b border-slate-200">
              <span className="flex items-center gap-2.5">
                <User className="w-4.5 h-4.5 text-slate-600" />
                WITNESS 2
              </span>
            </div>

            <div className="space-y-4.5">
              {/* Top Row: Full Name + Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4.5">
                <div>
                  <label className="text-xs sm:text-sm font-bold text-slate-700 block mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={w2Name}
                    onChange={(e) => setW2Name(e.target.value)}
                    placeholder="e.g. Priya Sundaram"
                    className="w-full px-4 py-3 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 font-medium shadow-2xs"
                  />
                </div>

                <div>
                  <label className="text-xs sm:text-sm font-bold text-slate-700 block mb-1.5">
                    Date of Witnessing
                  </label>
                  <input
                    type="date"
                    value={w2Date}
                    onChange={(e) => setW2Date(e.target.value)}
                    className="w-full px-4 py-3 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 font-medium shadow-2xs"
                  />
                </div>
              </div>

              {/* Bottom Row: Full Width Long Address Field */}
              <div>
                <label className="text-xs sm:text-sm font-bold text-slate-700 block mb-1.5">
                  Permanent / Work Address
                </label>
                <input
                  type="text"
                  value={w2Address}
                  onChange={(e) => setW2Address(e.target.value)}
                  placeholder="e.g. #45, 5th Cross, Indiranagar, Bengaluru, Karnataka"
                  className="w-full px-4 py-3 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 font-medium shadow-2xs"
                />
              </div>

              {/* Witness 2 Signature Pad */}
              <div className="pt-2 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-1.5">
                    <PenTool className="w-4 h-4 text-slate-500" />
                    <span>Witness 2 Signature Pad</span>
                  </label>
                  <div className="flex items-center bg-white rounded-xl border border-slate-300 p-1 text-xs font-bold shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setW2SignMode('draw')}
                      className={`px-3.5 py-1 rounded-lg transition inline-flex items-center gap-1 ${
                        w2SignMode === 'draw'
                          ? `${theme.primaryBg} text-white shadow-2xs`
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <PenTool className="w-3 h-3" />
                      <span>Draw Pad</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setW2SignMode('type')}
                      className={`px-3.5 py-1 rounded-lg transition inline-flex items-center gap-1 ${
                        w2SignMode === 'type'
                          ? `${theme.primaryBg} text-white shadow-2xs`
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Keyboard className="w-3 h-3" />
                      <span>Type Name</span>
                    </button>
                  </div>
                </div>

                {w2SignMode === 'draw' ? (
                  <div className="relative rounded-2xl bg-white border-2 border-slate-300 overflow-hidden shadow-inner">
                    <canvas
                      ref={w2CanvasRef}
                      width={900}
                      height={160}
                      onMouseDown={startW2Drawing}
                      onMouseMove={drawW2}
                      onMouseUp={stopW2Drawing}
                      onMouseLeave={stopW2Drawing}
                      onTouchStart={startW2Drawing}
                      onTouchMove={drawW2}
                      onTouchEnd={stopW2Drawing}
                      className="w-full h-44 sm:h-52 touch-none bg-white block"
                      style={{
                        cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='%230f172a' stroke='%23ffffff' stroke-width='1.5'%3E%3Cpath d='M17.8 2.2a2.5 2.5 0 0 1 3.5 3.5L8.5 18.5 2 22l3.5-6.5L17.8 2.2z'/%3E%3Cpath d='m15 5 4 4' stroke='%23ffffff' fill='none'/%3E%3Ccircle cx='2.5' cy='21.5' r='1.5' fill='%232563eb'/%3E%3C/svg%3E") 2 22, crosshair`,
                      }}
                    />
                    {!hasW2Drawn && !w2DrawnSignature && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs sm:text-sm font-medium italic">
                        Draw Witness 2 signature here with mouse or finger
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={clearW2Canvas}
                      className="absolute top-3 right-3 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold flex items-center gap-1.5 border border-slate-300 shadow-2xs cursor-pointer transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Clear & Redraw
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <input
                      type="text"
                      value={w2TypedSignature}
                      onChange={(e) => setW2TypedSignature(e.target.value)}
                      placeholder={w2Name.trim() ? `Type signature name (e.g. ${w2Name})` : 'Type witness signature name'}
                      className="w-full px-4 py-3 text-sm rounded-xl border border-slate-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-slate-400 shadow-2xs"
                    />
                    <div className={`h-28 sm:h-32 rounded-xl bg-white border-2 border-slate-300 flex items-center justify-center font-serif italic text-2xl sm:text-3xl ${theme.accentText} font-bold px-4 truncate shadow-inner`}>
                      {w2TypedSignature.trim() || w2Name.trim() || 'Type signature name above'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Legal Compliance Footnote (Matches Image 3) */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-2 pt-2 border-t border-slate-200">
            <span>Model Tenancy Act 2021 Formatted Document</span>
            <span>Section 65B Indian Evidence Act Compliant Electronic Record</span>
          </div>

          {/* ========================================================================= */}
          {/* STATUTORY DECLARATION & MUTUAL RELEASE CHECKBOX */}
          {/* ========================================================================= */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <label className="flex items-start gap-3.5 cursor-pointer text-xs sm:text-sm text-slate-800 font-semibold">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className={`mt-0.5 w-5 h-5 rounded ${theme.checkboxInput}`}
              />
              <span className="leading-relaxed">
                I, <strong className="text-slate-900">{settlementData.tenantName || 'Resident'}</strong>, confirm that I have read, understood and agree to all terms, handover checklist, deposit settlement calculation, and mutual release declaration of this check-out agreement.
                <span className="text-rose-500 ml-1 font-bold">*</span>
              </span>
            </label>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MODAL ACTIONS FOOTER */}
        {/* ========================================================================= */}
        <div className="px-7 py-4.5 border-t border-slate-200 bg-white flex items-center justify-between gap-4 shrink-0">
          <div className="text-xs sm:text-sm text-slate-500 hidden sm:flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-400" />
            <span>Cryptographically sealed & legally binding check-out settlement</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteSignature}
              disabled={
                !termsAccepted ||
                !keyHandoverConfirmed ||
                isSubmitting ||
                (signMode === 'draw' && !hasDrawn && !currentSignatureImage) ||
                (signMode === 'type' && !typedName.trim())
              }
              className={`px-7 py-3 text-xs sm:text-sm font-bold text-white rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${theme.primaryBg}`}
            >
              <CheckCircle2 className="w-4.5 h-4.5" />
              <span>{isSubmitting ? 'Executing Agreement...' : 'Sign & Finalize Agreement'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
