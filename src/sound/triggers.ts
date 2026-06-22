// Decide which SFX the local (camera) player should hear this tick by reading the
// post-step world — keeps audio out of the deterministic sim (the C plays these inline
// at gamelogi.c:126 / 347 and maingame.c:236). Pure; unit-tested.
import type { World } from '../sim/world';

export interface SfxEdges {
  /** the camera player fired this tick (reload rose from 0) */
  shot: boolean;
  /** the camera player was hit, or a player it shot was hit, this tick */
  hit: boolean;
  /** the camera player's reload after this tick — feed back as `prevReload` next call */
  reload: number;
}

/**
 * `prevReload` is the camera player's `ply_reload` from the previous tick. A shot fires
 * only on the tick reload rises from 0 (`gamelogi.c:126`: button & reload==0; reload is
 * then set and decremented once, so it is > 0 here). A hit plays when the camera player's
 * `ply_hitflag` is set, or when a player it shot got hit this tick (`ply_gunman`).
 */
export function detectSfx(world: World, cameraIndex: number, prevReload: number): SfxEdges {
  const me = world.players[cameraIndex]!;
  const shot = prevReload === 0 && me.ply_reload > 0;

  let hit = me.ply_hitflag === 1;
  if (!hit) {
    for (let i = 0; i < world.playerAndDroneCount; i++) {
      const p = world.players[i]!;
      if (p.ply_hitflag === 1 && p.ply_gunman === cameraIndex) {
        hit = true;
        break;
      }
    }
  }
  return { shot, hit, reload: me.ply_reload };
}
