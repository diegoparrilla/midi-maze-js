// Perspective projection + colour-mode viewport constants (draw3d.c, rungame.c).
// Rendering doesn't affect determinism, but the projection uses the same integer
// math as the sim so the view lines up with the world.
import { mulsDivs } from '../sim/fixed';
import { MAZE_CELL_SIZE } from '../sim/speed-table';

// Colour mode (320x200). The 3D view window is 160x100 at screen (16,50).
export const VIEW_HCENTER = 80;
export const VIEW_HALFWIDTH = 80;
export const VIEW_SKY_HEIGHT = 50;
export const VIEW_FLOOR_HEIGHT = 50;
export const VIEW_CELL_PIXELS = 20;
export const VIEW_SCREEN_X = 16;
export const VIEW_SCREEN_Y = 50;
export const VIEW_WIDTH = VIEW_HCENTER + VIEW_HALFWIDTH; // 160

/**
 * calc_yx_to_xh: project a view-space point (depth `y`, lateral `x`; y is negative
 * in front of the viewer) to `[screenX, height]`. `height` is half the wall's
 * on-screen height, measured from the horizon.
 */
export function calcYxToXh(y: number, x: number): [number, number] {
  const screenX = -mulsDivs(x, VIEW_HALFWIDTH, y) + VIEW_HCENTER;
  const height = -Math.trunc((VIEW_CELL_PIXELS * MAZE_CELL_SIZE) / y);
  return [screenX, height];
}
