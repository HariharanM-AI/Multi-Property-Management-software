'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BackButtonProps {
  label?: string;
  fallbackHref?: string;
  className?: string;
  variant?: 'default' | 'subtle' | 'pill';
}

export const BackButton: React.FC<BackButtonProps> = ({
  label = 'Back',
  fallbackHref = '/properties',
  className,
  variant = 'default',
}) => {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else if (fallbackHref) {
      router.push(fallbackHref);
    }
  };

  const variantStyles = {
    default:
      'px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-semibold shadow-xs transition-colors',
    subtle:
      'px-2.5 py-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 text-xs font-medium transition-colors',
    pill:
      'px-3.5 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-semibold shadow-xs transition-colors',
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 active:scale-[0.98]',
          variantStyles[variant],
          className
        )
      )}
      aria-label={label}
    >
      <ArrowLeft className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-700 shrink-0" />
      <span>{label}</span>
    </button>
  );
};
