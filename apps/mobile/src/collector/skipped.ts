import { useSyncExternalStore } from 'react';

/** Requests the collector skipped on C2 ("বাদ দিন"); hidden from C1 on this phone until the app restarts. */
const skipped = new Set<string>();
let version = 0;
const listeners = new Set<() => void>();

export function skipRequest(id: string) {
  skipped.add(id);
  version++;
  listeners.forEach((l) => l());
}

export function useSkipped(): ReadonlySet<string> {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
  );
  return skipped;
}
