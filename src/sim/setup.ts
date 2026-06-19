// Deterministic player placement (setup.c). Runs the shared RNG in the exact same
// call order as the original so every node lands players in identical spots (D-02).
import { MAZE_FIELD_EMPTY, MAZE_FIELD_WALL, MAZE_MAX_SIZE } from '../maze';
import { MAZE_CELL_SIZE } from './speed-table';
import {
  MAZE_FIELD_SHIFT,
  PLAYER_DIR_EAST,
  PLAYER_DIR_NORTH,
  PLAYER_DIR_SOUTH,
  PLAYER_DIR_WEST,
  PLAYER_MAX_LIVES,
  type World,
} from './world';

/** hunt_ply_pos: find a free, non-boxed-in cell for `player`, keeping distance to
 *  the others (relaxing over retries), then a cardinal facing. Returns false if
 *  no spot found in 666 tries (maze too small). */
export function huntPlyPos(world: World, player: number): boolean {
  const p = world.players[player]!;
  let noValid = true;
  for (let tries = 0; tries < 666 && noValid; tries++) {
    const fieldY = world.rng.rnd(world.mazeSize) | 1;
    const fieldX = world.rng.rnd(world.mazeSize) | 1;
    if (world.getMazeData(fieldY, fieldX) !== MAZE_FIELD_EMPTY) continue;

    let wallCount = 0;
    if (world.getMazeData(fieldY - 1, fieldX) === MAZE_FIELD_WALL) wallCount++;
    if (world.getMazeData(fieldY, fieldX - 1) === MAZE_FIELD_WALL) wallCount++;
    if (world.getMazeData(fieldY + 1, fieldX) === MAZE_FIELD_WALL) wallCount++;
    if (world.getMazeData(fieldY, fieldX + 1) === MAZE_FIELD_WALL) wallCount++;
    if (wallCount === 4) continue;

    noValid = false;
    p.ply_y = fieldY << MAZE_FIELD_SHIFT;
    p.ply_x = fieldX << MAZE_FIELD_SHIFT;

    const distance = (5 - Math.trunc(tries / 20)) * MAZE_CELL_SIZE;
    for (let i = 0; i < world.playerAndDroneCount; i++) {
      if (i === player) continue;
      const o = world.players[i]!;
      if (o.ply_lives <= 0) continue;
      if (Math.abs(o.ply_y - p.ply_y) < distance || Math.abs(o.ply_x - p.ply_x) < distance) {
        noValid = true;
        break;
      }
    }
  }
  if (noValid) return false;

  world.setObject(player, p.ply_y, p.ply_x);
  p.ply_plist = -1;

  let dir = world.rng.rnd(256) & 0xf8;
  if (dir < PLAYER_DIR_EAST) dir = PLAYER_DIR_NORTH;
  else
    dir =
      dir < PLAYER_DIR_SOUTH
        ? PLAYER_DIR_EAST
        : dir < PLAYER_DIR_WEST
          ? PLAYER_DIR_SOUTH
          : PLAYER_DIR_WEST;
  p.ply_dir = dir;
  // Drone-specific init is added in EPIC-08 (humans have dr_type 0).
  return true;
}

/** init_all_player: reset the maze cells + lives, then place every player/drone. */
export function initAllPlayer(world: World, playerCount: number, _isDrone = false): boolean {
  world.playerAndDroneCount = playerCount;
  world.weDontHaveAWinner = playerCount;

  for (let i = 1; i <= MAZE_MAX_SIZE - 1; i += 2) {
    for (let j = 1; j <= MAZE_MAX_SIZE - 1; j += 2) world.setMazeData(i, j, MAZE_FIELD_EMPTY);
  }
  world.objektAnz = 0;

  for (let i = 0; i < world.playerAndDroneCount; i++) world.players[i]!.ply_lives = 0;

  for (let i = 0; i < world.playerAndDroneCount; i++) {
    if (!huntPlyPos(world, i)) return false;
    const p = world.players[i]!;
    p.ply_lives = PLAYER_MAX_LIVES;
    p.ply_refresh = 0;
    p.ply_shoot = 0;
    p.ply_reload = 0;
    p.ply_score = 0;
    p.ply_hitflag = 0;
  }
  return true;
}
