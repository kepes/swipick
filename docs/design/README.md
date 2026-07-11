# Handoff: Swipick — "Playroom" UI redesign

## Overview

Teljes vizuális redesign a Swipick apphoz (böngészőben futó, billentyűzet-vezérelt kép/videó-rendező, Tinder-stílusú sorting). A design a meglévő funkcionalitást nem változtatja — a `ui-design-brief.md`-ben leírt képernyőkre ad új vizuális nyelvet, light + dark témával.

A kiválasztott irány: **"Playroom"** — világos, játékos, chunky 2px-es kontúrok, offszet ("hard") árnyékok, 3D keycap-ek, hangsúlyos dock-nagyítás, Sora betűtípus, meleg korall accent.

## About the Design Files

A csomagban lévő fájlok **HTML-ben készült design-referenciák** — a szándékolt kinézetet és viselkedést mutató prototípusok, nem közvetlenül átemelendő production kód. A feladat: **ezeket a designokat a cél-kódbázis meglévő környezetében újraépíteni** (a Swipick React + Framer Motion stackjében), annak bevett mintáival.

- `Swipick Prototype.dc.html` — **interaktív prototípus**: a teljes flow működik (billentyűzet, dock-nagyítás, undo/redo, overlay, light/dark toggle). Ez az elsődleges referencia a viselkedésre és időzítésekre.
- `Swipick Options.dc.html` — statikus képernyőtervek (a `t2` szekció a végleges irány; a `t1` a korai exploráció, informatív csak).
- `ui-design-brief.md` — az eredeti funkcionális brief (mit kell megtartani).

A `.dc.html` fájlok böngészőben megnyithatók; a releváns markup a `<x-dc>` blokkon belül van, minden stílus inline.

## Fidelity

**High-fidelity.** Színek, tipográfia, méretek, lekerekítések, árnyékok véglegesek — pixelhűen újraépítendő a kódbázis meglévő komponens-mintáival (a Framer Motion animációk paraméterei az Interactions szekcióban).

## Design Tokens

CSS-változóként érdemes felvenni; a téma-toggle ezeket cseréli.

| Token | Light | Dark |
|---|---|---|
| `--bg` (app háttér) | `#f4efe8` | `#171310` |
| `--card` (felület) | `#fffdf9` | `#262019` |
| `--ink` (kontúr + erős szöveg) | `#1f1a14` | `#f4efe8` |
| `--text` | `#1f1a14` | `#f4efe8` |
| `--dim` (másodlagos) | `#8a7c6b` | `#9a8d7c` |
| `--accent` | `#ff6b3d` | `#ff6b3d` (változatlan) |
| `--danger` | `#d63b1f` | `#ff7d5e` |
| `--danger-bg` | `#ffe9e2` | `#301a13` |
| success (Result ✓) | `#2f9e6e` | `#2f9e6e` |

**Tipográfia:** Sora (Google Fonts), súlyok: 400/500/600/700/800. Fájlnevek/technikai szöveg: `ui-monospace, Menlo, monospace`. Számlálók mindenhol `font-variant-numeric: tabular-nums`.

**Formanyelv:**
- Kontúr: `2px solid var(--ink)` szinte minden elemen (danger elemeken `var(--danger)`).
- "Chunky" gomb: a fenti kontúr + `border-bottom-width: 5px` (nagy gombnál 6–7px). Active állapotban: `translateY(3px)` + `border-bottom-width: 2px` (lenyomódás-effekt).
- Hard offszet árnyék paneleken: `box-shadow: 0 6px 0 var(--ink)` (danger panelen `var(--danger)`).
- Rádiuszok: panel/dock 20px, gomb 13–17px, thumbnail 12–14px, keycap 7–8px, chip/pill 99px.
- Keycap: `min-width/height 24px`, card háttér, 2px ink kontúr + 4px alsó él, 7px rádiusz, 700-as súly.

**Spacing:** overlay-elemek 12–18px-re a viewport szélétől; gombok között 10px gap; dock belső padding 12px 16px, elemek között 12px gap.

## Screens / Views

### 1. Start (folder picker)
Középre zárt oszlop üres `--bg` háttéren.
- Két dekoratív, döntött (−8° / +7°) "fotó"-kártya a wordmark mögött/mellett (64×84px, 14px rádiusz, ink kontúr).
- **Wordmark:** "Swipick" + korall pont — Sora 800, 52px, `letter-spacing: -0.02em`.
- **Alcím:** "Pick a folder and sort your images with the keyboard." — 15px/500, `--dim`, max 420px.
- **Primary gomb:** "Choose folder" — accent háttér, fehér szöveg, 16px/800, padding 14px 34px, 15px rádiusz, 6px alsó él.
- **Billentyű-legenda** (44px-szel lejjebb): három elem keycap + felirat párral: `A–Z` bucket · `→` keep · `←` delete (a ← keycap danger-stílusú).

**Resume variáns:** a gomb helyén kártya (max 520px, `--card`, ink kontúr, 20px rádiusz, `0 6px 0` árnyék): szöveg a mappanévvel/db-számmal félkövéren, alatta "Resume" (accent) + "Start over" (outlined) gombok.

**Unsupported browser / error variáns:** danger-bg háttér, danger kontúr és szöveg, ugyanez a kártyaforma.

### 2. Sorting (fő képernyő)
A média a **teljes viewportot kitölti** (`inset: 0`, `object-fit: contain` — nem vág le semmit, letterboxol, ha az arány nem stimmel). Nincs keret/rádiusz/árnyék a médián; a header/footer/preview mind fölötte lebeg overlay-ként.

