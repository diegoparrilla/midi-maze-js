---
id: EPIC-01
iteration: 1
title: Project scaffold & tooling
status: done
---

## Goal

A clean TypeScript + Vite + Vitest project that builds to a single static page
launchable from any mobile/desktop browser, with the test and lint loop that every
later epic relies on (D-03).

## Scope

- In scope: `package.json`, Vite config, TypeScript config, Vitest setup, lint/format,
  a trivial canvas "hello" page proving dev server + build + test all work.
- Out of scope: any game logic, networking, or rendering (later epics).

## Stories

- STORY-01: Toolchain & build (Vite + TS + static output)
- STORY-02: Test & lint harness (Vitest + linter + CI-able scripts)

## Notes

Output must be a self-contained static bundle (no server runtime) so it can be hosted
anywhere or served by the orchestrator's HTTP. Keep dependencies minimal.
