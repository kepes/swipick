// Kanonikus adatmodell — a teljes app közös referenciája.
// Lásd: docs/superpowers/specs/2026-06-17-keprendezo-design.md (4. szakasz).
// Stabil kulcs mindenhol: fileName (folder-scoped fájlnév, nem path, nincs külön id).

/** Belső kosár-kulcs: 'a'..'z' | '0'..'9' | 'delete'. */
export type BucketKey = string

/** A „törlés" kosár belső azonosítója. */
export const DELETE_BUCKET: BucketKey = 'delete'
/** A „törlés" kosár UI-felirata. */
export const DELETE_DISPLAY = 'törlés'
/** A „törlés" kosárhoz lemezre írt mappanév (spec 4.3). */
export const TRASH_DIR = '_torolt'

export type MediaKind = 'image' | 'video'

export interface MediaItem {
  /** Teljes fájlnév kiterjesztéssel — STABIL KULCS. */
  fileName: string
  kind: MediaKind
  /** A File lazy (handle.getFile()); a handle kell a Rendezéshez. */
  handle: FileSystemFileHandle
  /** ms epoch — rendezési kulcs. */
  lastModified: number
  size: number
}

/** keep (jobbra nyíl) → NINCS Decision (besorolatlan == helyben marad). */
export interface Decision {
  fileName: string
  bucket: BucketKey
}

/** Derivált, nem perzisztált forrásként. */
export interface Bucket {
  key: BucketKey
  kind: 'normal' | 'delete'
  /** fileName-ek besorolási sorrendben. */
  members: string[]
  /** === members[0] (derivált). */
  thumbnail: string | null
}

/**
 * Egységes undo/redo bejegyzés. A keep IS bejegyzés (undo-zhatóság),
 * de nextBucket=null → a kosár-réteg ignorálja.
 */
export interface HistoryEntry {
  fileName: string
  /** A sorbeli pozíció, ahonnan a döntés történt. */
  position: number
  /** Korábbi döntés (keep/besorolatlan = null). */
  prevBucket: BucketKey | null
  /** Új döntés (keep = null). */
  nextBucket: BucketKey | null
}

/** A billentyű-redukció bemenete (a KeyboardEvent releváns mezői). */
export interface KeyEvent {
  key: string
  ctrlKey: boolean
  shiftKey: boolean
  metaKey: boolean
  altKey: boolean
}

/** A classifyKey kimenete — diszkriminált unió. */
export type KeyAction =
  | { type: 'bucket'; bucketKey: BucketKey }
  | { type: 'delete' }
  | { type: 'keep' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'space' }
  | { type: 'esc' }
  | { type: 'noop' }

/** A döntés célja (placeCurrent bemenete). */
export type DecisionTarget =
  | { type: 'bucket'; bucketKey: BucketKey }
  | { type: 'delete' }
  | { type: 'keep' }

/**
 * Runtime app-state (a Zustand store a tulajdonosa).
 * A buckets DERIVÁLT a decisions-ből (selectorral), nem itt tárolt forrás.
 */
export interface SortState {
  folderName: string
  /** lastModified ASC, tie-break fileName. */
  items: MediaItem[]
  /** === items.length → KÉSZ. */
  position: number
  decisions: Record<string, Decision>
  history: HistoryEntry[]
  /** redo lehetséges, ha historyCursor < history.length. */
  historyCursor: number
}

/** Perzisztált session (handle/objectURL/buckets SOHA). */
export interface PersistedSessionV1 {
  schemaVersion: 1
  folderName: string
  savedAt: number
  decisions: Decision[]
  history: HistoryEntry[]
  historyCursor: number
  position: number
}

// ── FS gateway (mockolható) ────────────────────────────────────────────────

export interface FileSystemGateway {
  isSupported(): boolean
  pickDirectory(): Promise<FileSystemDirectoryHandle>
  ensureWritePermission(dir: FileSystemDirectoryHandle): Promise<boolean>
}

export interface ReadFolderResult {
  folderName: string
  /** A kiválasztott mappa handle-je — a Rendezés (organize) ide ír. */
  dirHandle: FileSystemDirectoryHandle
  /** lastModified ASC szerint rendezve. */
  items: MediaItem[]
  skippedCount: number
}

export type FolderReadError =
  | { type: 'aborted' }
  | { type: 'permission-denied' }
  | { type: 'empty'; folderName: string }
  | { type: 'unsupported-browser' }

// ── Rendezés (organize) ────────────────────────────────────────────────────

/** A Rendezés bemenete (a store-ból derivált selector építi). */
export type SortPlan = Map<BucketKey, FileSystemFileHandle[]>

export interface MoveFailure {
  name: string
  bucket: BucketKey
  error: string
}

export interface MoveResult {
  moved: number
  deleted: number
  failed: MoveFailure[]
}

export interface SortProgress {
  done: number
  total: number
  currentName: string
}
