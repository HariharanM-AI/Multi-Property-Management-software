'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Printer,
  X,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { formatIdProofDisplay } from './AgreementSignModal';
import { AgreementDocumentSheets } from './AgreementDocumentSheets';
import { downloadAgreementPdf } from './downloadAgreementPdf';

export interface AgreementDocumentData {
  id?: string;
  tenantName: string;
  tenantPhone: string;
  tenantEmail?: string;
  tenantAddress?: string;
  tenantAadhaar?: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerAddress?: string;
  ownerSignature?: string;
  residentSignature?: string;
  propertyName: string;
  propertyAddress?: string;
  unitOrBedName: string;
  sharingType?: string;
  propertyType: 'PG' | 'RENTAL_HOUSE';
  monthlyRent: number | string;
  securityDeposit?: number | string;
  lockInMonths?: number;
  lockInPeriodValue?: number;
  lockInPeriodUnit?: 'DAYS' | 'MONTHS' | 'YEARS' | string;
  noticePeriodDays?: number;
  startDate?: string;
  endDate?: string;
  signedAt?: string;
  status?: string;
  version?: number;
  witnesses?: Array<{
    name?: string;
    date?: string;
    address?: string;
    signature?: string;
  }>;
}

interface AgreementDocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  agreementData: AgreementDocumentData | null;
}

export function AgreementDocumentViewerModal({
  isOpen,
  onClose,
  agreementData,
}: AgreementDocumentViewerModalProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevOpenRef = useRef(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      // Only runs ONCE when modal opens: start cleanly at the top of Page 1
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      });
    }
    prevOpenRef.current = isOpen;
  }, [isOpen]);

  if (!isOpen || !agreementData) return null;

  const isPG = agreementData.propertyType === 'PG';
  const unitLabel = agreementData.unitOrBedName || 'Bed 102-A';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Dynamic Print Styles for Exact 2-Page A4 Output */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 10mm 12mm 10mm 12mm;
              }
              body {
                background: #ffffff !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .print\\:hidden,
              .no-print {
                display: none !important;
              }
              .print-document-container {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: transparent !important;
                box-shadow: none !important;
              }
              .print-page-sheet {
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                background: #ffffff !important;
                box-sizing: border-box !important;
              }
              .page-1-sheet {
                page-break-after: always !important;
                break-after: page !important;
                min-height: 270mm !important;
              }
              .page-2-sheet {
                page-break-before: always !important;
                break-before: page !important;
                page-break-after: avoid !important;
                break-after: avoid !important;
                min-height: 270mm !important;
              }
            }
          `,
        }}
      />

      <div className="bg-white w-full max-w-5xl max-h-[96vh] rounded-2xl shadow-2xl border border-slate-300 flex flex-col overflow-hidden text-slate-900">
        
        {/* ========================================================================= */}
        {/* MODAL CONTROL HEADER (NON-PRINTABLE) */}
        {/* ========================================================================= */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between gap-4 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${isPG ? 'bg-teal-500/20 border-teal-400/40 text-teal-300' : 'bg-blue-500/20 border-blue-400/40 text-blue-300'} border flex items-center justify-center font-bold shadow-xs`}>
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                {isPG ? 'Paying Guest Accommodation Agreement' : 'Residential Rent Agreement'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {agreementData.tenantName} • {unitLabel} • {agreementData.propertyName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Download PDF Button */}
            <button
              type="button"
              disabled={isDownloading}
              onClick={async () => {
                setIsDownloading(true);
                try {
                  await downloadAgreementPdf(agreementData);
                } catch (err) {
                  console.error(err);
                } finally {
                  setIsDownloading(false);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
              title="Download Agreement PDF file"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* OFFICIAL 2-PAGE A4 DOCUMENT VIEWER BODY (ENLARGED HIGH-VISIBILITY TYPOGRAPHY) */}
        {/* ========================================================================= */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200/90 scroll-smooth overscroll-contain print:bg-white print:p-0 print:overflow-visible"
        >
          <div className="print-document-container max-w-[920px] mx-auto">
            <AgreementDocumentSheets agreementData={agreementData} />
          </div>
        </div>

      </div>
    </div>
  );
}
