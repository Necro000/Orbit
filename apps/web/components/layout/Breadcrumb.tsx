'use client';

export interface BreadcrumbSegment {
  id: string;
  name: string;
}

export interface BreadcrumbProps {
  path?: BreadcrumbSegment[];
  onNavigate?: (folderId: string) => void;
}

const MAX_VISIBLE = 3; // collapse middle segments if path exceeds this

export function Breadcrumb({ path = [], onNavigate }: BreadcrumbProps) {
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
            className="text-[22px] font-semibold text-accent hover:underline transition-colors"
            onClick={() => onNavigate?.('root')}
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
                    className="text-[22px] font-semibold text-accent hover:underline transition-colors"
                    onClick={() => onNavigate?.(seg.id)}
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
