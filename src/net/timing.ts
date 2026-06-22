// Centralized lock-step timing for the MIDI ring (EPIC-19). The original tolerated
// MIDI_DEFAULT_TIMEOUT ≈ 0.4s per byte on a deterministic low-latency MIDI ring; over a
// WebSocket ring (orchestrator + Hatari/ST bridge, possibly mobile/venue WiFi) latency is
// variable and spiky, so a fixed per-tick deadline either false-times-out on a stall or is
// slow to notice a dead peer. The fix tunes only the *duration* — the lock-step model is
// unchanged: a byte that never arrives still ends the ring cleanly (C-01).

/** Election round-trip allowance (the `0x00` must travel the whole ring). */
export const ELECTION_TIMEOUT_MS = 1500;
/** Per-byte read default when no explicit deadline is given (handshake plumbing). */
export const RING_DEFAULT_TIMEOUT_MS = 2000;
/** Host handshake (election → COUNT → SEND_DATA block → START). Generous: the 4 KB
 *  block is paced to ~3125 B/s and travels the ring. */
export const SETUP_TIMEOUT_MS = 8000;
/** A slave waits patiently for the master to start (cancellable in the UI). */
export const SLAVE_WAIT_MS = 600_000;

/** The adaptive per-tick band: the read deadline is `RTT × multiplier`, clamped to
 *  `[floorMs, ceilingMs]`, where RTT is an EWMA of recent tick round-trips. */
export interface TimeoutBand {
  floorMs: number;
  ceilingMs: number;
  multiplier: number;
  /** EWMA smoothing for the RTT estimate (0..1; higher = more reactive). */
  alpha: number;
}

export const DEFAULT_BAND: TimeoutBand = {
  floorMs: 1500, // never tighter than the original-ish 1.5s, so a brief GC/radio stall is fine
  ceilingMs: 8000, // never looser than 8s, so a truly dead ring is still detected
  multiplier: 4,
  alpha: 0.25,
};

/**
 * An adaptive read deadline for the lock-step pump. Feed each tick's measured round-trip
 * via `update`; `next` returns the deadline for the following read — proportional to the
 * ring's normal speed (fast ring → tight, slow venue ring → patient), clamped to the band.
 * Before any sample it returns the ceiling, so the first ticks get maximum tolerance.
 */
export class AdaptiveTimeout {
  private ewma: number | null = null;
  private readonly band: TimeoutBand;

  constructor(band: TimeoutBand = DEFAULT_BAND) {
    this.band = band;
  }

  next(): number {
    if (this.ewma === null) return this.band.ceilingMs;
    const scaled = Math.round(this.ewma * this.band.multiplier);
    return Math.min(this.band.ceilingMs, Math.max(this.band.floorMs, scaled));
  }

  update(sampleMs: number): void {
    const a = this.band.alpha;
    this.ewma = this.ewma === null ? sampleMs : a * sampleMs + (1 - a) * this.ewma;
  }

  get rttEwma(): number | null {
    return this.ewma;
  }
}

/**
 * Build a timeout band from URL params for venue tuning (consistent with `?sendWindow`):
 * `?tickTimeout=N` raises/lowers the ceiling (max tolerance), `?tickFloor=N` the floor.
 * Setting both equal pins a fixed per-tick timeout. Invalid/absent values fall back to
 * the defaults; the floor is never above the ceiling.
 */
export function bandFromParams(params: URLSearchParams): TimeoutBand {
  const num = (key: string, fallback: number): number => {
    const v = Number(params.get(key));
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };
  const ceilingMs = num('tickTimeout', DEFAULT_BAND.ceilingMs);
  const floorMs = Math.min(num('tickFloor', DEFAULT_BAND.floorMs), ceilingMs);
  return { ...DEFAULT_BAND, floorMs, ceilingMs };
}
