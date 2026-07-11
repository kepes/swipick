# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Show current filename above the control buttons during sorting
- Establish English as the project's language policy (documented in CLAUDE.md)
- Add UI design brief document for designer handover, describing the current UI screen by screen (`docs/ui-design-brief.md`)
- Add a light/dark theme toggle

### Changed

- Redesign the entire app with a new warm/coral "Playroom" visual language: chunky ink outlines, hard offset shadows, pressable keycap-style buttons, and Sora typography, applied across the sorting screen, start screen, done screen, and result screen
- Number bucket folders when target directory already exists (e.g. `b/` → `b_01/` → `b_02/`); the trash bucket (`_torolt`) is still reused across sorts
- Tinder view now fills the full viewport; header, footer, and progress badge overlay the image instead of stacking below it
- Basket bar background is now transparent (removed elevated background and bottom border)
- Translate the entire project to English (UI strings, code comments, tests, README, and docs); app name changed from "Képrendező" to "Swipick"
- Rename Hungarian identifiers: the on-disk deleted-files folder `_torolt` to `_deleted`, the npm package name `keprendezo` to `swipick`, and the Hungarian-named docs to `swipick-*`

### Fixed

- Media card now re-renders once its object URL is ready, preventing a blank card on first display
