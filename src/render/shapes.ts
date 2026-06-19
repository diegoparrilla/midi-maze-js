// Sprite rasterization (drawshap.c: init_faces_shapes, draw_shape). Draws the
// eyeball body + face + shadow from the extracted 1bpp shapes, scaled by size and
// coloured per player. Colour mode only (D-10). Validated visually, not golden.
import ballRaw from '../assets/generated/ball-shapes.json';
import faceRaw from '../assets/generated/face-shapes.json';
import paletteRaw from '../assets/generated/palette.json';
import { VIEW_FLOOR_HEIGHT, VIEW_SCREEN_X, VIEW_SCREEN_Y, VIEW_SKY_HEIGHT } from './projection';

interface Shape {
  scale: number;
  height: number;
  widthWords: number;
  rows: number[];
}

const PAL = (paletteRaw as { ste: number; rgb: [number, number, number] }[]).map(
  ({ rgb }) => `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`,
);
const BALL = ballRaw as Shape[];
const FACE = faceRaw as Shape[][];

// Per-player colours (maingame.c color_ply_back / color_ply_frame).
const COLOR_PLY_BACK = [8, 3, 9, 13, 11, 12, 10, 15, 8, 3, 9, 13, 11, 12, 10, 15];
const COLOR_PLY_FRAME = [0, 0, 0, 0, 0, 0, 0, 0, 10, 11, 10, 11, 10, 10, 11, 10];
const COLOR_DKGREEN = 5;
const BODY_SHAPE_BACK_VIEW = 10;
const MAX_HEIGHT = VIEW_SKY_HEIGHT + VIEW_FLOOR_HEIGHT; // 100

// Derived shadow images: a vertically-squished sampling of each ball shape.
interface Shadow {
  height: number;
  widthWords: number;
  rows: number[];
}
const SHADOW: Shadow[] = BALL.map((ball) => {
  const bh = ball.height;
  const ww = ball.widthWords;
  const sh = Math.max(1, Math.trunc(bh / 4));
  const scale = Math.max(1, sh - 1);
  const half = Math.trunc(sh / 2);
  const rows: number[] = [];
  for (let s = 0; s < sh; s++) {
    const line = Math.trunc((bh + Math.trunc(((s - half) * (bh - 1) * 2) / scale) - 1) / 2);
    for (let w = 0; w < ww; w++) rows.push(line >= 0 ? ball.rows[line * ww + w]! : 0);
  }
  return { height: sh, widthWords: ww, rows };
});

/** size (0..32) -> shape index 0..23 (inverse of init_faces_shapes). */
function shapeIndexFromSize(size: number): number {
  return size <= 16 ? 24 - size : 8 - ((size - 15) >> 1);
}

/** Blit a 1bpp mask (row-major 16-bit words, MSB = leftmost) in a solid colour. */
function blitMask(
  ctx: CanvasRenderingContext2D,
  rows: number[],
  startRow: number,
  widthWords: number,
  height: number,
  sx: number,
  topY: number,
  color: number,
): void {
  ctx.fillStyle = PAL[color]!;
  for (let r = 0; r < height; r++) {
    const base = (startRow + r) * widthWords;
    for (let c = 0; c < widthWords * 16; c++) {
      const word = rows[base + (c >> 4)]!;
      if ((word >> (15 - (c & 15))) & 1) {
        ctx.fillRect(VIEW_SCREEN_X + sx + c, VIEW_SCREEN_Y + topY + r, 1, 1);
      }
    }
  }
}

/**
 * draw_shape: x = left edge, size = scale, sprite = face index (0..19; 10 = back/
 * shot), shadowOffset = ground line, colorIndex = player index.
 */
export function drawShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  size: number,
  sprite: number,
  shadowOffset: number,
  colorIndex: number,
): void {
  const s = shapeIndexFromSize(size);
  const ball = BALL[s]!;
  const ww = ball.widthWords;

  // shadow (dk-green), clipped to the bottom of the window
  const shadow = SHADOW[s]!;
  let sHeight = shadow.height;
  let sStart = 0;
  let sOff = shadowOffset + (sHeight >> 1);
  if (sOff > MAX_HEIGHT && sOff - sHeight + 1 <= MAX_HEIGHT) {
    sStart = sOff - MAX_HEIGHT;
    sHeight -= sOff - MAX_HEIGHT;
    sOff = MAX_HEIGHT;
  }
  if (sOff <= MAX_HEIGHT && sHeight > 0) {
    blitMask(ctx, shadow.rows, sStart, ww, sHeight, x, sOff - sHeight + 1, COLOR_DKGREEN);
  }

  // body (back colour) + face (frame colour), centred on the horizon
  const h = ball.height;
  const top = (h >> 1) + VIEW_SKY_HEIGHT - h + 1;
  blitMask(ctx, ball.rows, 0, ww, h, x, top, COLOR_PLY_BACK[colorIndex & 15]!);
  const face = FACE[s]![sprite]!;
  blitMask(ctx, face.rows, 0, ww, h, x, top, COLOR_PLY_FRAME[colorIndex & 15]!);
}

export { BODY_SHAPE_BACK_VIEW };
