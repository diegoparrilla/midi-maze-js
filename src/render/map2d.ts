// 2D top-down maze map (draw2d.c). Faithful to the original colour mode: the map is
// drawn *inside the 160x100 game view window* (not full-screen), so the dashboard +
// HUD stay around it. Coordinates mirror draw_2Dmap / set_ply_2Dmap.
import paletteRaw from '../assets/generated/palette.json';
import { MAZE_FIELD_WALL } from '../maze';
import { mulsDivs } from '../sim/fixed';
import { xySpeedTable } from '../sim/speed-table';
import type { World } from '../sim/world';
import { VIEW_SCREEN_X, VIEW_SCREEN_Y } from './projection';

interface PaletteEntry {
  ste: number;
  rgb: [number, number, number];
}
const PAL = (paletteRaw as PaletteEntry[]).map(({ rgb }) => `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`);

const COLOR_MAGNESIUM = 2;
const COLOR_STEEL = 7;
// Distinct per-player dot colours (palette indices).
const PLAYER_COLORS = [14, 8, 13, 12, 11, 9, 15, 1, 3, 5, 10, 6, 4, 2, 14, 8];

// Colour mode (draw2d.c): the map fills the view window with a 3px border.
const MAP_BORDER = 3;
const MAP_WIDTH = 160 - MAP_BORDER * 2 - 1; // 153
const MAP_HEIGHT = 100 - MAP_BORDER * 2; // 94

/** Draw the maze + placed players into the 160x100 game view window. */
export function drawMap2D(ctx: CanvasRenderingContext2D, world: World): void {
  const ox = VIEW_SCREEN_X;
  const oy = VIEW_SCREEN_Y;
  const ms = world.mazeSize;

  // erase the map window (steel), filling the 160x100 view window.
  ctx.fillStyle = PAL[COLOR_STEEL]!;
  ctx.fillRect(ox, oy, 160, 100);

  // Walls: horizontal segments, then vertical (via the flipped grid access).
  ctx.fillStyle = PAL[COLOR_MAGNESIUM]!;
  for (let y = 0; y <= ms; y += 2) {
    for (let x = 1; x < ms; x += 2) {
      if (world.getMazeData(y, x, false) === MAZE_FIELD_WALL) {
        const yc = Math.trunc((MAP_HEIGHT * y) / ms) + MAP_BORDER;
        const x1 = Math.trunc((MAP_WIDTH * (x - 1)) / ms) + MAP_BORDER;
        const x2 = Math.trunc((MAP_WIDTH * (x + 1)) / ms) + MAP_BORDER;
        ctx.fillRect(ox + x1, oy + yc, x2 - x1 + 1, 1);
      }
      if (world.getMazeData(y, x, true) === MAZE_FIELD_WALL) {
        const xc = Math.trunc((MAP_WIDTH * y) / ms) + MAP_BORDER;
        const y1 = Math.trunc((MAP_HEIGHT * (x - 1)) / ms) + MAP_BORDER;
        const y2 = Math.trunc((MAP_HEIGHT * (x + 1)) / ms) + MAP_BORDER;
        ctx.fillRect(ox + xc, oy + y1, 1, y2 - y1 + 1);
      }
    }
  }

  // Players: a dot at the mapped position + a short facing tick.
  const cellSpan = ms << 7;
  for (let i = 0; i < world.playerAndDroneCount; i++) {
    const p = world.players[i]!;
    if (p.ply_lives <= 0) continue;
    const posX = ox + mulsDivs(MAP_WIDTH, p.ply_x, cellSpan) + MAP_BORDER;
    const posY = oy + mulsDivs(MAP_HEIGHT, p.ply_y, cellSpan) + MAP_BORDER;
    const color = PAL[PLAYER_COLORS[i % PLAYER_COLORS.length]!]!;
    ctx.fillStyle = color;
    ctx.fillRect(posX - 1, posY - 1, 3, 3);

    const speed = xySpeedTable[p.ply_dir]!;
    const ex = posX + Math.round((speed.deltaX / 32) * 4);
    const ey = posY + Math.round((speed.deltaY / 32) * 4);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(posX + 0.5, posY + 0.5);
    ctx.lineTo(ex + 0.5, ey + 0.5);
    ctx.stroke();
  }
}
