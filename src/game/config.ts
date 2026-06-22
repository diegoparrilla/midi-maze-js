// Lobby game configuration — everything the original prefs/team dialogs decide
// (prefdlg.c / master.c) and that later becomes the MIDI_SEND_DATA block (EPIC-13).
// Pure data + helpers, no DOM; the UI (STORY-02/03) edits a GameConfig and the game
// start (STORY-04) applies it to the World.
import { PLAYER_MAX_COUNT, PLAYER_MAX_LIVES, type World } from '../sim/world';

// Timing presets (globals.h): the prefs dialog offers fast/slow for each.
export const TIME_RELOAD_FAST = 10;
export const TIME_RELOAD_SLOW = 30;
export const TIME_REGEN_FAST = 100;
export const TIME_REGEN_SLOW = 200;
export const TIME_REVIVE_FAST = 50;
export const TIME_REVIVE_SLOW = 100;

export type DroneCounts = [target: number, standard: number, ninja: number];

export interface GameConfig {
  reloadTime: number;
  regenTime: number;
  reviveTime: number;
  reviveLives: number; // 1..PLAYER_MAX_LIVES
  friendlyFire: boolean;
  teamFlag: boolean;
  teams: number[]; // per-player team 0..3, length PLAYER_MAX_COUNT
  drones: DroneCounts; // [target, standard, ninja]
  mazeId: string;
  playerName: string;
}

export function defaultConfig(): GameConfig {
  return {
    reloadTime: TIME_RELOAD_FAST,
    regenTime: TIME_REGEN_FAST,
    reviveTime: TIME_REVIVE_FAST,
    reviveLives: 2,
    friendlyFire: false,
    teamFlag: false,
    teams: new Array<number>(PLAYER_MAX_COUNT).fill(0),
    drones: [0, 0, 0],
    mazeId: 'midimaze',
    playerName: 'Player #1',
  };
}

/** Free slots for drones = total cap minus the human players (do_preference_form). */
export function maxDrones(humanCount: number): number {
  return PLAYER_MAX_COUNT - humanCount;
}

export function totalDrones(drones: DroneCounts): number {
  return drones[0] + drones[1] + drones[2];
}

/** Clamp drone counts so each is >= 0 and the total fits the free slots (trimming
 *  the later types first, mirroring how the dialog steppers stop at the cap). */
export function clampDrones(drones: DroneCounts, humanCount: number): DroneCounts {
  const out: DroneCounts = [Math.max(0, drones[0]), Math.max(0, drones[1]), Math.max(0, drones[2])];
  let over = totalDrones(out) - maxDrones(humanCount);
  for (let i = 2; i >= 0 && over > 0; i--) {
    const cut = Math.min(out[i]!, over);
    out[i]! -= cut;
    over -= cut;
  }
  return out;
}

/**
 * Apply a config to a World's game-rule fields (timings, lives, friendly fire,
 * team flag + per-player teams, drone counts). Does not place players or seed RNG
 * — that is the caller's `newWorld` (STORY-04). `humanCount` caps the drones.
 */
export function applyConfig(world: World, config: GameConfig, humanCount: number): void {
  world.reloadTime = config.reloadTime;
  world.regenTime = config.regenTime;
  world.reviveTime = config.reviveTime;
  world.reviveLives = Math.min(Math.max(config.reviveLives, 1), PLAYER_MAX_LIVES);
  world.friendlyFire = config.friendlyFire ? 1 : 0;
  world.teamFlag = config.teamFlag ? 1 : 0;
  const drones = clampDrones(config.drones, humanCount);
  world.activeDronesByType[0] = drones[0];
  world.activeDronesByType[1] = drones[1];
  world.activeDronesByType[2] = drones[2];
  for (let i = 0; i < PLAYER_MAX_COUNT; i++) {
    world.players[i]!.ply_team = config.teams[i] ?? 0;
  }
}
