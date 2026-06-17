// Tiszta billentyű-osztályozó: KeyEvent → KeyAction.
// A fenntartott kombók (undo/redo) MEGELŐZIK a betű-/szám-kosár ágat.
// Lásd: docs/superpowers/specs/2026-06-17-keprendezo-design.md.

import type { KeyEvent, KeyAction } from './types'

export function classifyKey(e: KeyEvent): KeyAction {
  const mod = e.ctrlKey || e.metaKey
  const lower = e.key.toLowerCase()

  // 1–2. Fenntartott kombók (Ctrl/Cmd ekvivalens).
  if (mod) {
    if (lower === 'z') return e.shiftKey ? { type: 'redo' } : { type: 'undo' }
    if (lower === 'y') return { type: 'redo' }
    // Bármely más betű/szám modifierrel → nincs kosár.
    return { type: 'noop' }
  }

  // 3–4. Speciális kulcsok.
  if (e.key === ' ') return { type: 'space' }
  if (e.key === 'Escape') return { type: 'esc' }

  // 5. Nyilak.
  if (e.key === 'ArrowRight') return { type: 'keep' }
  if (e.key === 'ArrowLeft') return { type: 'delete' }
  if (e.key === 'ArrowDown') return { type: 'undo' }
  if (e.key === 'ArrowUp') return { type: 'redo' }

  // 6. Betű-/szám-kosár (case-insensitive, Shift megengedett; Alt NEM).
  if (lower.length === 1 && !e.altKey) {
    if (lower >= 'a' && lower <= 'z') return { type: 'bucket', bucketKey: lower }
    if (lower >= '0' && lower <= '9') return { type: 'bucket', bucketKey: lower }
  }

  // 7. Minden más.
  return { type: 'noop' }
}
