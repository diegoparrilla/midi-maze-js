// Render-list generation (makedraw.c, makelist.c, drawwall.c): from a viewpoint,
// produce the ordered list of visible wall trapezoids (front-to-back), with FOV
// clipping and the objecttable coverage cull. Faithful to the original integer
// math. Sprites (draw_mazes_set_object) are EPIC-07; rasterization is STORY-03.
import { MAZE_FIELD_WALL } from '../maze';
import { MAZE_CELL_SIZE } from '../sim/speed-table';
import { rotate2d } from '../sim/trig';
import { MAZE_FIELD_SHIFT, type World } from '../sim/world';
import { VIEW_HALFWIDTH, VIEW_HCENTER, calcYxToXh } from './projection';

/** A wall draw-list entry: a trapezoid between screen columns x1..x2 with half-
 *  heights h1/h2, flat-shaded with wall colour 0 or 1. */
export interface Wall {
  color: number;
  x1: number;
  h1: number;
  x2: number;
  h2: number;
}

interface Delta {
  deltaY: number;
  deltaX: number;
}

const DIR_TABLE = [
  { minY: -7, minX: -7, maxY: 1, maxX: 9, fieldOffsetY: -1, fieldOffsetX: 1, flipped: 0 }, // N
  { minY: 8, minX: 8, maxY: -8, maxX: 0, fieldOffsetY: 1, fieldOffsetX: -1, flipped: 1 }, // NE
  { minY: -7, minX: 8, maxY: 9, maxX: 0, fieldOffsetY: 1, fieldOffsetX: 1, flipped: 1 }, // E
  { minY: 8, minX: -7, maxY: 0, maxX: 9, fieldOffsetY: 1, fieldOffsetX: 1, flipped: 0 }, // SE
  { minY: 8, minX: 8, maxY: 0, maxX: -8, fieldOffsetY: 1, fieldOffsetX: -1, flipped: 0 }, // S
  { minY: -7, minX: -7, maxY: 9, maxX: 1, fieldOffsetY: -1, fieldOffsetX: 1, flipped: 1 }, // SW
  { minY: 8, minX: -7, maxY: -8, maxX: 1, fieldOffsetY: -1, fieldOffsetX: -1, flipped: 1 }, // W
  { minY: -7, minX: 8, maxY: 1, maxX: -8, fieldOffsetY: -1, fieldOffsetX: -1, flipped: 0 }, // NW
] as const;

const VIEW_FULL_WIDTH = VIEW_HCENTER + VIEW_HALFWIDTH; // 160

class RenderList {
  private vm: Delta[][];
  private table: { xleft: number; xright: number }[];
  private tableSize = 0;
  private elems: Wall[] = [];

  constructor(private readonly world: World) {
    this.vm = Array.from({ length: 9 }, () =>
      Array.from({ length: 17 }, () => ({ deltaY: 0, deltaX: 0 })),
    );
    this.table = Array.from({ length: 20 }, () => ({ xleft: 0, xright: 0 }));
  }

  build(y: number, x: number, dir: number): Wall[] {
    const cd = (dir >> 5) & 7;
    const d = DIR_TABLE[cd]!;
    this.calcViewmatrix(
      y & (MAZE_CELL_SIZE - 1),
      x & (MAZE_CELL_SIZE - 1),
      d.minY * MAZE_CELL_SIZE,
      d.minX * MAZE_CELL_SIZE,
      d.maxY * MAZE_CELL_SIZE,
      d.maxX * MAZE_CELL_SIZE,
      d.flipped,
      dir,
    );
    this.world.setAllPlayer();
    this.generateRenderlist(y, x, d.fieldOffsetY, d.fieldOffsetX, d.flipped, cd & 1);
    return this.elems;
  }

