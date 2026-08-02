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
