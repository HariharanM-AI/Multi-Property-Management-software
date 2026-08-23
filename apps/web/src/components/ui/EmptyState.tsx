import React from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: IconOrElement,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  className,
}) => {
  return (
    <div
      className={twMerge(
        clsx(
          'bg-brand-white rounded-2xl border border-surface-border p-12 text-center space-y-4 shadow-xs',
          className
        )
      )}
    >
      {IconOrElement && (
        <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 text-brand-teal flex items-center justify-center mx-auto shrink-0">
          {React.isValidElement(IconOrElement) ? (
            IconOrElement
          ) : typeof IconOrElement === 'function' ? (
            <IconOrElement className="w-6 h-6" />
          ) : null}
        </div>
      )}

      <div className="space-y-1">
        <h3 className="text-base font-bold text-brand-navy tracking-tight">{title}</h3>
        {description && (
          <p className="text-xs text-surface-textSecondary max-w-md mx-auto leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actionLabel && (
        <div className="pt-2">
          {actionHref ? (
            <Link href={actionHref}>
              <Button variant="primary" size="sm" className="font-semibold shadow-sm">
                {actionLabel}
              </Button>
            </Link>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={onAction}
              className="font-semibold shadow-sm"
            >
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
