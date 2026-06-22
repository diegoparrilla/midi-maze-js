// Fixed-timestep pacing (EPIC-19). The original advanced one sim tick per VBL (~50/60 Hz);
// the browser loop ran one tick per `requestAnimationFrame`, which is the display refresh —
// so on a 120 Hz panel the game (and a browser-only ring's tick bandwidth) ran ~2× fast,
// and the wall-clock-calibrated flow timers (PREVIEW_TICKS/GAMEOVER_TICKS) were half as
// long. This decouples the tick rate from the refresh rate.

export const TICK_HZ = 60;
export const TICK_INTERVAL_MS = 1000 / TICK_HZ;
const MAX_CATCHUP = 4; // cap catch-up so a long stall (tab backgrounded) can't spiral

/**
 * Accumulates real elapsed time and yields how many fixed ticks to run this frame, so the
 * sim advances at `TICK_HZ` no matter the frame rate. Render every frame; step `advance()`
 * times. Caps catch-up to `MAX_CATCHUP` and drops the backlog after a big gap.
 */
export class FixedTimestep {
  private acc = 0;
  private last: number | null = null;

  /** Fixed ticks owed at `now` (ms). The first call runs exactly one tick. */
  advance(now: number): number {
    if (this.last === null) {
      this.last = now;
      return 1;
    }
    this.acc += now - this.last;
    this.last = now;
    let steps = 0;
    while (this.acc >= TICK_INTERVAL_MS && steps < MAX_CATCHUP) {
      this.acc -= TICK_INTERVAL_MS;
      steps++;
    }
    if (steps === MAX_CATCHUP) this.acc = 0; // big gap (e.g. backgrounded tab): drop the backlog
    return steps;
  }

  reset(): void {
    this.acc = 0;
    this.last = null;
  }
}
