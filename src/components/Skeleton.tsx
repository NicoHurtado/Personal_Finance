export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-[#EEF1F1] rounded-lg ${className}`} />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white border border-[#E6EAEB] rounded-xl p-6">
      <Skeleton className="h-3 w-20 mb-3 rounded" />
      <Skeleton className="h-7 w-28 rounded" />
      <Skeleton className="h-3 w-16 mt-2 rounded" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white border border-[#E6EAEB] rounded-xl p-6">
      <Skeleton className="h-5 w-36 mb-5 rounded" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="bg-white border border-[#E6EAEB] rounded-xl p-6">
      <Skeleton className="h-5 w-36 mb-5 rounded" />
      <Skeleton className="h-[240px] w-full rounded-lg" />
    </div>
  );
}
