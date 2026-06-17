# Képrendező

Lokálisan, böngészőben futó webalkalmazás képek és videók **villámgyors, billentyűzet-vezérelt rendszerezésére**. Kiválasztasz egy mappát, az app Tinder-szerűen egyesével feldobja a benne lévő médiát, te billentyűkkel kosarakba sorolod, a végén pedig egyetlen kattintással **valódi fájlműveletekkel** almappákba rendezi őket.

A teljes folyamat a böngészőben, **szerver és adatbázis nélkül** zajlik a [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) segítségével.

## Tartalomjegyzék

1. [Funkciók](#funkciók)
2. [Böngésző-követelmény](#böngésző-követelmény)
3. [Telepítés és futtatás](#telepítés-és-futtatás)
4. [Használat](#használat)
5. [Billentyűk](#billentyűk)
6. [Hogyan rendez (fájlműveletek)](#hogyan-rendez-fájlműveletek)
7. [Munkamenet-mentés](#munkamenet-mentés)
8. [npm scriptek](#npm-scriptek)
9. [Architektúra](#architektúra)

## Funkciók

- **Tinder-nézet:** egyszerre egy elem nagyban, finom „eldobás"-animációval, haladásjelzővel (`37 / 240`).
- **Kép és videó:** a videók némítva, ismétlődő (loop) előnézettel, automatikusan indulnak; `Space`-szel play/pause.
- **Dinamikus kosarak:** bármelyik betű/szám billentyű kosarat hoz létre (max. 36 + „törlés").
- **Undo / Redo:** korlátlan lépés visszavonható és újra megismételhető.
- **Folder-scoped munkamenet-mentés:** a döntéseid a böngésző `localStorage`-ába mentődnek, mappánként külön; legközelebb folytathatod onnan, ahol abbahagytad.
- **Valódi rendezés:** a „Rendezés" gomb almappákba mozgatja a fájlokat ütközéskezeléssel.

## Böngésző-követelmény

- **Csak Chromium-alapú böngésző** (Chrome / Edge) — a File System Access API miatt. Firefox / Safari nem támogatott.
- **Biztonságos kontextus kell:** az API csak `https`-en vagy `localhost`-on él. A `dist/index.html` dupla-kattintással (`file://`) **nem** fog működni — futtasd helyi szerverről (`npm run dev` vagy `npm run preview`), illetve élesben `https`-host alól.
- A mappa kiválasztásakor a böngésző **írási engedélyt** kér — ezt meg kell adni, mert az app valódi fájlokat mozgat.

## Telepítés és futtatás

```bash
npm install        # függőségek telepítése
npm run dev        # fejlesztői szerver (Vite) → http://localhost:5173
```

Éles build és helyi kipróbálás:

```bash
npm run build      # típusellenőrzés + production build a dist/-be
npm run preview    # a dist/ kiszolgálása localhost-ról (secure context)
```

## Használat

1. Indításkor egyetlen képernyő: **„Mappa kiválasztása"**. Kattints rá, és válassz egy mappát (adj írási engedélyt).
2. Az app beolvassa a mappa megjeleníthető képeit/videóit (almappákat kihagyja), és `lastModified` szerint **növekvő** sorrendben feldobja őket.
3. Billentyűkkel kosarazol (lásd lent). A kosarak a képernyő tetején sorakoznak (név + bélyegkép + darabszám; a „törlés" kosár pirossal elkülönül).
4. A pakli végén megjelenik a **„Kész"** képernyő a nagy **„Rendezés"** gombbal. A Rendezés a fejlécből **bármikor** korábban is elindítható.
5. A Rendezés után megjelenik az eredmény (pl. „3 kép áthelyezve, 1 törölve"), innen visszatérhetsz a mappaválasztóhoz.

Ha ugyanazt a mappát választod, amelyhez van mentett munkamenet, a mappaválasztó **felajánlja a folytatást** (Folytatás / Újrakezdés).

## Billentyűk

| Billentyű | Művelet |
|---|---|
| **Betű (`a`–`z`) vagy szám (`0`–`9`)** | A kép a billentyű nevével azonos kosárba kerül (létrejön, ha kell). Kis-/nagybetű mindegy. |
| **Jobbra nyíl (→)** | A kép **marad a helyén** (nem kerül kosárba, a rendezéskor sem mozdul). |
| **Balra nyíl (←)** | A kép a **„törlés"** kosárba kerül. |
| **`Space`** | A fent lévő videó lejátszása / szüneteltetése. |
| **`Ctrl+Z`** | Undo (visszavonás). |
| **`Ctrl+Y`** vagy **`Ctrl+Shift+Z`** | Redo (újra). |
| **`Esc`** | Az aktuális animáció megszakítása. |

> Az érvénytelen fájlnév-karakterek (`/ \ : * ? < > |` stb.) és minden más billentyű **nem csinál semmit** — így sosem keletkezik érvénytelen nevű kosár. A **Rendezésnek nincs** billentyű-gyorsindítása (hogy véletlen lenyomás ne mozgasson fájlokat).

## Hogyan rendez (fájlműveletek)

A „Rendezés" gomb a kiválasztott mappán belül:

- **Minden nem-„törlés" kosárhoz** létrehoz egy almappát a kosár nevével (`a/`, `1/`, …), és átmozgatja bele a képeit.
- A **„törlés" kosár** képeit egy **`_torolt`** nevű almappába mozgatja (innen manuálisan törölheted — nem az OS kukájába kerül).
- A **jobbra nyíllal megtartott** és a **még be nem sorolt** képek **a helyükön maradnak**.
- **Ütközéskezelés:** ha egy almappa már létezik, újrafelhasználja; ha egy fájlnév ütközik a célmappában, sorszámoz (`kep.jpg` → `kep (1).jpg`).
- A mozgatás **biztonságos** (előbb másol/ír, csak utána törli az eredetit); egy fájl hibája nem állítja le a többit, a végén jelzi a sikertelenek számát.

## Munkamenet-mentés

- Minden döntésnél mentődik a kosár-állapot, a döntések, az undo/redo előzmény és a pozíció — **mappánként külön** kulcson (`picsort:v1:session:<mappanév>`).
- **A képtartalom soha nem mentődik**, csak a fájlnevekhez kötött döntések. A visszatöltés fájlnév alapján párosít.
- Ha egy fájlt időközben átneveztek/töröltek, a hozzá tartozó döntés elveszik; új fájlok besorolatlanként jelennek meg.
- A **sikeres Rendezés** és az **Újrakezdés (Reset)** törli az adott mappa mentett munkamenetét.

> Megjegyzés: a mappa azonosítása a **neve** alapján történik (a böngésző biztonsági okból nem ad stabil teljes elérési utat). Két azonos nevű, de fizikailag különböző mappa ugyanazt a munkamenet-ágat használhatja; a fájlnév-párosítás ezt tovább szűri.

## npm scriptek

| Script | Mit csinál |
|---|---|
| `npm run dev` | Vite fejlesztői szerver HMR-rel (`http://localhost:5173`). |
| `npm run build` | `tsc --noEmit` típusellenőrzés **és** production build a `dist/`-be (relatív útvonalakkal). |
| `npm run preview` | A buildelt `dist/` kiszolgálása helyi szerverről (a File System Access API-hoz kellő secure context). |
| `npm test` | A teljes Vitest teszt-suite egyszeri lefuttatása. |
| `npm run test:watch` | Vitest watch módban. |
| `npm run typecheck` | Csak típusellenőrzés (`tsc --noEmit`). |

## Architektúra

Réteges, egyirányú adatfolyam — **tiszta domain → Zustand store → React komponensek**; az I/O (FS, localStorage) dependency-injection mögött, így tesztelhető.

```
src/
  domain/      types.ts (kanonikus modell), keymap, reducer (undo/redo), buckets, ordering — tiszta, I/O-mentes
  fs/          gateway (File System Access wrap), scan (mappaolvasás+szűrés), organize (fájlmozgatás+ütközés)
  store/       useSortStore (Zustand), persist (folder-scoped localStorage + reconcile)
  components/  FolderPicker, BasketBar, ProgressBadge, MediaCard, CardStack, ControlButtons, DoneScreen, ResultScreen
  hooks/       useKeyboard (globális billentyűk), useMediaWindow (ablakos objectURL cache)
  test/        fakeFs (in-memory File System Access fake), setup
```

**Stack:** Vite · TypeScript · React 19 · Zustand 5 · Framer Motion · CSS Modules · Vitest + Testing Library.

A részletes tervdokumentumok:
- **Követelmény-spec:** [docs/keprendezo-specifikacio.md](docs/keprendezo-specifikacio.md)
- **Design / architektúra:** [docs/superpowers/specs/2026-06-17-keprendezo-design.md](docs/superpowers/specs/2026-06-17-keprendezo-design.md)
- **Implementációs terv:** [docs/superpowers/plans/2026-06-17-keprendezo-plan.md](docs/superpowers/plans/2026-06-17-keprendezo-plan.md)
