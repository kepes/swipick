---
version: "alpha"
name: Swipick Playroom
description: Playful, keyboard-first media organizer UI — chunky outlines, hard offset shadows, 3D keycaps, warm coral accent. Light and dark themes.
colors:
  primary: "#1f1a14"
  on-primary: "#f4efe8"
  secondary: "#8a7c6b"
  tertiary: "#ff6b3d"
  on-tertiary: "#ffffff"
  neutral: "#f4efe8"
  surface: "#fffdf9"
  error: "#d63b1f"
  error-container: "#ffe9e2"
  on-error-container: "#d63b1f"
  success: "#2f9e6e"
  dark-neutral: "#171310"
  dark-surface: "#262019"
  dark-primary: "#f4efe8"
  dark-secondary: "#9a8d7c"
  dark-error: "#ff7d5e"
  dark-error-container: "#301a13"
typography:
  display:
    fontFamily: Sora
    fontSize: 3.25rem
    fontWeight: 800
    letterSpacing: -0.02em
  h1:
    fontFamily: Sora
    fontSize: 2.5rem
    fontWeight: 800
    letterSpacing: -0.02em
  h2:
    fontFamily: Sora
    fontSize: 1.75rem
    fontWeight: 800
  body-md:
    fontFamily: Sora
    fontSize: 0.9375rem
    fontWeight: 500
    lineHeight: 1.5
  label-button:
    fontFamily: Sora
    fontSize: 0.8125rem
    fontWeight: 700
  label-keycap:
    fontFamily: Sora
    fontSize: 0.75rem
    fontWeight: 700
  counter:
    fontFamily: Sora
    fontSize: 0.6875rem
    fontWeight: 600
    fontFeature: tnum
  mono-filename:
    fontFamily: ui-monospace, Menlo, monospace
    fontSize: 0.6875rem
    fontWeight: 600
rounded:
  xs: 7px
  sm: 13px
  md: 17px
  lg: 20px
  xl: 24px
  pill: 99px
spacing:
  xs: 6px
  sm: 10px
  md: 12px
  lg: 16px
  xl: 22px
  xxl: 32px
components:
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    typography: "{typography.label-button}"
    rounded: "{rounded.sm}"
    padding: 10px 26px
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.label-button}"
    rounded: "{rounded.sm}"
    padding: 10px 18px
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.error}"
    typography: "{typography.label-button}"
    rounded: "{rounded.sm}"
    padding: 10px 18px
  keycap:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.label-keycap}"
    rounded: "{rounded.xs}"
    height: 24px
  dock-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: 12px 16px
  dock-panel-delete:
    backgroundColor: "{colors.error-container}"
    textColor: "{colors.error}"
    rounded: "{rounded.lg}"
    padding: 12px 16px
  progress-badge:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral}"
    typography: "{typography.counter}"
    rounded: "{rounded.pill}"
    padding: 7px 14px
  filename-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    typography: "{typography.mono-filename}"
    rounded: "{rounded.pill}"
    padding: 5px 14px
---

## Overview

**Playroom** — a playful, keyboard-first visual language for Swipick, a browser-based
media organizer with Tinder-style sorting. The aesthetic is warm and toy-like:
chunky 2px ink outlines, hard offset shadows (no blur), pressable 3D keycaps and
buttons, and a single warm coral accent. The media being sorted is always the star:
it fills the viewport (`object-fit: contain`, letterboxed) and every UI element
floats above it as an overlay. Typeface is Sora throughout; filenames and technical
text use the system monospace stack.

Two themes exist. Light is the default (warm off-white); dark swaps the neutral
foundation to warm near-black and inverts ink to cream. The accent coral is
identical in both themes.

## Colors

