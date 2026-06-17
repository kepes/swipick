# Képrendező — Felhasználói igény specifikáció

## Tartalomjegyzék

1. [Áttekintés](#1-áttekintés)
2. [Technológiai keretek](#2-technológiai-keretek)
3. [Munkafolyamat](#3-munkafolyamat)
4. [Nem billentyűs funkciók (gombok)](#4-nem-billentyűs-funkciók-gombok)
5. [Megjelenés](#5-megjelenés)
6. [Korlátok és feltételezések](#6-korlátok-és-feltételezések)
7. [Nyitott / jövőbeli kérdések](#7-nyitott--jövőbeli-kérdések-nem-része-az-alap-mvp-nek)

## 1. Áttekintés

Lokálisan, böngészőben futó webes alkalmazás képek villámgyors rendszerezésére. A felhasználó kiválaszt egy mappát, az app Tinder-szerűen egyesével feldobja a benne lévő képeket, és billentyűkkel kosarakba sorolja őket. A rendezés végén az app valódi fájlműveletekkel mappákba rendezi a képeket.

**Fő cél:** több száz képet tartalmazó mappa gyors átnézése és kategorizálása, amikor nem minden képre van szükség.

## 2. Technológiai keretek

- **Frontend:** React, modern megjelenés.
- **Nincs szerver, nincs adatbázis.** Az app egyetlen, böngészőből megnyitható fájlként fut (statikus HTML/JS).
- **Fájlhozzáférés:** File System Access API. Emiatt az app **Chrome / Edge** böngészőt igényel (a Firefox/Safari nem támogatja az API-t teljes körűen).
- A felhasználónak a mappa kiválasztásakor **írási engedélyt** kell adnia a mappára, mert az app valódi fájlokat mozgat.
- Minden adat és művelet a memóriában él, az oldal frissítése elveti a folyamatban lévő munkamenetet.

## 3. Munkafolyamat

### 3.1 Indulás — mappaválasztó
- Indításkor egyetlen képernyő látható: egy „Mappa kiválasztása" gomb.
- Kattintásra a File System Access API mappaválasztója nyílik meg.
- Kiválasztás után az app beolvassa a mappa **minden olyan média típusú fájlját, amit a böngésző natívan meg tud jeleníteni** — konverzió nélkül. Ide tartoznak:
  - **Képek:** jpg, jpeg, png, gif, webp, avif, bmp, svg (és heic, ha az adott böngésző támogatja).
  - **Mozgóképek/videók:** mp4, webm, ogg/ogv, mov (amennyiben a böngésző le tudja játszani).
  - Az alapelv: ha a böngésző natívan meg tudja jeleníteni/lejátszani, akkor rendezhető. Az app nem futtat konverziót.
- A nem megjeleníthető vagy ismeretlen formátumú fájlokat az app kihagyja.
- Az almappákat figyelmen kívül hagyja (csak az adott szint képeit dolgozza fel).
- **Ha a mappában nincs egyetlen megjeleníthető média sem**, az app egyértelmű üzenetet ad (pl. „Ebben a mappában nincs megjeleníthető kép vagy videó"), és a mappaválasztó képernyőn marad — nem lép be a Tinder-nézetbe.

### 3.2 Sorrend
- A képek a **`lastModified` (módosítás dátuma) szerint növekvő sorrendben** jelennek meg (legrégebbi elöl). Ez közelíti a „mappába kerülés" időpontját.

### 3.3 Kép megjelenítése (Tinder-nézet)
- A képernyő közepén egyszerre egy elem (kép vagy videó) látható, nagy méretben.
- Videó esetén a lejátszó beágyazva jelenik meg: automatikus, **némított, ismétlődő (loop) előnézet**, hogy gyorsan dönthető legyen. A **`Space`** billentyű a fent lévő videót lejátssza/szünetelteti (lásd 3.4).
- Látszik valamilyen haladásjelző (pl. „37 / 240").
- A kép a billentyű lenyomásakor animációval „eldobódik" a megfelelő irányba/kosárba.

### 3.4 Billentyűvezérlés
A jelenleg fent lévő képre vonatkozik. **Csak a betű- (`a`–`z`) és szám- (`0`–`9`) billentyűk hoznak létre / töltenek kosarat.** Minden más billentyű vagy fenntartott funkció (lásd alább), vagy **figyelmen kívül marad (no-op)** — így fájlnévként érvénytelen karakterekből (`/ \ : * ? < > |` stb.) sosem keletkezik kosár.

**Kosár-billentyűk:**

| Billentyű | Művelet |
|---|---|
| **Jobbra nyíl (→)** | A kép **marad a helyén**. Nem kerül kosárba, a rendezéskor sem mozdul. |
| **Balra nyíl (←)** | A kép a **„törlés"** kosárba kerül. |
| **Betű vagy szám** (`a`–`z`, `0`–`9`) | A kép a megnyomott billentyű **nevével azonos kosárba** kerül. Ha a kosár még nem létezik, létrejön. |

- A betű-billentyűk **kis-/nagybetűtől függetlenek** (case-insensitive): az `a` és a `Shift+A` **ugyanaz a kosár**. A kosár (és így a mappa) neve mindig a **kisbetűs** alak (pl. `a/`).
- Tetszőleges számú kosár hozható létre, dinamikusan, a használt betű-/szám-billentyűk alapján (max. 36 lehetséges kosár: 26 betű + 10 szám, plusz a „törlés").

**Fenntartott billentyűk (NEM hoznak létre kosarat):**

| Billentyű | Funkció |
|---|---|
| **`Space`** | A fent lévő videó lejátszása / szüneteltetése. |
| **`Ctrl+Z`** | Undo (visszavonás) — lásd 4.1. |
| **`Ctrl+Y`** (vagy `Ctrl+Shift+Z`) | Redo (újra) — lásd 4.2. |
| **`Esc`** | Aktuális animáció / fókusz megszakítása. |

- A **Rendezés**nek **nincs** billentyű-gyorsindítása — kizárólag a képernyőn lévő gombra kattintással indul (lásd 4.3), hogy véletlen billentyű-lenyomás ne mozgasson fájlokat.

### 3.5 Kosarak megjelenítése
- A kosarak a **képernyő tetején**, vízszintesen sorakoznak.
- Minden kosárnál látszik:
  - a **neve** (maga a billentyű, illetve a „törlés" a balra nyílhoz),
  - egy **bélyegkép**: az adott kosárba elsőként betett kép,
  - opcionálisan a kosárban lévő képek darabszáma.
- A „törlés" kosár vizuálisan elkülönül (pl. piros jelölés).

### 3.6 „Kész" állapot (a pakli végén)
- Amikor az **utolsó** képet is besoroltad (elfogyott a sor), az app egy **egyértelmű jelzést** ad, hogy végignézted az összes elemet.
- Ezen a képernyőn egy **jól látható, nagy „Rendezés" gomb** található, amit megnyomva elindul a fájlmozgatás (lásd 4.3).
- A Rendezés ettől függetlenül **bármikor korábban is** elindítható (nem kötelező a pakli végéig eljutni) — lásd 4.3.

## 4. Nem billentyűs funkciók (gombok)

### 4.1 Undo (visszavonás)
- Gombbal **és** `Ctrl+Z` billentyűvel is elérhető.
- Az utolsó képbesorolást visszavonja: a kép visszakerül az aktuális pozícióba, kikerül a kosárból, és újra fent lesz.
- Több lépés visszavonható egymás után.

### 4.2 Redo (újra)
- Gombbal **és** `Ctrl+Y` (vagy `Ctrl+Shift+Z`) billentyűvel is elérhető.
- Egy visszavont műveletet megismétel.
- Új művelet elvégzése után a redo-lánc törlődik.

### 4.3 Rendezés (fő funkció — fájlműveletek)
- **Indítás:** kizárólag a képernyőn lévő **„Rendezés" gombra kattintással** (nincs billentyű-gyorsindítás, hogy véletlen lenyomás ne mozgasson fájlokat).
- **Külön megerősítő dialógus nincs** — a kattintás azonnal elindítja a fájlmozgatást; a visszajelzés a művelet végén jelenik meg. (A döntések a Rendezésig memóriában élnek és undo-zhatók, így a kattintás az „elköteleződés" pillanata.)

Kattintáskor az app a kiválasztott mappán belül:
- **Minden nem-„törlés" kosárhoz** létrehoz egy almappát a **kosár nevével** (pl. `1/`, `a/`), és átmozgatja bele a hozzá tartozó képeket.
- A **„törlés" kosár** képeit egy **`_torolt`** nevű almappába mozgatja (a kiválasztott mappán belül).
- A **jobbra nyíllal megtartott** képek **a helyükön maradnak**, semmilyen mappába nem kerülnek.
- A **még be nem sorolt (sorrendben hátralévő) képek a helyükön maradnak** — ugyanúgy, mint a megtartottak. A Rendezés bármikor megnyomható, nem kötelező végigérni az összes képen.
- A művelet végén az app visszajelzést ad (pl. „X kép áthelyezve, Y törölve").

**Megjegyzés:** névütközés esetén (ha már létezik ilyen nevű almappa vagy fájl) az appnak ütközéskezeléssel kell rendelkeznie (pl. meglévő mappa újrafelhasználása, fájlnév-ütközésnél sorszámozás).

### 4.4 Újrakezdés / Reset
- Eldobja az összes kosarat és minden eddigi műveletet (memóriából **és az aktuális mappa localStorage-ágából**). Más mappák mentett munkamenetét nem érinti.
- Visszatér a kiindulási **mappaválasztó** képernyőre.
- **Nem** végez fájlműveletet — csak az állapotot nullázza.

## 4.5 Munkamenet perzisztálása (localStorage)
- A rendezés közbeni állapot **folyamatosan mentődik a böngésző localStorage-ába**, minden döntésnél. Ami mentésre kerül:
  - a kosarak listája (név + melyik fájl került bele),
  - az egyes képekre hozott döntések (megtart / törlés / kosár),
  - az undo/redo előzmény,
  - az aktuális pozíció a sorban.
- **A képek/videók maga a tartalom NEM kerül mentésre** — csak a fájlnevekhez kötött döntések. (A localStorage csak kis méretű szöveges adatot tárol.)
- **Mappánként külön munkamenet (folder-scoped):** a mentett állapot **a kiválasztott mappához van kötve**, nem globális. Ha egy másik mappát indítasz el, az **saját, független munkamenet-ágat** kap a localStorage-ban — a két mappa állapota nem írja felül egymást, és mindkettő külön folytatható.
  - A mappa azonosítása a **mappa neve** alapján történik (a File System Access API nem ad stabil teljes elérési utat). **Korlát:** két, azonos nevű — de fizikailag különböző — mappa ütközhet (ugyanaz a munkamenet-ág); ez ritka, és a fájlnév-párosítás (lásd lentebb) tovább szűri.
- **Visszatöltés legközelebbi indításkor:**
  - Az app a mappaválasztónál jelzi, ha **az adott mappához** van mentett munkamenet (a mappa kiválasztása után).
  - A felhasználó **újra kiválasztja ugyanazt a mappát** (a böngésző biztonsági okból minden induláskor újra elkéri a mappa engedélyét — ez nem megkerülhető).
  - Az app a **fájlnevek alapján** összepárosítja a mappa képeit a mentett döntésekkel, és visszaállítja a kosarakat, az előzményt és a pozíciót.
- **Korlát:** ha egy fájlt a két munkamenet között átneveztek vagy töröltek, a hozzá tartozó korábbi döntés elveszik (a párosítás fájlnév alapján történik). Új, korábban nem látott fájlok a sor végére kerülnek besorolatlanként.
- A **Rendezés** sikeres lefutása után a mentett munkamenet törlődik (a rendezés lezárja a folyamatot).

## 5. Megjelenés
- Modern, letisztult frontend React komponensekkel.
- Tinder-szerű kártyaélmény, finom animációkkal (kép „eldobás" iránya/célja szerint).
- **Kizárólag billentyűzet-orientált, asztali (desktop) használat.** Nincs touch / mobil gesztus-támogatás — a teljes interakció a billentyűzeten (kosarazás) és néhány képernyő-gombon (Undo / Redo / Rendezés / Reset) keresztül történik. A gombok egér-kattintással is működnek.

## 6. Korlátok és feltételezések
- Csak Chromium-alapú böngésző (Chrome/Edge) támogatott a File System Access API miatt.
- **Perzisztencia (localStorage):** a rendezés közbeni döntések mentődnek, és legközelebbi indításkor — ugyanazon mappa újbóli kiválasztása után, fájlnév alapján — visszatöltődnek. A képtartalom nem mentődik. (A már lemezre írt fájlmozgatások véglegesek.)
- A sorrend a `lastModified` mezőn alapul, nem a valódi fájl-létrehozási dátumon.
- A törlés nem az OS kukájába, hanem a `_torolt` almappába helyez (innen a felhasználó manuálisan törölhet).
- Egyszerre egy mappa egy szintje kerül feldolgozásra (almappák kihagyva).

## 7. Nyitott / jövőbeli kérdések (nem része az alap-MVP-nek)
- Mappa-handle automatikus visszatöltése IndexedDB-vel (a jelenlegi A-megoldás helyett, hogy ne kelljen újra kiválasztani a mappát).
- HEIC megjelenítés böngésző-támogatottsága (böngészőfüggő).
- Nagy videófájlok memóriahasználata és előnézet-teljesítmény több száz elemnél.
- **Kosár tartalmának szerkesztése** (kosárra kattintva belenézés, egy-egy kép kivétele/átrakása) — az MVP-ben **csak a lineáris undo/redo** van, célzott korrekció nincs.
- **Kosarak beszédes átnevezése** (pl. `a` → `kedvencek`) — az MVP-ben a mappanév maga a billentyű.
- **Touch / mobil gesztus-támogatás** (swipe) — az MVP kizárólag desktop + billentyűzet.
- **Teljesítmény több száz elemnél:** a képek (és nem csak a videók) betöltési stratégiája — pl. lazy-betöltés / előtöltés ablakkal —, hogy egy több száz elemes mappa is gyorsan induljon és ne fogyassza feleslegesen a memóriát. A konkrét megoldást a fejlesztőre bízzuk.
- **Ismételt rendezés ugyanazon a mappán (re-run viselkedés):** egy korábbi Rendezés után a létrejött almappák (`1/`, `a/`, `_torolt/`) almappaként **kimaradnak** az újbóli feldolgozásból (összhangban a „csak egy szint" szabállyal — 3.1). Csak a felső szinten maradt (megtartott + besorolatlan) képek jelennek meg újra. Ez a jelenlegi elvárt viselkedés; ha később finomítani kell (pl. a generált mappák kihagyásának explicit jelzése), az itt kezelhető.