  private calcViewmatrix(
    microY: number,
    microX: number,
    minYOffset: number,
    minXOffset: number,
    maxYOffset: number,
    maxXOffset: number,
    isFlipped: number,
    dir: number,
  ): void {
    const vm = this.vm;
    const minYDelta = minYOffset - microY;
    const minXDelta = minXOffset - microX;
    const maxYDelta = maxYOffset - microY;
    const maxXDelta = maxXOffset - microX;
    vm[0]![0] = { deltaY: minYDelta, deltaX: minXDelta };
    vm[8]![16] = { deltaY: maxYDelta, deltaX: maxXDelta };
    if (!isFlipped) {
      vm[8]![0] = { deltaY: maxYDelta, deltaX: minXDelta };
      vm[0]![16] = { deltaY: minYDelta, deltaX: maxXDelta };
    } else {
      vm[8]![0] = { deltaY: minYDelta, deltaX: maxXDelta };
      vm[0]![16] = { deltaY: maxYDelta, deltaX: minXDelta };
    }
    for (const [r, c] of [
      [0, 0],
      [8, 0],
      [0, 16],
      [8, 16],
    ] as const) {
      const cell = vm[r]![c]!;
      const [ry, rx] = rotate2d(cell.deltaY, cell.deltaX, dir);
      cell.deltaY = ry;
      cell.deltaX = rx;
    }
    for (let i = 8; i; i >>= 1) {
      for (let j = i; j < 16; j += i + i) {
        for (const row of [0, 8] as const) {
          vm[row]![j]!.deltaY = (vm[row]![j - i]!.deltaY + vm[row]![j + i]!.deltaY) >> 1;
          vm[row]![j]!.deltaX = (vm[row]![j - i]!.deltaX + vm[row]![j + i]!.deltaX) >> 1;
        }
      }
    }
    for (let j = 0; j <= 16; j++) {
      for (let j2 = 4; j2; j2 >>= 1) {
        for (let k = j2; k < 8; k += j2 + j2) {
          vm[k]![j]!.deltaY = (vm[k - j2]![j]!.deltaY + vm[k + j2]![j]!.deltaY) >> 1;
          vm[k]![j]!.deltaX = (vm[k - j2]![j]!.deltaX + vm[k + j2]![j]!.deltaX) >> 1;
        }
      }
    }
  }

  // --- wall intersection / clipping (90-degree FOV) ---
  private wallIntersection(
    y1: number,
    x1: number,
    y2: number,
    x2: number,
    slope: number,
  ): { ok: boolean; y: number; x: number } {
    const deltaY = y1 - y2;
    const deltaX = x2 - x1;
    const divisor = y1 * deltaX + x1 * deltaY;
    if (slope === 1) {
      const diff = deltaX + deltaY;
      if (diff) {
        const v = Math.trunc(divisor / diff);
        return { ok: true, y: v, x: v };
      }
    } else if (slope === -1) {
      const diff = deltaY - deltaX;
      if (diff) {
        const v = Math.trunc(divisor / diff);
        return { ok: true, y: -v, x: v };
      }
    } else if (deltaX) {
      return { ok: true, y: Math.trunc(divisor / deltaX), x: 0 };
    }
    return { ok: false, y: 0, x: 0 };
  }

  private checkOrder(
    y1: number,
    x1: number,
    y2: number,
    x2: number,
    y3: number,
    x3: number,
  ): boolean {
    const yOk = y1 <= y3 ? y1 <= y2 && y2 <= y3 : y3 <= y2 && y2 <= y1;
    const xOk = x1 <= x3 ? x1 <= x2 && x2 <= x3 : x3 <= x2 && x2 <= x1;
    return yOk && xOk;
  }

  /** Returns the (possibly clipped) wall as [y1,x1,y2,x2] or null if not visible. */
  private clipWall(y1: number, x1: number, y2: number, x2: number): number[] | null {
    const in1 = x1 >= 0 ? y1 < -x1 : y1 < x1;
    const in2 = x2 >= 0 ? y2 < -x2 : y2 < x2;
    if (in1 && in2) return [y1, x1, y2, x2];

    if (!in1 && !in2) {
      if (x1 * x2 >= 0) return null;
      const hit = this.wallIntersection(y1, x1, y2, x2, 0);
      if (hit.ok) {
        if (hit.y >= 0) return null;
        if (x1 > x2) {
          [y1, y2] = [y2, y1];
          [x1, x2] = [x2, x1];
        }
        const a = this.wallIntersection(y1, x1, y2, x2, 1);
        if (a.ok) {
          y1 = a.y;
          x1 = a.x;
        }
        const b = this.wallIntersection(y1, x1, y2, x2, -1);
        if (b.ok) {
          y2 = b.y;
          x2 = b.x;
        }
        return [y1, x1, y2, x2];
      }
      return null;
    }

    if (in2) {
      [y1, y2] = [y2, y1];
      [x1, x2] = [x2, x1];
    }
    let a = this.wallIntersection(y1, x1, y2, x2, 1);
    if (a.ok && this.checkOrder(y1, x1, a.y, a.x, y2, x2)) {
      y2 = a.y;
      x2 = a.x;
    }
    a = this.wallIntersection(y1, x1, y2, x2, -1);
    if (a.ok && this.checkOrder(y1, x1, a.y, a.x, y2, x2)) {
      y2 = a.y;
      x2 = a.x;
    }
    return [y1, x1, y2, x2];
  }

