import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type StatusVariant =
  | 'active'
  | 'pending'
  | 'warning'
  | 'inactive'
  | 'info'
  | 'success'
  | 'danger'
  | 'neutral'
  | 'urgent';

export interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  className?: string;
  showDot?: boolean;
}

const variantStyles: Record<StatusVariant, string> = {
  active: 'bg-teal-50 text-brand-teal border-teal-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  urgent: 'bg-rose-50 text-rose-700 border-rose-200 font-semibold',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  inactive: 'bg-slate-100 text-surface-textSecondary border-surface-border',
};

// Automatic domain status to semantic variant resolution
function resolveVariant(status: string, explicitVariant?: StatusVariant): StatusVariant {
  if (explicitVariant) return explicitVariant;

  const s = status.toUpperCase().trim();

  // Success / Active states
  if (['ACTIVE', 'VERIFIED', 'PAID', 'FINALIZED', 'COMPLETED', 'SIGNED', 'FOUNDATION VERIFIED', 'CHECKED_IN', 'ENFORCED'].includes(s)) {
    return 'active';
  }

  // Pending / Progress / Warning states
  if (['PENDING', 'IN_PROGRESS', 'SETTLEMENT_PENDING', 'NOTICE', 'PARTIALLY_PAID', 'PARTIALLY_SIGNED', 'PENDING_SIGNATURE', 'READY', 'IN_NOTICE'].includes(s)) {
    return 'pending';
  }

  // High priority / Danger / Overdue states
  if (['REJECTED', 'OVERDUE', 'CANCELLED', 'ARCHIVED', 'VOID', 'URGENT', 'HIGH'].includes(s)) {
    return 'danger';
  }

  // Informational / Initiated states
  if (['OPEN', 'ASSIGNED', 'PROSPECT', 'INITIATED', 'GENERATED', 'ISSUED', 'MEDIUM'].includes(s)) {
    return 'info';
  }

  // Draft / Low / Neutral states
  if (['DRAFT', 'LOW', 'CHECKED_OUT', 'ALL'].includes(s)) {
    return 'neutral';
  }

  return 'neutral';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant,
  className,
  showDot = true,
}) => {
  const resolved = resolveVariant(status, variant);

  // Format display text (convert SNAKE_CASE to Title Case if not already formatted)
  const displayStatus = status.includes('_')
    ? status
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
    : status;

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border shrink-0',
          variantStyles[resolved],
          className
        )
      )}
    >
      {showDot && <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-80 shrink-0" />}
      <span>{displayStatus}</span>
    </span>
  );
};
