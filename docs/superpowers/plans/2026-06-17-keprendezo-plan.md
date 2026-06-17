# Képrendező — Implementációs terv

> **Forrás-spec:** [keprendezo-specifikacio.md](../../keprendezo-specifikacio.md)
> **Design doc:** [2026-06-17-keprendezo-design.md](../specs/2026-06-17-keprendezo-design.md) (kanonikus adatmodell, kontraktok)
>
> Ez a dokumentum azt írja le, _hogyan_ hajtjuk végre a designt — végrehajtási sorrend, TDD-ütemezés, párhuzamos sub-agent csoportok, verification gate-ek.

## Tartalomjegyzék

1. [Alapelvek](#1-alapelvek)
2. [Megvalósítási sorrend táblázat](#2-megvalósítási-sorrend-táblázat)
3. [TDD-ütemezés modulonként](#3-tdd-ütemezés-modulonként)
4. [Verification gate-ek](#4-verification-gate-ek)
5. [Sub-agent dispatch stratégia](#5-sub-agent-dispatch-stratégia)
6. [Commit-struktúra](#6-commit-struktúra)

## 1. Alapelvek

- **TDD kötelező:** minden modul előbb failing teszt, aztán implementáció (red → green).
- **Tiszta domain először:** a `domain/` réteg (keymap, reducer, ordering, buckets) I/O-mentes, gyorsan tesztelhető, és minden más erre épül — ez a kritikus út.
- **Kanonikus modell befagyasztva:** a design 4. szakaszának `types.ts`-e a közös referencia. Minden párhuzamos agent EBBŐL dolgozik, nem vezeti le újra. Ezért a **G0 (scaffold + types.ts)** szigorúan minden más előtt fut, egyedül.
- **Közös state-en dolgozó taskokat nem párhuzamosítunk** (store, App). Független modulokat igen.

## 2. Megvalósítási sorrend táblázat

| # | Projekt | Feladat | Sub-agent csoport | Párhuzam |
|---|---|---|---|---|
| 1 | frontend | **Scaffold:** Vite+TS+React projekt, `package.json`, `vite.config.ts` (base+vitest), `tsconfig`, `src/test/setup.ts`, **`src/domain/types.ts`** (kanonikus modell befagyasztva), `src/test/fakeFs.ts` (in-memory FS Access fake) | **G0** (solo, blokkoló) | nem |
| 2 | frontend | `domain/keymap.ts` — `classifyKey` + igazságtábla teszt | **G1** | igen (G1-en belül) |
| 3 | frontend | `domain/ordering.ts` — `lastModified` ASC tie-break + teszt | **G1** | igen |
| 4 | frontend | `fs/scan.ts` — `classifyByExtension` + `readFolder(gateway)` + teszt (fakeFs) | **G1** | igen |
| 5 | frontend | `fs/organize.ts` — `resolveCollisionName`/`ensureBucketDir`/`moveFile`/`runSort` + ütközés-teszt (fakeFs) | **G1** | igen |
| 6 | frontend | `domain/reducer.ts` + `domain/buckets.ts` — `applyKey`/`placeCurrent`/`undo`/`redo` + derivált buckets + lánc-teszt | **G2** (függ: keymap, types) | igen (G2-n belül) |
| 7 | frontend | `store/persist.ts` — `storageKey`/save/load/`hasSession`/clear/`reconcile` + folder-scoped teszt | **G2** (függ: types) | igen |
| 8 | frontend | `store/useSortStore.ts` — Zustand store, a reducer+persist bekötése, `buildSortPlan` selector, képernyő-állapot | **G3** (függ: 6,7) | nem (közös integ. pont) |
| 9 | frontend | UI: `FolderPicker`, `ProgressBadge`, `BasketBar`, `ControlButtons`, `DoneScreen` (prezentációs, store-selectorral) | **G4** (függ: 8) | igen (külön fájlok) |
| 10 | frontend | UI: `MediaCard` + `CardStack` + `hooks/useMediaWindow` (Framer Motion anim, videó) | **G4** | igen |
| 11 | frontend | `hooks/useKeyboard.ts` + `App.tsx` routing (picker/sorting/done) bekötés | **G5** (függ: 8,9,10) | nem |
| 12 | frontend | Integrációs teszt: picker→sorting→done flow fakeFs-szel; végső verifikáció (typecheck+build+teszt) | **G6** (függ: minden) | nem |

**Függőségi lánc:** G0 → G1 (4 független modul párhuzamosan) → G2 (reducer+persist párhuzamosan) → G3 (store, solo) → G4 (UI, párhuzamosan) → G5 (App+keyboard, solo) → G6 (integráció+verifikáció).

## 3. TDD-ütemezés modulonként

Minden modul: **a felsorolt teszt írandó ELŐSZÖR** (failing), majd az implementáció zöldre.

- **keymap** (#2): igazságtábla (design 6.) — `a`/`A`/`Shift+A`→`bucket('a')`, számok, nyilak, `Ctrl+Z`/`Ctrl+Y`/`Ctrl+Shift+Z`, `z`(ctrl nélkül)→bucket, Space/Esc→domain no-op, érvénytelen karakterek (`/ \ : * ? < > | . Tab Enter F1 Alt+a`)→noop, `Cmd`==`Ctrl`.
- **ordering** (#3): `lastModified` ASC; egyenlőségnél `fileName` szerinti stabil sorrend; üres tömb.
- **scan** (#4): vegyes mappa → csak támogatott ext marad, ismeretlen kihagyva, `skippedCount`; almappa sosem `items`-ben; üres/csupa-nem-média → `empty`; picker-abort→`aborted`, engedély-megtagadás→`permission-denied`; `classifyByExtension` case-insensitive, ext nélkül `null`; `isSupported()===false`→`unsupported-browser`.
- **organize** (#5): ütközésmentes → `finalName===name`; létező `kep.jpg`→`kep (1).jpg`→`kep (2).jpg`; ext nélküli `README`→`README (1)`; `_torolt` mappa a delete-kosárnak, `deleted` nő; megtartott/besorolatlan kép NEM mozdul; write-hiba → eredeti megmarad + `failed[]`; `MoveResult` számok = bucket-méretek; meglévő bucket-mappa újrafelhasználva.
- **reducer+buckets** (#6): igazságtábla `applyKey`-en át végállapotra; lánc-teszt (3 besorolás→2 undo→1 redo→1 új→redo no-op); kosár utolsó elemének undo-ja → kosár eltűnik, redo újra létrehozza; `keep` undo nem érint kosarat; `position===len`-nél döntés no-op; thumbnail===members[0] undo után is.
- **persist** (#7): két különböző nevű mappa → két kulcs, nincs felülírás; döntés→save→load round-trip; törölt fájl → `reconcile` `droppedFiles`, nincs crash; új fájl → besorolatlan a `lastModified` helyén; sikeres rendezés/reset után `load`→null; sérült JSON → null (friss munkamenet); undo-állapot reload után redo-lható.
- **store** (#8): `applyKey` dispatch → state + persist-mentés (fake localStorage) hívódik; `buildSortPlan` a `delete`+normal kosarakat adja handle-tömbökkel, megtartottat/besorolatlant kihagyja; reset üríti az állapotot + `clearSession`.
- **UI** (#9,#10): FolderPicker `unsupported-browser` üzenet renderel; ProgressBadge `position+1/total` (csak `position < items.length` esetén renderel — Kész állapotban a DoneScreen veszi át, nincs `241/240` overflow); **BasketBar:** minden kosárnál név + bélyegkép + **darabszám** (spec 3.5); a **delete-kosár piros jelölés**sel elkülönül; MediaCard videó `muted+loop+autoplay`, Space toggle; `useMediaWindow` max 8 él objectURL + revoke spy; **DoneScreen:** „végignézted az összes elemet" jelzés (spec 3.6) + nagy Rendezés gomb (nincs billentyű-trigger).
- **integráció** (#12): teljes flow fakeFs-szel — pick→3 besorolás→Rendezés→`_torolt`+kosár-mappák létrejönnek, megtartott a root-ban.

## 4. Verification gate-ek

A G-csoportok között **kötelező gate** — a következő csoport csak zöld gate után indul:

- **Gate G0→G1:** `npm run typecheck` zöld a scaffold + `types.ts` + `fakeFs.ts` felett (a fake önmagában fordul).
- **Gate G1→G2:** `npm test` zöld a keymap/ordering/scan/organize modulokra; `typecheck` 0 hiba.
- **Gate G2→G3:** reducer+persist tesztek zöldek.
- **Gate G3→G4:** store teszt zöld; `typecheck` 0 hiba (store integráció a leggyakoribb típushiba-forrás).
- **Gate G4→G5:** UI komponens-tesztek zöldek.
- **Gate G5→G6:** App renderel, keyboard-hook dispatchol (smoke).
- **Záró gate (G6):** teljes `npm test` zöld, `npm run typecheck` 0 hiba, `npm run build` zöld (`dist/` relatív úttal), és kézi `vite preview` smoke (a böngésző-only FS API-t a teszt mockolja; a preview a UI-flow-t igazolja).

## 5. Sub-agent dispatch stratégia

- **G0 solo** (Sonnet, medium — scaffold/config felismerés): a teljes váz + befagyasztott `types.ts` + `fakeFs.ts`. Ez a kanonikus referencia, minden más erre hivatkozik.
- **G1 párhuzamos** (4 agent egy üzenetben — keymap/ordering/scan/organize külön fájlok, nincs ütközés). Domain-logika → Opus medium; scan/organize FS-mock → Opus medium (ütközés-szemantika kényes).
- **G2 párhuzamos** (reducer+persist — külön fájl). Reducer (undo/redo lánc, kényes) → Opus high; persist → Opus medium.
- **G3 solo** (store — közös integrációs pont, sok típus). Opus medium.
- **G4 párhuzamos** (UI presentational + card/anim — külön fájlok). Sonnet medium (mechanikus, spec szerint).
- **G5 solo** (App+keyboard wiring). Opus medium.
- **G6 solo** (integráció + verifikáció). Sonnet medium → ha hiba, Opus high debug.

Minden dispatch megkapja: a design 4. (kanonikus modell) + a saját szakasz kontraktját + a konkrét fájlútat. **Nem** kapja meg a teljes chat-et. Output-nyesés: ≤120 szó összefoglaló dispatch-enként.

## 6. Commit-struktúra

Commit **csak zöld teszt után**, feature branch-en (`feat/keprendezo`), Claude-attribúció nélkül. Javasolt commit-pontok a gate-eknél:

1. `chore: scaffold Vite+TS+React + kanonikus types + fakeFs` (G0 után)
2. `feat: domain keymap + ordering + fs scan/organize` (G1 után)
3. `feat: undo/redo reducer + folder-scoped persist` (G2 után)
4. `feat: zustand store + sort plan selector` (G3 után)
5. `feat: UI komponensek (picker, card, baskets, controls, done)` (G4 után)
6. `feat: app routing + keyboard + integrációs teszt` (G5–G6 után)
7. `docs: README futtatás-használattal` (záró)
