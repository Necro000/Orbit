import React, { useState } from 'react';

export interface BreadcrumbSegment {
  id: string;
  name: string;
}

export interface BreadcrumbProps {
  path?: BreadcrumbSegment[];
  onNavigate?: (folderId: string) => void;
  onDropTarget?: (targetFolderId: string, e: React.DragEvent) => void;
}

const MAX_VISIBLE = 3; // collapse middle segments if path exceeds this

export function Breadcrumb({ path = [], onNavigate, onDropTarget }: BreadcrumbProps) {
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Truncate deep paths: show first + last (MAX_VISIBLE - 1) segments with "…" in between
  const shouldTruncate = path.length > MAX_VISIBLE;
  const visibleSegments = shouldTruncate
    ? [path[0]!, { id: '…', name: '…' }, ...path.slice(-(MAX_VISIBLE - 1))]
    : path;

  if (path.length === 0) {
    return (
      <nav aria-label="Breadcrumb" className="py-3">
        <h1 className="text-[22px] font-semibold text-text-primary">
          My Drive
        </h1>
      </nav>
    );
  }

  return (
    <nav aria-label="Breadcrumb" className="py-3">
      <ol className="flex items-center flex-wrap gap-1.5 list-none">
        <li className="flex items-center gap-1.5">
          <button
            type="button"
            className={`text-[22px] font-semibold transition-all px-1.5 py-0.5 rounded-lg ${
              dragOverId === 'root'
                ? 'text-amber-300 bg-amber-400/20 ring-2 ring-amber-400 scale-105'
                : 'text-accent hover:underline'
            }`}
            onClick={() => onNavigate?.('root')}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOverId('root');
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (dragOverId === 'root') setDragOverId(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOverId(null);
              onDropTarget?.('root', e);
            }}
          >
            My Drive
          </button>
          <span className="text-text-secondary text-[20px]" aria-hidden="true">/</span>
        </li>

        {visibleSegments.map((seg, i) => {
          const isLast = i === visibleSegments.length - 1;
          const isEllipsis = seg.id === '…';

          return (
            <li key={seg.id} className="flex items-center gap-1.5">
              {isEllipsis ? (
                <span className="text-text-secondary px-1 text-base">…</span>
              ) : isLast ? (
                <h1 className="text-[22px] font-semibold text-text-primary" aria-current="page">
                  {seg.name}
                </h1>
              ) : (
                <>
                  <button
                    type="button"
                    className={`text-[22px] font-semibold transition-all px-1.5 py-0.5 rounded-lg ${
                      dragOverId === seg.id
                        ? 'text-amber-300 bg-amber-400/20 ring-2 ring-amber-400 scale-105'
                        : 'text-accent hover:underline'
                    }`}
                    onClick={() => onNavigate?.(seg.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverId(seg.id);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (dragOverId === seg.id) setDragOverId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverId(null);
                      onDropTarget?.(seg.id, e);
                    }}
                  >
                    {seg.name}
                  </button>
                  <span className="text-text-secondary text-[20px]" aria-hidden="true">/</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
