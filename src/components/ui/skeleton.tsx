export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-sunken ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-[1200px] grid-cols-[minmax(0,1fr)] gap-6 px-6 py-10 lg:px-8" role="status" aria-label="불러오는 중">
      <div className="grid min-w-0 gap-2">
        <Skeleton className="h-8 w-full max-w-64" />
        <Skeleton className="h-4 w-full max-w-96" />
      </div>
      <div className="grid min-w-0 gap-6 lg:grid-cols-12">
        <Skeleton className="h-72 lg:col-span-7" />
        <Skeleton className="h-72 lg:col-span-5" />
      </div>
    </div>
  );
}
