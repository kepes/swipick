// Canonical data model — the shared reference for the whole app.
// See: docs/superpowers/specs/2026-06-17-swipick-design.md (section 4).
// Stable key everywhere: fileName (folder-scoped file name, not a path, no separate id).

/** Internal bucket key: 'a'..'z' | '0'..'9' | 'delete'. */
export type BucketKey = string

/** Internal identifier of the "delete" bucket. */
export const DELETE_BUCKET: BucketKey = 'delete'
/** UI label of the "delete" bucket. */
export const DELETE_DISPLAY = 'delete'
/** Folder name written to disk for the "delete" bucket (spec 4.3). */
export const TRASH_DIR = '_deleted'

export type MediaKind = 'image' | 'video'

export interface MediaItem {
  /** Full file name with extension — STABLE KEY. */
  fileName: string
  kind: MediaKind
  /** The File is lazy (handle.getFile()); the handle is needed for the Sort. */
  handle: FileSystemFileHandle
  /** ms epoch — sort key. */
  lastModified: number
  size: number
}

/** keep (right arrow) → NO Decision (unclassified == stays in place). */
export interface Decision {
  fileName: string
  bucket: BucketKey
}

/** Derived, not a persisted source. */
export interface Bucket {
  key: BucketKey
  kind: 'normal' | 'delete'
  /** fileNames in classification order. */
  members: string[]
  /** === members[0] (derived). */
  thumbnail: string | null
}

/**
 * Unified undo/redo entry. A keep IS an entry too (for undoability),
 * but nextBucket=null → the bucket layer ignores it.
 */
export interface HistoryEntry {
  fileName: string
  /** The queue position from which the decision was made. */
  position: number
  /** Previous decision (keep/unclassified = null). */
  prevBucket: BucketKey | null
  /** New decision (keep = null). */
  nextBucket: BucketKey | null
}

/** Input of the key reduction (the relevant fields of KeyboardEvent). */
export interface KeyEvent {
  key: string
  ctrlKey: boolean
  shiftKey: boolean
  metaKey: boolean
  altKey: boolean
}

/** Output of classifyKey — discriminated union. */
export type KeyAction =
  | { type: 'bucket'; bucketKey: BucketKey }
  | { type: 'delete' }
  | { type: 'keep' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'space' }
  | { type: 'esc' }
  | { type: 'noop' }

/** The target of the decision (input of placeCurrent). */
export type DecisionTarget =
  | { type: 'bucket'; bucketKey: BucketKey }
  | { type: 'delete' }
  | { type: 'keep' }

/**
 * Runtime app state (owned by the Zustand store).
 * The buckets are DERIVED from decisions (via a selector), not a source stored here.
 */
export interface SortState {
  folderName: string
  /** lastModified ASC, tie-break fileName. */
  items: MediaItem[]
  /** === items.length → DONE. */
  position: number
  decisions: Record<string, Decision>
  history: HistoryEntry[]
  /** redo is possible when historyCursor < history.length. */
  historyCursor: number
}

/** Persisted session (handle/objectURL/buckets NEVER). */
export interface PersistedSessionV1 {
  schemaVersion: 1
  folderName: string
  savedAt: number
  decisions: Decision[]
  history: HistoryEntry[]
  historyCursor: number
  position: number
}

// ── FS gateway (mockable) ────────────────────────────────────────────────

export interface FileSystemGateway {
  isSupported(): boolean
  pickDirectory(): Promise<FileSystemDirectoryHandle>
  ensureWritePermission(dir: FileSystemDirectoryHandle): Promise<boolean>
}

export interface ReadFolderResult {
  folderName: string
  /** The handle of the selected folder — the Sort (organize) writes here. */
  dirHandle: FileSystemDirectoryHandle
  /** sorted by lastModified ASC. */
  items: MediaItem[]
  skippedCount: number
}

export type FolderReadError =
  | { type: 'aborted' }
  | { type: 'permission-denied' }
  | { type: 'empty'; folderName: string }
  | { type: 'unsupported-browser' }

// ── Sort (organize) ────────────────────────────────────────────────────

/** Input of the Sort (built by a selector derived from the store). */
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
