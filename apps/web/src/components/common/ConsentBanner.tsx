'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shield, X, Check } from 'lucide-react';

export const ConsentBanner: React.FC = () => {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem('propertyos_privacy_consent');
      if (!consent) {
        setShowBanner(true);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem('propertyos_privacy_consent', JSON.stringify({
        acceptedAt: new Date().toISOString(),
        version: 'DPDP-2023-v1',
      }));
    } catch {
      // Ignore localStorage errors
    }
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 bg-brand-navy text-brand-white p-4 rounded-2xl border border-slate-700 shadow-2xl space-y-3">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-brand-teal/20 text-brand-teal rounded-xl shrink-0 mt-0.5">
          <Shield className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-brand-white">
            Data Privacy & DPDP Notice
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            PropertyOS processes personal operational data strictly for property management, tenant
            KYC, and invoicing under the <strong>DPDP Act 2023</strong>. We use only essential
            session tokens with zero third-party advertising trackers.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-xs">
        <Link
          href="/privacy"
          className="text-brand-teal hover:underline font-semibold"
        >
          View Privacy Notice
        </Link>
        <button
          onClick={handleAccept}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-teal text-white font-bold hover:bg-teal-600 transition"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Acknowledge</span>
        </button>
      </div>
    </div>
  );
};
