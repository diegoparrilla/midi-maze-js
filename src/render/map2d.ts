// 2D top-down maze map (draw2d.c), scaled to fill the 320x200 canvas. Interim
// visual: shows the loaded maze and the deterministic player placements. The
// faithful first-person 3D renderer is EPIC-06.
import paletteRaw from '../assets/generated/palette.json';
import { MAZE_FIELD_WALL } from '../maze';
import { mulsDivs } from '../sim/fixed';
import { xySpeedTable } from '../sim/speed-table';
import type { World } from '../sim/world';

interface PaletteEntry {
  ste: number;
  rgb: [number, number, number];
}
const PAL = (paletteRaw as PaletteEntry[]).map(({ rgb }) => `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`);

const COLOR_BLACK = 0;
const COLOR_MAGNESIUM = 2;
const COLOR_STEEL = 7;
// Distinct per-player dot colours (palette indices).
const PLAYER_COLORS = [14, 8, 13, 12, 11, 9, 15, 1, 3, 5, 10, 6, 4, 2, 14, 8];

export const MAP_W = 320;
export const MAP_H = 200;

/** Draw the maze + placed players into a 320x200 context. */
export function drawMap2D(ctx: CanvasRenderingContext2D, world: World): void {
  const border = 8;
  const mapW = MAP_W - border * 2;
  const mapH = MAP_H - border * 2;
  const ms = world.mazeSize;

  ctx.fillStyle = PAL[COLOR_BLACK]!;
  ctx.fillRect(0, 0, MAP_W, MAP_H);
  ctx.fillStyle = PAL[COLOR_STEEL]!;
  ctx.fillRect(border - 3, border - 3, mapW + 6, mapH + 6);

  // Walls: horizontal segments, then vertical (via the flipped grid access).
  ctx.fillStyle = PAL[COLOR_MAGNESIUM]!;
  for (let y = 0; y <= ms; y += 2) {
    for (let x = 1; x < ms; x += 2) {
      if (world.getMazeData(y, x, false) === MAZE_FIELD_WALL) {
        const yc = Math.trunc((mapH * y) / ms) + border;
        const x1 = Math.trunc((mapW * (x - 1)) / ms) + border;
        const x2 = Math.trunc((mapW * (x + 1)) / ms) + border;
        ctx.fillRect(x1, yc, x2 - x1 + 1, 1);
      }
      if (world.getMazeData(y, x, true) === MAZE_FIELD_WALL) {
        const xc = Math.trunc((mapW * y) / ms) + border;
        const y1 = Math.trunc((mapH * (x - 1)) / ms) + border;
        const y2 = Math.trunc((mapH * (x + 1)) / ms) + border;
        ctx.fillRect(xc, y1, 1, y2 - y1 + 1);
      }
    }
  }

  // Players: a dot at the mapped position + a short facing tick.
  const cellSpan = ms << 7;
  for (let i = 0; i < world.playerAndDroneCount; i++) {
    const p = world.players[i]!;
    if (p.ply_lives <= 0) continue;
    const posX = mulsDivs(mapW, p.ply_x, cellSpan) + border;
    const posY = mulsDivs(mapH, p.ply_y, cellSpan) + border;
    const color = PAL[PLAYER_COLORS[i % PLAYER_COLORS.length]!]!;
    ctx.fillStyle = color;
    ctx.fillRect(posX - 2, posY - 2, 5, 5);

    const speed = xySpeedTable[p.ply_dir]!;
    const ex = posX + Math.round((speed.deltaX / 32) * 6);
    const ey = posY + Math.round((speed.deltaY / 32) * 6);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(posX + 0.5, posY + 0.5);
    ctx.lineTo(ex + 0.5, ey + 0.5);
    ctx.stroke();
  }
}
