'use client';

import React from 'react';
import type { SearchFilters } from '@/lib/search';

interface FilterChipsProps {
  filters: SearchFilters;
  onFilterChange: (filters: SearchFilters) => void;
}

export function FilterChips({ filters, onFilterChange }: FilterChipsProps) {
  const currentType = filters.type ?? 'all';
  const currentOwner = filters.owner ?? 'all';
  const hasActiveFilter = currentType !== 'all' || currentOwner !== 'all';

  const typeOptions: Array<{
    label: string;
    value: SearchFilters['type'];
    icon?: (props: { className?: string }) => React.ReactElement;
  }> = [
      { label: 'All Types', value: 'all' },
      {
        label: 'Folders',
        value: 'folder',
        icon: ({ className }) => (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        ),
      },
      {
        label: 'Images',
        value: 'image',
        icon: ({ className }) => (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      },
      {
        label: 'PDFs',
        value: 'pdf',
        icon: ({ className }) => (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        ),
      },
    ];

  const ownerOptions: Array<{
    label: string;
    value: SearchFilters['owner'];
    icon?: (props: { className?: string }) => React.ReactElement;
  }> = [
      { label: 'Anyone', value: 'all' },
      {
        label: 'Owned by me',
        value: 'me',
        icon: ({ className }) => (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ),
      },
      {
        label: 'Shared with me',
        value: 'shared',
        icon: ({ className }) => (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ),
      },
    ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* File Type Filter Group Container: bg-bg-surface rounded-lg border border-border-subtle p-1 flex items-center gap-1.5 */}
      <div className="flex items-center bg-bg-surface rounded-lg border border-border-subtle p-1 gap-1.5">
        {typeOptions.map(({ label, value, icon: IconComponent }) => {
          const isSelected = currentType === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onFilterChange({ ...filters, type: value })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${isSelected
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-transparent text-text-secondary border border-border-subtle hover:text-text-primary hover:bg-bg-surface-hover'
                }`}
            >
              {IconComponent && (
                <IconComponent className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-text-secondary'}`} />
              )}
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Owner Filter Group Container: bg-bg-surface rounded-lg border border-border-subtle p-1 flex items-center gap-1.5 */}
      <div className="flex items-center bg-bg-surface rounded-lg border border-border-subtle p-1 gap-1.5">
        {ownerOptions.map(({ label, value, icon: IconComponent }) => {
          const isSelected = currentOwner === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onFilterChange({ ...filters, owner: value })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${isSelected
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-transparent text-text-secondary border border-border-subtle hover:text-text-primary hover:bg-bg-surface-hover'
                }`}
            >
              {IconComponent && (
                <IconComponent className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-text-secondary'}`} />
              )}
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Reset Filters Button */}
      {hasActiveFilter && (
        <button
          type="button"
          onClick={() => onFilterChange({ ...filters, type: 'all', owner: 'all' })}
          className="text-xs text-text-secondary hover:text-danger px-2.5 py-1.5 border border-border-subtle rounded-md hover:bg-bg-surface-hover transition-colors flex items-center gap-1"
          title="Reset all filters"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span>Reset</span>
        </button>
      )}
    </div>
  );
}
