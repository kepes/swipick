# Design spec — Web deploy, browser gate & desktop binary download

**Status:** Approved design (pre-implementation)
**Date:** 2026-07-13
**Scope:** Ship Swipick as a GitHub Pages web app, gate unsupported browsers with a
friendly fallback, and offer downloadable Electron desktop binaries
(macOS / Windows / Linux) from GitHub Releases.

## Table of contents

1. [Goal](#goal)
2. [Context](#context)
3. [Web deployment — GitHub Pages, tag-driven](#web-deployment--github-pages-tag-driven)
4. [Browser gate & fallback UI](#browser-gate--fallback-ui)
5. [Download links → GitHub Releases](#download-links--github-releases)
6. [Electron desktop wrapper](#electron-desktop-wrapper)
7. [Release pipeline — desktop binaries](#release-pipeline--desktop-binaries)
8. [Release automation — `prod_deploy`](#release-automation--prod_deploy)
9. [Branch model](#branch-model)
10. [Manual setup (GitHub) — operator checklist](#manual-setup-github--operator-checklist)
11. [Testing](#testing)
12. [Documentation](#documentation)
13. [Non-goals (YAGNI for now)](#non-goals-yagni-for-now)
14. [Primary risk & verification-first step](#primary-risk--verification-first-step)

## Goal

Swipick is a static Vite/React single-page app. It must:

- Deploy to GitHub Pages automatically when a `v*` version tag is pushed.
- Show a friendly fallback screen to anyone opening it in an unsupported browser
  (any browser without the File System Access API — Firefox, Safari, all mobile
  browsers), with an OS-aware button to download a desktop binary.
- Provide downloadable Electron desktop binaries for macOS, Windows and Linux,
  published to GitHub Releases (unsigned for now).

## Context

Facts that shape the design (verified in the current codebase):

- The app is a client-only static SPA — no server, no database. All file
  operations run in the browser via the **File System Access API**
  (`window.showDirectoryPicker`), so files never leave the user's machine.
- The API is Chromium-only and requires a secure context (`https` or
  `localhost`). This is why unsupported browsers need a fallback.
- `vite.config.ts` already sets `base: './'` (relative base). This works for the
  GitHub Pages subpath **and** for Electron — no dual build needed.
- Capability detection already exists: `realGateway.isSupported()` in
  [`src/fs/gateway.ts`](../../src/fs/gateway.ts) checks for
  `window.showDirectoryPicker`. [`src/components/FolderPicker.tsx`](../../src/components/FolderPicker.tsx)
  already renders a one-line "not supported" warning on the unsupported branch.
  The fallback UI extends this seam rather than introducing new detection.
- Repository: `github.com/kepes/swipick`. Pages URL: `https://kepes.github.io/swipick/`.
- The `prod` branch already exists (local and remote), alongside `dev` and `main`.

## Web deployment — GitHub Pages, tag-driven

Production is **tag-driven**: code reaches production only via a `v*` version
tag, never via a casual branch push (see [Branch model](#branch-model)). The same
tag drives both the web deploy and the desktop binary build.

- **Trigger:** pushing a `v*` tag runs the GitHub Actions workflow
  (`.github/workflows/pages.yml`) via `on: push: tags: ['v*']`. The workflow
  builds from the tagged commit's tree — no dependency on a specific branch.
- **Steps:** `npm ci` → `npm run build` (the existing `tsc --noEmit && vite build`)
  → upload `dist/` as a Pages artifact → deploy with `actions/deploy-pages`.
- **Method:** the modern Actions-based Pages deployment (not the legacy
  "deploy from a branch folder" mode).
- **URL:** `https://kepes.github.io/swipick/`. The existing `base: './'` in
  `vite.config.ts` makes all asset URLs relative, so the subpath just works and
  the same build output is reused by Electron.

## Browser gate & fallback UI

The unsupported-browser branch in
[`FolderPicker.tsx`](../../src/components/FolderPicker.tsx) is expanded from a
single line into a proper fallback block. Detection is unchanged —
`realGateway.isSupported()` (feature detection on `window.showDirectoryPicker`,
not user-agent sniffing).

On `isSupported() === false`, render:

- A short explanation (Swipick needs Chrome or Edge on desktop for secure local
  file handling).
- An "Open in Chrome" hint.
- An **OS-detected primary download button**, plus the other two platforms as
  secondary links.

New module `src/platform/downloads.ts`:

- Detects the OS from `navigator.userAgentData` (preferred) with a
  `navigator.platform` fallback → one of `mac` / `win` / `linux` / `unknown`.
- Returns the correct download URL for the detected OS (see next section).

## Download links → GitHub Releases

- Binaries are published to GitHub Releases with **stable, version-less file
  names** via electron-builder's `artifactName` config:
  - `Swipick-mac.dmg`
  - `Swipick-win.exe`
  - `Swipick-linux.AppImage`
- The fallback deep-links directly to the latest asset, with no version
  hard-coded, e.g.
  `https://github.com/kepes/swipick/releases/latest/download/Swipick-mac.dmg`.
- For an `unknown` OS, link to the `releases/latest` page so the user can choose
  a binary manually.
- **Ordering dependency:** these links only resolve once at least one desktop
  release exists. This is documented in the README and the release process.

## Electron desktop wrapper

- New `electron/` folder: `main.cjs` (main process) and a minimal `preload.cjs`.
  It loads the built `dist`.
- **Secure context (the one genuinely fiddly part):** the File System Access API
  requires a secure context, and `file://` is not one by default. The main
  process registers a **privileged custom protocol** (`app://`) with
  `secure: true` and serves `dist` from it, so `isSecureContext === true` and
  `showDirectoryPicker` works.
  - **Fallback plan** if the custom protocol misbehaves: run a tiny
    `http://localhost:<port>` static server in the main process — `localhost` is
    also a secure context.
- Because Electron is Chromium, `src/fs/gateway.ts` and the entire app run
  **unchanged**.
- New dev dependencies: `electron`, `electron-builder`.
- New npm scripts:
  - `electron:dev` — launch the built app locally.
  - `electron:build` — produce a desktop binary.

## Release pipeline — desktop binaries

- Workflow `.github/workflows/release.yml`, triggered by the same git tag
  (`v*`) that drives the web deploy. A tag is the single production trigger; no
  branch push builds binaries.
- **Matrix:**
  - `macos-latest` → universal `.dmg`
  - `windows-latest` → NSIS `.exe`
  - `ubuntu-latest` → `.AppImage`
- Each runner: web build → electron-builder → upload the asset to the tag's
  GitHub Release.
- **Signing: none** (per decision). Binaries ship unsigned; macOS Gatekeeper and
  Windows SmartScreen will warn and the user allows manually. Signing can be
  added later without changing the rest of the pipeline.

## Release automation — `prod_deploy`

A single command, `npm run prod_deploy` (`node scripts/prod-deploy.mjs`), is the
**only sanctioned way to ship a release**. It cuts the `v*` tag that drives both
CI workflows. It follows the pattern used by sibling projects (e.g. the `fokusz`
`deploy.mjs`) but is deliberately much simpler: no monorepo modes, no database
steps, no Vercel — it ends by pushing a tag, and GitHub Actions takes over.

**Automatic version bump with a prompt (required behaviour):** the script reads
the highest existing `v*` tag, suggests the next patch version, and prompts the
user to accept it (Enter) or type an explicit `X.Y.Z`. The entered version is
validated as semver and must be greater than the current one.

Steps:

1. **Preflight** — must be on `dev`; working tree clean; `git fetch origin --tags`;
   warn (y/n) if `dev` is behind `origin/dev`.
2. **Version prompt** — highest `v*` tag → suggest `patch + 1` → prompt
   (`? New version [0.1.1]:`) → semver + greater-than validation. Abort if the
   tag already exists.
3. **Build validation** — run `npm run build` (`tsc --noEmit && vite build`);
   abort on failure so a broken build never gets tagged.
4. **Version artifacts** — bump `package.json` `version`, prepend a dated
   `CHANGELOG.md` entry, and regenerate `src/version.ts` (auto-generated,
   never hand-edited; exports `VERSION`). Commit on `dev`:
   `chore: release vX.Y.Z`.
5. **Promote + tag** — no branch switching and no worktree needed: tag the new
   commit `vX.Y.Z`, then fast-forward the remote `prod` to it with
   `git push origin dev:prod`. A fast-forward push is not a force-push, so it
   respects the `prod` protection rules.
6. **Push** — `git push origin dev` and `git push origin vX.Y.Z`. The tag push
   triggers `pages.yml` and `release.yml`.

This keeps `prod` as an exact pointer to the released commit while never
disturbing the working tree. Roughly ~100 lines; reuses the sibling script's
version/prompt/semver helpers.

### Version badge (UI)

- A faint version label is shown in the **top-left corner** of the app, reading
  `VERSION` from the generated `src/version.ts` (rendered as `v0.1.1`).
- Styling: fixed position, top-left, low-contrast/muted color that works in both
  the light and dark theme, small font, `pointer-events: none` so it never
  intercepts clicks, and a low `z-index`-safe placement that does not overlap the
  interactive header (bucket bar). Purely decorative/informational.
- It renders on every screen (folder picker, sorting view, fallback), since it is
  a top-level overlay, not tied to a specific view.
- Before the first release, `src/version.ts` may not exist yet; the badge falls
  back to a dev placeholder (e.g. `dev`) or renders nothing, so the app builds
  and runs pre-release.

## Branch model

- `dev` (day-to-day work) → (merge) `main` (integration). Releases are cut from
  `dev` by `prod_deploy`, which fast-forwards `prod` to the released commit.
- **`prod` is release-only and protected.** Code reaches it only through
  `prod_deploy` (a tagged release); there are no casual pushes to `prod`.
- **Production is driven by `v*` tags, not branch pushes.** Cutting a `v*` tag
  is what deploys the web app and builds the desktop binaries. `prod` tracks the
  released commit, but the CI trigger is the tag.
- **Branch/tag protection (public repo, free):**
  - A GitHub *ruleset* on `prod`: block force-pushes and restrict deletions.
  - Tag protection on `v*`: only the owner may create/delete release tags.
  - **The owner must be able to push `prod`** so `prod_deploy` works — add the
    "Repository admin" role to the ruleset bypass list (or, with classic branch
    protection, admins bypass by default). Do **not** enable
    "Do not allow bypassing" / "include administrators", which would block the
    script's own fast-forward push.
  - Optionally, a `production` GitHub Environment with a required reviewer, so a
    deploy waits for manual approval.

## Manual setup (GitHub) — operator checklist

These are one-time GitHub configuration steps the repository owner must perform in
the web UI. They are **not** created by code; the CI workflows and `prod_deploy`
assume they are in place. Public repo → all of this is free.

### 1. Enable GitHub Pages (Actions source)

- `Settings → Pages → Build and deployment → Source: GitHub Actions`.
- No branch selection is needed (the `pages.yml` workflow publishes the artifact).

### 2. Protect the `prod` branch (ruleset)

- `Settings → Rules → Rulesets → New branch ruleset`.
- Name: `prod protection`; Enforcement status: **Active**.
- Target branches: **Include** → `prod`.
- Enable rules:
  - ✅ **Restrict deletions**
  - ✅ **Block force pushes**
- **Bypass list:** add **Repository admin** (role). This lets `prod_deploy`'s
  fast-forward push (`git push origin dev:prod`) succeed.
- ⚠️ Do **not** enable "Require a pull request before merging" here, and do
  **not** remove admin from the bypass list — either would block the deploy
  script's own push to `prod`.

### 3. Protect release tags `v*` (ruleset)

- `Settings → Rules → Rulesets → New tag ruleset`.
- Name: `release tags`; Enforcement status: **Active**.
- Target tags: **Include by pattern** → `v*`.
- Enable rules:
  - ✅ **Restrict creations** (only the bypass list may create matching tags)
  - ✅ **Restrict deletions**
  - ✅ **Block force pushes**
- **Bypass list:** add **Repository admin** — so only the owner (via
  `prod_deploy`) can cut `v*` release tags.

### 4. (Optional) Deploy approval gate

- If you want a manual approval before a release goes live:
  `Settings → Environments → New environment` → `production` → add yourself as a
  **Required reviewer**. Then the deploy job in `pages.yml` / `release.yml` must
  reference `environment: production`. This makes each deploy wait for your
  click. Skip unless you want that friction.

### Notes

- The desktop `release.yml` publishes GitHub Releases using the built-in
  `GITHUB_TOKEN`; it creates a **Release**, not a tag, so the tag ruleset does
  not block it. The `v*` tag itself is created by `prod_deploy` under your admin
  credentials (on the bypass list), so it is allowed.
- Because you are the sole admin, none of this locks you out — it prevents
  accidental direct pushes/force-pushes and casual tag creation, while leaving
  the scripted release path working.

## Testing

- **Web side (Vitest):**
  - `downloads.ts` OS detection → correct asset URL mapping (mocked
    `navigator`).
  - Fallback branch rendering driven by a mocked `isSupported()` (app vs
    fallback).
- **Electron:** not unit-tested. A **manual smoke checklist**, run for the
  verification spike and for every release:
  1. Launch the packaged binary.
  2. Pick a folder.
  3. Sort a few items.
  4. Verify real file moves on disk (files landed in the expected subfolders).

## Documentation

Per project rules, the README is updated in the same change:

- The `prod_deploy` script: what it does, how to call it (`npm run prod_deploy`),
  the version prompt, and that it is the only sanctioned release path.
- The Pages deployment flow and the tag-driven promotion.
- The new `electron:*` scripts (what they do, how to call them).
- The release flow (tag → CI → Releases).
- The warning that download links only resolve after the first desktop release.
- Add the new sections to the README table of contents.

## Non-goals (YAGNI for now)

- ❌ Auto-update (Electron autoUpdater) — later.
- ❌ Code signing / notarization — later.
- ❌ Mobile (Capacitor) — separate project.
- ❌ Tauri — Electron was chosen.
- ❌ Custom domain — the `github.io` subpath is enough (relative base handles it).

## Primary risk & verification-first step

The single biggest unknown is whether the File System Access API works inside the
packaged Electron app under the custom secure protocol. Before building the full
pipeline, run a ~30-minute spike: package a minimal Electron build, then run the
manual smoke checklist (pick a folder, perform one real file move). Only proceed
to the release pipeline once the spike passes. If the custom protocol fails, fall
back to the localhost static-server approach described above.
