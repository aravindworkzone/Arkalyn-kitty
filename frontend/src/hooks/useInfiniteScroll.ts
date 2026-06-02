import { useEffect, useRef } from "react";

interface Options {
  /** Called when the sentinel scrolls into view. */
  onLoadMore: () => void;
  /** Only observe while there's more to load and nothing is in flight. */
  enabled: boolean;
  /** How early to trigger before the sentinel is fully visible. */
  rootMargin?: string;
}

/**
 * Returns a ref to attach to a sentinel element near the bottom of a list.
 * When the sentinel enters the viewport (within `rootMargin`), `onLoadMore`
 * fires. The observer is torn down while `enabled` is false — so passing
 * `hasNextPage && !isFetching` prevents duplicate fetches during a load.
 */
export function useInfiniteScroll<T extends HTMLElement = HTMLDivElement>({
  onLoadMore,
  enabled,
  rootMargin = "200px",
}: Options) {
  const sentinelRef = useRef<T | null>(null);

  // Keep the latest callback without re-creating the observer each render.
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !enabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMoreRef.current();
      },
      { rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, rootMargin]);

  return sentinelRef;
}
