/** Polls `fn` every `intervalMs`, skipping ticks while a previous call is still in flight. Returns a stop function. */
export function createRunPoller(fn: () => Promise<void>, intervalMs: number): () => void {
  let busy = false;
  let stopped = false;
  const tick = async () => {
    if (busy || stopped) return;
    busy = true;
    try {
      await fn();
    } finally {
      busy = false;
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), intervalMs);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
