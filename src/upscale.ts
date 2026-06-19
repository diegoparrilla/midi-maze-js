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
