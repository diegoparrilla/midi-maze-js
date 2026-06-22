// EPIC-16: end-to-end browser-vs-browser correctness. Two (and three) NetGame nodes
// exchange joysticks over a simulated orchestrator ring (OUT(N) → IN(N+1)) for a full
// run; every node must hold the identical world each tick (worldChecksum, C-02) — the
// definition of "zero desync between browsers". Setup agreement is covered by
// handshake.test.ts; this covers the lock-step gameplay loop and the TERMINATE end.
import { describe, expect, it } from 'vitest';
import { loadMazeById } from '../game/mazes';
import type { Maze } from '../maze';
import { worldChecksum } from '../sim/checksum';
import { JOYSTICK_BUTTON, JOYSTICK_LEFT, JOYSTICK_RIGHT, JOYSTICK_UP } from '../sim/movement';
import { Rng } from '../sim/rng';
import { initAllPlayer } from '../sim/setup';
import { World } from '../sim/world';
import { NetGame } from './netgame';
import { MIDI_TERMINATE_GAME } from './protocol';
import { ByteChannel } from './ring';

/** N channels wired as an orchestrator ring: channel i's output → channel (i+1)%N's input.
 *  queueMicrotask keeps it async (like the real transport), no synchronous re-entrancy. */
function ringN(n: number): ByteChannel[] {
  const chans: ByteChannel[] = [];
  for (let i = 0; i < n; i++) {
    const target = (i + 1) % n;
    chans.push(new ByteChannel((b) => queueMicrotask(() => chans[target]!.push(b.slice()))));
  }
  return chans;
}

function makeWorld(maze: Maze, seed: number, count: number): World {
  const w = new World(maze, new Rng(seed));
  w.machinesOnline = count;
  expect(initAllPlayer(w, count)).toBe(true); // same seed → identical placement on every node
  return w;
}

/** Drive `count` NetGames over an N-node ring for `ticks`, asserting all worlds stay
 *  byte-identical each tick. `scripts[i][t]` is node i's joystick byte at tick t. */
async function playInLockStep(
  maze: Maze,
  seed: number,
  count: number,
  ticks: number,
  scripts: number[][],
): Promise<void> {
  const chans = ringN(count);
  const worlds = Array.from({ length: count }, () => makeWorld(maze, seed, count));
  // identical start
  const start = worldChecksum(worlds[0]!);
  for (const w of worlds) expect(worldChecksum(w)).toBe(start);

  const games: NetGame[] = worlds.map(
    (world, i) =>
      new NetGame({
        world,
        ownNumber: i,
        machinesOnline: count,
        localInput: () => scripts[i]![games[i]!.tick] ?? JOYSTICK_UP,
        timeoutMs: 1000, // pinned so a deadlock fails fast instead of hanging
      }),
  );

  for (let t = 0; t < ticks; t++) {
    const ends = await Promise.all(games.map((g, i) => g.runTick(chans[i]!)));
    for (const e of ends) expect(e).toBeNull();
    const ref = worldChecksum(worlds[0]!);
    for (let i = 1; i < count; i++) expect(worldChecksum(worlds[i]!)).toBe(ref);
    // every node observed the identical joystick ring this tick
    for (let i = 1; i < count; i++) expect(games[i]!.lastJoy).toEqual(games[0]!.lastJoy);
  }
}

describe('browser-vs-browser lock-step (EPIC-16)', () => {
  const maze = loadMazeById('midimaze');

  it('two browsers stay bit-identical across a full exchange', async () => {
    const m = [JOYSTICK_UP | JOYSTICK_BUTTON, JOYSTICK_UP, JOYSTICK_LEFT, JOYSTICK_UP];
    const s = [JOYSTICK_RIGHT, JOYSTICK_UP, JOYSTICK_UP, JOYSTICK_RIGHT | JOYSTICK_BUTTON];
    const scriptM = Array.from({ length: 60 }, (_, t) => m[t % m.length]!);
    const scriptS = Array.from({ length: 60 }, (_, t) => s[t % s.length]!);
    await playInLockStep(maze, 0x1234, 2, 60, [scriptM, scriptS]);
  });

  it('three browsers stay bit-identical (ring routing for > 2 nodes)', async () => {
    const scripts = [
      Array.from({ length: 48 }, (_, t) => (t % 3 ? JOYSTICK_UP : JOYSTICK_LEFT)),
      Array.from({ length: 48 }, (_, t) =>
        t % 2 ? JOYSTICK_RIGHT : JOYSTICK_UP | JOYSTICK_BUTTON,
      ),
      Array.from({ length: 48 }, () => JOYSTICK_UP),
    ];
    await playInLockStep(maze, 0x5a5a, 3, 48, scripts);
  });

  it('both nodes end cleanly when the master quits (TERMINATE two-step)', async () => {
    const chans = ringN(2);
    const worldM = makeWorld(maze, 0x2222, 2);
    const worldS = makeWorld(maze, 0x2222, 2);
    let quit = false;
    const games = [
      new NetGame({
        world: worldM,
        ownNumber: 0,
        machinesOnline: 2,
        localInput: () => (quit ? MIDI_TERMINATE_GAME : JOYSTICK_UP),
        timeoutMs: 1000,
      }),
      new NetGame({
        world: worldS,
        ownNumber: 1,
        machinesOnline: 2,
        localInput: () => JOYSTICK_UP,
        timeoutMs: 1000,
      }),
    ];
    // play a few ticks, then the master injects TERMINATE
    for (let t = 0; t < 3; t++) {
      const ends = await Promise.all([games[0]!.runTick(chans[0]!), games[1]!.runTick(chans[1]!)]);
      expect(ends).toEqual([null, null]);
    }
    quit = true;
    const ends = await Promise.all([games[0]!.runTick(chans[0]!), games[1]!.runTick(chans[1]!)]);
    expect(ends).toEqual(['terminated', 'terminated']);
  });
});
