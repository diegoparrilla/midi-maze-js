// First-person wall rasterizer (draw3d.c: draw_wall, draw_vline, draw_list +
// draw_col.c: blit_clear_window_color). Draws the wall render-list into the
// 320x200 canvas, in the 160x100 view window at screen (16,50).
import paletteRaw from '../assets/generated/palette.json';
import type { World } from '../sim/world';
import {
  VIEW_FLOOR_HEIGHT,
  VIEW_HALFWIDTH,
  VIEW_HCENTER,
  VIEW_SCREEN_X,
  VIEW_SCREEN_Y,
  VIEW_SKY_HEIGHT,
  VIEW_WIDTH,
} from './projection';
import { DRAW_PLAYER, DRAW_SHOT, DRAW_WALL, makeDrawList } from './renderlist';
import { BODY_SHAPE_BACK_VIEW, drawShape } from './shapes';

const PAL = (paletteRaw as { ste: number; rgb: [number, number, number] }[]).map(
  ({ rgb }) => `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`,
);

const COLOR_BLACK = 0;
const COLOR_BLUE = 3; // sky
const COLOR_STEEL = 7; // floor
// Wall colour by axis (draw_list wand_farb_tab): magnesium / aluminium.
const WALL_COLORS = [2, 6];

const WALL_CENTER_OFFSET = VIEW_SKY_HEIGHT; // 50 (horizon, local y)
const WALL_MAX_HEIGHT = VIEW_SKY_HEIGHT; // 50

/** Fill a local-coordinate box [x1,x2]x[y1,y2] (inclusive) in the view window. */
function fillBox(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: number,
): void {
  const xl = Math.min(x1, x2);
  const yt = Math.min(y1, y2);
  ctx.fillStyle = PAL[color]!;
  ctx.fillRect(
    VIEW_SCREEN_X + xl,
    VIEW_SCREEN_Y + yt,
    Math.abs(x2 - x1) + 1,
    Math.abs(y2 - y1) + 1,
  );
}

function hline(
  ctx: CanvasRenderingContext2D,
  xa: number,
  xb: number,
  y: number,
  color: number,
): void {
  const xl = Math.min(xa, xb);
  ctx.fillStyle = PAL[color]!;
  ctx.fillRect(VIEW_SCREEN_X + xl, VIEW_SCREEN_Y + y, Math.abs(xb - xa) + 1, 1);
}

/** draw_wall: an isosceles trapezoid = a box plus mirrored slanted edges. */
function drawWall(
  ctx: CanvasRenderingContext2D,
  x1: number,
  h1: number,
  x2: number,
  h2: number,
  color: number,
): void {
  if (h1 > h2) {
    [h1, h2] = [h2, h1];
    [x1, x2] = [x2, x1];
  }
  if (x1 === VIEW_WIDTH) x1--;
  if (x2 === VIEW_WIDTH) x2--;
  if (h1 > WALL_MAX_HEIGHT) h1 = WALL_MAX_HEIGHT;

  fillBox(ctx, x1, WALL_CENTER_OFFSET - h1, x2, h1 + WALL_CENTER_OFFSET, color);
  if (h2 === h1) return;

  const slope = Math.trunc(((x2 - x1) * 16) / (h2 - h1));
  let endX = x1 * 16 + (slope >> 1) + 8;
  while (++h1 <= h2) {
    if (h1 > WALL_CENTER_OFFSET) break;
    const xe = endX >> 4;
    hline(ctx, x2, xe, WALL_CENTER_OFFSET - h1, color);
    hline(ctx, x2, xe, h1 + WALL_CENTER_OFFSET, color);
    endX += slope;
  }
}

/** draw_vline: black vertical edge line bounding a wall segment. */
function drawVline(ctx: CanvasRenderingContext2D, x: number, h: number): void {
  if (VIEW_HCENTER - VIEW_HALFWIDTH >= x || VIEW_HCENTER + VIEW_HALFWIDTH - 1 <= x) return;
  if (h > VIEW_FLOOR_HEIGHT) h = VIEW_FLOOR_HEIGHT;
  ctx.fillStyle = PAL[COLOR_BLACK]!;
  ctx.fillRect(VIEW_SCREEN_X + x, VIEW_SCREEN_Y + WALL_CENTER_OFFSET - h, 1, 2 * h + 1);
}

function clearWindow(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = PAL[COLOR_BLUE]!;
  ctx.fillRect(VIEW_SCREEN_X, VIEW_SCREEN_Y, VIEW_WIDTH, VIEW_SKY_HEIGHT);
  ctx.fillStyle = PAL[COLOR_STEEL]!;
  ctx.fillRect(VIEW_SCREEN_X, VIEW_SCREEN_Y + VIEW_SKY_HEIGHT, VIEW_WIDTH, VIEW_FLOOR_HEIGHT + 1);
}

/** Render the first-person view from (y,x,dir) into the canvas. `ownNumber` is the
 *  viewer's player index (its sprite is not drawn). */
export function drawView3D(
  ctx: CanvasRenderingContext2D,
  world: World,
  y: number,
  x: number,
  dir: number,
  ownNumber = -1,
): void {
  // Black backdrop (the HUD areas are filled in EPIC-07).
  ctx.fillStyle = PAL[COLOR_BLACK]!;
  ctx.fillRect(0, 0, 320, 200);
  clearWindow(ctx);

  const elems = makeDrawList(world, y, x, dir, ownNumber);
  // The list is front-to-back; draw it back-to-front for correct occlusion.
  for (let i = elems.length - 1; i >= 0; i--) {
    const el = elems[i]!;
    if (el.t === DRAW_WALL) {
      drawWall(ctx, el.b, el.c, el.d, el.e, WALL_COLORS[el.a]!);
      drawVline(ctx, el.b, el.c);
      drawVline(ctx, el.d, el.e);
    } else if (el.t === DRAW_PLAYER) {
      drawShape(ctx, el.b, el.d, el.a, el.c, el.e);
    } else if (el.t === DRAW_SHOT) {
      // A shot is the body from behind — no face.
      drawShape(ctx, el.b, el.d, BODY_SHAPE_BACK_VIEW, el.c, el.e);
    }
  }
}
