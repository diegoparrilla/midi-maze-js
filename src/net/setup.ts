// End-to-end pre-game handshake over the ring (EPIC-13 STORY-03): election →
// COUNT-PLAYERS → START_GAME → SEND_DATA, resolving to the shared game definition on
// master and slave. This is the protocol layer EPIC-15 (master mode) drives from the
// lobby; it does not touch the per-tick loop (EPIC-14).
import type { GameConfig } from '../game/config';
import { loadMazeById } from '../game/mazes';
import type { Maze } from '../maze';
import {
  decodeData,
  encodeData,
  MIDI_COUNT_PLAYERS,
  MIDI_NAME_DIALOG,
  MIDI_SEND_DATA,
  MIDI_START_GAME,
  SEND_DATA_FIXED,
} from './protocol';
import {
  type ByteChannel,
  countMaster,
  type CountResult,
  countSlave,
  nameCountSlave,
  type Role,
  waitForControl,
} from './ring';

export interface SetupResult {
  /** Game-rule config shared by all nodes (the master's, adopted by slaves). */
  config: GameConfig;
  /** The shared maze grid. */
  maze: Maze;
  /** Shared 16-bit RNG seed. */
  seed: number;
  /** This node's player index in the ring (master = 0). */
  ownNumber: number;
  /** Total human players in the ring. */
  machinesOnline: number;
  /** Every player's name, in ring order — agreed by the name exchange. */
  names: string[];
}

/**
 * Player-name ring exchange (`midi_send_playernames`, midicomm.c, active-player branch).
 * Each iteration **sends** the name it holds for slot `i` and **reads** (does NOT echo —
 * only the MIDIcam echoes) the previous slot's name, stepping `i` backwards mod
 * `machinesOnline` until it wraps to `ownNumber`. After `machinesOnline` rounds every
 * node holds every name. N sends + N reads per node — perfectly balanced.
 */
export async function exchangeNames(
  ch: ByteChannel,
  ownNumber: number,
  machinesOnline: number,
  ownName: string,
  timeoutMs?: number,
): Promise<string[]> {
  // A lone node has no peer to exchange with (and the orchestrator self-echo can't model
  // a ring of one for this protocol).
  if (machinesOnline <= 1) return [ownName];

  const names = new Array<string>(machinesOnline).fill('');
  names[ownNumber] = ownName;
  let i = ownNumber;
  do {
    const name = names[i] ?? '';
    for (let j = 0; j < name.length; j++) ch.sendByte(name.charCodeAt(j));
    ch.sendByte(0x00); // 0-terminator
    if (--i < 0) i = machinesOnline - 1;
    let recv = '';
    for (;;) {
      const b = await ch.readByte(timeoutMs); // read only — active players don't echo
      if (b === 0x00) break;
      recv += String.fromCharCode(b);
    }
    names[i] = recv;
  } while (i !== ownNumber);
  return names;
}

/**
 * Send a bulk block to the ring without overrunning a real ST's MIDI port. MIDI is
 * 31250 baud ≈ 3125 bytes/s, so dumping 4 KB at once overflows the gateway/ST buffer and
 * loses bytes. Like `send_datas` (midicomm.c, the 50-byte maze buffer): keep at most
 * `SEND_WINDOW` bytes in flight and read each echo, which self-paces the sender to the
 * ring's actual speed (MIDI-limited when a real ST is on the ring, fast browser↔browser).
 */
const SEND_WINDOW = 50;
async function sendPaced(ch: ByteChannel, bytes: Uint8Array, timeoutMs?: number): Promise<void> {
  for (let i = 0; i < bytes.length; i++) {
    ch.sendByte(bytes[i]!);
    if (i >= SEND_WINDOW) await ch.readByte(timeoutMs); // echo lags by the window
  }
  for (let i = 0; i < Math.min(SEND_WINDOW, bytes.length); i++) await ch.readByte(timeoutMs); // drain
}

/**
 * NAME_DIALOG sync barrier (`playername_edit_dialog`, slave.c:215 — "wait for all player
 * to be done, no timeout"): after editing, each node sends `machinesOnline` zeros and
 * reads that many back, so the name exchange only begins once **every** node has finished
 * editing. Without it, a node still in its dialog lets these zeros be misread as a name.
 */
export async function nameBarrier(
  ch: ByteChannel,
  machinesOnline: number,
  timeoutMs?: number,
): Promise<void> {
  for (let i = 0; i < machinesOnline; i++) {
    ch.sendByte(0x00);
    await ch.readByte(timeoutMs);
  }
}

