// One deterministic game tick (maingame.c main loop body, minus rendering and the
// network/MIDI exchange). The network layer (EPIC-14) feeds in the joystick byte
// for every player; this advances the whole world identically on every node (D-02).
import { droneAction } from './drone';
import { movePlayer } from './movement';
import type { World } from './world';

/**
 * Advance the world one tick from `joyTable` (one joystick byte per player slot).
 * Order matches maingame.c: rebuild the object map, let every drone pick its own
 * joystick byte, reset hit flags, then move every player starting from a rotating
 * index, breaking early once a winner is found. The drone slots of `joyTable` are
 * ignored — `drone_action` overwrites them. Returns false on "maze too small".
 */
export function step(world: World, joyTable: readonly number[], dronesActiveFlag = 0): boolean {
  world.setAllPlayer();

  // Drones generate their own joystick bytes (slots machinesOnline..count).
  const joy = joyTable.slice();
  for (let i = world.machinesOnline; i < world.playerAndDroneCount; i++) droneAction(world, i, joy);

  for (let i = 0; i < world.playerAndDroneCount; i++) world.players[i]!.ply_hitflag = 0;

  let i = world.playerIndex;
  do {
    if (!movePlayer(world, i, joy[i]!, dronesActiveFlag)) return false;
    if (!world.weDontHaveAWinner) break;
    if (--i < 0) i = world.playerAndDroneCount - 1;
  } while (i !== world.playerIndex);

  if (++world.playerIndex === world.playerAndDroneCount) world.playerIndex = 0;
  return true;
}
