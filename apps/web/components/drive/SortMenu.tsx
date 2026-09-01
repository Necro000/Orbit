'use client';

import React from 'react';

interface SortMenuProps {
  sortBy: 'name' | 'date' | 'size';
  sortDir: 'asc' | 'desc';
  onChange: (sortBy: 'name' | 'date' | 'size', sortDir: 'asc' | 'desc') => void;
}

export function SortMenu({ sortBy, sortDir, onChange }: SortMenuProps) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 border border-slate-700/80 rounded-lg px-2.5 py-1.5">
      <span className="text-slate-400">Sort by:</span>
      <select
        value={sortBy}
        onChange={(e) => onChange(e.target.value as 'name' | 'date' | 'size', sortDir)}
        className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
      >
        <option value="date" className="bg-slate-800">Date Modified</option>
        <option value="name" className="bg-slate-800">Name</option>
        <option value="size" className="bg-slate-800">Size</option>
      </select>
      <button
        type="button"
        onClick={() => onChange(sortBy, sortDir === 'asc' ? 'desc' : 'asc')}
        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition"
        title={`Sort ${sortDir === 'asc' ? 'Descending' : 'Ascending'}`}
      >
        {sortDir === 'asc' ? '↑' : '↓'}
      </button>
    </div>
  );
}
