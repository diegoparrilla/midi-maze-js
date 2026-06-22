---
id: STORY-01
epic: EPIC-25
title: Build & deploy basics in the README
status: done
---

## Goal

A reader can build and run the app, and knows how to deploy the built bundle, from the
README alone.

## Tasks

- [x] **Building** section: `npm install` / `dev` / `build` / `preview` / `test` / `lint`,
      and that `dist/` is a self-contained static page.
- [x] **Deploying a build** section: `dist/` is static files for any HTTP host; `base: './'`
      makes it path/domain-agnostic.
- [x] Document the HTTP-vs-HTTPS constraint for networked play (mixed content blocks `ws://`
      from HTTPS; Private Network Access blocks a public page from a local/LAN orchestrator),
      so HTTP hosting is required for a local `ws://` orchestrator.

## Acceptance

**Automated:** none (docs). **Manual:** following the README, a new user builds, runs, and
understands where/how to host the result.
