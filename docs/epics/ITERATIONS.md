# Iterations

The road from an empty repo to **browsers playing MIDI Maze against real Atari STs
through the md-MIDI2IP orchestrator during the presentation talk**.

Each iteration ends in something verifiable by **automated tests** and by **you**
playing it. Epics are listed under each iteration; `EPIC-NN` numbers are global.
Stories for the current/next iteration are authored in full; later iterations are
mapped at the epic level and fleshed out just-in-time.

---

## Iteration 1 — Foundations & reference harness

**Goal:** stand up the project, the tracker, the original assets, and a golden
reference so every later iteration can prove it matches the original.

**Verify:** `npm test` is green, `npm run build` emits a static page, the cockpit
renders, and reference vectors (maze decode, sine table) are committed.

| Epic | Goal |
| --- | --- |
| EPIC-01 · Project scaffold & tooling | Vite + TypeScript + Vitest, lint, static build, dev server. |
| EPIC-02 · Development tracker | This `docs/epics/` system + `cockpit.sh` + `STATUS.md`. |
| EPIC-03 · Asset & maze extraction + reference vectors | Extract `.D8A` shapes/sine and load the `.MAZ` maze; generate golden vectors from the C/Python. |

## Iteration 2 — Solo playable (offline)

**Goal:** a single-player, pixel-faithful MIDI Maze vs drones running entirely in
the browser, with no networking.

**Verify:** you play it vs drones in a browser; the sim reproduces the golden
movement/shot traces exactly.

| Epic | Goal |
| --- | --- |
| EPIC-04 · Deterministic simulation core | Fixed-point player/shot model, movement, wall/player collision, shooting, kills, shared RNG — golden-tested against the C. |
| EPIC-05 · Maze model & loader | Parse `.MAZ` (ASCII) into a 64×64 grid; access matching `maze_obj.c`; optional `.MZE` (MIDI Maze 2) import later. |
| EPIC-06 · Pixel-faithful wall renderer | 320×200 view, perspective wall-trapezoid projection, sky/floor, draw list. |
| EPIC-07 · Sprites, shadows & HUD | Distance-scaled eyeball faces, shadows, crosshair, happy indicator, scoreboard. |
| EPIC-08 · Drone AI parity | Target / standard / ninja drones reproducing `drone.c`. |
| EPIC-09 · Solo game flow | Init → countdown → play → win/lose, tying the core to the renderer and input. |

## Iteration 3 — Controls & mobile

**Goal:** playable on a phone as a standalone web page with touch controls.

**Verify:** you play it on your own phone in a mobile browser.

| Epic | Goal |
| --- | --- |
| EPIC-10 · Input system | Keyboard/mouse → joystick byte (`JOYSTICK_*` bits), matching `joystickmouse.c`. |
| EPIC-11 · Touch controls & responsive shell | On-screen D-pad + fire, integer-upscaled responsive canvas, fullscreen, orientation. |

## Iteration 4 — Networking (browser ↔ browser via orchestrator)

**Goal:** two or more browsers play one game through the real orchestrator, using
the wire-faithful protocol; a browser can be master or slave.

**Verify:** two browser tabs/phones play a full game via `orchestrator.py --ws`;
each appears on the orchestrator status ring.

| Epic | Goal |
| --- | --- |
| EPIC-12 · WebSocket transport client | Binary-frame byte pipe to the orchestrator; room join via `Authorization: Bearer`; reconnect. |
| EPIC-13 · Protocol: election, count, seed, send-data | Master election (`0x00`; reply→master), player count (`0x80`), and the `MIDI_SEND_DATA` (0x83) block (names, maze grid, timings, teams, RNG seed). |
| EPIC-14 · Per-tick ring loop & lock-step pump | The `maingame.c` send/receive ring loop over the async transport; control bytes (`0x81–0x86`). |
| EPIC-15 · Browser master mode | Menus/maze-select/start driving the ring as master; slave follows. |
| EPIC-16 · Browser-vs-browser validation | End-to-end multiplayer correctness; no desync between browsers. |

## Iteration 5 — Wire-faithful interop with real hardware

**Goal:** a browser shares one ring with Hatari / a real Atari ST through the
orchestrator — the presentation goal.

**Verify:** a browser eyeball moves in the same maze as a real ST player, kills
and respawns stay in sync over the talk's duration.

| Epic | Goal |
| --- | --- |
| EPIC-17 · Determinism hardening & desync detection | Fuzz the sim against reference; detect & diagnose divergence; lock down fixed-point edge cases. |
| EPIC-18 · Mixed-ring interop | Validate a browser + Hatari (+ real ST) in one ring; reconcile any protocol gaps. |
| EPIC-19 · Latency/timeout tuning | Tune the lock-step pump for internet latency without breaking the timeout model. |

## Iteration 6 — Presentation polish

**Goal:** presentation-ready — menus, sound, end screens, robustness.

**Verify:** a full session (lobby → multiple rounds → results) runs unattended on
phones in a room during a dry run of the talk.

| Epic | Goal |
| --- | --- |
| EPIC-20 · Menus & dialogs | Prefs (reload/regen/revive, drones), teams, name entry, maze select. |
| EPIC-21 · Sound | Shot/hit sounds — synthesised per `sound.c` (YM2149) via WebAudio, or recreated SFX (not in the `.D8A`). |
| EPIC-22 · Popchart, noteboard & end animations | Kill chart, score noteboard, win/lose tongue/blink animations. |
| EPIC-23 · Presentation hardening | Multiple rooms, reconnect mid-game, performance on low-end phones. |
