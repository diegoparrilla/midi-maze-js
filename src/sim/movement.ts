// Player movement + combat (gamelogi.c: move_player, move_shoot). Faithful to the
// original integer math (C-02). Sound/AES/UI side effects are intentionally
// omitted — they never affect the simulation.
import { MAZE_FIELD_EMPTY, MAZE_FIELD_WALL } from '../maze';
import { huntPlyPos } from './setup';
import { MAZE_CELL_SIZE, PLAYER_MOTION_ROTATE, xySpeedTable } from './speed-table';
import {
  GAME_WIN_SCORE,
  MAZE_FIELD_SHIFT,
  PLAYER_MAX_COUNT,
  PLAYER_MAX_LIVES,
  type World,
} from './world';

export const JOYSTICK_UP = 0x01;
export const JOYSTICK_DOWN = 0x02;
export const JOYSTICK_LEFT = 0x04;
export const JOYSTICK_RIGHT = 0x08;
export const JOYSTICK_BUTTON = 0x10;

const PLAYER_RADIUS = 48;
const PLAYER_WALL_DISTANCE = 65;
const CELL_MASK = MAZE_CELL_SIZE - 1;

/**
 * move_shoot: advance this player's shot 3 substeps (a shot is 3x player speed),
 * stopping on a wall, and apply hits (damage, scoring, win, death timers).
 */
export function moveShoot(world: World, player: number): void {
  const pd = world.players;
  const p = pd[player]!;
  let hasShot = true;
  let shotY = p.ply_shooty;
  let shotX = p.ply_shootx;
  const shotDirection = p.ply_shootr;
  let shotYField = (shotY >> MAZE_FIELD_SHIFT) | 1;
  let shotXField = (shotX >> MAZE_FIELD_SHIFT) | 1;

  for (let z = 0; z < 3; z++) {
    shotY += xySpeedTable[shotDirection]!.deltaY;
    shotX += xySpeedTable[shotDirection]!.deltaX;
    const saveY = shotYField;
    const saveX = shotXField;
    shotYField = (shotY >> MAZE_FIELD_SHIFT) | 1;
    shotXField = (shotX >> MAZE_FIELD_SHIFT) | 1;
    if (
      (shotYField !== saveY || shotXField !== saveX) &&
      world.getMazeData((saveY + shotYField) >> 1, (saveX + shotXField) >> 1) === MAZE_FIELD_WALL
    ) {
      p.ply_shoot = 0;
      break;
    }

    for (let xOffset = -2; xOffset <= 2 && hasShot; xOffset += 2) {
      for (let yOffset = -2; yOffset <= 2 && hasShot; yOffset += 2) {
        let objectID = world.getMazeData(xOffset + shotYField, yOffset + shotXField, false);
        while (objectID !== MAZE_FIELD_EMPTY) {
          if (objectID < PLAYER_MAX_COUNT) {
            const o = pd[objectID]!;
            if (player !== objectID && o.ply_lives > 0) {
              const distanceY = Math.abs(o.ply_y - shotY);
              const distanceX = Math.abs(o.ply_x - shotX);
              if (distanceY <= PLAYER_RADIUS && distanceX <= PLAYER_RADIUS) {
                o.ply_hitflag = 1;
                o.ply_gunman = player;
                if (
                  !world.teamFlag ||
                  p.ply_team !== o.ply_team ||
                  (!world.friendlyFire && o.ply_lives !== 1)
                ) {
                  o.ply_refresh = world.regenTime;
                  if (--o.ply_lives === 0) {
                    o.ply_refresh = world.reviveTime;
                    p.ply_score++;
                    if (world.teamFlag) {
                      const t = p.ply_team;
                      const score = world.teamScores[t]! + 1;
                      world.teamScores[t] = score;
                      if (score === GAME_WIN_SCORE) world.weDontHaveAWinner = 0;
                    } else if (p.ply_score === GAME_WIN_SCORE) {
                      world.weDontHaveAWinner = 0;
                    }
                  }
                  p.ply_looser = objectID;
                }
                p.ply_shoot = 0;
                hasShot = false;
              }
            }
            objectID = pd[objectID]!.ply_plist;
          } else {
            objectID = pd[objectID - PLAYER_MAX_COUNT]!.ply_slist;
          }
        }
      }
    }
  }
  p.ply_shooty = shotY;
  p.ply_shootx = shotX;
}

/** move_player: advance one player by `joystickData`. Returns false on the fatal
 *  "boxed in"/respawn-failure case (maze too small). */
export function movePlayer(
  world: World,
  player: number,
  joystickData: number,
  dronesActiveFlag: number,
): boolean {
  const pd = world.players;
  const p = pd[player]!;

  // Refresh pending: regenerate a life and, if the player was dead, respawn.
  if (p.ply_refresh > 0 && --p.ply_refresh === 0) {
    if (++p.ply_lives < PLAYER_MAX_LIVES) p.ply_refresh = world.regenTime;
    if (p.ply_lives === 1) {
      if ((p.ply_lives = world.reviveLives) === PLAYER_MAX_LIVES) p.ply_refresh = 0;
      if (!huntPlyPos(world, player)) return false;
    }
  }

  if (p.ply_lives === 0) {
    if (p.ply_shoot) moveShoot(world, player);
    if (p.ply_reload) p.ply_reload--;
    return true;
  }

  let direction = p.ply_dir;
  if (joystickData & JOYSTICK_LEFT) direction -= PLAYER_MOTION_ROTATE;
  else if (joystickData & JOYSTICK_RIGHT) direction += PLAYER_MOTION_ROTATE;
  direction &= 255;

  // Fire a shot.
  if ((joystickData & JOYSTICK_BUTTON) === JOYSTICK_BUTTON && p.ply_reload === 0) {
    p.ply_shootr = direction;
    p.ply_shoot = 10;
    p.ply_reload = world.reloadTime;
    p.ply_shooty = p.ply_y;
    p.ply_shootx = p.ply_x;
  }
  if (p.ply_shoot) moveShoot(world, player);
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
