import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type StatusVariant = 'active' | 'pending' | 'warning' | 'inactive' | 'info';

export interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant = 'active',
  className,
}) => {
  const variantStyles: Record<StatusVariant, string> = {
    active: 'bg-teal-50 text-brand-teal border-teal-200',
    pending: 'bg-slate-100 text-brand-navy border-slate-300',
    warning: 'bg-slate-50 text-slate-700 border-slate-300',
    inactive: 'bg-slate-100 text-surface-textSecondary border-surface-border',
    info: 'bg-slate-50 text-brand-navy border-surface-border',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
          variantStyles[variant],
          className
        )
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-80" />
      {status}
    </span>
  );
};
