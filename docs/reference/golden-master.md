# Golden-master reference

Determinism is the make-or-break for wire-faithful interop (D-02, D-07, C-02): a
browser must compute the *exact* same world as a real Atari ST from the same maze +
seed + joystick stream, or it desyncs. We guard this by comparing our TypeScript
against reference data derived from the original.

## What exists now (EPIC-03)

| Vector | Source of truth | Checked by |
| --- | --- | --- |
| **Sine table** (65 words) | `MIDIMAZE.D8A` @ `0x0AAD8`, extracted to `src/assets/generated/sine.json` | `src/assets.test.ts` asserts each entry `== trunc(sin(i/256·2π)·256)` |
| **Maze grids** | original `.MAZ` files → `src/assets/generated/mazes/*.json` | `src/maze.test.ts` (independent ASCII parse) + `src/assets.test.ts` (generated == loader) |
| **Palette** (16 colours) | `read_d8a.py` constant → `palette.json` | `src/assets.test.ts` count + RGB range |

Regenerate everything with `npm run assets` (reads `assets-src/`, writes
`src/assets/generated/`).

### Determinism facts locked here

- **Sine table is `(int)(sin·256)` — truncated, not rounded.** 30 of 65 entries
  differ from `Math.round`. `fast_sin`/`rotate2d`/`xy_speed_table` must use this
  exact table (EPIC-04), so the sim should read `sine.json`, never recompute.
- Angles are **0..255** (256 = 360°); positions are fixed-point in **1/256-cell**
  units (`MAZE_CELL_SIZE = 256`). No floats in the sim core (C-02, D-09).
- Maze grid is 64×64; cells beyond the file `size` and out-of-bounds are the 1×1
  checkerboard `(y & x & 1) ? EMPTY : WALL` (`maze_obj.c`).

## Deferred to EPIC-04: the C trace harness

Movement, shot, and shared-RNG traces are only useful once `move_player`,
`fast_sin`/`rotate2d`, and `rnd.c` are being ported — so the harness lands at the
**start of EPIC-04**, alongside the code it checks. Plan:

1. Carve the pure-logic C into a tiny headless CLI: `gamelogi.c` (move/collide/shoot),
   `fastmath.c` (rotate2d, fast_sin/cos), `rnd.c` (shared PRNG), `maze_obj.c`
   (get/set), plus the `xy_speed_table` init and the relevant `globals.h` state.
   Stub the rendering/AES/MIDI externs (they don't affect the simulation).
2. Feed it a fixed maze + seed + scripted `player_joy_table[]` sequence; dump a
   per-tick CSV/JSON of every player's `ply_x/ply_y/ply_dir`, shot state, and
   `ply_score`. Also dump the raw `Random()` sequence for a known seed.
3. Commit the traces under `src/assets/generated/vectors/`; the EPIC-04 sim specs
   assert bit-for-bit equality against them.

The original compiles on macOS (`README.md`), but as an Xcode AppKit app — hence
the carve-out into a standalone CLI rather than reusing the app target.
