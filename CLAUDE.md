# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project

`midi-maze-js` — a **wire-faithful** TypeScript/browser re-creation of **MIDI Maze**,
ported from the reconstructed C source at
https://github.com/sarnau/AtariST-MIDIMaze-Source (cloned read-only as a sibling:
`../AtariST-MIDIMaze-Source/`). The goal: browsers playing MIDI Maze against real
Atari STs through the `md-MIDI2IP` orchestrator (WebSocket relay) during a
presentation talk (`../midi-maze-atarist-presentation/`).

**Key architectural fact:** MIDI Maze is a **lock-step deterministic simulation**.
Only one joystick byte per player per tick crosses the wire; every node recomputes
the whole world locally from the shared maze + shared RNG seed + shared joystick
stream. The hard part is reproducing the integer simulation *exactly* (no floats) so
the browser never desyncs from real hardware — not the networking.

- **Stack:** TypeScript + Vite + Vitest, built to a static page (mobile + desktop).
- **Plan & tracking:** `docs/epics/` (iterations → epics → stories → tasks). Read
  `docs/epics/ITERATIONS.md` and `docs/epics/DECISIONS.md` first; run
  `./docs/epics/cockpit.sh` to regenerate `docs/epics/STATUS.md` (never edit by hand).
- **Reference:** when porting behaviour, the original C wins. Tie changes to the
  relevant `file:line` in `../AtariST-MIDIMaze-Source/src/`.

---

## Working style

These behavioral guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think before coding

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity first

Minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical changes

Touch only what you must. Clean up only your own mess.
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- When your changes orphan an import/variable/function, remove it. Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

### 4. Goal-driven execution

Define success criteria. Loop until verified.
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan with a verification check per step.

### 5. No AI attribution

Never add AI-tool attribution to commits, PR descriptions, code comments,
docs, or any other artifact. This means **no**:
- "Generated with Claude Code", "Co-authored by Claude", "Made with ChatGPT",
  or any similar phrasing.
- `Co-Authored-By: Claude …`, `Co-Authored-By: ChatGPT …`, or any other
  AI co-author trailer.
- "AI-assisted", "written with the help of an LLM", etc., as comments or
  changelog entries.

Write the message as the human author. Do not mention AI tools used to
produce the work.
