import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Search } from 'lucide-react';

export interface FilterTab {
  id: string;
  label: string;
  count?: number;
}

export interface FilterBarProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  tabs?: FilterTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  children?: React.ReactNode;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search...',
  tabs,
  activeTab,
  onTabChange,
  children,
  className,
}) => {
  return (
    <div
      className={twMerge(
        clsx(
          'bg-brand-white p-4 rounded-xl border border-surface-border shadow-sm flex flex-col md:flex-row gap-3.5 items-stretch md:items-center justify-between',
          className
        )
      )}
    >
      {/* Tabs */}
      {tabs && tabs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange?.(tab.id)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0',
                  isActive
                    ? 'bg-brand-teal text-brand-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span
                    className={clsx(
                      'ml-1.5 px-1.5 py-0.2 rounded-full text-[10px]',
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Search & Custom Controls */}
      <div className="flex flex-wrap items-center gap-2.5 ml-auto w-full md:w-auto">
        {typeof onSearchChange === 'function' && (
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-surface-textSecondary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-subtle border border-surface-border rounded-lg text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal"
            />
          </div>
        )}

        {children}
      </div>
    </div>
  );
};
