"use client";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-center gap-1 mt-5">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E6EAEB] text-[#4A5B60] disabled:opacity-30 hover:bg-[#F2F5F5] transition-colors"
      >
        Prev
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${
            p === currentPage
              ? "bg-[#025864] text-white"
              : "text-[#4A5B60] hover:bg-[#F2F5F5]"
          }`}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E6EAEB] text-[#4A5B60] disabled:opacity-30 hover:bg-[#F2F5F5] transition-colors"
      >
        Next
      </button>
    </div>
  );
}
