# Swipick — Design / architecture doc

> **Source (requirements spec):** [swipick-spec.md](../../swipick-spec.md). This document describes _what_ we build and _why_; the execution order lives in the [plan](../plans/2026-06-17-swipick-plan.md).

## Table of contents

1. [Overview and scope](#1-overview-and-scope)
2. [Stack choices (with rationale)](#2-stack-choices-with-rationale)
3. [Architecture and folder structure](#3-architecture-and-folder-structure)
4. [Canonical data model](#4-canonical-data-model)
5. [State machine](#5-state-machine)
6. [Key → action contract (the core of the app)](#6-key--action-contract-the-core-of-the-app)
7. [Undo / Redo](#7-undo--redo)
8. [FS operations contract](#8-fs-operations-contract)
9. [Folder-scoped localStorage persistence](#9-folder-scoped-localstorage-persistence)
10. [Edge cases (summary)](#10-edge-cases-summary)
11. [Success criteria (verifiable)](#11-success-criteria-verifiable)
12. [Decisions / assumptions](#12-decisions--assumptions)

## 1. Overview and scope

A client-side React app running in the browser for Tinder-style, keyboard-driven sorting of images/videos. The user picks a folder (File System Access API, with write permission), the app presents the displayable media one at a time in ascending `lastModified` order, the user sorts them into buckets with the keyboard, and finally the **Sort** button organizes the images into subfolders with real file operations.

**In scope:** spec sections 1–6 in their entirety. **NOT in scope (outside the MVP):** the "future questions" of spec section 7 (IndexedDB handle persistence, editing bucket contents, bucket renaming, touch/swipe, explicit lazy-load tuning with a re-run signal). The baseline re-run behavior (generated subfolders are skipped on re-read) follows naturally from the "one level only" rule, so it is included.

## 2. Stack choices (with rationale)

| Layer | Choice | Rationale |
|---|---|---|
| **Bundler** | **Vite** (`base: './'`) | Zero-config static build; a single `dist/` bundle. |
| **Language** | **TypeScript** | FS Access API types + a typed domain model (buckets, decisions, history). |
| **State** | **Zustand 5** (`persist` middleware) | Single store, folder-scoped localStorage, selector re-render isolation. Redux/Context would be overkill. |
| **Animation** | **Framer Motion** (`AnimatePresence`) | Declarative "throw away" exit animation by direction/target; a hand-rolled CSS keyframe for the 38 directions would be fragile. |
| **Testing** | **Vitest + Testing Library + jsdom** | Vite-native, shared config; `@testing-library/user-event` for the keys. |
| **Styling** | **CSS Modules** | A single clean view, no design-system need; a Tailwind toolchain is unnecessary. |
| **FS mock** | Hand-written in-memory fake (`src/test/fakeFs.ts`) | jsdom does not implement the FS Access API; our own fake models the `move`/collision/`removeEntry` semantics precisely (small surface, 4–5 methods). |

**Secure-context constraint:** the File System Access API is only available under `https`/`localhost`, not from a double-clicked `file://`. The "static app" goal still holds (`vite preview` or any static host). The README records this.

## 3. Architecture and folder structure

Layered, one-way data flow: **pure domain (reducers) → Zustand store (single owner) → React components (stateless with respect to the domain)**. The FS and persistence I/O layer sits behind dependency injection so it can be mocked in tests.

```
src/
  main.tsx, App.tsx               # entry + screen routing (picker | sorting | done)
  domain/                         # PURE, I/O-free — the core logic lives here
    types.ts                      # canonical types (see 4.)
    keymap.ts                     # classifyKey(KeyEvent) → KeyAction
    reducer.ts                    # applyKey / placeCurrent / undo / redo (pure)
    buckets.ts                    # buckets derived selector from decisions+history
    ordering.ts                   # lastModified ASC, tie-break fileName
  fs/
    gateway.ts                    # FileSystemGateway interface + real impl (showDirectoryPicker)
    scan.ts                       # readFolder(gateway) → MediaItem[] (filter + sort)
    organize.ts                   # runSort / moveFile / resolveCollisionName / ensureBucketDir
  store/
    useSortStore.ts               # Zustand store (OWNER of position/decisions/history)
    persist.ts                    # storageKey / save / load / hasSession / clear / reconcile
  components/
    FolderPicker.tsx  CardStack.tsx  MediaCard.tsx  ProgressBadge.tsx
    BasketBar.tsx     ControlButtons.tsx  DoneScreen.tsx
  hooks/
    useKeyboard.ts                # global keydown → store action dispatch
    useMediaWindow.ts             # windowed objectURL cache (revoke outside the window)
  test/
    fakeFs.ts  setup.ts
```

**Ownership (single source of truth):** the Zustand store owns `position`, `decisions`, and the full `history`. `buckets` is **derived** (computed from `decisions` + the sorting order), not a separately stored source. The CardView and the reducer are stateless with respect to these.

## 4. Canonical data model

> This is the consolidated, contradiction-free model — every subsystem follows THIS. The stable key everywhere is **`fileName`** (folder-scoped file name, not path, no separate `id`).

```ts
// Key space
type BucketKey = string;            // 'a'..'z' | '0'..'9' | 'delete'
const DELETE_BUCKET: BucketKey = 'delete';   // internal id
const DELETE_DISPLAY = 'delete';             // UI label
const TRASH_DIR = '_deleted';                 // folder name written to disk (spec 4.3!)

type MediaKind = 'image' | 'video';

interface MediaItem {
  fileName: string;                 // full name with extension — STABLE KEY
  kind: MediaKind;
  handle: FileSystemFileHandle;     // the File is lazy: handle.getFile(); the handle is needed for the Sort
  lastModified: number;             // ms epoch — sort key
  size: number;
}

// keep (right arrow) → NO Decision (unclassified == stays in place)
interface Decision { fileName: string; bucket: BucketKey; }

// Derived, not persisted as a source
interface Bucket {
  key: BucketKey;
  kind: 'normal' | 'delete';
  members: string[];                // fileNames in classification order
  thumbnail: string | null;         // === members[0] (DERIVED)
}

// Unified undo/redo entry. keep IS an entry (for undoability), but nextBucket=null.
interface HistoryEntry {
  fileName: string;
  position: number;                 // the position in the sequence where the decision was made
  prevBucket: BucketKey | null;     // previous decision (keep/unclassified = null)
  nextBucket: BucketKey | null;     // new decision (keep = null)
}

// Runtime AppState — the store is the owner
interface AppState {
  folderName: string;
  items: MediaItem[];               // lastModified ASC, tie-break fileName
  position: number;                 // === items.length → DONE
  decisions: Record<string, Decision>;
  history: HistoryEntry[];
  historyCursor: number;            // redo is possible when historyCursor < history.length
}

// Persisted shape (handle/objectURL/buckets NEVER)
interface PersistedSessionV1 {
  schemaVersion: 1;
  folderName: string;
  savedAt: number;
  decisions: Decision[];
  history: HistoryEntry[];
  historyCursor: number;
  position: number;
}
```

**Conflict resolutions (based on the cross-check critic):**
- Stable id = **`fileName`** (not `id`/`fileId`/`filename`).
- Delete bucket internal id = **`'delete'`**; UI label **`delete`**; folder name written to disk **`_deleted`** (spec 4.3 explicit — here I override the critic's suggestion, the spec wins).
- Undo model = **a single `history` array + `historyCursor`** (not two separate stacks); the reducer uses this.
- The position is named **`position`** everywhere.
- Canonical order = **`lastModified` ASC, tie-break `fileName`** — the persisted `position` also builds on this (NOT alphabetical order), so it is stable after reload.
- `thumbnail` = derived `members[0]`, never a separately stored source.
- The `SortPlan` (input of the Sort) is built by a **derived selector** from the store (`buildSortPlan(state)`), `Map<BucketKey, FileSystemFileHandle[]>`.

## 5. State machine

**Screen level (App routing):**

```
PICKER ──pickDirectory→ (permission) ──ready(items≥1)──→ SORTING ──Sort button──→ DONE
  ▲  └─ aborted / permission-denied / empty / unsupported → stays PICKER (with message)
  └──────────────────────── Reset (4.4) ────────────────────────────────────────────┘
SORTING ──Sort button (anytime)──→ (runSort) ──success──→ result feedback + session cleared
```

**Internal state during sorting (SORTING):** `position` 0..N. `position === items.length` → the CardStack renders the **"Done" view** (large Sort button), but the Sort button in the header stays **available throughout** (4.3: can be triggered anytime). Input-lock during animation (except Esc).

**Sort (organize) phase:** `idle → sorting (buttons disabled) → done(MoveResult) | partial(failed>0)`. After success (`failed===0`), the localStorage session is cleared. **After** the operation the app stays on the result screen (feedback: "X moved, Y deleted[, Z failed]"), from where a **"Back to folder picker"** button (essentially Reset) takes you to the PICKER.

**Esc semantics:** since `placeCurrent` commits **immediately** on the key (a domain state change), the animation is pure presentation — so `Esc` only cuts off the running visual exit animation, it does **not** revert the decision that has already been made (that's what Undo is for). If there is no running animation, `Esc` is a no-op.

## 6. Key → action contract (the core of the app)

`classifyKey(e: KeyEvent): KeyAction` — pure, side-effect-free. `KeyEvent = { key, ctrlKey, shiftKey, metaKey }` (`key` is the `KeyboardEvent.key`). `metaKey` (macOS Cmd) is ctrl-equivalent for undo/redo.

**Evaluation order (the reserved combos TAKE PRECEDENCE over the letter branch):**
1. `Ctrl/Cmd+Z` (without Shift) → `undo`
2. `Ctrl/Cmd+Y` **or** `Ctrl/Cmd+Shift+Z` → `redo`
3. `Space` → `space` (UI: video toggle; domain no-op)
4. `Escape` → `esc` (UI: animation interrupt; domain no-op)
5. `ArrowRight` → `keep`
6. `ArrowLeft` → `delete`
7. otherwise `key.toLowerCase()` ∈ `a–z` → `bucket('<letter>')`; ∈ `0–9` → `bucket('<digit>')`
8. everything else (`/ \ : * ? < > |`, `.`, `Tab`, `Enter`, `F1`, `Alt+a`, etc.) → `noop`

**Truth table (success criterion):**

| KeyEvent | KeyAction |
|---|---|
| `a` / `A` / `Shift+A` | `bucket('a')` |
| `0`..`9` | `bucket('<digit>')` |
| `ArrowRight` | `keep` |
| `ArrowLeft` | `delete` |
| `Ctrl+Z` / `Cmd+Z` | `undo` |
| `Ctrl+Y` / `Ctrl+Shift+Z` | `redo` |
| `z` (without Ctrl) | `bucket('z')` |
| `Space` | `space` (domain no-op) |
| `Escape` | `esc` (domain no-op) |
| `/ \ : * ? < > \|`, `.`, `Tab`, `Enter`, `F1`, `Alt+a` | `noop` |
| any decision at `position===items.length` | `noop` *(applyKey-level, NOT classifyKey — classifyKey does not know the position)* |
| undo/redo on an empty chain | `noop` *(applyKey-level, NOT classifyKey)* |

`applyKey(state, e)` orchestrates: `classifyKey` → depending on the branch `placeCurrent(state, target)` (decision + `position++` + history push + redo branch cut), `undo`, `redo`, or identity (`space`/`esc`/`noop`). Case-insensitive: `'A'` and `'a'` are the same `'a'` bucket; the bucket name is always lowercase.

## 7. Undo / Redo

Over the `history` + `historyCursor` model:
- **placeCurrent:** `history = history.slice(0, historyCursor)` (cut the redo branch) then push; `historyCursor++`; `position++`.
- **undo** (`historyCursor > 0`): `entry = history[historyCursor-1]`; restores the image to `prevBucket` (or removes it from the bucket if `null`); `position = entry.position`; `historyCursor--`. If the affected bucket becomes empty → the `Bucket` disappears (derived, automatic).
- **redo** (`historyCursor < history.length`): `entry = history[historyCursor]`; sets to `nextBucket`; `position = entry.position + 1`; `historyCursor++`.
- **`keep` is undoable** (history entry with `nextBucket=null`), but it does not touch a bucket.
- The `thumbnail` is always `members[0]` — automatically correct after undo (derived), no separate `wasFirstInBucket` field.

**Chain success criterion:** 3 classifications → 2 undo → 1 redo → 1 new action → redo no-op; at the end `historyCursor === history.length`, the redo branch cut off.

## 8. FS operations contract

**Gateway (mockable):**
```ts
interface FileSystemGateway {
  isSupported(): boolean;
  pickDirectory(): Promise<FileSystemDirectoryHandle>;       // throws AbortError
  ensureWritePermission(dir: FileSystemDirectoryHandle): Promise<boolean>;
}
```

**Reading (`scan.ts`):**
```ts
const IMAGE_EXT = ['jpg','jpeg','png','gif','webp','avif','bmp','svg','heic'];
const VIDEO_EXT = ['mp4','webm','ogg','ogv','mov'];
classifyByExtension(name): MediaKind | null;                 // segment after the last '.', lowercase
readFolder(gateway): Promise<ReadFolderResult>;             // dir.values() → filter → lastModified ASC
// ReadFolderResult = { folderName, items, skippedCount }
// Errors: { type: 'aborted' | 'permission-denied' | 'empty' | 'unsupported-browser' }
```
- Subfolders (`kind==='directory'`) are skipped — including the `1/`,`a/`,`_deleted/` generated by a previous Sort, automatically (spec 7. re-run).
- Empty / all-non-media → `empty` (3.1 message), stays on the picker.
- We request write permission **already at read time** (spec 2. Technical framework — "the user … must grant write permission to the folder"), so that the Sort does not stall.

**Writing / Sort (`organize.ts`):**
```ts
resolveCollisionName(destDir, name): Promise<string>;       // 'kep.jpg' → 'kep (1).jpg' → 'kep (2).jpg'
resolveBucketDirName(root, bucketKey): Promise<string>;     // 'b' free → 'b'; taken → 'b_01' → 'b_02' (two-digit)
ensureBucketDir(root, bucketKey): Promise<DirHandle>;       // normal: free _NN-numbered folder; delete: reuse _deleted
moveFile(src, root, destDir, name): Promise<{finalName}>;   // collision resolution → write → delete (root needed for the source removeEntry)
runSort(root, plan, onProgress?): Promise<MoveResult>;      // MoveResult = {moved, deleted, failed[]}
```
- **moveFile order: write → delete** (not the other way around) — on an interruption the source is never lost. Native fast path: if `src.move` exists, it uses that; otherwise `createWritable` + `getFile` blob copy + `root.removeEntry(src.name)`.
- **ensureBucketDir:** normal bucket → folder named `key`, but if it **already exists**, a fresh `_NN` two-digit-numbered sibling (`b/` → `b_01/` → `b_02/`) — each sort into a separate folder; `delete` bucket → **`_deleted`** folder, which is **reused** (a single collector folder, not numbered).
- **Collision:** if `getFileHandle` on the target name does not throw `NotFoundError` → taken → `base (n).ext` increment (without extension `name (n)`).
- **Fault-tolerant batch:** a failed file accumulates into `failed[]`, the run continues; at the end `"X moved, Y deleted[, Z failed]"`.
- The **kept (keep) and unclassified** images are not in the `SortPlan` → they stay in place.

## 9. Folder-scoped localStorage persistence

- **Key:** `swipick:v1:session:<folderName>`. One versioned JSON per folder; a different folder → a different key, no overwrite.
- **Save:** after every decision/undo/redo, **debounce 150ms**. Saved: `decisions`, `history`, `historyCursor`, `position`. NOT saved: image content, handle, `buckets` (derived).
- **Restore:** on the picker, after the folder is picked `hasSession` → badge. Re-selecting → `loadSession` + `reconcile(persisted, currentFileNames)`:
  1. Filter `decisions` to the current file names; missing ones → `droppedFiles` (the decision of a renamed/deleted file is lost).
  2. Purge `history` of entries referring to droppedFiles (order-preserving). The `historyCursor` correction is **specifically:** `historyCursor_new = historyCursor_old − (number of purged entries BEFORE the cursor)`, then `clamp(0, history_new.length)`. (NOT ratio scaling — the cursor marks a concrete entry boundary.)
  3. New (never-seen) files → unclassified, at their **natural place** in the canonical (`lastModified` ASC) sequence (not separately "appended to the end", because the order follows from the file's `lastModified` — the critic's "to the end" suggestion is replaced here by the `lastModified` ordering, consistent with section 4).
  4. **Recomputing `HistoryEntry.position`:** the `position` field of the remaining history entries points to the *old* row index; the reconcile **recomputes** each of them using the current `fileName→index` mapping of `items` (droppedFiles and new files shift the indices). Without this, after reload redo would jump to the wrong position (a silent bug — the 11.3 persistence test also asserts on `position`).
  5. `position = min(persisted.position, items.length)`.
- **Cleanup:** after Reset (4.4) and a **successful** Sort, `clearSession` (only the current branch).
- **Best-effort:** parse/version error → fresh session (no crash); `QuotaExceededError` → console warn, continues in memory.

## 10. Edge cases (summary)

- **Picker abort** → silently back to the picker, no error message.
- **Write permission denied** → "Write permission is required", does not proceed.
- **Non-Chromium browser** (`!('showDirectoryPicker' in window)`) → blocking message on the picker.
- **`lastModified` equal** → stable tie-break `fileName` (reproducible position).
- **Key during animation** → input-lock, at most one throw (Esc is the exception: interrupts, the decision does not commit).
- **Video autoplay block** (despite muted) → `.catch` silently, retries on Space.
- **objectURL** → windowed cache (default 5 ahead / 2 behind), `revokeObjectURL` outside the window, all revoked on unmount — no leak even with several hundred items.
- **moveFile write error** → the original stays, goes into `failed[]`, we do not delete.
- **Extensionless / dot-file** (`README`, `.gitignore`) → extension detection only at the last dot, a leading dot is not a separator.
- **Separate folder with the same name** → the same localStorage branch may collide (the spec accepts this); the file-name matching filters out foreign images.
- **Large video + no native `move`** → the `createWritable` blob-copy fallback reads the whole file into memory → memory spike. Accepted MVP limit (spec 7.); `runSort` processes the files **sequentially** (not in parallel), so the spike is limited to a single file.

## 11. Success criteria (verifiable)

The full list is in the TDD section of the [plan](../plans/2026-06-17-swipick-plan.md), by module. The highlighted, testable invariants:

1. **Key→bucket mapping** per the truth table in section 6 (case-insensitive, a–z/0–9, invalid → no-op, `position===len` → no-op).
2. **Undo/redo chain:** 3 classifications → 2 undo → 1 redo → 1 new action → redo no-op; undoing the last element of a bucket → the bucket disappears, redo recreates it.
3. **Folder-scoped localStorage** round-trip: decision → reload → same folder → buckets+position+history restored; two differently named folders do not overwrite each other; the decision of a deleted file falls into `droppedFiles`, no crash.
4. **Sort collision handling:** existing bucket folder → new `_NN`-numbered sibling (`b/` → `b_01/`); `_deleted` reused instead; file-name collision → `name (n).ext`; kept/unclassified image stays in the root; write→delete order.
5. **scan:** only supported extensions, a subfolder never in `items`, `lastModified` ASC tie-break name, empty folder → `empty`.
6. **Build:** `tsc --noEmit` 0 errors, `vite build` green, `dist/` with relative paths.

## 12. Decisions / assumptions

Senior defaults taken at the gaps in the spec (fixed without asking):

1. **Stack:** Vite + TS + React 19 + Zustand 5 + Framer Motion + CSS Modules + Vitest. Minimalist, spec-covered, no router/Tailwind/extra lib.
2. **FS gateway DI + a hand-written in-memory fake** for testing (instead of an npm mock) — small surface, precise `move`/collision semantics.
3. **Delete folder named `_deleted`** (spec 4.3 explicit), internal key `delete`, UI label `delete` — a deliberate divergence, documented.
4. **Write permission requested at read time** (spec 2. Technical framework — "must grant write permission to the folder"), not at the Sort.
5. **Canonical order `lastModified` ASC, tie-break `fileName`** — the persisted `position` also builds on this (not alphabetical order).
6. **`keep` (right arrow) is not persisted** as a Decision (unclassified == no decision), but it **does** have a history entry for undoability.
7. **`buckets` and `thumbnail` are derived** — the single source is `decisions` + classification order; no separately stored thumbnail/`wasFirstInBucket`.
8. **moveFile write→delete order**, fault-tolerant batch (a single failed file does not stop the Sort).
9. **objectURL windowed cache** (5/2) — we cover spec 7.'s "lazy-load" question with just this in the MVP, we do not build a configurable preloader.
10. **Pessimistic flow for the Sort** (irreversible file operation, disk confirmation instead of server confirmation) — in line with the exceptions to the global Optimistic-UI rule; the click is the "commitment", the feedback comes at the end of the operation.
11. **`metaKey` (Cmd) == `ctrlKey`** for undo/redo — macOS compat, even though the spec says Ctrl.
12. **Secure-context:** the README records that `vite preview`/a host is needed (not a `file://` double-click).
