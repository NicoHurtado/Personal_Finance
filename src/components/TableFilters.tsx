"use client";

interface FilterOption {
  label: string;
  value: string;
}

interface TableFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  filterOptions?: FilterOption[];
  filterLabel?: string;
}

export default function TableFilters({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  filterValue,
  onFilterChange,
  filterOptions,
  filterLabel = "Filter",
}: TableFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
      <div className="relative flex-1 max-w-xs">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--c-text-3)] pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-9 pr-3 py-2 text-sm text-[var(--c-text)] bg-card border border-[var(--c-border)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--c-brand)] placeholder:text-[var(--c-text-3)]"
        />
      </div>
      {filterOptions && filterOptions.length > 0 && onFilterChange && (
        <select
          value={filterValue ?? ""}
          onChange={(e) => onFilterChange(e.target.value)}
          className="px-3 py-2 text-sm text-[var(--c-text)] bg-card border border-[var(--c-border)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--c-brand)]"
          aria-label={filterLabel}
        >
          <option value="">All {filterLabel}</option>
          {filterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
