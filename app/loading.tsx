import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <main
      id="main-content"
      className="yk-route-loading"
      aria-label="Loading page"
    >
      <Skeleton className="h-3 w-32" label="Loading page context" />
      <Skeleton className="mt-4 h-10 w-full max-w-md" label="Loading heading" />
      <Skeleton className="mt-8 h-12 w-full" label="Loading controls" />
      <div
        className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
        aria-hidden="true"
      >
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton
            key={index}
            className="aspect-[5/7] w-full"
            label="Loading content"
          />
        ))}
      </div>
    </main>
  );
}