- **Primary (#1f1a14):** Warm ink. Used for nearly all outlines, strong text, and
  hard offset shadows. In dark theme this role is played by `dark-primary` (#f4efe8).
- **Secondary (#8a7c6b):** Warm taupe for secondary text, counters, disabled
  labels, hints. Dark theme: `dark-secondary` (#9a8d7c).
- **Tertiary (#ff6b3d):** Coral — the sole interaction driver. Primary buttons,
  progress fills, spinner, hovered keycaps, the wordmark dot. Same in both themes.
- **Neutral (#f4efe8):** Warm off-white app background. Dark theme: `dark-neutral` (#171310).
- **Surface (#fffdf9):** Cards, panels, chips, keycaps. Dark theme: `dark-surface` (#262019).
- **Error (#d63b1f):** The "delete" semantics — delete bucket outline/text,
  destructive buttons. Dark theme: `dark-error` (#ff7d5e). Container fills:
  `error-container` / `dark-error-container`.
- **Success (#2f9e6e):** Only for the result-screen ✓ badge. Both themes.

Never introduce additional hues. Bucket thumbnails and media provide the color
variety; the chrome stays ink + neutral + coral.

## Typography

Sora (Google Fonts, weights 400–800) for everything except filenames.

- Wordmark/display: 800, −0.02em tracking, 52px.
- Headings: 800 (h1 40px, h2 28px).
- Body and UI labels: 500–700, 12–15px.
- Buttons: 700 (primary CTA 800), 13px; large CTA 19px.
- All numeric counters use `font-variant-numeric: tabular-nums`.
- Filenames and technical annotations: `ui-monospace, Menlo, monospace`, 11px.

## Layout

- Full-viewport app; the current media fills the whole viewport with
  `object-fit: contain` (letterboxed, never cropped). All chrome floats above it.
- Fixed overlay positions (functional constraint — do not move): bucket dock top
  center; progress badge top-right; next-up previews bottom-left (height 20vh,
  width by aspect ratio); filename chip + control row bottom center; theme toggle
  bottom-right.
- Overlay elements sit 12–18px from viewport edges. Gaps: 10px between buttons,
  12px between dock items, 10px between stacked footer rows.
- Start and result screens are centered vertical columns on the bare neutral
  background.

## Elevation & Depth

No soft blurred shadows on chrome. Depth comes from two devices:

- **Hard offset shadow** on floating panels: `box-shadow: 0 6px 0 <outline-color>`
  (dock, cards; 8px for the sorting-overlay card).
- **Pressable edges** on buttons/keycaps: the bottom border is thicker
  (buttons 5px, keycaps 4px, large CTA 6–7px). On `:active` the element translates
  down 3px and the bottom border shrinks to 2px — a physical press.
- Dimming overlay for blocking states: `rgba(31,26,20,.55)`.
- Magnified dock thumbnails may take a soft shadow (`0 10px 24px rgba(31,26,20,.25)`)
  as the one exception, to lift them off the bar.

## Shapes

- Everything is rounded and outlined: 2px solid outline on virtually every element
  (error elements use the error color instead of ink).
- Radii: keycaps 7px, buttons 13–17px, thumbnails 12–14px, panels/dock 20px,
  chips/pills/badges fully rounded (99px).
- Decorative "photo card" motifs are slightly tilted (±2–8°); the next-up previews
  tilt −4° and +2°.
- Keycap: min 24×24px, surface fill, 2px outline with 4px bottom edge, 7px radius.

## Components

- **button-primary ("Sort", "Choose folder", "Resume"):** coral fill, white 700–800
  text, ink outline with thick bottom edge. Disabled: opacity .45. The Sort action
  deliberately has no keyboard shortcut — keep it visually deliberate.
- **button-secondary ("Undo", "Redo", "Back to folder picker"):** surface fill,
  ink text; may embed a mini keycap showing its shortcut (↓ / ↑).
- **button-danger ("Start over"):** transparent fill, error outline and text.
- **dock-panel:** the bucket bar. One surface panel holds all user buckets; the
  delete bucket sits in its own error-styled panel, always last (rightmost).
  Each bucket chip is a column: thumbnail (44×44px base) → keycap with its letter →
  counter. Hover magnifies the thumbnail to 84px (neighbors ~60px) with a springy
  `0.18s cubic-bezier(.34,1.56,.64,1)` transition, growing upward from the bar's
  bottom edge; the hovered keycap turns coral. Clicking a chip sorts the current
  item into that bucket. Empty state: dashed-outline hint pill
  ("Press any letter to create a bucket").
- **progress-badge:** ink pill, top-right, "37 / 240", tabular numerals.
- **filename-chip:** monospace pill, truncates with ellipsis, max-width 360px.
- **Swipe animation:** exit 240ms ease-out — right `translateX(130%) rotate(15deg)`
  (keep), left `translateX(-130%) rotate(-15deg)` (delete), up `translateY(-130%)`
  (bucket); enter from `scale(.96)` + fade.
- **Sorting overlay:** dim + surface card: 40px coral ring spinner (0.8s linear),
  status text, 220×10px outlined progress pill with coral fill.
- **Result badge:** 72px success-green square, ink outline, 22px radius, −4° tilt,
  white ✓.

## Do's and Don'ts

- **Do** keep the media untouched: no outline, radius, or shadow on the full-bleed
  media itself; chrome floats above it.
- **Do** give every interactive element the press affordance (translate + bottom
  edge shrink) and every shortcut a visible keycap.
- **Do** keep the delete bucket visually distinct (error color) and always last.
- **Don't** introduce new hues, gradients, or blurred drop shadows on chrome.
- **Don't** bind the Sort action to a key; it must remain a deliberate click.
- **Don't** use outlines thinner than 2px or radii larger than 24px.
- **Don't** replace Sora with a generic UI font; filenames stay monospace.
