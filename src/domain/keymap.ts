// Pure key classifier: KeyEvent → KeyAction.
// The reserved combos (undo/redo) TAKE PRECEDENCE over the letter/number bucket branch.
// See: docs/superpowers/specs/2026-06-17-swipick-design.md.

import type { KeyEvent, KeyAction } from './types'

export function classifyKey(e: KeyEvent): KeyAction {
  const mod = e.ctrlKey || e.metaKey
  const lower = e.key.toLowerCase()

  // 1–2. Reserved combos (Ctrl/Cmd equivalent).
  if (mod) {
    if (lower === 'z') return e.shiftKey ? { type: 'redo' } : { type: 'undo' }
    if (lower === 'y') return { type: 'redo' }
    // Any other letter/number with a modifier → no bucket.
    return { type: 'noop' }
  }

  // 3–4. Special keys.
  if (e.key === ' ') return { type: 'space' }
  if (e.key === 'Escape') return { type: 'esc' }

  // 5. Arrows.
  if (e.key === 'ArrowRight') return { type: 'keep' }
  if (e.key === 'ArrowLeft') return { type: 'delete' }
  if (e.key === 'ArrowDown') return { type: 'undo' }
  if (e.key === 'ArrowUp') return { type: 'redo' }

  // 6. Letter/number bucket (case-insensitive, Shift allowed; Alt NOT).
  if (lower.length === 1 && !e.altKey) {
    if (lower >= 'a' && lower <= 'z') return { type: 'bucket', bucketKey: lower }
    if (lower >= '0' && lower <= '9') return { type: 'bucket', bucketKey: lower }
  }

  // 7. Everything else.
  return { type: 'noop' }
}
