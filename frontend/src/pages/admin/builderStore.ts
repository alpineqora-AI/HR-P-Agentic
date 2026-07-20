// Tiny localStorage-backed store for the Admin builders (survey + email).
// POC persistence — no backend. Each builder owns a top-level key.

import { useCallback, useEffect, useState } from 'react'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

// A useState that mirrors itself into localStorage on every change.
export function usePersistentState<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => read(key, initial))
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* quota / private mode — ignore for POC */
    }
  }, [key, value])
  return [value, setValue]
}

export function uid(): string {
  // No Date.now()/Math.random() restriction here (runs in the browser, not the workflow VM).
  return Math.random().toString(36).slice(2, 10)
}

export function useNow() {
  // Stable-ish "now" for updatedAt labels; recomputed when caller asks.
  return useCallback(() => new Date().toISOString(), [])
}
