// Folder-scoped localStorage persistence + reconcile.
// The handle/objectURL/buckets are NEVER persisted (see PersistedSessionV1).
// See: docs/superpowers/specs/2026-06-17-swipick-design.md.

import type {
  SortState,
  PersistedSessionV1,
  MediaItem,
  Decision,
  HistoryEntry,
} from '../domain/types'

export function storageKey(folderName: string): string {
  return `swipick:v1:session:${folderName}`
}

export function toPersisted(
  state: SortState,
  savedAt = 0,
): PersistedSessionV1 {
  return {
    schemaVersion: 1,
    folderName: state.folderName,
    savedAt,
    decisions: Object.values(state.decisions),
    history: state.history,
    historyCursor: state.historyCursor,
    position: state.position,
  }
}

export function saveSession(state: SortState, savedAt = 0): void {
  try {
    localStorage.setItem(
      storageKey(state.folderName),
      JSON.stringify(toPersisted(state, savedAt)),
    )
  } catch (e) {
    console.warn('swipick: saveSession failed', e)
  }
}

export function loadSession(folderName: string): PersistedSessionV1 | null {
  try {
    const raw = localStorage.getItem(storageKey(folderName))
    if (raw == null) return null
    const parsed = JSON.parse(raw) as PersistedSessionV1
    if (parsed?.schemaVersion !== 1) return null
    return parsed
  } catch {
    return null
  }
}

export function hasSession(folderName: string): boolean {
  return loadSession(folderName) !== null
}

export function clearSession(folderName: string): void {
  localStorage.removeItem(storageKey(folderName))
}

export interface ReconcileResult {
  decisions: Record<string, Decision>
  history: HistoryEntry[]
  historyCursor: number
  position: number
  droppedFiles: string[]
  newFiles: string[]
}

export function reconcile(
  persisted: PersistedSessionV1,
  items: MediaItem[],
): ReconcileResult {
  // 1.
  const currentSet = new Set(items.map((i) => i.fileName))
  const nameToIndex = new Map<string, number>()
  items.forEach((i, idx) => nameToIndex.set(i.fileName, idx))

  // 2.
  const keptDecisions = persisted.decisions.filter((d) =>
    currentSet.has(d.fileName),
  )
  const droppedFiles = persisted.decisions
    .filter((d) => !currentSet.has(d.fileName))
    .map((d) => d.fileName)

  // 3.
  const droppedSet = new Set(droppedFiles)
  const purgedHistory = persisted.history.filter(
    (h) => !droppedSet.has(h.fileName),
  )

  // 4.
  let purgedBeforeCursor = 0
  persisted.history.forEach((h, idx) => {
    if (idx < persisted.historyCursor && droppedSet.has(h.fileName)) {
      purgedBeforeCursor++
    }
  })
  let historyCursor = persisted.historyCursor - purgedBeforeCursor
  historyCursor = Math.max(0, Math.min(historyCursor, purgedHistory.length))

  // 5. purgedHistory is already filtered to currentSet, so the fileName is always found;
  // the `?? items.length` is a defensive fallback for a possible invariant violation
  // (instead of a silent bad jump, it moves to the end of the queue).
  const history: HistoryEntry[] = purgedHistory.map((h) => ({
    ...h,
    position: nameToIndex.get(h.fileName) ?? items.length,
  }))

  // 6.
  const decisions: Record<string, Decision> = {}
  for (const d of keptDecisions) decisions[d.fileName] = d

  // 7.
  const knownNames = new Set<string>([
    ...persisted.decisions.map((d) => d.fileName),
    ...persisted.history.map((h) => h.fileName),
  ])
  const newFiles = items
    .map((i) => i.fileName)
    .filter((n) => !knownNames.has(n))

  // 8.
  const position = Math.min(persisted.position, items.length)

  return { decisions, history, historyCursor, position, droppedFiles, newFiles }
}
