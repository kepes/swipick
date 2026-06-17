# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Show current filename above the control buttons during sorting

### Changed

- Number bucket folders when target directory already exists (e.g. `b/` → `b_01/` → `b_02/`); the trash bucket (`_torolt`) is still reused across sorts
- Tinder view now fills the full viewport; header, footer, and progress badge overlay the image instead of stacking below it
- Basket bar background is now transparent (removed elevated background and bottom border)

### Fixed

- Media card now re-renders once its object URL is ready, preventing a blank card on first display