  // --- objecttable (coverage cull) ---
  private objCheckHidden(xleft: number, xright: number): boolean {
    const fullWidth = VIEW_FULL_WIDTH - 1;
    if (xright < 0) return true;
    if (xleft > fullWidth) return true;
    if (xleft < 0) xleft = 0;
    if (xright > fullWidth) xright = fullWidth;
    for (let i = 0; i < this.tableSize; i++) {
      if (this.table[i]!.xleft <= xleft && this.table[i]!.xright >= xright) return true;
    }
    return false;
  }

  private objCheckCovered(): boolean {
    return (
      this.tableSize === 1 &&
      this.table[0]!.xleft === 0 &&
      VIEW_FULL_WIDTH === this.table[0]!.xright
    );
  }

  private objSearch(x1: number, startIndex: number): { index: number; found: boolean } {
    let i = startIndex;
    let found = false;
    for (; i < this.tableSize; i++) {
      if (this.table[i]!.xleft > x1) break;
      if (this.table[i]!.xright >= x1) {
        found = true;
        break;
      }
    }
    return { index: i, found };
  }

  private objShift(lowerIndex: number, upperIndex: number): void {
    const width = upperIndex - lowerIndex + 1;
    if (width > 0) {
      upperIndex++;
      while (upperIndex < this.tableSize) {
        this.table[lowerIndex]!.xleft = this.table[upperIndex]!.xleft;
        this.table[lowerIndex]!.xright = this.table[upperIndex]!.xright;
        lowerIndex++;
        upperIndex++;
      }
      this.tableSize = lowerIndex;
    } else {
      if (width >= 0) return;
      for (upperIndex = this.tableSize; upperIndex >= lowerIndex; upperIndex--) {
        this.table[upperIndex]!.xleft = this.table[upperIndex - 1]!.xleft;
        this.table[upperIndex]!.xright = this.table[upperIndex - 1]!.xright;
      }
      this.tableSize++;
    }
  }

  private objAdd(xleft: number, xright: number): void {
    const l = this.objSearch(xleft, 0);
    const r = this.objSearch(xright, l.index);
    const newxleft = l.found ? this.table[l.index]!.xleft : xleft;
    let newxright: number;
    if (r.found) {
      newxright = this.table[r.index]!.xright;
      this.objShift(l.index, r.index - 1);
    } else {
      newxright = xright;
      this.objShift(l.index + 1, r.index - 1);
    }
    this.table[l.index]!.xleft = newxleft;
    this.table[l.index]!.xright = newxright;
  }

  private objSetWall(
    x1: number,
    h1: number,
    x2: number,
    h2: number,
    color: number,
    leftRightFlag: number,
  ): boolean {
    const xleft = x1 <= x2 ? x1 : x2;
    const xright = x1 <= x2 ? x2 : x1;
    if (leftRightFlag) {
      if (this.objCheckHidden(0, xright)) return true;
    } else if (this.objCheckHidden(xleft, VIEW_FULL_WIDTH)) {
      return true;
    }
    if (!this.objCheckHidden(xleft, xright)) {
      this.objAdd(xleft, xright);
      this.elems.push({ color, x1, h1, x2, h2 });
    }
    return false;
  }

