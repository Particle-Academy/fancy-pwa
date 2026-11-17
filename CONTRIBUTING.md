# Contributing to @particle-academy/fancy-pwa

Notes for anyone, human or agent, working ON this package's code. How to USE the
package is in [AGENTS.md](./AGENTS.md); what it is, is in [README.md](./README.md).
`CLAUDE.md` is a symlink to this file, so Claude Code reads these notes when it
works in this repo.

## Build and test

```bash
npm run build       # tsup
npm run dev         # tsup --watch
npm run lint        # tsc --noEmit && eslint .
npm test            # vitest run
```

- Tests live in `test/`.
- Entries: `.` (React hooks, components, provider), `./vite` (the build
  plugin), `./sw` (the service-worker strategy toolkit), `./styles.css`.
- Every hook is window-guarded with no module-level browser access, so the
  package imports cleanly into an SSR bundle; `test/ssr.test.tsx` covers it.
- `@particle-academy/fancy-auto-common` is a lazily imported optional peer:
  absent, the activity broadcast is a silent no-op.

## Changelog

Update `CHANGELOG.md` (`## [Unreleased]`) in the same commit as the change.
