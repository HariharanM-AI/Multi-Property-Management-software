import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string | React.ReactNode;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  variant?: 'default' | 'teal' | 'amber' | 'emerald' | 'rose' | 'blue';
  className?: string;
}

const valueColorStyles: Record<string, string> = {
  default: 'text-brand-navy',
  teal: 'text-brand-teal',
  amber: 'text-amber-600',
  emerald: 'text-emerald-600',
  rose: 'text-rose-600',
  blue: 'text-blue-600',
};

const iconColorStyles: Record<string, string> = {
  default: 'text-surface-textSecondary',
  teal: 'text-brand-teal',
  amber: 'text-amber-500',
  emerald: 'text-emerald-500',
  rose: 'text-rose-500',
  blue: 'text-blue-500',
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  icon: IconOrElement,
  variant = 'default',
  className,
}) => {
  return (
    <div
      className={twMerge(
        clsx(
          'bg-brand-white p-5 rounded-xl border border-surface-border shadow-sm flex flex-col justify-between',
          className
        )
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-surface-textSecondary uppercase tracking-wider truncate">
            {label}
          </span>
          {IconOrElement && (
            <div className={clsx('shrink-0', iconColorStyles[variant])}>
              {React.isValidElement(IconOrElement) ? (
                IconOrElement
              ) : typeof IconOrElement === 'function' ? (
                <IconOrElement className="w-4 h-4" />
              ) : null}
            </div>
          )}
        </div>
        <p className={clsx('text-2xl font-bold mt-2 tracking-tight', valueColorStyles[variant])}>
          {value}
        </p>
      </div>

      {subtext && (
        <div className="text-xs text-surface-textSecondary mt-1.5 truncate">
          {subtext}
        </div>
      )}
    </div>
  );
};
