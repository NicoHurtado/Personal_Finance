"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
  /** Renders beside the type filter on mobile (e.g. category select) */
  endAdornment?: ReactNode;
  className?: string;
}

export default function TableFilters({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  filterValue,
  onFilterChange,
  filterOptions,
  filterLabel = "Filter",
  endAdornment,
  className,
}: TableFiltersProps) {
  const hasTypeFilter = filterOptions && filterOptions.length > 0 && onFilterChange;

  const selectCls =
    "w-full min-w-0 px-3 py-2.5 sm:py-2 text-base sm:text-sm text-[var(--c-text)] bg-card border border-[var(--c-border)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--c-brand)] touch-manipulation";

  return (
    <div
      className={cn(
        "mb-4 flex max-lg:mb-3 flex-col gap-2 max-lg:gap-1.5",
        "md:flex-row md:flex-wrap md:items-stretch md:gap-3",
        className
      )}
    >
      <div className="relative min-w-0 w-full md:flex-1 md:min-w-[12rem] md:max-w-xl lg:max-w-2xl">
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
          type="search"
          enterKeyHint="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-9 pr-3 py-2.5 sm:py-2 text-base sm:text-sm text-[var(--c-text)] bg-card border border-[var(--c-border)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--c-brand)] placeholder:text-[var(--c-text-3)] touch-manipulation"
        />
      </div>
      {(hasTypeFilter || endAdornment) && (
        <div
          className={cn(
            "grid min-w-0 items-stretch gap-2 max-lg:gap-1.5",
            hasTypeFilter && endAdornment ? "grid-cols-2" : "grid-cols-1",
            "md:flex md:flex-none md:gap-3"
          )}
        >
          {hasTypeFilter && (
            <select
              value={filterValue ?? ""}
              onChange={(e) => onFilterChange(e.target.value)}
              className={cn(selectCls, "md:w-40 md:max-w-[11rem] md:flex-none lg:w-44")}
              aria-label={filterLabel}
            >
              <option value="">{filterLabel}</option>
              {filterOptions!.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
          {endAdornment && (
            <div
              className={cn(
                "min-w-0 w-full [&_select]:min-w-0 [&_select]:w-full",
                "md:min-w-[12rem] md:max-w-xs md:flex-1 lg:max-w-sm"
              )}
            >
              {endAdornment}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
