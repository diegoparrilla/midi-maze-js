---
id: STORY-01
epic: EPIC-23
title: Low-end phone render perf (run-batched blits)
status: done
---

## Goal

Cut the per-frame canvas work on low-end phones. The sprite/HUD blitter emitted one 1×1
`fillRect` per set pixel — hundreds of draw calls per sprite, the hot path — so every
eyeball, the health face, scoreboard and kills window were death-by-a-thousand-fillRects.

## Tasks

- [x] `render/blit.ts` `blitRuns`: coalesce each mask row's consecutive set bits into a
      single horizontal `fillRect` (run-length), drawing the identical pixels with far
      fewer calls. Pure + unit-tested (correctness + coalescing).
- [x] Route both `blitMask`s (`shapes.ts` view-relative, `hud.ts` absolute) through it.

## Acceptance

**Automated:** `blitRuns` unit-tested (run coalescing, gaps, `startRow`, exact pixel
coverage); the existing sprite/render golden tests still pass (output is byte-identical,
just batched); build/lint green. **Manual (user):** smoother play on a low-end phone.

## Notes

A full ImageData framebuffer would cut more but is a large, risky rewrite touching every
draw module; run-batching is strictly fewer/equal canvas ops, provably correct, and zero
architectural change. Walls already draw as box + per-scanline `fillRect` (a slanted edge
is unavoidably 1px-tall lines), so they were left as-is.
