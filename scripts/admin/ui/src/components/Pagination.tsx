interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  onPrev: () => void;
  onNext: () => void;
}

export function Pagination({
  page,
  totalPages,
  totalItems,
  onPrev,
  onNext,
}: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination">
      <button className="btn btn-sm" disabled={page <= 1} onClick={onPrev}>
        &larr; 上一页
      </button>
      <span className="page-info">
        {page} / {totalPages} ({totalItems} 条)
      </span>
      <button
        className="btn btn-sm"
        disabled={page >= totalPages}
        onClick={onNext}
      >
        下一页 &rarr;
      </button>
    </div>
  );
}
