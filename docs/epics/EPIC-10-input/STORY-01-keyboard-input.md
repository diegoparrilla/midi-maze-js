---
id: STORY-01
epic: EPIC-10
title: Keyboard → joystick byte
status: done
---

## Goal

Turn input into the joystick byte the sim consumes (`JOYSTICK_*` bits), matching the
original bitmask. (Delivered in `main.ts`; recorded here for tracker accuracy.)

## Tasks

- [x] Track held keys; map arrows → UP/DOWN/LEFT/RIGHT, space → FIRE (`main.ts:joyByte`)
- [x] Feed the byte into `step()` each tick
- [x] Bits match `globals.h` (UP 0x01, DOWN 0x02, LEFT 0x04, RIGHT 0x08, BUTTON 0x10)

## Acceptance

**Automated:** build/lint green.
**Manual (user):** arrows move/turn, space fires in the running app.

## Notes

Mouse/joystick-device input (`joystickmouse.c`) is N/A for the browser; touch is
EPIC-11. The mapping is currently inline in `main.ts` and could be extracted to a
small input module if it grows.
