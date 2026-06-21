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

/** Fixed tail after the zero-terminated name(s): maze-size + reload + regen + revive
 *  + lives + 3 drones + 4096 maze + team-flag + 16 teams + friendly-fire + seed hi/lo. */
export const SEND_DATA_FIXED = 1 + 1 + 1 + 1 + 1 + 3 + MAZE_BYTES + 1 + PLAYER_MAX_COUNT + 1 + 2; // 4123

/** The shared game definition carried by a MIDI_SEND_DATA block. */
export interface SendData {
  /** One name per human player, in ring order. */
  names: string[];
  /** The 64×64 (4096-byte) maze grid. */
  maze: Maze;
  /** Game-rule config (timings, lives, friendly fire, team flag + teams, drones). */
  config: GameConfig;
  /** 16-bit shared RNG seed. */
  seed: number;
}

/**
 * Encode a SEND_DATA block, byte-exact to MIDICommunication.md: each name
 * zero-terminated, then maze-size, reload, regen, revive, lives, 3 drone counts,
 * 4096 maze bytes, team-flag, 16 team bytes, friendly-fire, seed hi/lo. The leading
 * MIDI_SEND_DATA (0x83) marker itself is part of the handshake (STORY-03), not here.
 */
export function encodeSendData(d: SendData): Uint8Array {
  const out: number[] = [];
  for (const name of d.names) {
    for (let i = 0; i < name.length; i++) out.push(name.charCodeAt(i) & 0xff);
    out.push(0x00); // zero terminator
  }
  out.push(d.maze.size & 0xff);
  out.push(d.config.reloadTime & 0xff);
  out.push(d.config.regenTime & 0xff);
  out.push(d.config.reviveTime & 0xff);
  out.push(d.config.reviveLives & 0xff);
  out.push(d.config.drones[0] & 0xff, d.config.drones[1] & 0xff, d.config.drones[2] & 0xff);
  for (let i = 0; i < MAZE_BYTES; i++) out.push(d.maze.data[i]! & 0xff);
  out.push(d.config.teamFlag ? 1 : 0);
  for (let i = 0; i < PLAYER_MAX_COUNT; i++) out.push((d.config.teams[i] ?? 0) & 0xff);
  out.push(d.config.friendlyFire ? 1 : 0);
  out.push((d.seed >> 8) & 0xff, d.seed & 0xff);
  return Uint8Array.from(out);
}

/**
 * Decode a SEND_DATA block. `nameCount` names (known from COUNT-PLAYERS) are read
 * first, then the fixed tail. The returned config carries the game-rule fields; the
 * maze grid is authoritative (mazeId is left empty — the wire carries the grid, not
 * an id).
 */
export function decodeSendData(bytes: Uint8Array, nameCount: number): SendData {
  let p = 0;
  const names: string[] = [];
  for (let n = 0; n < nameCount; n++) {
    let s = '';
    while (p < bytes.length && bytes[p] !== 0x00) s += String.fromCharCode(bytes[p++]!);
    p++; // skip the terminator
    names.push(s);
  }

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

  return { names, maze, config, seed };
}
