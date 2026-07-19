/**
 * Run an async mapper over items with bounded concurrency — our politeness
 * valve against the public Hiro/BNS API rate limits. The mapper must handle
 * its own errors; a rejection here would abort the whole batch.
 */
export async function mapLimit<T>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (next < items.length) {
        const index = next++;
        const item = items[index];
        if (item !== undefined) await fn(item);
      }
    },
  );
  await Promise.all(workers);
}

/** Sleep that resolves early when the given AbortSignal fires (for shutdown). */
export function interruptibleSleep(
  ms: number,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done(): void {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}
