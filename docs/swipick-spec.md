# Swipick — User requirements specification

## Table of contents

1. [Overview](#1-overview)
2. [Technology stack](#2-technology-stack)
3. [Workflow](#3-workflow)
4. [Non-keyboard features (buttons)](#4-non-keyboard-features-buttons)
5. [Appearance](#5-appearance)
6. [Constraints and assumptions](#6-constraints-and-assumptions)
7. [Open / future questions](#7-open--future-questions-not-part-of-the-base-mvp)

## 1. Overview

A local, browser-based web application for lightning-fast image sorting. The user picks a folder, the app flips through the images inside it one by one Tinder-style, and the user sorts them into buckets with the keyboard. At the end of the sort, the app organizes the images into folders with real file operations.

**Main goal:** quickly reviewing and categorizing a folder with several hundred images when not every image is needed.

## 2. Technology stack

- **Frontend:** React, modern look.
- **No server, no database.** The app runs as a single file openable from the browser (static HTML/JS).
- **File access:** File System Access API. Because of this, the app requires **Chrome / Edge** (Firefox/Safari don't fully support the API).
- When picking the folder, the user must grant **write permission** to it, because the app moves real files.
- All data and operations live in memory; refreshing the page discards the in-progress session.

## 3. Workflow

### 3.1 Startup — folder picker
- On startup a single screen is shown: a "Choose folder" button.
- Clicking it opens the File System Access API folder picker.
- After selection, the app reads **every media file in the folder that the browser can display natively** — without conversion. These include:
  - **Images:** jpg, jpeg, png, gif, webp, avif, bmp, svg (and heic, if the given browser supports it).
  - **Moving images/videos:** mp4, webm, ogg/ogv, mov (as long as the browser can play them).
  - The principle: if the browser can natively display/play it, it can be sorted. The app runs no conversion.
- Files that can't be displayed or have an unknown format are skipped by the app.
- Subfolders are ignored (only the images at the given level are processed).
- **If the folder contains no displayable media at all**, the app gives a clear message (e.g. "This folder has no images or videos to display") and stays on the folder picker screen — it doesn't enter the Tinder view.

### 3.2 Order
- Images are shown **in ascending order by `lastModified` (modification date)** (oldest first). This approximates the "added to the folder" time.

### 3.3 Displaying an image (Tinder view)
- One item (image or video) is shown at a time in the center of the screen, at large size.
- For a video, the player is embedded: an automatic, **muted, looping preview**, so a decision can be made quickly. The **`Space`** key plays/pauses the video on top (see 3.4).
- Some kind of progress indicator is visible (e.g. "37 / 240").
- When a key is pressed, the image is "thrown away" with an animation in the corresponding direction/bucket.

### 3.4 Keyboard controls
Applies to the image currently on top. **Only letter (`a`–`z`) and number (`0`–`9`) keys create / fill buckets.** Every other key is either a reserved function (see below) or **ignored (no-op)** — so a bucket is never created from characters that are invalid in filenames (`/ \ : * ? < > |` etc.).

**Bucket keys:**

| Key | Action |
|---|---|
| **Right arrow (→)** | The image **stays in place**. It doesn't go into a bucket and isn't moved during the sort either. |
| **Left arrow (←)** | The image goes into the **"delete"** bucket. |
| **Letter or number** (`a`–`z`, `0`–`9`) | The image goes into the **bucket named after the pressed key**. If the bucket doesn't exist yet, it's created. |

- Letter keys are **case-insensitive**: `a` and `Shift+A` are the **same bucket**. The bucket's (and thus the folder's) name is always the **lowercase** form (e.g. `a/`).
- Any number of buckets can be created dynamically, based on the letter/number keys used (max. 36 possible buckets: 26 letters + 10 numbers, plus "delete").

**Reserved keys (do NOT create buckets):**

| Key | Function |
|---|---|
| **`Space`** | Play / pause the video on top. |
| **`Ctrl+Z`** (or **down arrow ↓**) | Undo — see 4.1. |
| **`Ctrl+Y`** (or `Ctrl+Shift+Z`, or **up arrow ↑**) | Redo — see 4.2. |
| **`Esc`** | Cancel current animation / focus. |

- The **Sort** action has **no** keyboard shortcut — it starts only by clicking the on-screen button (see 4.3), so that an accidental keypress can't move files.

### 3.5 Displaying buckets
- The buckets line up horizontally at the **top of the screen**.
- Each bucket shows:
  - its **name** (the key itself, or "delete" for the left arrow),
  - a **thumbnail**: the first image put into that bucket,
  - optionally the count of images in the bucket.
- The "delete" bucket is visually distinct (e.g. red marking).

### 3.6 "Done" state (at the end of the deck)
- When you've sorted the **last** image (the queue is exhausted), the app gives a **clear signal** that you've reviewed everything.
- On this screen there's a **prominent, large "Sort" button**; pressing it starts the file moving (see 4.3).
- The Sort can also be started **at any earlier point** regardless (you don't have to reach the end of the deck) — see 4.3.

## 4. Non-keyboard features (buttons)

### 4.1 Undo
- Available via a button **and** the `Ctrl+Z` / **down arrow (↓)** key.
- Reverts the last image classification: the image returns to the current position, is removed from the bucket, and is on top again.
- Multiple steps can be undone in a row.

### 4.2 Redo
- Available via a button **and** the `Ctrl+Y` (or `Ctrl+Shift+Z`, or **up arrow ↑**) key.
- Repeats an undone operation.
- After performing a new operation, the redo chain is cleared.

### 4.3 Sort (main feature — file operations)
- **Start:** only by clicking the on-screen **"Sort" button** (no keyboard shortcut, so an accidental keypress can't move files).
- **There is no separate confirmation dialog** — the click immediately starts the file moving; feedback appears at the end of the operation. (Decisions live in memory and can be undone until the Sort, so the click is the moment of "commitment".)

On click, within the selected folder the app:
- **For every non-"delete" bucket**, creates a subfolder with the **bucket's name** (e.g. `1/`, `a/`) and moves the corresponding images into it.
- Moves the **"delete" bucket's** images into a subfolder named **`_deleted`** (within the selected folder).
- Images **kept with the right arrow** **stay in place**, going into no folder.
- Images **not yet classified (remaining in the queue) stay in place** — just like the kept ones. The Sort can be pressed at any time; going through all images is not required.
- At the end of the operation the app gives feedback (e.g. "X images moved, Y deleted").

**Note — conflict handling:**
- **Folder conflict:** if a non-"delete" bucket-named subfolder already exists, the app **does not overwrite or merge** it, but creates a fresh sibling with a `_NN` two-digit sequence number (`b/` taken → `b_01/`; `b/` and `b_01/` both exist → `b_02/`). This way each sort goes into a separate folder.
- **Exception — `_deleted`:** the "delete" bucket's folder is not sequence-numbered; it stays a single collector folder across multiple sorts (reused).
- **Filename conflict:** if a filename collides in the target folder, sequence numbering (`kep.jpg` → `kep (1).jpg`).

### 4.4 Start over / Reset
- Discards all buckets and every operation so far (from memory **and from the current folder's localStorage branch**). It does not affect other folders' saved sessions.
- Returns to the initial **folder picker** screen.
- Does **not** perform any file operation — it only resets the state.

## 4.5 Session persistence (localStorage)
- The state during sorting is **continuously saved to the browser's localStorage**, on every decision. What is saved:
  - the list of buckets (name + which files went into them),
  - the decisions made on each image (keep / delete / bucket),
  - the undo/redo history,
  - the current position in the queue.
- **The images'/videos' actual content is NOT saved** — only the decisions tied to the filenames. (localStorage stores only small text data.)
- **A separate session per folder (folder-scoped):** the saved state is **tied to the selected folder**, not global. If you start a different folder, it gets its **own, independent session branch** in localStorage — the two folders' states don't overwrite each other, and both can be continued separately.
  - The folder is identified by the **folder name** (the File System Access API doesn't provide a stable full path). **Limitation:** two folders with the same name — but physically different — can collide (the same session branch); this is rare, and the filename matching (see below) further filters it.
- **Restoration on the next startup:**
  - The app indicates at the folder picker whether **the given folder** has a saved session (after the folder is picked).
  - The user **picks the same folder again** (for security reasons the browser re-requests folder permission on every startup — this can't be bypassed).
  - The app matches the folder's images with the saved decisions **by filename**, and restores the buckets, the history, and the position.
- **Limitation:** if a file was renamed or deleted between the two sessions, the earlier decision tied to it is lost (matching is by filename). New, previously unseen files go to the end of the queue as unclassified.
- After the **Sort** runs successfully, the saved session is deleted (the sort closes the process).

## 5. Appearance
- Modern, clean frontend with React components.
- A Tinder-like card experience, with subtle animations (per the image "throw" direction/target).
- **Keyboard-oriented, desktop-only use.** No touch / mobile gesture support — the entire interaction happens via the keyboard (bucketing) and a few on-screen buttons (Undo / Redo / Sort / Reset). The buttons also work with a mouse click.

## 6. Constraints and assumptions
- Only Chromium-based browsers (Chrome/Edge) are supported, due to the File System Access API.
- **Persistence (localStorage):** decisions made during sorting are saved and, on the next startup — after re-picking the same folder, matched by filename — restored. Image content is not saved. (File moves already written to disk are final.)
- The order is based on the `lastModified` field, not the true file creation date.
- Delete doesn't move to the OS trash but into the `_deleted` subfolder (from where the user can delete manually).
- One level of one folder is processed at a time (subfolders skipped).

## 7. Open / future questions (not part of the base MVP)
- Automatic restoration of the folder handle with IndexedDB (instead of the current solution A, so the folder doesn't have to be re-picked).
- Browser support for HEIC display (browser-dependent).
- Memory usage of large video files and preview performance with several hundred items.
- **Editing a bucket's contents** (clicking a bucket to look inside, removing/moving individual images) — the MVP has **only linear undo/redo**, no targeted correction.
- **Descriptive bucket renaming** (e.g. `a` → `favorites`) — in the MVP the folder name is the key itself.
- **Touch / mobile gesture support** (swipe) — the MVP is desktop + keyboard only.
- **Performance with several hundred items:** the loading strategy for images (and not just videos) — e.g. lazy loading / preloading with a window — so that even a folder of several hundred items starts quickly and doesn't waste memory unnecessarily. The concrete solution is left to the developer.
- **Repeated sorting on the same folder (re-run behavior):** after an earlier Sort, the subfolders created (`1/`, `a/`, `_deleted/`) **are left out** of reprocessing as subfolders (consistent with the "one level only" rule — 3.1). Only the images left at the top level (kept + unclassified) show up again. This is the current expected behavior; if it needs refining later (e.g. explicitly signaling the exclusion of generated folders), it can be handled here.
</content>
</invoke>
