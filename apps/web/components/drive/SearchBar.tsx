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
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8B8B96] group-focus-within:text-[#6366F1] transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Search Input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ paddingLeft: '40px', paddingRight: '48px' }}
        className="w-full h-9 bg-[#1A1A22] hover:bg-[#22222C]/70 focus:bg-[#1A1A22] border border-[#2A2A35] focus:border-[#6366F1] rounded-[8px] text-sm text-[#F5F5F7] placeholder-[#8B8B96] focus:outline-none focus:ring-2 focus:ring-[#6366F126] transition-all"
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
            className="p-1 text-[#8B8B96] hover:text-[#F5F5F7] hover:bg-[#22222C] rounded-md transition-colors text-xs"
            title="Clear search"
            aria-label="Clear search"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-[#8B8B96] bg-[#22222C] border border-[#2A2A35] rounded font-mono select-none pointer-events-none">
            ⌘K
          </kbd>
        )}
      </div>
    </div>
  );
}
