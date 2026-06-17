// Tiszta, immutábilis SortState reducerek. A buckets DERIVÁLT (deriveBuckets),
// nem a state mezője. A keep IS history-bejegyzés (undo-zhatóság), de
// nextBucket=null → a kosár-réteg ignorálja.
// Lásd: docs/superpowers/specs/2026-06-17-keprendezo-design.md.

import { classifyKey } from './keymap'
import { DELETE_BUCKET } from './types'
import type {
  SortState,
  DecisionTarget,
  HistoryEntry,
  BucketKey,
  KeyEvent,
} from './types'

/** decisions másolat, ahol fileName a megadott bucketbe kerül, vagy törlődik (null). */
function withDecision(
  decisions: SortState['decisions'],
  fileName: string,
  bucket: BucketKey | null,
): SortState['decisions'] {
  if (bucket === null) {
    const { [fileName]: _omit, ...rest } = decisions
    return rest
  }
  return { ...decisions, [fileName]: { fileName, bucket } }
}

export function placeCurrent(state: SortState, target: DecisionTarget): SortState {
  if (state.position >= state.items.length) return state

  const current = state.items[state.position].fileName
  const prevBucket = state.decisions[current]?.bucket ?? null
  const nextBucket: BucketKey | null =
    target.type === 'keep'
      ? null
      : target.type === 'delete'
        ? DELETE_BUCKET
        : target.bucketKey

  const decisions = withDecision(state.decisions, current, nextBucket)

  const entry: HistoryEntry = {
    fileName: current,
    position: state.position,
    prevBucket,
    nextBucket,
  }
  const history = [...state.history.slice(0, state.historyCursor), entry]

  return {
    ...state,
    decisions,
    history,
    historyCursor: history.length,
    position: state.position + 1,
  }
}

export function undo(state: SortState): SortState {
  if (state.historyCursor === 0) return state

  const entry = state.history[state.historyCursor - 1]
  return {
    ...state,
    decisions: withDecision(state.decisions, entry.fileName, entry.prevBucket),
    position: entry.position,
    historyCursor: state.historyCursor - 1,
    // history tömb VÁLTOZATLAN — csak a kurzor mozog (redo-zhatóság).
  }
}

export function redo(state: SortState): SortState {
  if (state.historyCursor >= state.history.length) return state

  const entry = state.history[state.historyCursor]
  return {
    ...state,
    decisions: withDecision(state.decisions, entry.fileName, entry.nextBucket),
    position: entry.position + 1,
    historyCursor: state.historyCursor + 1,
  }
}

export function applyKey(state: SortState, e: KeyEvent): SortState {
  const action = classifyKey(e)
  switch (action.type) {
    case 'bucket':
      return placeCurrent(state, { type: 'bucket', bucketKey: action.bucketKey })
    case 'delete':
      return placeCurrent(state, { type: 'delete' })
    case 'keep':
      return placeCurrent(state, { type: 'keep' })
    case 'undo':
      return undo(state)
    case 'redo':
      return redo(state)
    case 'space':
    case 'esc':
    case 'noop':
      return state
  }
}
