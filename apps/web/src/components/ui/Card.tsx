import React, { HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Card: React.FC<HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={twMerge(
        clsx(
          'bg-brand-white border border-surface-border rounded-xl p-5 shadow-sm',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div className={twMerge(clsx('flex items-center justify-between pb-3 border-b border-surface-border mb-4', className))} {...props}>
      {children}
    </div>
  );
};

export const CardTitle: React.FC<HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className,
  ...props
}) => {
  return (
    <h3 className={twMerge(clsx('text-base font-semibold text-brand-navy', className))} {...props}>
      {children}
    </h3>
  );
};
