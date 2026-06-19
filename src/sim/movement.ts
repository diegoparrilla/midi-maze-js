// Player movement (gamelogi.c:move_player): rotation, forward/back via the speed
// table, player-player collision, and wall clamping/corner sliding. Faithful to
// the original integer math (C-02).
//
// The fire / move_shoot / refresh-respawn branches are STORY-04 (combat); they are
// inert for movement-only input (no button, no damage), so movement traces match
// the C harness exactly without them.
import { MAZE_FIELD_EMPTY, MAZE_FIELD_WALL } from '../maze';
import { huntPlyPos } from './setup';
import { MAZE_CELL_SIZE, PLAYER_MOTION_ROTATE, xySpeedTable } from './speed-table';
import { MAZE_FIELD_SHIFT, PLAYER_MAX_COUNT, type World } from './world';

export const JOYSTICK_UP = 0x01;
export const JOYSTICK_DOWN = 0x02;
export const JOYSTICK_LEFT = 0x04;
export const JOYSTICK_RIGHT = 0x08;
export const JOYSTICK_BUTTON = 0x10;

const PLAYER_RADIUS = 48;
const PLAYER_WALL_DISTANCE = 65;
const CELL_MASK = MAZE_CELL_SIZE - 1;

/** move_player: advance one player by `joystickData`. Returns false on the fatal
 *  "boxed in" case (maze too small). `dronesActiveFlag` only affects the drone
 *  idle marker. */
