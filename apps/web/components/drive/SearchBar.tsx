'use client';

import React, { useRef, useEffect } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = 'Search in Orbit...',
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus search bar on Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="relative flex-1 max-w-md group">
      {/* Search Icon */}
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondary group-focus-within:text-accent transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Search Input: bg-bg-surface border border-border-subtle rounded-lg focus:ring-2 focus:ring-accent-subtle-bg */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ paddingLeft: '36px', paddingRight: '44px' }}
        className="w-full h-9 bg-bg-surface border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all"
      />

      {/* Right-aligned Clear Button or Shortcut Hint */}
      <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center">
        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange('');
              onClear?.();
              inputRef.current?.focus();
            }}
            className="p-1 text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover rounded-md transition-colors text-xs"
            title="Clear search"
            aria-label="Clear search"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-text-secondary bg-bg-surface-hover border border-border-subtle rounded font-mono select-none pointer-events-none">
            ⌘K
          </kbd>
        )}
      </div>
    </div>
  );
}
