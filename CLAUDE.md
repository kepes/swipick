# Project instructions

## Language

- **The language of this project is English.** All code comments, documentation
  (README, CHANGELOG, specs, design docs, plans), commit messages, identifiers,
  UI strings, and any other prose committed to the repository must be written in
  English. Do not introduce Hungarian (or any other non-English) text into the
  codebase.

## Release & branches

- **`prod` is release-only.** Never push directly to `prod`, and never treat it
  as a working branch. Code reaches `prod` only as a tagged release: a commit
  that carries a `v*` version tag.
- **Releases are tag-driven.** Cutting a `v*` tag is what promotes code to
  production — it drives both the GitHub Pages web deploy and the desktop binary
  build. No casual pushes trigger a production release.
- **`prod` is a protected branch** (GitHub ruleset: no direct push, no
  force-push, PR required) and `v*` tags are protected. Do not propose or make
  changes that assume direct write access to `prod`.
- Day-to-day work happens on `dev`; `main` is the integration branch.

## Documentation layout

- **No `docs/superpowers/` directory.** Specs and plans live directly under
  `docs/` — never nest them inside a `superpowers/` folder.
  - Design docs / specs → `docs/specs/YYYY-MM-DD-<topic>-design.md`
  - Implementation plans → `docs/plans/YYYY-MM-DD-<topic>-plan.md`
- The Superpowers workflows (brainstorming, writing-plans, etc.) must write
  their output to these locations, not to `docs/superpowers/…`.
