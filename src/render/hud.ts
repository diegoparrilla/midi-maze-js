// HUD overlay (maingame.c crosshair; happyind.c / notebrd.c to follow). Drawn in
// the view window's local coordinates. Colour mode only.
import paletteRaw from '../assets/generated/palette.json';
import { VIEW_SCREEN_X, VIEW_SCREEN_Y } from './projection';

const PAL = (paletteRaw as { ste: number; rgb: [number, number, number] }[]).map(
  ({ rgb }) => `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`,
);
// Per-player body colour (maingame.c color_ply_back).
const COLOR_PLY_BACK = [8, 3, 9, 13, 11, 12, 10, 15, 8, 3, 9, 13, 11, 12, 10, 15];

function vline(ctx: CanvasRenderingContext2D, y1: number, y2: number, x: number): void {
  ctx.fillRect(VIEW_SCREEN_X + x, VIEW_SCREEN_Y + y1, 1, y2 - y1 + 1);
}

/** Firing crosshair, shown when the player is reloaded (maingame.c), in the
 *  player's own colour, centred on the view. */
export function drawCrosshair(ctx: CanvasRenderingContext2D, playerIndex: number): void {
  ctx.fillStyle = PAL[COLOR_PLY_BACK[playerIndex & 15]!]!;
  vline(ctx, 50, 51, 78);
  vline(ctx, 50, 51, 80);
  vline(ctx, 49, 49, 79);
  vline(ctx, 52, 52, 79);
}
