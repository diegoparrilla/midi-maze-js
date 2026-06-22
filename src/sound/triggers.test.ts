import { describe, expect, it } from 'vitest';
import type { World } from '../sim/world';
import { detectSfx } from './triggers';

type P = { ply_reload: number; ply_hitflag: number; ply_gunman: number };

/** A minimal World stand-in: just the fields detectSfx reads. */
function world(players: P[]): World {
  return { players, playerAndDroneCount: players.length } as unknown as World;
}

const p = (over: Partial<P> = {}): P => ({
  ply_reload: 0,
  ply_hitflag: 0,
  ply_gunman: -1,
  ...over,
});

describe('detectSfx', () => {
  it('fires a shot when reload rises from 0', () => {
    const w = world([p({ ply_reload: 9 })]);
    expect(detectSfx(w, 0, 0)).toEqual({ shot: true, hit: false, reload: 9 });
  });

  it('does not re-fire while the reload counts down', () => {
    const w = world([p({ ply_reload: 6 })]);
    expect(detectSfx(w, 0, 7).shot).toBe(false);
  });

  it('plays a hit when the camera player is hit', () => {
    const w = world([p({ ply_hitflag: 1 })]);
    expect(detectSfx(w, 0, 0)).toMatchObject({ shot: false, hit: true });
  });

  it('plays a hit when a player the camera shot got hit', () => {
    const w = world([p(), p({ ply_hitflag: 1, ply_gunman: 0 })]);
    expect(detectSfx(w, 0, 0).hit).toBe(true);
  });

  it('ignores hits between other players', () => {
    const w = world([p(), p({ ply_hitflag: 1, ply_gunman: 2 }), p()]);
    expect(detectSfx(w, 0, 0).hit).toBe(false);
  });

  it('returns the current reload to feed back next tick', () => {
    const w = world([p({ ply_reload: 5 })]);
    expect(detectSfx(w, 0, 5).reload).toBe(5);
  });
});
