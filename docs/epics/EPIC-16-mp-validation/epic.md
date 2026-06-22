---
id: EPIC-16
iteration: 4
title: Browser-vs-browser validation
status: done
---

## Goal

End-to-end multiplayer correctness; zero desync between browser nodes through the real orchestrator.

## Stories

- STORY-01: Browser-vs-browser lock-step validation — 2- and 3-node `NetGame`s exchange
  joysticks over a simulated orchestrator ring; all nodes stay byte-identical
  (`worldChecksum`) every tick, and a master quit ends all nodes via the TERMINATE
  two-step. `done`. (A live two-browser run through the real orchestrator is the remaining
  manual check.)

## Notes

See ITERATIONS.md for where this epic sits and the original C under
`../../../AtariST-MIDIMaze-Source/` for the authoritative behaviour.
