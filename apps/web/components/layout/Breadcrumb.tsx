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
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <ol className="breadcrumb-list">
          <li className="breadcrumb-item breadcrumb-item--current" aria-current="page">
            My Drive
          </li>
        </ol>
      </nav>
    );
  }

  return (
    <nav aria-label="Breadcrumb" className="breadcrumb">
      <ol className="breadcrumb-list">
        <li className="breadcrumb-item">
          <button
            type="button"
            className="breadcrumb-link"
            onClick={() => onNavigate?.('root')}
          >
            My Drive
          </button>
          <span className="breadcrumb-sep" aria-hidden="true">/</span>
        </li>

        {visibleSegments.map((seg, i) => {
          const isLast = i === visibleSegments.length - 1;
          const isEllipsis = seg.id === '…';

          return (
            <li key={seg.id} className="breadcrumb-item">
              {isEllipsis ? (
                <span className="breadcrumb-ellipsis">…</span>
              ) : isLast ? (
                <span className="breadcrumb-item--current" aria-current="page">
                  {seg.name}
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    className="breadcrumb-link"
                    onClick={() => onNavigate?.(seg.id)}
                  >
                    {seg.name}
                  </button>
                  <span className="breadcrumb-sep" aria-hidden="true">/</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
