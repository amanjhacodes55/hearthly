import { ListSkeleton, Skeleton } from "@/components/ui";

// Shown instantly on navigation (and prefetched by <Link>) while the next page renders on the server.
export default function Loading() {
  return (
    <div>
      <div className="border-b border-border px-5 py-4 md:px-8">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2 h-3 w-64" />
      </div>
      <ListSkeleton rows={8} />
    </div>
  );
}
