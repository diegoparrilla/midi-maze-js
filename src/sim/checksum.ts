// A compact signature of the deterministic sim state, for spotting desync against
// another node (browser, Hatari, or a real ST bridge). Every node steps the identical
// joystick table, so after each tick all nodes must hold the identical world — and thus
// the identical checksum. A drift between two screens localizes a desync to the tick it
// first appears. FNV-1a/32; covers the per-tick-mutated player fields (D-02, C-02).
import type { World } from './world';

const FNV_PRIME = 0x01000193;

/** FNV-1a hex checksum over every player/drone's live integer state. */
export function worldChecksum(world: World): string {
  let h = 0x811c9dc5;
  const mix = (v: number): void => {
    for (let s = 0; s < 32; s += 8) {
      h ^= (v >>> s) & 0xff;
      h = Math.imul(h, FNV_PRIME);
    }
  };
  for (let i = 0; i < world.playerAndDroneCount; i++) {
    const p = world.players[i]!;
    mix(p.ply_x);
    mix(p.ply_y);
    mix(p.ply_dir);
    mix(p.ply_lives);
    mix(p.ply_score);
    mix(p.ply_reload);
    mix(p.ply_shoot);
    mix(p.ply_shooty);
    mix(p.ply_shootx);
    mix(p.ply_shootr);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
