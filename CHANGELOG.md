# Changelog

Notable changes to `@particle-academy/fancy-pwa`.

**BREAKING** marks anything that can stop working on upgrade. This package is
pre-1.0, so breaking changes land in MINOR releases — read those entries before
upgrading.

> Entries below **1.0** were reconstructed from git history when this file was
> introduced, so they summarise commit subjects rather than consumer impact.
> Everything from the next release onward is written by hand, in the same commit
> as the change.

---

## [Unreleased]

## 0.2.0 — 2026-08-07

### Changed

- **BREAKING — Node 22 is now declared as the floor.** `engines.node` is `>=22`, where this package previously declared **nothing at all**.

  Declaring nothing was not the same as supporting old Node: a consumer on 18 installed cleanly and found out at runtime.

  **What you must do:** on Node 22 or newer, nothing. Note npm only *warns* on an `engines` mismatch while **pnpm fails the install**, so this surfaces differently depending on your package manager. Node 18 is end-of-life and 20 is maintenance-only.

- **BREAKING — React 18 is no longer supported.** `peerDependencies.react` / `react-dom` are now `^19.0.0`.

  **What you must do:** on React 19, nothing. On React 18, stay on the previous release, or upgrade your app to 19 first.

  React 18 support was a claim nothing tested — every build and test in this package ran against 19, so the 18 half of the old range was never executed. An untested compatibility claim is worse than an absent one, because it reads as support.

### Why

These are the kit 0.5 platform floors, applied across every package at once so a consumer never has to resolve a mix. **No API changed, nothing was removed, nothing was renamed** — only what the package requires.


## 0.1.7 — 2026-06-27

### Fixed

- **vite:** drop bad-tag-filter regexp from SW-registration injection

## 0.1.6 — 2026-06-19

- Maintenance only (2 internal commits).

## 0.1.5 — 2026-06-18

### Fixed

- **vite:** skip CSS-only facade entry chunks in precache (0.1.5)

## 0.1.4 — 2026-06-18

### Fixed

- **vite:** skip SSR build + precache the app shell only (0.1.4)

## 0.1.3 — 2026-06-18

### Fixed

- **build:** keep esbuild external in the /vite plugin bundle (0.1.3)

## 0.1.2 — 2026-06-18

### Fixed

- **vite:** bundle the service worker (inline imports) so classic SWs evaluate (0.1.2)

## 0.1.1 — 2026-06-18

### Fixed

- **vite:** respect Vite's resolved base in precache URLs + injected hrefs (0.1.1)

## 0.1.0 — 2026-06-18

### Added

- fancy-pwa v0.1.0 — installable + offline PWA layer for Fancy UI
