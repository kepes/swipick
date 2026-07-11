# Swipick — UI Design Brief

A handover document for a designer. It describes the **current** UI of Swipick
screen by screen — exact labels, positions, sizes and the current color values —
so a designer can produce a polished visual **without changing any functionality**.

Swipick is a local, browser-based image/video organizer with Tinder-style
swiping, driven from the keyboard. No server, no database — everything runs in
the browser via the File System Access API.

## Table of contents

1. [The app in a nutshell](#1-the-app-in-a-nutshell)
2. [Current visual language (design tokens)](#2-current-visual-language-design-tokens)
3. [Start screen (Folder Picker)](#3-start-screen-folder-picker)
4. [Sorting screen (the main experience)](#4-sorting-screen-the-main-experience)
5. [End-of-deck state (Done screen)](#5-end-of-deck-state-done-screen)
6. [Sorting progress overlay](#6-sorting-progress-overlay)
7. [Result screen](#7-result-screen)
8. [Keyboard controls](#8-keyboard-controls)
9. [What to keep vs. what the designer may redesign](#9-what-to-keep-vs-what-the-designer-may-redesign)

## 1. The app in a nutshell

A user picks a folder, the app deals out the images/videos inside it one at a
time, the user sorts each item into "buckets" from the keyboard, and at the end a
single button performs **real file moves** into subfolders. No server, no
database — everything runs in the browser.

**Four main screens / states:**

1. **Start screen** (folder picker)
2. **Sorting screen** — the core: full-screen media with floating UI
3. **End-of-deck state** (inside the sorting screen) + **sorting progress overlay**
4. **Result screen** (after sorting)

## 2. Current visual language (design tokens)

Dark theme. This is the current palette — the designer is free to redesign it,
but this is the starting point:

| Token | Value | Usage |
|---|---|---|
| Background | `#0f1115` | app base background |
| Elevated surface | `#181b22` | badges, filename chip, notice |
| Card surface | `#1f2430` | bucket chips, buttons, dialogs |
| Border | `#2b313d` | subtle borders |
| Text | `#e7e9ee` | primary |
| Dim text | `#9aa3b2` | secondary, counters |
| Accent (blue) | `#6c8cff` → hover `#5577f5` | primary buttons |
| Danger (red) | `#ff5c6c` | "delete" bucket, errors |
| Danger dim | `#4a2730` | red background fill |
| Keep (green) | `#43c595` | success result title |
| Radius | 14px / 9px (small) | rounding |
| Shadow | `0 10px 30px rgba(0,0,0,.45)` | floating elements |
| Font | system sans (San Francisco / Segoe UI) | everything |

## 3. Start screen (Folder Picker)

Centered vertical column on an empty dark background.

```
┌───────────────────────────────────────────────┐
│                                                 │
│                                                 │
│                   Swipick            ← H1, 2.5rem, bold
│   Pick a folder and sort your images with       │
│            the keyboard.             ← subtitle, dim
│                                                 │
│            ┌─────────────────┐                  │
│            │  Choose folder  │      ← accent blue button
│            └─────────────────┘                  │
│                                                 │
└───────────────────────────────────────────────┘
```

**Elements:**

- **Title:** "Swipick" (2.5rem, bold)
- **Subtitle:** "Pick a folder and sort your images with the keyboard." (dim text, centered)
- **Primary button:** "Choose folder" (accent blue, white text, ~0.875rem × 2rem padding, 1.125rem font)

### 3.a Variant — saved session (Resume)

If the picked folder already has a saved session, the button is replaced by a
card (elevated surface, border, shadow, max 520px):

```
┌─────────────────────────────────────────┐
│  The folder **Vacation2025** has a saved  │
│  session (**37** earlier decisions).      │
│                                           │
│    ┌──────────┐   ┌──────────────┐        │
│    │  Resume  │   │  Start over  │        │
│    └──────────┘   └──────────────┘        │
│     accent blue     outlined (secondary)  │
└─────────────────────────────────────────┘
```

- Text: "The folder **{folderName}** has a saved session (**{count}** earlier decisions)." — folder name and count are bold.
- **"Resume"** = accent blue button, **"Start over"** = transparent, outlined button.

### 3.b Variant — unsupported browser

Instead of the button, a red warning box (danger-dim background, red text, max 480px):

> "This browser is not supported — use Chrome or Edge."

### 3.c Variant — error

Below the content, a red error box (same danger style) with the error message
from the store (e.g. permission denied).

## 4. Sorting screen (the main experience)

**Key concept:** the current media **fills the entire viewport**
(`object-fit: contain`, so it never crops — it letterboxes), and every UI element
**floats over it** as a transparent overlay. The header/footer strips are
`pointer-events: none`; only the interactive elements inside them are clickable —
so the media stays the star.

```
┌──────────────────────────────────────────────────────────┐
│ [A▸12] [B▸5] [C▸8]  … [DELETE▸3]              37 / 240     │ ← header: bucket bar (center), progress (top-right)
│                                                            │
│                                                            │
│                                                            │
│                                                            │
│                  ┌────────────────────┐                    │
│                  │                    │                    │
│                  │   CURRENT MEDIA    │  ← full screen, contain
│                  │   (image / video)  │                    │
│                  │                    │                    │
│                  └────────────────────┘                    │
│                                                            │
│  ┌────┐┌──────┐                                            │
│  │ +2 ││  +1  │  ← next 2 items preview (bottom-left)       │
│  └────┘└──────┘                                            │
│                    IMG_2024.jpg          ← filename chip    │
│           [◀ Undo] [Redo] [Sort] [Start over]  ← controls   │
└──────────────────────────────────────────────────────────┘
```

### 4.1 Header — Bucket bar (BasketBar), top center

A horizontal, wrap-able row of dynamically created buckets, 12px padding,
**transparent background** (media shows through underneath).

Each bucket is a **chip**:

- On the left, a **thumbnail** (the most recent item dropped into that bucket) — base 56×56px.
- **Label** — the key uppercased (`A`, `B`, `1`…), or the "delete" label for the delete bucket.
- **Counter** — how many items it holds (dim, tabular numerals).
- Chip style: card surface, subtle border, 9px radius.
- **The "delete" bucket is highlighted:** red border + red dim background. It is always sorted to the **end** of the row.

**Important interaction — macOS dock magnification:** as the cursor moves over the
bucket bar, the thumbnails **magnify**, the one closest to the cursor being the
largest. Base size 56px, peak 120px, effect radius ±160px, spring animation. This
is a deliberately playful micro-interaction — the designer may emphasize or refine it.

### 4.2 Progress badge — top-right corner

Small pill/badge: **"{current} / {total}"** format (e.g. `37 / 240`). Elevated
surface, dim text, tabular numerals. Fixed to the top-right corner (12px offset),
not clickable.

### 4.3 Center — the media card (CardStack + MediaCard)

- Only **one** item is shown large at a time, centered, filling the area in `contain` mode.
- **Image:** static.
- **Video:** auto-plays, **muted**, **looping** (continuous preview). Play/pause with `Space`.
- **Swipe animation (Framer Motion):** when the user decides, the card flies out:
  - **right** (keep-in-place decision) → slides right + 15° tilt
  - **left** (delete) → slides left + −15° tilt
  - **up** (drop into a bucket) → slides up
  - on enter: subtle fade + scale (0.96→1). Transition ~0.25s, easeOut.

### 4.4 Preview of upcoming items — bottom-left corner (NextUpPreview)

Small previews of the next **two** items in the bottom-left corner (16px offset),
side by side, bottom-aligned:

- Height: **20vh**, width auto (aspect preserved), rounded, bordered, with a shadow.
- **The next item is on the right** (closer to the card), the one after it on the left.
- `<img>` for images, muted `<video>` for videos. Decorative (`aria-hidden`).

### 4.5 Footer — filename + control buttons, bottom center

Stacked vertically, centered (12px padding, 10px gap):

1. **Filename chip** (when there is a current item): the current file's name on one line, truncated with `…` on overflow. Elevated surface, small chip.
2. **Control buttons row** (ControlButtons), left to right:
   - **"◀ Undo"** — undo (disabled when nothing to undo)
   - **"Redo"** — redo
   - **"Sort"** — **primary accent blue button**, starts sorting at any time (disabled during sorting)
   - **"Start over"** — **danger style** (red border/text, red background on hover), restart

> Note for the designer: "Sort" is deliberately **not** bound to a key (so an
> accidental keypress can't move files) — make it visually clear it is a
> deliberate action.

### 4.6 "Restored" notice

On session restore, a floating pill appears **bottom center** (above the footer,
~88px), rounded, with dim text — a short confirmation message that then disappears.

## 5. End-of-deck state (Done screen)

When the user has reviewed every item, in place of the media card (still inside
the sorting screen, header/footer remain), a centered block:

```
        You've reviewed everything 🎉      ← 1.6rem, bold
        ┌──────────────────┐
        │       Sort       │              ← large accent blue button, 1.25rem
        └──────────────────┘
```

- Message: **"You've reviewed everything 🎉"**
- Large primary **"Sort"** button (bigger than the one in the footer — 1rem × 2.5rem padding, bold).

## 6. Sorting progress overlay

While sorting runs, a full-screen dimming overlay (`rgba(0,0,0,.6)`) with a card
in the center:

- **Spinner** (36px, accent-colored rotating ring)
- Text: **"Sorting in progress — {done} / {total}"** (when progress data exists), otherwise "Sorting in progress…"

This blocks interaction while the real file move is happening.

## 7. Result screen

After sorting, a separate full screen (like the start screen), centered column:

```
                ✓ Done!                  ← H1, GREEN (keep color), 2.5rem
        3 images moved, 1 deleted        ← summary
                                          
        ┌─────────────────────────┐
        │  Back to folder picker  │      ← elevated-surface button
        └─────────────────────────┘
```

- **Title:** "✓ Done!" — **green** (`--keep`), 2.5rem bold.
- **Summary:** comma-separated parts: "{N} images moved", "{N} deleted", and if there were errors: "{N} failed".
- **Error section** (only if some files failed): "Failed files:" heading (red), then a list — each row: **filename** (bold, red) — error message, on a danger-dim background.
- **Button:** "Back to folder picker" (elevated surface, outlined, returns to the start screen).

## 8. Keyboard controls

The app is keyboard-centric — the designer may support this visually (e.g. a hint
bar, key markings on the buckets):

| Key | Action |
|---|---|
| Letter `a–z` / number `0–9` | sort into the bucket of that name (creates it too) |
| → right | stays in place (not moved during sorting) |
| ← left | into the "delete" bucket |
| `Space` | video play/pause |
| `Ctrl+Z` / ↓ | undo |
| `Ctrl+Y`, `Ctrl+Shift+Z` / ↑ | redo |
| `Esc` | cancel the current animation |

## 9. What to keep vs. what the designer may redesign

**Must keep (functional constraints):**

- The media is full-screen; everything else floats over it.
- The four positions: buckets top, progress top-right, preview bottom-left, controls + filename bottom.
- The visual distinction of the "delete" bucket (red).
- The swipe-direction semantics (right = keep, left = delete, up = bucket).

**Free to redesign:**

- The whole palette (it need not be a dark theme, or it could have a light/dark toggle).
- The dock-magnification micro-interaction's style/strength.
- Typography, radius, shadows, button shapes.
- The layout/mood of the start and result screens.
- Empty states, animation timing, hover feedback.
