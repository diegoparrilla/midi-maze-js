// Per-angle forward-motion velocity (gamelogi.c:calc_sin_table). Each of the 256
// directions maps to a (deltaY, deltaX) step at the player's max speed.
import { rotate2d } from './trig';

export const MAZE_CELL_SIZE = 256;
export const PLAYER_MOTION_SPEED = MAZE_CELL_SIZE / 8; // 32 — 8 steps per cell
export const PLAYER_MOTION_ROTATE = 8; // 32 turn-steps per full circle

export interface XYSpeed {
  deltaY: number;
  deltaX: number;
}

/**
 * Build xy_speed_table[256]. The C calls `rotate2d(&y, &x, -angle)` with
 * y=-SPEED, x=0, then stores deltaY=y, deltaX=x — i.e. y is the first arg and x
 * the second, so deltaY is the rotated first component.
 */
export function buildSpeedTable(): XYSpeed[] {
  const table: XYSpeed[] = [];
  for (let angle = 0; angle < 256; angle++) {
    const [rotatedY, rotatedX] = rotate2d(-PLAYER_MOTION_SPEED, 0, -angle);
    table.push({ deltaY: rotatedY, deltaX: rotatedX });
  }
  return table;
}

export const xySpeedTable: readonly XYSpeed[] = buildSpeedTable();
