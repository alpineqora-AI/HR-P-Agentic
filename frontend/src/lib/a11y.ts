import type { KeyboardEvent } from 'react'

/**
 * Props for a clickable table row so it's also keyboard-reachable:
 * focusable, announced as a button, Enter/Space activate.
 */
export function rowAction<T extends HTMLElement>(onActivate: () => void) {
  return {
    onClick: onActivate,
    tabIndex: 0,
    role: 'button' as const,
    onKeyDown: (e: KeyboardEvent<T>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onActivate()
      }
    },
    style: { cursor: 'pointer' as const },
  }
}