export function movePlayer(
  world: World,
  player: number,
  joystickData: number,
  dronesActiveFlag: number,
): boolean {
  const pd = world.players;
  const p = pd[player]!;

  // TODO(STORY-04): refresh/revive block (regenerate lives, respawn via hunt).
  if (p.ply_lives === 0) {
    // TODO(STORY-04): if (p.ply_shoot) moveShoot(world, player);
    if (p.ply_reload) p.ply_reload--;
    return true;
  }

  let direction = p.ply_dir;
  if (joystickData & JOYSTICK_LEFT) direction -= PLAYER_MOTION_ROTATE;
  else if (joystickData & JOYSTICK_RIGHT) direction += PLAYER_MOTION_ROTATE;
  direction &= 255;

  // TODO(STORY-04): fire block + moveShoot.
  if (p.ply_reload) p.ply_reload--;

  let speedY: number;
  let speedX: number;
  if (joystickData & JOYSTICK_UP) {
    speedY = xySpeedTable[direction]!.deltaY;
    speedX = xySpeedTable[direction]!.deltaX;
  } else if (joystickData & JOYSTICK_DOWN) {
    speedY = -xySpeedTable[direction]!.deltaY;
    speedX = -xySpeedTable[direction]!.deltaX;
  } else {
    speedY = 0;
    speedX = 0;
  }

  let playerY = p.ply_y + speedY;
  let playerX = p.ply_x + speedX;
  let newFieldY = (playerY >> MAZE_FIELD_SHIFT) | 1;
  let newFieldX = (playerX >> MAZE_FIELD_SHIFT) | 1;
  let bumpOfWalls = true;

  // Player-player collision: scan the 3x3 block of cells around the new field.
  for (let yOffset = -2; yOffset <= 2; yOffset += 2) {
    for (let xOffset = -2; xOffset <= 2; xOffset += 2) {
      let objectID = world.getMazeData(yOffset + newFieldY, xOffset + newFieldX, false);
      while (objectID !== MAZE_FIELD_EMPTY) {
        if (objectID < PLAYER_MAX_COUNT) {
          if (player !== objectID) {
            const o = pd[objectID]!;
            const distanceY = Math.abs(o.ply_y - playerY);
            const distanceX = Math.abs(o.ply_x - playerX);
            if (distanceY < PLAYER_RADIUS * 2 && distanceX < PLAYER_RADIUS * 2) {
              const oldDiffY = Math.abs(o.ply_y - p.ply_y);
              const oldDiffX = Math.abs(o.ply_x - p.ply_x);
              if (oldDiffY < PLAYER_RADIUS * 2) {
                speedX -=
                  speedX < 0 ? -(PLAYER_RADIUS * 2 - distanceX) : PLAYER_RADIUS * 2 - distanceX;
              } else if (oldDiffX < PLAYER_RADIUS * 2) {
                speedY -=
                  speedY < 0 ? -(PLAYER_RADIUS * 2 - distanceY) : PLAYER_RADIUS * 2 - distanceY;
              } else if (distanceY > distanceX) {
                speedY -=
                  speedY < 0 ? -(PLAYER_RADIUS * 2 - distanceY) : PLAYER_RADIUS * 2 - distanceY;
              } else {
                speedX -=
                  speedX < 0 ? -(PLAYER_RADIUS * 2 - distanceX) : PLAYER_RADIUS * 2 - distanceX;
              }
              playerY = p.ply_y + speedY;
              playerX = p.ply_x + speedX;
            }
          }
          objectID = pd[objectID]!.ply_plist;
        } else {
          objectID = pd[objectID - PLAYER_MAX_COUNT]!.ply_slist;
        }
      }
    }
  }

  // Wall clamping.
  newFieldY = (playerY >> MAZE_FIELD_SHIFT) | 1;
  newFieldX = (playerX >> MAZE_FIELD_SHIFT) | 1;
  const cellYfract = playerY & CELL_MASK;
  const cellXfract = playerX & CELL_MASK;
  const tooCloseTop = cellYfract < PLAYER_WALL_DISTANCE;
  const tooCloseBottom = cellYfract > MAZE_CELL_SIZE - PLAYER_WALL_DISTANCE;
  const tooCloseLeft = cellXfract < PLAYER_WALL_DISTANCE;
  const tooCloseRight = cellXfract > MAZE_CELL_SIZE - PLAYER_WALL_DISTANCE;
  const yOffset = tooCloseTop ? -1 : tooCloseBottom ? 1 : 0;
  const xOffset = tooCloseLeft ? -1 : tooCloseRight ? 1 : 0;
  if (bumpOfWalls) {
    if (
      (tooCloseTop || tooCloseBottom) &&
      world.getMazeData(yOffset + newFieldY, newFieldX) === MAZE_FIELD_WALL
    ) {
      playerY &= ~CELL_MASK;
      playerY += tooCloseBottom ? MAZE_CELL_SIZE - PLAYER_WALL_DISTANCE : PLAYER_WALL_DISTANCE;
      bumpOfWalls = false;
    }
    if (
      (tooCloseLeft || tooCloseRight) &&
      world.getMazeData(newFieldY, xOffset + newFieldX) === MAZE_FIELD_WALL
    ) {
      playerX &= ~CELL_MASK;
      playerX += tooCloseRight ? MAZE_CELL_SIZE - PLAYER_WALL_DISTANCE : PLAYER_WALL_DISTANCE;
      bumpOfWalls = false;
    }
  }
  // Outside corner: slide along the nearer axis.
  if (
    bumpOfWalls &&
    yOffset &&
    xOffset &&
    world.getMazeData(yOffset + newFieldY, xOffset + newFieldX) === MAZE_FIELD_WALL
  ) {
    const distanceY = tooCloseTop ? cellYfract : MAZE_CELL_SIZE - cellYfract;
    const distanceX = tooCloseLeft ? cellXfract : MAZE_CELL_SIZE - cellXfract;
    if (distanceY >= distanceX) {
      playerY &= ~CELL_MASK;
      playerY += tooCloseBottom ? MAZE_CELL_SIZE - PLAYER_WALL_DISTANCE : PLAYER_WALL_DISTANCE;
    } else {
      playerX &= ~CELL_MASK;
      playerX += tooCloseRight ? MAZE_CELL_SIZE - PLAYER_WALL_DISTANCE : PLAYER_WALL_DISTANCE;
    }
  }

  if (
    dronesActiveFlag &&
    playerY === p.ply_y &&
    playerX === p.ply_x &&
    p.ply_dir === direction &&
    p.dr_rotateCounter === 0 &&
    !p.dr_targetLocked
  ) {
    p.dr_isInactive = 1;
  }

  p.ply_y = playerY;
  p.ply_x = playerX;
  p.ply_dir = direction;

  // Emergency: if the player ended up boxed in (a collision bug), re-place it.
  const boxY = (playerY >> MAZE_FIELD_SHIFT) | 1;
  const boxX = (playerX >> MAZE_FIELD_SHIFT) | 1;
  let surroundingWalls = 0;
  if (world.getMazeData(boxY - 1, boxX) === MAZE_FIELD_WALL) surroundingWalls++;
  if (world.getMazeData(boxY, boxX - 1) === MAZE_FIELD_WALL) surroundingWalls++;
  if (world.getMazeData(boxY + 1, boxX) === MAZE_FIELD_WALL) surroundingWalls++;
  if (world.getMazeData(boxY, boxX + 1) === MAZE_FIELD_WALL) surroundingWalls++;
  if (surroundingWalls === 4) {
    if (!huntPlyPos(world, player)) return false;
  }
  return true;
}
