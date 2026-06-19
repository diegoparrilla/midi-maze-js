---
id: STORY-02
epic: EPIC-01
title: Test & lint harness (Vitest + linter)
status: done
---

## Goal

Automated test and lint commands wired up so every later story can add specs.

## Tasks

- [x] Add Vitest; `npm test` runs the suite; `npm run test:watch` for the loop
- [x] One trivial passing spec proving the runner works (`src/upscale.test.ts`)
- [x] Add linter + formatter config; `npm run lint` (ESLint + Prettier)
- [x] Document the loop in the root `README.md` (build/dev/test/lint)

## Acceptance

**Automated:** `npm test` and `npm run lint` both exit 0.
**Manual (user):** none beyond seeing green.

## Notes

Vitest is the home for golden-master specs (D-07). Keep config minimal.
