'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  FileText,
  Home,
  Printer,
  X,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Download,
  Loader2,
} from 'lucide-react';
import { CheckoutAgreementData } from '../../lib/agreementStorage';
import { CheckoutAgreementDocumentSheets } from './CheckoutAgreementDocumentSheets';
import { downloadCheckoutAgreementPdf } from './downloadCheckoutAgreementPdf';

interface CheckoutAgreementViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  agreementData: CheckoutAgreementData | null;
  hideDownloadButton?: boolean;
}

export function CheckoutAgreementViewerModal({
  isOpen,
  onClose,
  agreementData,
  hideDownloadButton = false,
}: CheckoutAgreementViewerModalProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevOpenRef = useRef(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
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
  const unitLabel = agreementData.unitOrBedName || (isPG ? 'Bed 101-C' : 'Flat 102');

  const handleDownload = async () => {
    try {
      setDownloading(true);
      await downloadCheckoutAgreementPdf(agreementData);
    } catch (err) {
      console.error('Failed to download checkout agreement PDF:', err);
      alert('Could not download PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
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
            <div
              className={`w-10 h-10 rounded-xl ${
                isPG
                  ? 'bg-teal-500/20 border-teal-400/40 text-teal-300'
                  : 'bg-blue-500/20 border-blue-400/40 text-blue-300'
              } border flex items-center justify-center font-bold shadow-xs`}
            >
              {isPG ? <FileText className="w-5 h-5" /> : <Home className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  {isPG
                    ? 'Paying Guest Handover & Deposit Settlement Agreement'
                    : 'Residential House Handover & Deposit Settlement Agreement'}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  Check-Out Settlement
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {agreementData.tenantName} • {unitLabel} • {agreementData.propertyName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!hideDownloadButton && (
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
                title="Download Official Check-Out Agreement PDF"
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>Download Check-Out PDF</span>
              </button>
            )}

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
        {/* OFFICIAL 2-PAGE A4 DOCUMENT VIEWER BODY */}
        {/* ========================================================================= */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200/90 scroll-smooth overscroll-contain print:bg-white print:p-0 print:overflow-visible"
        >
          <div className="print-document-container max-w-[920px] mx-auto">
            <CheckoutAgreementDocumentSheets agreementData={agreementData} />
          </div>
        </div>
      </div>
    </div>
  );
}