- **Bucket-dock (fent középen):** egy `--card` panel a létrehozott bucketekkel + külön danger-panel a delete bucketnek (mindig a sor végén, jobbra). Panel: 20px rádiusz, ink/danger kontúr, `0 6px 0` hard árnyék. Egy bucket-chip oszlop: thumbnail (44×44px alap, 12px rádiusz, ink kontúr) → keycap a betűvel → számláló (11px/600, `--dim`; delete-nél danger szín). Ha nincs még bucket: szaggatott kontúrú hint-pill: "Press any letter to create a bucket".
- **Dock-nagyítás:** hover-re a chip thumbnailje 44px → 84px (csúcs), a szomszédok ~60px; átmenet `0.18s cubic-bezier(.34,1.56,.64,1)` (rugós túllövés), a sor aljához igazítva (felfelé nő). Hoverelt chip keycapje accent hátterű, thumbnailje lágy árnyékot kap. Kattintás = sorolás abba a bucketbe.
- **Progress badge (jobb felül):** ink hátterű pill, `--bg` színű szöveg: "37 / 240" (az elválasztó rész `--dim`).
- **Next-up preview (bal alul):** következő 2 elem, magasság **20vh** (szélesség az arány szerint), jobbra a közelebbi (+2° döntés), balra a távolabbi (−4°). 14px rádiusz, ink kontúr, `0 8px 0 rgba(31,26,20,.15)` árnyék.
- **Footer (lent középen):** fájlnév-pill (monospace 11px, `--card`, ink kontúr, max-width + ellipsis), alatta gombsor: "◀ Undo" (+ `↓` mini-keycap), "Redo" (+ `↑`), **"Sort"** (accent, 800-as súly — szándékosan nincs billentyűje), "Start over" (transparent, danger kontúr/szöveg). Disabled gombok: `opacity: 0.45`.
- **Videó-jelzés:** a kártya jobb felső sarkában sötét pill: "▶ video" (szünetnél ⏸).
- **Téma-toggle (jobb alul):** 42×42px chunky gomb, 🌙/☀️.

### 3. End-of-deck (done state)
A sorting képernyőn belül, a kártya helyén középre zárva: 🎉 (44px) → "You've reviewed everything" (Sora 800, 28px) → nagy **Sort** gomb (19px/800, padding 16px 52px, 17px rádiusz, 7px alsó él) → alatta figyelmeztető sor: "{N} decisions · this will move the files for real" (12px, `--dim`). A header/footer chrome maradhat, halványítva (`opacity: .55`).

### 4. Sorting progress overlay
Teljes képernyős dim: `rgba(31,26,20,.55)`. Középen kártya (`--card`, ink kontúr, 20px rádiusz, `0 8px 0` árnyék, padding 32px 44px): spinner (40px gyűrű, 4px, `--danger-bg` alap + accent felső ív, 0.8s lineáris forgás) → "Sorting in progress — {done} / {total}" (14px/700) → progress-sáv (220×10px, ink kontúr, pill, accent kitöltés, width-transition 0.1s linear).

### 5. Result
Középre zárt oszlop: zöld ✓ badge (72×72px, `#2f9e6e`, ink kontúr, 6px alsó él, 22px rádiusz, −4° döntés, 34px fehér pipa) → "Done!" (Sora 800, 40px) → összegző sor: "**{N}** images moved, **{N}** deleted" (a számok félkövérek, a deleted szám danger színű) → "Back to folder picker" gomb (`--card`, outlined stílus). Hibalista (ha van): danger-bg kártya, "Failed files:" danger felirat, soronként félkövér fájlnév + hibaüzenet.

## Interactions & Behavior

- **Swipe-animáció (Framer Motion):** kilépés 240ms ease-out — jobbra: `translateX(130%) rotate(15°)`, balra: `translateX(-130%) rotate(-15°)`, felfelé (bucket): `translateY(-130%)`; opacity → 0. Belépés: `scale(0.96)` + opacity 0 → 1 (rövid, ~30ms delay után normál átmenettel). `Esc` megszakítja a folyamatban lévő kilépést.
- **Gomb-lenyomás:** minden chunky gombon active-ra `translateY(3px)` + alsó él 5px→2px.
- **Dock-nagyítás:** lásd fent; mouse-leave-re minden visszaáll 44px-re.
- **Téma-váltás:** háttér `transition: background .3s`; a választás localStorage-ben perzisztált.
- **Billentyűzet (változatlan a briefhez képest):** A–Z/0–9 bucket, → keep, ← delete, Space play/pause, Ctrl+Z/↓ undo, Ctrl+Y·Ctrl+Shift+Z/↑ redo, Esc animáció-megszakítás. A Sort-nak szándékosan nincs billentyűje.
- **Undo/Redo:** disabled állapot 0.45 opacityvel; undo/redo alatt nincs swipe-animáció (azonnali csere).

## State Management

A meglévő store változatlan. A designhoz szükséges plusz UI-state:
- `theme: 'light' | 'dark'` (localStorage-ben perzisztálva)
- `hoverIdx: number | null` — dock-nagyításhoz (melyik chip fölött van a kurzor)
- kártya-animáció fázis: `idle | out-right | out-left | out-up | enter`

## Assets

Nincs külső asset. Betűtípus: **Sora** (Google Fonts, 400–800). A prototípusban a média helyén csíkozott placeholderek állnak — a valós appban ezek a tényleges kép/videó elemek.

## Files

- `Swipick Prototype.dc.html` — interaktív prototípus (elsődleges viselkedési referencia)
- `Swipick Options.dc.html` — statikus képernyőtervek (t2 = végleges irány)
- `ui-design-brief.md` — eredeti funkcionális brief
