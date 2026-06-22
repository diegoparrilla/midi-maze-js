// Shared 1bpp mask blitter (EPIC-23 perf). Sprites and HUD masks used to emit one 1×1
// fillRect per set pixel — hundreds of canvas calls per sprite, the per-frame hot path on
// low-end phones. This coalesces each row's consecutive set bits into a single horizontal
// fillRect (run-length), drawing the identical pixels with far fewer calls. The caller
// sets ctx.fillStyle and passes the absolute top-left (x, y).

/**
 * Blit a 1bpp mask (row-major 16-bit words, MSB = leftmost) at absolute (x, y), one
 * fillRect per run of set bits. `startRow` skips into multi-frame tables; `widthWords`
 * words per row; `height` rows.
 */
export function blitRuns(
  ctx: CanvasRenderingContext2D,
  rows: number[],
  startRow: number,
  widthWords: number,
  height: number,
  x: number,
  y: number,
): void {
  const cols = widthWords * 16;
  for (let r = 0; r < height; r++) {
    const base = (startRow + r) * widthWords;
    let runStart = -1;
    for (let c = 0; c < cols; c++) {
      const bit = (rows[base + (c >> 4)]! >> (15 - (c & 15))) & 1;
      if (bit) {
        if (runStart < 0) runStart = c;
      } else if (runStart >= 0) {
        ctx.fillRect(x + runStart, y + r, c - runStart, 1);
        runStart = -1;
      }
    }
    if (runStart >= 0) ctx.fillRect(x + runStart, y + r, cols - runStart, 1);
  }
}
