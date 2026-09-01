import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BackButton } from './BackButton';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  showBack?: boolean;
  backHref?: string;
  backLabel?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon: IconOrElement,
  badge,
  actions,
  className,
  showBack,
  backHref,
  backLabel,
}) => {
  return (
    <div
      className={twMerge(
        clsx(
          'flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1',
          className
        )
      )}
    >
      <div className="space-y-1">
        {showBack && (
          <div className="mb-2">
            <BackButton fallbackHref={backHref} label={backLabel} />
          </div>
        )}
        <div className="flex items-center gap-2.5 flex-wrap">
          {IconOrElement && (
            <div className="p-2 rounded-xl bg-teal-50 border border-teal-200 text-brand-teal shrink-0">
              {React.isValidElement(IconOrElement) ? (
                IconOrElement
              ) : typeof IconOrElement === 'function' ? (
                <IconOrElement className="w-6 h-6" />
              ) : null}
            </div>
          )}
          <h1 className="text-2xl font-bold text-brand-navy tracking-tight">{title}</h1>
          {badge && <div className="inline-flex items-center">{badge}</div>}
        </div>
        {subtitle && (
          <p className="text-sm text-surface-textSecondary max-w-3xl">{subtitle}</p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">{actions}</div>
      )}
    </div>
  );
};