  private setWall(
    y1p: number,
    x1p: number,
    y2p: number,
    x2p: number,
    color: number,
    leftRightFlag: number,
  ): boolean {
    const clipped = this.clipWall(
      this.vm[y1p]![x1p]!.deltaY,
      this.vm[y1p]![x1p]!.deltaX,
      this.vm[y2p]![x2p]!.deltaY,
      this.vm[y2p]![x2p]!.deltaX,
    );
    if (clipped) {
      const [sx1, sh1] = calcYxToXh(clipped[0]!, clipped[1]!);
      const [sx2, sh2] = calcYxToXh(clipped[2]!, clipped[3]!);
      return this.objSetWall(sx1, sh1, sx2, sh2, color, leftRightFlag);
    }
    return true;
  }

  private generateRenderlist(
    y: number,
    x: number,
    fieldOffsetY: number,
    fieldOffsetX: number,
    flip: number,
    leftRightFlag: number,
  ): void {
    this.tableSize = 0;
    this.elems = [];
    const _fieldY = (y >> MAZE_FIELD_SHIFT) | 1;
    const _fieldX = (x >> MAZE_FIELD_SHIFT) | 1;
    const fieldY = flip ? _fieldX : _fieldY;
    const fieldX = flip ? _fieldY : _fieldX;
    const wall = (a: number, b: number): boolean =>
      this.world.getMazeData(a, b, !!flip) === MAZE_FIELD_WALL;

    let fieldFY = fieldY;
    for (let viewingDistance = 7; viewingDistance >= 0; viewingDistance--) {
      // walls towards the horizon, on/left of centre
      let viewingWidth = 7;
      let fieldFX = fieldX;
      do {
        fieldFX -= fieldOffsetX;
        if (wall(fieldFY, fieldFX)) {
          if (
            this.setWall(
              viewingDistance,
              viewingWidth,
              viewingDistance + 1,
              viewingWidth,
              flip,
              leftRightFlag ^ 1,
            )
          )
            break;
        }
        if (this.objCheckCovered()) break;
        fieldFX -= fieldOffsetX;
      } while (--viewingWidth >= 0);

      // walls towards the horizon, right of centre
      viewingWidth = 8;
      fieldFX = fieldX + fieldOffsetX;
      for (;;) {
        if (wall(fieldFY, fieldFX)) {
          if (
            this.setWall(
              viewingDistance,
              viewingWidth,
              viewingDistance + 1,
              viewingWidth,
              flip,
              leftRightFlag,
            )
          )
            break;
        }
        if (this.objCheckCovered()) break;
        if (viewingWidth === 16) break;
        fieldFX += fieldOffsetX;
        fieldFX += fieldOffsetX;
        viewingWidth++;
      }

      // walls parallel to the horizon, left of centre
      fieldFY += fieldOffsetY;
      fieldFX = fieldX;
      for (viewingWidth = 7; viewingWidth >= 0; viewingWidth--) {
        if (wall(fieldFY, fieldFX)) {
          if (
            this.setWall(
              viewingDistance,
              viewingWidth,
              viewingDistance,
              viewingWidth + 1,
              flip ^ 1,
              leftRightFlag ^ 1,
            )
          )
            break;
        }
        if (this.objCheckCovered()) break;
        fieldFX -= fieldOffsetX + fieldOffsetX;
      }

      // walls parallel to the horizon, right of centre
      fieldFX = fieldX + fieldOffsetX + fieldOffsetX;
      for (viewingWidth = 8; viewingWidth < 16; viewingWidth++) {
        if (wall(fieldFY, fieldFX)) {
          if (
            this.setWall(
              viewingDistance,
              viewingWidth,
              viewingDistance,
              viewingWidth + 1,
              flip ^ 1,
              leftRightFlag,
            )
          )
            break;
        }
        if (this.objCheckCovered()) break;
        fieldFX += fieldOffsetX + fieldOffsetX;
      }
      fieldFY += fieldOffsetY;
      if (this.objCheckCovered()) break;
    }
  }
}

/** Build the wall draw-list for a viewpoint (y,x in units, dir 0..255). */
export function makeWallList(world: World, y: number, x: number, dir: number): Wall[] {
  return new RenderList(world).build(y, x, dir);
}
