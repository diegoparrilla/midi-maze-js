// MIDI Maze wire protocol (MIDICommunication.md). The control bytes and a byte-exact
// codec for the MIDI_SEND_DATA (0x83) shared-data block, so every node rebuilds the
// identical game from the wire (D-02). Pure — no transport here (that is STORY-02/03).
import { type GameConfig, defaultConfig } from '../game/config';
import { MAZE_MAX_SIZE, type Maze } from '../maze';
import { PLAYER_MAX_COUNT } from '../sim/world';

// Control bytes (globals.h / MIDICommunication.md). 0x00 is also "joystick: none"
// once in-game; context disambiguates.
export const MIDI_MASTER_ELECT = 0x00;
export const MIDI_COUNT_PLAYERS = 0x80;
export const MIDI_RESET_SCORE = 0x81;
export const MIDI_TERMINATE_GAME = 0x82;
export const MIDI_SEND_DATA = 0x83;
export const MIDI_START_GAME = 0x84;
export const MIDI_ABOUT = 0x85;
export const MIDI_NAME_DIALOG = 0x86;

const MAZE_BYTES = MAZE_MAX_SIZE * MAZE_MAX_SIZE; // 4096

/** Fixed SEND_DATA data block (no names — those are a separate ring exchange,
 *  `midi_send_playernames`): maze-size + reload + regen + revive + lives + 3 drones +
 *  4096 maze + team-flag + 16 teams + friendly-fire + seed hi/lo. */
export const SEND_DATA_FIXED = 1 + 1 + 1 + 1 + 1 + 3 + MAZE_BYTES + 1 + PLAYER_MAX_COUNT + 1 + 2;

/** The shared game definition carried by the MIDI_SEND_DATA data block (no names). */
export interface GameData {
  /** The 64×64 (4096-byte) maze grid. */
  maze: Maze;
  /** Game-rule config (timings, lives, friendly fire, team flag + teams, drones). */
  config: GameConfig;
  /** 16-bit shared RNG seed. */
  seed: number;
}

/**
 * Encode the SEND_DATA data block: maze-size, reload, regen, revive, lives, 3 drone
 * counts, 4096 maze bytes, team-flag, 16 team bytes, friendly-fire, seed hi/lo. Player
 * names are NOT here — they are exchanged as a ring (`midi_send_playernames`) so every
 * node contributes its own. (We keep the seed in the block; the real ST shares it
 * separately at game-start — reconciled in EPIC-18.)
 */
export function encodeData(maze: Maze, config: GameConfig, seed: number): Uint8Array {
  const out: number[] = [];
  out.push(maze.size & 0xff);
  out.push(config.reloadTime & 0xff);
  out.push(config.regenTime & 0xff);
  out.push(config.reviveTime & 0xff);
  out.push(config.reviveLives & 0xff);
  out.push(config.drones[0]! & 0xff, config.drones[1]! & 0xff, config.drones[2]! & 0xff);
  for (let i = 0; i < MAZE_BYTES; i++) out.push(maze.data[i]! & 0xff);
  out.push(config.teamFlag ? 1 : 0);
  for (let i = 0; i < PLAYER_MAX_COUNT; i++) out.push((config.teams[i] ?? 0) & 0xff);
  out.push(config.friendlyFire ? 1 : 0);
  out.push((seed >> 8) & 0xff, seed & 0xff);
  return Uint8Array.from(out);
}

/** Decode the SEND_DATA data block. The maze grid is authoritative (`mazeId` left empty). */
export function decodeData(bytes: Uint8Array): GameData {
  let p = 0;
  const mazeSize = bytes[p++]!;
  const config = defaultConfig();
  config.mazeId = '';
  config.reloadTime = bytes[p++]!;
  config.regenTime = bytes[p++]!;
  config.reviveTime = bytes[p++]!;
  config.reviveLives = bytes[p++]!;
  config.drones = [bytes[p++]!, bytes[p++]!, bytes[p++]!];

  const data = new Int8Array(MAZE_BYTES);
  for (let i = 0; i < MAZE_BYTES; i++) data[i] = (bytes[p++]! << 24) >> 24; // byte -> signed
  const maze: Maze = { size: mazeSize, data, defect: false };

  config.teamFlag = bytes[p++] !== 0;
  config.teams = [];
  for (let i = 0; i < PLAYER_MAX_COUNT; i++) config.teams.push(bytes[p++]!);
  config.friendlyFire = bytes[p++] !== 0;
  const seed = ((bytes[p++]! << 8) | bytes[p++]!) & 0xffff;

  return { maze, config, seed };
}
