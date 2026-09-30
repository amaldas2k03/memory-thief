import { useCallback, useEffect, useState } from 'react';

/**
 * localStorage-backed state.
 *
 * Every read and write is wrapped: Safari private mode, blocked third-party
 * storage and quota-exceeded all throw here, and none of them should break the
 * game — they just mean progress is not persisted this session.
 */
export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw) as T;
    // Merge onto the fallback so a stored object written by an older build
    // still gains any fields added since.
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      && fallback && typeof fallback === 'object' && !Array.isArray(fallback)) {
      return { ...(fallback as object), ...(parsed as object) } as T;
    }
    return parsed;
  } catch {
    return fallback;
  }
}

export function writeStored<T>(key: string, value: T): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStored(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* storage unavailable — nothing to clean up */
  }
}

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readStored(key, initial));

  useEffect(() => {
    writeStored(key, value);
  }, [key, value]);

  const update = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) => (typeof next === 'function' ? (next as (p: T) => T)(prev) : next));
  }, []);

  return [value, update] as const;
}
