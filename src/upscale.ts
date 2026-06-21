/** Native MIDI Maze colour-mode framebuffer size (D-04). */
export const BASE_WIDTH = 320;
export const BASE_HEIGHT = 200;

/**
 * Largest integer scale factor that fits a `baseW x baseH` framebuffer inside a
 * `viewportW x viewportH` area, clamped to at least 1 so the canvas is never
 * scaled below native (it just overflows on tiny viewports).
 */
export function integerScale(
  viewportW: number,
  viewportH: number,
  baseW: number = BASE_WIDTH,
  baseH: number = BASE_HEIGHT,
): number {
  const fit = Math.min(viewportW / baseW, viewportH / baseH);
  return Math.max(1, Math.floor(fit));
}

export interface DisplaySize {
  width: number;
  height: number;
}

/**
 * Pixel display size for the canvas (D-12). When `fillHeight` (touch / coarse
 * pointer), the framebuffer fills the viewport height with no top/bottom gaps,
 * centered horizontally — width follows the 16:10 aspect, clamped so it never
 * exceeds the viewport width. Otherwise (desktop) it uses the largest integer
 * upscale (D-04). The framebuffer stays `baseW x baseH`; this is display only.
 */
export function displaySize(
  viewportW: number,
  viewportH: number,
  fillHeight: boolean,
  baseW: number = BASE_WIDTH,
  baseH: number = BASE_HEIGHT,
): DisplaySize {
  if (fillHeight) {
    let height = viewportH;
    let width = Math.round((height * baseW) / baseH);
    if (width > viewportW) {
      width = viewportW;
      height = Math.round((width * baseH) / baseW);
    }
    return { width, height };
  }
  const scale = integerScale(viewportW, viewportH, baseW, baseH);
  return { width: baseW * scale, height: baseH * scale };
}
