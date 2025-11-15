export async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const safeConcurrency = Math.max(1, concurrency);

  async function runWorker(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex;
      if (currentIndex >= items.length) {
        break;
      }
      nextIndex += 1;
      const item = items[currentIndex]!;
      results[currentIndex] = await worker(item, currentIndex);
    }
  }

  const runners = Array.from({ length: Math.min(safeConcurrency, items.length) }, runWorker);
  await Promise.all(runners);

  return results;
}
