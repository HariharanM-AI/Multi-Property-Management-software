'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PropertyType } from '@propertyos/types';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '@/lib/auth-context';
import { ShieldAlert, LogIn, UserPlus, Lock, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface AppShellProps {
  children:
    | React.ReactNode
    | ((props: {
        propertyType: PropertyType;
        setPropertyType: (t: PropertyType) => void;
      }) => React.ReactNode);
  activePath?: string;
  propertyName?: string;
  propertyType?: PropertyType;
  requireAuth?: boolean;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  activePath,
  propertyName,
  propertyType: propPropertyType,
  requireAuth,
}) => {
  const pathname = usePathname() || activePath || '';
  const { isAuthenticated, isLoading } = useAuth();
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const [internalPropertyType, setInternalPropertyType] = useState<PropertyType>(
    propPropertyType || PropertyType.PG
  );

  React.useEffect(() => {
    if (propPropertyType) {
      setInternalPropertyType(propPropertyType);
    }
  }, [propPropertyType]);

  const propertyType = propPropertyType || internalPropertyType;
  const setPropertyType = setInternalPropertyType;

  // Public whitelist
  const isPublicRoute =
    pathname === '/discover' ||
    pathname.startsWith('/discover/') ||
    pathname === '/terms' ||
    pathname === '/privacy' ||
    pathname.startsWith('/privacy/');

  const shouldEnforceAuth = requireAuth !== undefined ? requireAuth : !isPublicRoute;

  return (
    <div className="flex h-screen bg-surface-subtle overflow-hidden">
      {/* Dynamic Sidebar */}
      <Sidebar currentPropertyType={propertyType} activePath={activePath || pathname} />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          currentPropertyType={propertyType}
          onPropertyTypeChange={setPropertyType}
          selectedPropertyName={
            propertyName ||
            (propertyType === PropertyType.PG
              ? 'GreenGlen PG Residency, HSR Layout'
              : 'Emerald Heights Apt #402, Indiranagar')
          }
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 w-full">
          {!mounted || isLoading ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-brand-teal" />
              <p className="text-sm font-medium">Verifying authorized session...</p>
            </div>
          ) : shouldEnforceAuth && !isAuthenticated ? (
            <div className="max-w-3xl mx-auto my-12 animate-fadeIn">
              <div className="bg-white border border-slate-200 shadow-xl rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden">
                {/* Background decorative accent */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-teal/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-brand-navy/5 rounded-full blur-3xl pointer-events-none" />

                <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-200/80 text-brand-teal flex items-center justify-center mx-auto mb-6 shadow-xs">
                  <Lock className="w-8 h-8" />
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold uppercase tracking-wider mb-4">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Authentication Required</span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-3">
                  Sign In Required for Property Operations
                </h2>

                <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto leading-relaxed mb-8">
                  PropertyOS strictly isolates tenant records, tenancy agreements, property creation, and financial suites. Please sign in to your owner account or register to perform any operations.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto mb-10">
                  <Link
                    href={`/login?returnUrl=${encodeURIComponent(pathname)}`}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-teal hover:bg-teal-700 text-white font-bold text-sm shadow-md shadow-teal-700/10 transition cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Sign In to Continue</span>
                    <ArrowRight className="w-4 h-4 ml-0.5" />
                  </Link>

                  <Link
                    href="/register"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm border border-slate-300 transition cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Register New Account</span>
                  </Link>
                </div>

                <div className="pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/50">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">DPDP Privacy</h4>
                      <p className="text-[11px] text-slate-500">Zero tenant or landlord PII exposed to guests.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/50">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Operation Guard</h4>
                      <p className="text-[11px] text-slate-500">Property creation and edits require verified auth.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/50">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Legal Stamping</h4>
                      <p className="text-[11px] text-slate-500">Authorized e-signatures for official tenancy agreements.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : typeof children === 'function' ? (
            children({ propertyType, setPropertyType })
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
};
