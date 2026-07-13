# Swipic

A local, browser-based web app for **lightning-fast, keyboard-driven organizing** of images and videos. You pick a folder, the app deals out the media inside it one at a time Tinder-style, you sort each item into buckets with the keyboard, and at the end a single click organizes them into subfolders with **real file operations**.

The whole flow runs in the browser, **with no server and no database**, using the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API).

## Table of contents

1. [Features](#features)
2. [Browser requirement](#browser-requirement)
3. [Install and run](#install-and-run)
4. [Usage](#usage)
5. [Keys](#keys)
6. [How it sorts (file operations)](#how-it-sorts-file-operations)
7. [Session saving](#session-saving)
8. [npm scripts](#npm-scripts)
9. [Architecture](#architecture)

## Features

- **Tinder view:** one item at a time, large, with a subtle "toss" animation and a progress indicator (`37 / 240`).
- **Images and videos:** videos play automatically, muted, with a looping preview; toggle play/pause with `Space`.
- **Preview of upcoming items:** in the bottom-left corner, the next two media items shown small (the next one on the right, the one after it on the left); for both images and videos.
- **Dynamic buckets:** any letter/number key creates a bucket (up to 36 + "delete").
- **Zoomable bucket bar:** the bucket thumbnails appear enlarged in the header, and when you hover over them they magnify macOS-dock-style (the one closest to the cursor is the largest).
- **Undo / Redo:** unlimited steps can be undone and redone.
- **Folder-scoped session saving:** your decisions are saved to the browser's `localStorage`, separately per folder; next time you can resume where you left off.
- **Real sorting:** the "Sort" button moves the files into subfolders with collision handling.

## Browser requirement

- **Chromium-based browsers only** (Chrome / Edge) — because of the File System Access API. Firefox / Safari are not supported.
- **A secure context is required:** the API only works over `https` or on `localhost`. Double-clicking `dist/index.html` (`file://`) will **not** work — run it from a local server (`npm run dev` or `npm run preview`), or in production from an `https` host.
- When you pick a folder, the browser asks for **write permission** — you must grant it, because the app moves real files.

## Install and run

```bash
npm install        # install dependencies
npm run dev        # development server (Vite) → http://localhost:5173
```

Trying a production build locally:

```bash
npm run preview    # builds automatically, then serves dist/ from localhost (secure context)
```

## Usage

1. On startup there's a single screen: **"Choose folder"**. Click it and pick a folder (grant write permission).
2. The app reads the folder's displayable images/videos (skipping subfolders) and deals them out in **ascending** order by `lastModified`.
3. You bucket them with the keyboard (see below). The buckets line up at the top of the screen (name + thumbnail + count; the "delete" bucket stands out in red).
4. At the end of the deck the **"Done"** screen appears with the large **"Sort"** button. Sorting can also be started earlier from the header at **any time**.
5. After sorting, the result is shown (e.g. "3 images moved, 1 deleted"), from where you can return to the folder picker.

If you pick the same folder that has a saved session, the folder picker **offers to resume** (Resume / Start over).

## Keys

| Key                                                  | Action                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Letter (`a`–`z`) or number (`0`–`9`)**             | The image goes into the bucket named after the key (created if needed). Case-insensitive.  |
| **Right arrow (→)**                                  | The image **stays in place** (not put into a bucket, and not moved during sorting either). |
| **Left arrow (←)**                                   | The image goes into the **"delete"** bucket.                                               |
| **`Space`**                                          | Play / pause the video on top.                                                             |
| **`Ctrl+Z`** or **down arrow (↓)**                   | Undo.                                                                                      |
| **`Ctrl+Y`**, **`Ctrl+Shift+Z`** or **up arrow (↑)** | Redo.                                                                                      |
| **`Esc`**                                            | Cancel the current animation.                                                              |

> Invalid filename characters (`/ \ : * ? < > |` etc.) and every other key **do nothing** — so a bucket with an invalid name is never created. **Sorting has no** keyboard shortcut (so an accidental keypress can't move files).

## How it sorts (file operations)

Inside the selected folder, the "Sort" button:

- **For every non-"delete" bucket**, creates a subfolder named after the bucket (`a/`, `1/`, …) and moves its images into it.
- Moves the images in the **"delete" bucket** into a subfolder named **`_deleted`** (from which you can delete them manually — they do not go to the OS trash). The `_deleted` folder stays a **single collector folder** across multiple sorts (it is reused).
- Images **kept with the right arrow** and **not yet classified** ones **stay in place**.
- **Folder collision (numbering):** if a subfolder with the bucket's name **already exists**, Sort neither overwrites nor merges it, but creates a fresh, **`_NN`-numbered sibling** (`b/` taken → `b_01/`; if both `b/` and `b_01/` exist → `b_02/`). This way each sort goes into a separate folder. (`_deleted` is the exception — it is always the same folder.)
- **Filename collision:** if a filename clashes in the target folder, it is numbered (`kep.jpg` → `kep (1).jpg`).
- The move is **safe** (it copies/writes first, and only then deletes the original); an error on one file does not stop the rest, and the number of failures is reported at the end.

## Session saving

- On every decision, the bucket state, the decisions, the undo/redo history and the position are saved — under a **separate key per folder** (`swipick:v1:session:<folder-name>`).
- **The image content is never saved**, only the decisions tied to filenames. Restoring matches by filename.
- If a file was renamed/deleted in the meantime, its associated decision is lost; new files show up as unclassified.
- A **successful Sort** and **Start over (Reset)** clear the given folder's saved session.

> Note: the folder is identified by its **name** (for security reasons the browser does not provide a stable full path). Two folders with the same name but physically different could share the same session branch; filename matching filters this further.

## npm scripts

| Script               | What it does                                                                                                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`        | First `tsc --noEmit` type checking, then the Vite development server with HMR (`http://localhost:5173`). On a type error the server won't even start.                              |
| `npm run build`      | `tsc --noEmit` type checking **and** a production build into `dist/` (with relative paths).                                                                                        |
| `npm run preview`    | First runs the build (`vite build`), then serves `dist/` from a local server (the secure context needed for the File System Access API) — no need to remember to build separately. |
| `npm test`           | A single run of the full Vitest test suite.                                                                                                                                        |
| `npm run test:watch` | Vitest in watch mode.                                                                                                                                                              |
| `npm run typecheck`  | Type checking only (`tsc --noEmit`).                                                                                                                                               |

## Architecture

Layered, one-way data flow — **pure domain → Zustand store → React components**; I/O (FS, localStorage) is behind dependency injection, so it's testable.

```
src/
  domain/      types.ts (canonical model), keymap, reducer (undo/redo), buckets, ordering — pure, I/O-free
  fs/          gateway (File System Access wrap), scan (folder read + filter), organize (file move + collision)
  store/       useSortStore (Zustand), persist (folder-scoped localStorage + reconcile)
  components/  FolderPicker, BasketBar, ProgressBadge, MediaCard, CardStack, ControlButtons, DoneScreen, ResultScreen
  hooks/       useKeyboard (global keys), useMediaWindow (windowed objectURL cache)
  test/        fakeFs (in-memory File System Access fake), setup
```

**Stack:** Vite · TypeScript · React 19 · Zustand 5 · Framer Motion · CSS Modules · Vitest + Testing Library.

The detailed design documents:

- **Requirements spec:** [docs/swipick-spec.md](docs/swipick-spec.md)
- **Design / architecture:** [docs/specs/2026-06-17-swipick-design.md](docs/specs/2026-06-17-swipick-design.md)
- **Implementation plan:** [docs/plans/2026-06-17-swipick-plan.md](docs/plans/2026-06-17-swipick-plan.md)