/** Receive the SEND_DATA block (slave): marker, name ring, then the data block (echoed). */
async function receiveData(
  ch: ByteChannel,
  ownNumber: number,
  machinesOnline: number,
  ownName: string,
  timeoutMs?: number,
) {
  const marker = await ch.readByte(timeoutMs); // expect MIDI_SEND_DATA
  ch.sendByte(marker);
  const names = await exchangeNames(ch, ownNumber, machinesOnline, ownName, timeoutMs);
  const bytes: number[] = [];
  for (let i = 0; i < SEND_DATA_FIXED; i++) {
    const b = await ch.readByte(timeoutMs);
    ch.sendByte(b); // the slave echoes the data block (receive_datas)
    bytes.push(b);
  }
  return { ...decodeData(Uint8Array.from(bytes)), names };
}

/**
 * Drive (host) or follow (join) the setup handshake. The host authors the shared
 * block (its `config`, the selected maze, and `seed`); slaves adopt it. In a ring of
 * one the host self-echoes the whole exchange and gets its own block back.
 */
export interface SetupOptions {
  /** Slave: the master sent NAME_DIALOG — open the name editor and resolve the chosen
   *  name (used for the ring exchange that follows). */
  onNameDialog?: () => Promise<string>;
  /** Slave: the names agreed by a NAME_DIALOG round (every player's name, ring order). */
  onNames?: (names: string[]) => void;
}

export async function runSetup(
  ch: ByteChannel,
  role: Role,
  config: GameConfig,
  seed: number,
  timeoutMs?: number,
  opts: SetupOptions = {},
): Promise<SetupResult> {
  if (role === 'host') {
    const count = await hostCount(ch, timeoutMs);
    return hostStart(ch, config, seed, count, timeoutMs);
  }

  // join: process control bytes until the data block arrives.
  ch.flush(); // drop residue from a previous game before waiting (slave.c:30-31)
  let machinesOnline = 1;
  let ownNumber = 0;
  for (;;) {
    const b = await waitForControl(ch, timeoutMs);
    if (b === MIDI_COUNT_PLAYERS) {
      const c = await countSlave(ch, timeoutMs);
      machinesOnline = c.machinesOnline;
      ownNumber = c.ownNumber;
    } else if (b === MIDI_NAME_DIALOG) {
      // Live NAME_DIALOG round (slave.c:150): the token was echoed by waitForControl;
      // do the 0x86 count, edit our name, then exchange every name round the ring.
      const c = await nameCountSlave(ch, timeoutMs);
      const chosen = (await opts.onNameDialog?.()) ?? config.playerName;
      config.playerName = chosen;
      await nameBarrier(ch, c.machinesOnline, timeoutMs); // wait for every node to finish editing
      const names = await exchangeNames(ch, c.ownNumber, c.machinesOnline, chosen, timeoutMs);
      opts.onNames?.(names);
    } else if (b === MIDI_START_GAME) {
      const sd = await receiveData(ch, ownNumber, machinesOnline, config.playerName, timeoutMs);
      const { config: cfg, maze, seed: s, names } = sd;
      return { config: cfg, maze, seed: s, ownNumber, machinesOnline, names };
    }
  }
}

/**
 * Master COUNT-PLAYERS (master.c:212-230): flush buffered elections, then tally the
 * ring. The original runs this when the player picks **Play**, *before* the preferences
 * dialog, so the dialog knows how many humans are online. `ownNumber` is 0.
 */
export async function hostCount(ch: ByteChannel, timeoutMs?: number): Promise<CountResult> {
  ch.flush(); // drop joiners' buffered 0x00 elections before COUNT (master.c:212)
  return countMaster(ch, timeoutMs);
}

/**
 * Master START_GAME + SEND_DATA (master.c:257 + send_datas, midicomm.c): re-arm COUNT,
 * START, then the package = flush, marker, the **player-name ring exchange** (so every
 * node's real name reaches everyone), and the fixed data block. Returns the agreed world
 * plus the full name table.
 */
export async function hostStart(
  ch: ByteChannel,
  config: GameConfig,
  seed: number,
  count: CountResult,
  timeoutMs?: number,
): Promise<SetupResult> {
  ch.sendByte(MIDI_COUNT_PLAYERS); // re-arm the slaves' next count round (master.c:245)
  await ch.readByte(timeoutMs);
  ch.sendByte(MIDI_START_GAME);
  await ch.readByte(timeoutMs);

  ch.flush(); // send_datas: drop pending before the package (midicomm.c:114)
  ch.sendByte(MIDI_SEND_DATA);
  await ch.readByte(timeoutMs);

  const names = await exchangeNames(
    ch,
    count.ownNumber,
    count.machinesOnline,
    config.playerName,
    timeoutMs,
  );

  const maze = loadMazeById(config.mazeId);
  const block = encodeData(maze, config, seed);
  await sendPaced(ch, block, timeoutMs); // throttle to MIDI speed — a real ST can't take 4KB at once
  return {
    config,
    maze,
    seed,
    ownNumber: count.ownNumber,
    machinesOnline: count.machinesOnline,
    names,
  };
}
