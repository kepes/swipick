# Swipick — Implementation plan

> **Source spec:** [swipick-spec.md](../../swipick-spec.md)
> **Design doc:** [2026-06-17-swipick-design.md](../specs/2026-06-17-swipick-design.md) (canonical data model, contracts)
>
> This document describes _how_ we execute the design — execution order, TDD schedule, parallel sub-agent groups, verification gates.

## Table of contents

1. [Principles](#1-principles)
2. [Implementation order table](#2-implementation-order-table)
3. [TDD schedule per module](#3-tdd-schedule-per-module)
4. [Verification gates](#4-verification-gates)
5. [Sub-agent dispatch strategy](#5-sub-agent-dispatch-strategy)
6. [Commit structure](#6-commit-structure)

## 1. Principles

- **TDD is mandatory:** every module gets a failing test first, then the implementation (red → green).
- **Pure domain first:** the `domain/` layer (keymap, reducer, ordering, buckets) is I/O-free, fast to test, and everything else builds on it — this is the critical path.
- **Canonical model frozen:** the `types.ts` from section 4 of the design is the shared reference. Every parallel agent works from THIS, and does not re-derive it. That is why **G0 (scaffold + types.ts)** runs strictly before everything else, solo.
- **We do not parallelize tasks working on shared state** (store, App). Independent modules, yes.

## 2. Implementation order table

| # | Project | Task | Sub-agent group | Parallel |
|---|---|---|---|---|
| 1 | frontend | **Scaffold:** Vite+TS+React project, `package.json`, `vite.config.ts` (base+vitest), `tsconfig`, `src/test/setup.ts`, **`src/domain/types.ts`** (canonical model frozen), `src/test/fakeFs.ts` (in-memory FS Access fake) | **G0** (solo, blocking) | no |
| 2 | frontend | `domain/keymap.ts` — `classifyKey` + truth-table test | **G1** | yes (within G1) |
| 3 | frontend | `domain/ordering.ts` — `lastModified` ASC tie-break + test | **G1** | yes |
| 4 | frontend | `fs/scan.ts` — `classifyByExtension` + `readFolder(gateway)` + test (fakeFs) | **G1** | yes |
| 5 | frontend | `fs/organize.ts` — `resolveCollisionName`/`ensureBucketDir`/`moveFile`/`runSort` + collision test (fakeFs) | **G1** | yes |
| 6 | frontend | `domain/reducer.ts` + `domain/buckets.ts` — `applyKey`/`placeCurrent`/`undo`/`redo` + derived buckets + chain test | **G2** (depends: keymap, types) | yes (within G2) |
| 7 | frontend | `store/persist.ts` — `storageKey`/save/load/`hasSession`/clear/`reconcile` + folder-scoped test | **G2** (depends: types) | yes |
| 8 | frontend | `store/useSortStore.ts` — Zustand store, wiring reducer+persist together, `buildSortPlan` selector, screen state | **G3** (depends: 6,7) | no (shared integration point) |
| 9 | frontend | UI: `FolderPicker`, `ProgressBadge`, `BasketBar`, `ControlButtons`, `DoneScreen` (presentational, with store selectors) | **G4** (depends: 8) | yes (separate files) |
| 10 | frontend | UI: `MediaCard` + `CardStack` + `hooks/useMediaWindow` (Framer Motion anim, video) | **G4** | yes |
| 11 | frontend | `hooks/useKeyboard.ts` + `App.tsx` routing (picker/sorting/done) wiring | **G5** (depends: 8,9,10) | no |
| 12 | frontend | Integration test: picker→sorting→done flow with fakeFs; final verification (typecheck+build+test) | **G6** (depends: everything) | no |

**Dependency chain:** G0 → G1 (4 independent modules in parallel) → G2 (reducer+persist in parallel) → G3 (store, solo) → G4 (UI, in parallel) → G5 (App+keyboard, solo) → G6 (integration+verification).

## 3. TDD schedule per module

Every module: **the listed test is written FIRST** (failing), then the implementation to green.

- **keymap** (#2): truth table (design section 6) — `a`/`A`/`Shift+A`→`bucket('a')`, digits, arrows, `Ctrl+Z`/`Ctrl+Y`/`Ctrl+Shift+Z`, `z` (without ctrl)→bucket, Space/Esc→domain no-op, invalid characters (`/ \ : * ? < > | . Tab Enter F1 Alt+a`)→noop, `Cmd`==`Ctrl`.
- **ordering** (#3): `lastModified` ASC; on equality, stable order by `fileName`; empty array.
- **scan** (#4): mixed folder → only supported extensions remain, unknown skipped, `skippedCount`; subfolder never in `items`; empty/all-non-media → `empty`; picker-abort→`aborted`, permission denied→`permission-denied`; `classifyByExtension` case-insensitive, `null` without extension; `isSupported()===false`→`unsupported-browser`.
- **organize** (#5): collision-free → `finalName===name`; existing `kep.jpg`→`kep (1).jpg`→`kep (2).jpg`; extensionless `README`→`README (1)`; `_deleted` folder for the delete bucket, `deleted` increments; a kept/unclassified image does NOT move; write error → original stays + `failed[]`; `MoveResult` counts = bucket sizes; existing bucket folder reused.
- **reducer+buckets** (#6): truth table via `applyKey` down to the final state; chain test (3 classifications→2 undos→1 redo→1 new→redo no-op); undo of a bucket's last item → bucket disappears, redo recreates it; `keep` undo does not touch a bucket; at `position===len` a decision is a no-op; thumbnail===members[0] even after undo.
- **persist** (#7): two folders with different names → two keys, no overwrite; decision→save→load round-trip; deleted file → `reconcile` `droppedFiles`, no crash; new file → unclassified at its `lastModified` position; after a successful sort/reset `load`→null; corrupt JSON → null (fresh session); undo state is redo-able after reload.
- **store** (#8): `applyKey` dispatch → state + persist-save (fake localStorage) is called; `buildSortPlan` returns the `delete`+normal buckets with handle arrays, omitting kept/unclassified; reset clears the state + `clearSession`.
- **UI** (#9,#10): FolderPicker renders the `unsupported-browser` message; ProgressBadge shows `position+1/total` (renders only when `position < items.length` — in the Done state the DoneScreen takes over, no `241/240` overflow); **BasketBar:** every bucket shows name + thumbnail + **count** (spec 3.5); the **delete bucket is set apart with red marking**; MediaCard video `muted+loop+autoplay`, Space toggles; `useMediaWindow` max 8 live objectURLs + revoke spy; **DoneScreen:** "you've reviewed everything" indication (spec 3.6) + big Sort button (no keyboard trigger).
- **integration** (#12): full flow with fakeFs — pick→3 classifications→Sort→`_deleted`+bucket folders get created, kept image stays in the root.

## 4. Verification gates

Between the G-groups there is a **mandatory gate** — the next group only starts after a green gate:

- **Gate G0→G1:** `npm run typecheck` green over scaffold + `types.ts` + `fakeFs.ts` (the fake compiles on its own).
- **Gate G1→G2:** `npm test` green for the keymap/ordering/scan/organize modules; `typecheck` 0 errors.
- **Gate G2→G3:** reducer+persist tests green.
- **Gate G3→G4:** store test green; `typecheck` 0 errors (store integration is the most common source of type errors).
- **Gate G4→G5:** UI component tests green.
- **Gate G5→G6:** App renders, keyboard hook dispatches (smoke).
- **Final gate (G6):** full `npm test` green, `npm run typecheck` 0 errors, `npm run build` green (`dist/` with a relative path), and manual `vite preview` smoke (the tests mock the browser-only FS API; the preview verifies the UI flow).

## 5. Sub-agent dispatch strategy

- **G0 solo** (Sonnet, medium — scaffold/config recognition): the full skeleton + frozen `types.ts` + `fakeFs.ts`. This is the canonical reference; everything else refers to it.
- **G1 parallel** (4 agents in one message — keymap/ordering/scan/organize are separate files, no collision). Domain logic → Opus medium; scan/organize FS-mock → Opus medium (collision semantics are delicate).
- **G2 parallel** (reducer+persist — separate files). Reducer (undo/redo chain, delicate) → Opus high; persist → Opus medium.
- **G3 solo** (store — shared integration point, many types). Opus medium.
- **G4 parallel** (UI presentational + card/anim — separate files). Sonnet medium (mechanical, per spec).
- **G5 solo** (App+keyboard wiring). Opus medium.
- **G6 solo** (integration + verification). Sonnet medium → if it fails, Opus high debug.

Every dispatch receives: design section 4 (canonical model) + its own section's contract + the concrete file path. It does **not** receive the full chat. Output trimming: ≤120-word summary per dispatch.

## 6. Commit structure

Commit **only after green tests**, on a feature branch (`feat/swipick`), without Claude attribution. Suggested commit points at the gates:

1. `chore: scaffold Vite+TS+React + canonical types + fakeFs` (after G0)
2. `feat: domain keymap + ordering + fs scan/organize` (after G1)
3. `feat: undo/redo reducer + folder-scoped persist` (after G2)
4. `feat: zustand store + sort plan selector` (after G3)
5. `feat: UI components (picker, card, baskets, controls, done)` (after G4)
6. `feat: app routing + keyboard + integration test` (after G5–G6)
7. `docs: README with run/usage` (final)
