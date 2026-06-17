# Képrendező — Design / architektúra doc

> **Forrás (követelmény-spec):** [keprendezo-specifikacio.md](../../keprendezo-specifikacio.md). Ez a dokumentum azt írja le, _mit_ és _miért_ építünk; a végrehajtási sorrend a [plan](../plans/2026-06-17-keprendezo-plan.md)-ben él.

## Tartalomjegyzék

1. [Áttekintés és scope](#1-áttekintés-és-scope)
2. [Stack-választás (indoklással)](#2-stack-választás-indoklással)
3. [Architektúra és mappastruktúra](#3-architektúra-és-mappastruktúra)
4. [Kanonikus adatmodell](#4-kanonikus-adatmodell)
5. [Állapotautomata](#5-állapotautomata)
6. [Billentyű → művelet kontraktus (az app magja)](#6-billentyű--művelet-kontraktus-az-app-magja)
7. [Undo / Redo](#7-undo--redo)
8. [FS-műveletek kontraktja](#8-fs-műveletek-kontraktja)
9. [Folder-scoped localStorage perzisztencia](#9-folder-scoped-localstorage-perzisztencia)
10. [Edge case-ek (összesítő)](#10-edge-case-ek-összesítő)
11. [Sikerkritériumok (verifikálható)](#11-sikerkritériumok-verifikálható)
12. [Döntések / feltételezések](#12-döntések--feltételezések)

## 1. Áttekintés és scope

Kliensoldali, böngészőben futó React app képek/videók Tinder-szerű, billentyűzet-vezérelt rendezésére. A felhasználó kiválaszt egy mappát (File System Access API, írási engedéllyel), az app egyesével feldobja a megjeleníthető médiát `lastModified` szerint növekvő sorrendben, a felhasználó billentyűkkel kosarakba sorol, végül a **Rendezés** gomb valódi fájlműveletekkel almappákba rendezi a képeket.

**Scope-ban:** spec 1–6. szakasz teljes egészében. **NEM scope (MVP-n kívül):** spec 7. szakasz „jövőbeli kérdései" (IndexedDB handle-perzisztencia, kosár-tartalom szerkesztés, kosár-átnevezés, touch/swipe, explicit lazy-load finomhangolás re-run jelzéssel). A re-run alap-viselkedés (generált almappák kimaradnak az újraolvasásból) viszont természetesen adódik a „csak egy szint" szabályból, így benne van.

## 2. Stack-választás (indoklással)

| Réteg | Választás | Indok |
|---|---|---|
| **Bundler** | **Vite** (`base: './'`) | Zero-config statikus build; egyetlen `dist/` bundle. |
| **Nyelv** | **TypeScript** | FS Access API típusok + típusos domain-modell (kosarak, döntések, history). |
| **State** | **Zustand 5** (`persist` middleware) | Egyetlen store, folder-scoped localStorage, selector re-render izoláció. Redux/Context overkill. |
| **Animáció** | **Framer Motion** (`AnimatePresence`) | Deklaratív „eldobás" exit-animáció irány/cél szerint; kézi CSS-keyframe a 38 irányra törékeny. |
| **Teszt** | **Vitest + Testing Library + jsdom** | Vite-natív, közös config; `@testing-library/user-event` a billentyűkhez. |
| **Styling** | **CSS Modules** | Egy letisztult nézet, nincs design-system igény; Tailwind-lánc fölösleges. |
| **FS-mock** | Kézi in-memory fake (`src/test/fakeFs.ts`) | jsdom nem implementál FS Access API-t; saját fake pontosan modellezi a `move`/ütközés/`removeEntry` szemantikát (kis felület, 4-5 metódus). |

**Secure-context megkötés:** a File System Access API csak `https`/`localhost` alatt él, dupla-kattintásos `file://`-ról nem. A „statikus app" cél így is teljesül (`vite preview` vagy bármilyen statikus host). Ezt a README rögzíti.

## 3. Architektúra és mappastruktúra

Réteges, egyirányú adatfolyam: **tiszta domain (reducerek) → Zustand store (egyetlen tulajdonos) → React komponensek (stateless a domainre)**. Az FS és a perzisztencia I/O-rétege dependency-injection mögött van, hogy tesztben mockolható legyen.

```
src/
  main.tsx, App.tsx               # belépő + képernyő-routing (picker | sorting | done)
  domain/                         # TISZTA, I/O-mentes — itt él a logika magja
    types.ts                      # kanonikus típusok (lásd 4.)
    keymap.ts                     # classifyKey(KeyEvent) → KeyAction
    reducer.ts                    # applyKey / placeCurrent / undo / redo (tiszta)
    buckets.ts                    # buckets derivált selector a decisions+history-ből
    ordering.ts                   # lastModified ASC, tie-break fileName
  fs/
    gateway.ts                    # FileSystemGateway interfész + valós impl (showDirectoryPicker)
    scan.ts                       # readFolder(gateway) → MediaItem[] (szűrés + rendezés)
    organize.ts                   # runSort / moveFile / resolveCollisionName / ensureBucketDir
  store/
    useSortStore.ts               # Zustand store (a position/decisions/history TULAJDONOSA)
    persist.ts                    # storageKey / save / load / hasSession / clear / reconcile
  components/
    FolderPicker.tsx  CardStack.tsx  MediaCard.tsx  ProgressBadge.tsx
    BasketBar.tsx     ControlButtons.tsx  DoneScreen.tsx
  hooks/
    useKeyboard.ts                # global keydown → store action dispatch
    useMediaWindow.ts             # ablakos objectURL cache (revoke ablakon kívül)
  test/
    fakeFs.ts  setup.ts
```

**Tulajdonjog (single source of truth):** a Zustand store birtokolja a `position`-t, a `decisions`-t és a teljes `history`-t. A `buckets` **derivált** (a `decisions` + besorolási sorrendből számolt), nem külön tárolt forrás. A CardView és a reducer stateless ezekre.

## 4. Kanonikus adatmodell

> Ez a konszolidált, ellentmondás-mentes modell — minden alrendszer EZT követi. Stabil kulcs mindenhol a **`fileName`** (folder-scoped fájlnév, nem path, nincs külön `id`).

```ts
// Kulcs-tér
type BucketKey = string;            // 'a'..'z' | '0'..'9' | 'delete'
const DELETE_BUCKET: BucketKey = 'delete';   // belső id
const DELETE_DISPLAY = 'törlés';             // UI-felirat
const TRASH_DIR = '_torolt';                 // lemezre írt mappanév (spec 4.3!)

type MediaKind = 'image' | 'video';

interface MediaItem {
  fileName: string;                 // teljes név kiterjesztéssel — STABIL KULCS
  kind: MediaKind;
  handle: FileSystemFileHandle;     // a File lazy: handle.getFile(); handle kell a Rendezéshez
  lastModified: number;             // ms epoch — rendezési kulcs
  size: number;
}

// keep (jobbra nyíl) → NINCS Decision (besorolatlan == helyben marad)
interface Decision { fileName: string; bucket: BucketKey; }

// Derivált, nem perzisztált forrásként
interface Bucket {
  key: BucketKey;
  kind: 'normal' | 'delete';
  members: string[];                // fileName-ek besorolási sorrendben
  thumbnail: string | null;         // === members[0] (DERIVÁLT)
}

// Egységes undo/redo bejegyzés. keep IS bejegyzés (undo-zhatóság), de nextBucket=null.
interface HistoryEntry {
  fileName: string;
  position: number;                 // a sorbeli pozíció, ahonnan a döntés történt
  prevBucket: BucketKey | null;     // korábbi döntés (keep/besorolatlan = null)
  nextBucket: BucketKey | null;     // új döntés (keep = null)
}

// Runtime AppState — a store a tulajdonos
interface AppState {
  folderName: string;
  items: MediaItem[];               // lastModified ASC, tie-break fileName
  position: number;                 // === items.length → KÉSZ
  decisions: Record<string, Decision>;
  history: HistoryEntry[];
  historyCursor: number;            // redo lehetséges, ha historyCursor < history.length
}

// Perzisztált shape (handle/objectURL/buckets SOHA)
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

**Konfliktus-feloldások (a cross-check critic alapján):**
- Stabil id = **`fileName`** (nem `id`/`fileId`/`filename`).
- Törlés-kosár belső id = **`'delete'`**; UI-felirat **`törlés`**; lemezre írt mappanév **`_torolt`** (spec 4.3 explicit — itt a critic javaslatát felülírom, a spec nyer).
- Undo modell = **egy `history` tömb + `historyCursor`** (nem két külön stack); a reducer ezt használja.
- Pozíció neve mindenhol **`position`**.
- Kanonikus sorrend = **`lastModified` ASC, tie-break `fileName`** — a perzisztált `position` is erre épül (NEM névsorra), hogy reload után stabil legyen.
- `thumbnail` = derivált `members[0]`, sehol nem tárolt forrás.
- A `SortPlan`-t (Rendezés bemenete) a store-ból **derivált selector** építi (`buildSortPlan(state)`), `Map<BucketKey, FileSystemFileHandle[]>`.

## 5. Állapotautomata

**Képernyő-szint (App routing):**

```
PICKER ──pickDirectory→ (permission) ──ready(items≥1)──→ SORTING ──Rendezés gomb──→ DONE
  ▲  └─ aborted / permission-denied / empty / unsupported → marad PICKER (üzenettel)
  └──────────────────────── Reset (4.4) ────────────────────────────────────────────┘
SORTING ──Rendezés gomb (bármikor)──→ (runSort) ──siker──→ eredmény-visszajelzés + munkamenet törlés
```

**Rendezés közbeni (SORTING) belső állapot:** `position` 0..N. `position === items.length` → a CardStack a **„Kész" nézetet** (nagy Rendezés gomb) rendereli, de a Rendezés gomb a fejlécben **végig elérhető** (4.3: bármikor indítható). Animáció közben input-lock (kivéve Esc).

**Rendezés (organize) fázis:** `idle → sorting (gombok tiltva) → done(MoveResult) | partial(failed>0)`. Siker (`failed===0`) után localStorage-munkamenet törlés. A művelet **után** az app az eredmény-képernyőn marad (visszajelzés: „X áthelyezve, Y törölve[, Z sikertelen]"), ahonnan egy **„Vissza a mappaválasztóhoz"** gomb (lényegében Reset) visz a PICKER-re.

**Esc-szemantika:** mivel a `placeCurrent` a billentyűre **azonnal** kommitál (domain state-változás), az animáció pusztán prezentáció — az `Esc` ezért csak a futó vizuális exit-animációt vágja le, a már megtörtént döntést **nem** vonja vissza (arra az Undo való). Ha nincs futó animáció, az `Esc` no-op.

## 6. Billentyű → művelet kontraktus (az app magja)

`classifyKey(e: KeyEvent): KeyAction` — tiszta, mellékhatásmentes. `KeyEvent = { key, ctrlKey, shiftKey, metaKey }` (a `key` a `KeyboardEvent.key`). A `metaKey` (macOS Cmd) ctrl-ekvivalens az undo/redo-nál.

**Kiértékelési sorrend (a fenntartott kombók MEGELŐZIK a betű-ágat):**
1. `Ctrl/Cmd+Z` (Shift nélkül) → `undo`
2. `Ctrl/Cmd+Y` **vagy** `Ctrl/Cmd+Shift+Z` → `redo`
3. `Space` → `space` (UI: videó toggle; domain no-op)
4. `Escape` → `esc` (UI: anim megszakítás; domain no-op)
5. `ArrowRight` → `keep`
6. `ArrowLeft` → `delete`
7. egyébként `key.toLowerCase()` ∈ `a–z` → `bucket('<betű>')`; ∈ `0–9` → `bucket('<szám>')`
8. minden más (`/ \ : * ? < > |`, `.`, `Tab`, `Enter`, `F1`, `Alt+a`, stb.) → `noop`

**Igazságtábla (sikerkritérium):**

| KeyEvent | KeyAction |
|---|---|
| `a` / `A` / `Shift+A` | `bucket('a')` |
| `0`..`9` | `bucket('<szám>')` |
| `ArrowRight` | `keep` |
| `ArrowLeft` | `delete` |
| `Ctrl+Z` / `Cmd+Z` | `undo` |
| `Ctrl+Y` / `Ctrl+Shift+Z` | `redo` |
| `z` (Ctrl nélkül) | `bucket('z')` |
| `Space` | `space` (domain no-op) |
| `Escape` | `esc` (domain no-op) |
| `/ \ : * ? < > \|`, `.`, `Tab`, `Enter`, `F1`, `Alt+a` | `noop` |
| bármely döntés `position===items.length`-nél | `noop` *(applyKey-szint, NEM classifyKey — a classifyKey nem ismeri a position-t)* |
| undo/redo üres láncon | `noop` *(applyKey-szint, NEM classifyKey)* |

`applyKey(state, e)` orchestrálja: `classifyKey` → ág szerint `placeCurrent(state, target)` (döntés + `position++` + history push + redo-ág vágás), `undo`, `redo`, vagy identitás (`space`/`esc`/`noop`). Case-insensitive: `'A'` és `'a'` ugyanaz a `'a'` kosár; a kosárnév mindig kisbetűs.

## 7. Undo / Redo

A `history` + `historyCursor` modell fölött:
- **placeCurrent:** `history = history.slice(0, historyCursor)` (redo-ág vágás) majd push; `historyCursor++`; `position++`.
- **undo** (`historyCursor > 0`): `entry = history[historyCursor-1]`; a képet visszaállítja `prevBucket`-re (vagy kiveszi a kosárból, ha `null`); `position = entry.position`; `historyCursor--`. Ha az érintett kosár kiürül → a `Bucket` eltűnik (derivált, automatikus).
- **redo** (`historyCursor < history.length`): `entry = history[historyCursor]`; `nextBucket`-re állít; `position = entry.position + 1`; `historyCursor++`.
- **`keep` undo-zható** (history-bejegyzés `nextBucket=null`), de kosarat nem érint.
- A `thumbnail` mindig `members[0]` — undo után automatikusan helyes (derivált), nincs külön `wasFirstInBucket` mező.

**Lánc-sikerkritérium:** 3 besorolás → 2 undo → 1 redo → 1 új művelet → redo no-op; végén `historyCursor === history.length`, a redo-ág levágva.

## 8. FS-műveletek kontraktja

**Gateway (mockolható):**
```ts
interface FileSystemGateway {
  isSupported(): boolean;
  pickDirectory(): Promise<FileSystemDirectoryHandle>;       // throws AbortError
  ensureWritePermission(dir: FileSystemDirectoryHandle): Promise<boolean>;
}
```

**Olvasás (`scan.ts`):**
```ts
const IMAGE_EXT = ['jpg','jpeg','png','gif','webp','avif','bmp','svg','heic'];
const VIDEO_EXT = ['mp4','webm','ogg','ogv','mov'];
classifyByExtension(name): MediaKind | null;                 // utolsó '.' utáni szegmens, lowercase
readFolder(gateway): Promise<ReadFolderResult>;             // dir.values() → szűr → lastModified ASC
// ReadFolderResult = { folderName, items, skippedCount }
// Hibák: { type: 'aborted' | 'permission-denied' | 'empty' | 'unsupported-browser' }
```
- Almappák (`kind==='directory'`) kihagyva — a korábbi Rendezés generálta `1/`,`a/`,`_torolt/` is automatikusan (spec 7. re-run).
- Üres / csupa-nem-média → `empty` (3.1 üzenet), picker-en marad.
- Az írási engedélyt **már az olvasásnál** elkérjük (spec 2. Technológiai keretek — „a felhasználónak … írási engedélyt kell adnia a mappára"), hogy a Rendezés ne akadjon el.

**Írás / Rendezés (`organize.ts`):**
```ts
resolveCollisionName(destDir, name): Promise<string>;       // 'kep.jpg' → 'kep (1).jpg' → 'kep (2).jpg'
ensureBucketDir(root, bucketKey): Promise<DirHandle>;       // getDirectoryHandle({create:true}), újrafelhasznál
moveFile(src, root, destDir, name): Promise<{finalName}>;   // ütközés-feloldás → write → delete (root kell a forrás removeEntry-hez)
runSort(root, plan, onProgress?): Promise<MoveResult>;      // MoveResult = {moved, deleted, failed[]}
```
- **moveFile sorrend: write → delete** (nem fordítva) — félbeszakadásnál a forrás sosem vész el. Natív gyors-út: ha `src.move` létezik, azt használja; különben `createWritable` + `getFile` blob-másolás + `root.removeEntry(src.name)`.
- **ensureBucketDir:** normal kosár → `key` nevű mappa; `delete` kosár → **`_torolt`** mappa.
- **Ütközés:** ha a célnévre `getFileHandle` nem dob `NotFoundError`-t → foglalt → `base (n).ext` inkrementál (ext nélkül `name (n)`).
- **Hibatűrő batch:** egy fájl bukása `failed[]`-be gyűlik, a futás megy tovább; a végén `"X áthelyezve, Y törölve[, Z sikertelen]"`.
- A **megtartott (keep) és besorolatlan** képek nincsenek a `SortPlan`-ban → helyben maradnak.

## 9. Folder-scoped localStorage perzisztencia

- **Kulcs:** `picsort:v1:session:<folderName>`. Mappánként egy verziózott JSON; külön mappa → külön kulcs, nincs felülírás.
- **Mentés:** minden döntés/undo/redo után, **debounce 150ms**. Mentett: `decisions`, `history`, `historyCursor`, `position`. NEM mentett: képtartalom, handle, `buckets` (derivált).
- **Visszatöltés:** picker-en a mappa kiválasztása után `hasSession` → badge. Újraválasztás → `loadSession` + `reconcile(persisted, currentFileNames)`:
  1. `decisions` szűrése a jelen fájlnevekre; hiányzók → `droppedFiles` (átnevezett/törölt döntése elveszik).
  2. `history` purge a droppedFiles-re hivatkozó bejegyzésekre (sorrendtartó). A `historyCursor` korrekciója **konkrétan:** `historyCursor_új = historyCursor_régi − (a kurzor ELŐTT álló, purge-ölt bejegyzések száma)`, majd `clamp(0, history_új.length)`. (NEM arány-skálázás — a kurzor egy konkrét bejegyzés-határt jelöl.)
  3. Új (sosem látott) fájlok → besorolatlan, a kanonikus (`lastModified` ASC) sor **természetes helyükön** (nem külön „végére fűzve", mert a sorrend a fájl `lastModified`-jából adódik — a critic „végére" javaslatát itt a `lastModified`-rendezés váltja ki, konzisztensen a 4. ponttal).
  4. **`HistoryEntry.position` újraszámolás:** a megmaradt history-bejegyzések `position` mezője a *régi* sor-indexre mutat; a reconcile az `items` aktuális `fileName→index` leképezésével **újraszámolja** mindegyiket (a droppedFiles és az új fájlok eltolják az indexeket). Enélkül reload után a redo rossz pozícióra ugrana (silent hiba — a 11.3 perzisztencia-teszt a `position`-t is asszertálja).
  5. `position = min(persisted.position, items.length)`.
- **Törlés:** Reset (4.4) és **sikeres** Rendezés után `clearSession` (csak az aktuális ág).
- **Best-effort:** parse/verzió-hiba → friss munkamenet (nincs crash); `QuotaExceededError` → konzol-warn, memóriában megy tovább.

## 10. Edge case-ek (összesítő)

- **Picker abort** → némán vissza a pickerhez, nincs hibaüzenet.
- **Írási engedély megtagadva** → „Írási engedély szükséges", nem lép tovább.
- **Nem-Chromium böngésző** (`!('showDirectoryPicker' in window)`) → blokkoló üzenet a pickeren.
- **`lastModified` egyenlő** → stabil tie-break `fileName` (reprodukálható pozíció).
- **Animáció közbeni billentyű** → input-lock, max egy dobás (Esc kivétel: megszakít, döntés nem kommitál).
- **Videó autoplay-blokk** (muted ellenére) → `.catch` némán, Space-re újrapróbál.
- **objectURL** → ablakos cache (default 5 előre / 2 hátra), ablakon kívül `revokeObjectURL`, unmountkor mind revoke — több száz elemnél nem szivárog.
- **moveFile write-hiba** → eredeti megmarad, `failed[]`-be kerül, nem törlünk.
- **Ext nélküli / dot-fájl** (`README`, `.gitignore`) → ext-detektálás csak utolsó pontnál, vezető pont nem szeparátor.
- **Azonos nevű külön mappa** → ugyanaz a localStorage-ág ütközhet (spec elfogadja); a fájlnév-párosítás kiszűri az idegen képeket.
- **Nagy videó + nincs natív `move`** → a `createWritable` blob-copy fallback a teljes fájlt memóriába olvassa → memória-csúcs. Elfogadott MVP-korlát (spec 7.); a `runSort` **szekvenciálisan** dolgozza a fájlokat (nem párhuzamosan), így a csúcs egy fájlra korlátozódik.

## 11. Sikerkritériumok (verifikálható)

A teljes lista a [plan](../plans/2026-06-17-keprendezo-plan.md) TDD-szekciójában modulonként. Kiemelt, tesztelendő invariánsok:

1. **Billentyű→kosár leképezés** a 6. szakasz igazságtáblája szerint (case-insensitive, a–z/0–9, érvénytelen → no-op, `position===len` → no-op).
2. **Undo/redo lánc:** 3 besorolás → 2 undo → 1 redo → 1 új művelet → redo no-op; kosár utolsó elemének undo-ja → kosár eltűnik, redo újra létrehozza.
3. **Folder-scoped localStorage** round-trip: döntés → reload → ugyanaz a mappa → kosarak+pozíció+history visszaáll; két különböző nevű mappa nem írja felül egymást; törölt fájl döntése `droppedFiles`-be esik, nincs crash.
4. **Rendezés ütközéskezelés:** meglévő mappa újrafelhasználva (nincs `kep (1)/` mappa-duplikátum); fájlnév-ütközés → `name (n).ext`; `_torolt` mappa a delete-kosárnak; megtartott/besorolatlan kép a root-ban marad; write→delete sorrend.
5. **scan:** csak támogatott ext, almappa sosem `items`-ben, `lastModified` ASC tie-break név, üres mappa → `empty`.
6. **Build:** `tsc --noEmit` 0 hiba, `vite build` zöld, `dist/` relatív úttal.

## 12. Döntések / feltételezések

A spec hézagjainál hozott senior default-ok (kérdés nélkül rögzítve):

1. **Stack:** Vite + TS + React 19 + Zustand 5 + Framer Motion + CSS Modules + Vitest. Minimalista, spec-fedett, nincs router/Tailwind/extra lib.
2. **FS gateway DI + kézi in-memory fake** a teszthez (npm-mock helyett) — kis felület, pontos `move`/ütközés-szemantika.
3. **Törlés-mappa neve `_torolt`** (spec 4.3 explicit), belső kulcs `delete`, UI-felirat `törlés` — szándékos divergencia, dokumentálva.
4. **Írási engedély az olvasáskor** kérve (spec 2. Technológiai keretek — „írási engedélyt kell adnia a mappára"), nem a Rendezésnél.
5. **Kanonikus sorrend `lastModified` ASC, tie-break `fileName`** — a perzisztált `position` is erre épül (nem névsorra).
6. **`keep` (jobbra nyíl) nem perzisztál** Decision-ként (besorolatlan == nincs döntés), de **van** history-bejegyzése az undo-zhatóságért.
7. **`buckets` és `thumbnail` derivált** — egyetlen forrás a `decisions` + besorolási sorrend; nincs külön tárolt thumbnail/`wasFirstInBucket`.
8. **moveFile write→delete sorrend**, hibatűrő batch (egy fájl bukása nem állítja le a Rendezést).
9. **objectURL ablakos cache** (5/2) — a spec 7. „lazy-load" kérdését az MVP-ben ennyivel fedjük, nem építünk konfigurálható előtöltést.
10. **Pesszimista flow a Rendezésnél** (irreverzibilis fájlművelet, server-konfirmáció helyett lemez-konfirmáció) — összhangban a globális Optimistic-UI szabály kivételeivel; a kattintás az „elköteleződés", a visszajelzés a művelet végén jön.
11. **`metaKey` (Cmd) == `ctrlKey`** az undo/redo-nál — macOS-kompat, bár a spec Ctrl-t ír.
12. **Secure-context:** README rögzíti, hogy `vite preview`/host kell (nem `file://` dupla-katt).
