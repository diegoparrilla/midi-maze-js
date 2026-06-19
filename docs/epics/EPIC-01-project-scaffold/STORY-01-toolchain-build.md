---
id: STORY-01
epic: EPIC-01
title: Toolchain & build (Vite + TS + static output)
status: done
---

## Goal

A working Vite + TypeScript project with dev server and a production static build.

## Tasks

- [x] `npm init` + add Vite, TypeScript; `tsconfig.json` with strict mode
- [x] `index.html` + `src/main.ts` rendering a placeholder 320×200 canvas
- [x] `npm run dev` (dev server) and `npm run build` (static `dist/`) scripts
- [x] `npm run preview` to serve the built bundle
- [x] `.gitignore` for `node_modules/` and `dist/` (repo already ignores `dist/`)

## Acceptance

**Automated:** `npm run build` exits 0 and produces `dist/index.html` + assets.
**Manual (user):** `npm run dev`, open the URL, see the placeholder canvas on
desktop and on your phone (same LAN).

## Notes

Single-page, no SSR. Strict TS from day one — the sim core depends on it (C-02).
