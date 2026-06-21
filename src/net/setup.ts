// End-to-end pre-game handshake over the ring (EPIC-13 STORY-03): election →
// COUNT-PLAYERS → START_GAME → SEND_DATA, resolving to the shared game definition on
// master and slave. This is the protocol layer EPIC-15 (master mode) drives from the
// lobby; it does not touch the per-tick loop (EPIC-14).
import type { GameConfig } from '../game/config';
import { loadMazeById } from '../game/mazes';
import type { Maze } from '../maze';
import {
  decodeSendData,
  encodeSendData,
  MIDI_COUNT_PLAYERS,
  MIDI_SEND_DATA,
  MIDI_START_GAME,
  SEND_DATA_FIXED,
} from './protocol';
import { type ByteChannel, countMaster, countSlave, type Role, waitForControl } from './ring';

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
}

/** Read a complete SEND_DATA block off the wire (slave side), echoing each byte on. */
async function receiveData(ch: ByteChannel, nameCount: number, timeoutMs?: number) {
  const marker = await ch.readByte(timeoutMs); // expect MIDI_SEND_DATA
  ch.sendByte(marker);
  const bytes: number[] = [];
  for (let n = 0; n < nameCount; n++) {
    for (;;) {
      const b = await ch.readByte(timeoutMs);
      ch.sendByte(b);
      bytes.push(b);
      if (b === 0x00) break;
    }
  }
  for (let i = 0; i < SEND_DATA_FIXED; i++) {
    const b = await ch.readByte(timeoutMs);
    ch.sendByte(b);
    bytes.push(b);
  }
  return decodeSendData(Uint8Array.from(bytes), nameCount);
}

/**
 * Drive (host) or follow (join) the setup handshake. The host authors the shared
 * block (its `config`, the selected maze, and `seed`); slaves adopt it. In a ring of
 * one the host self-echoes the whole exchange and gets its own block back.
 */
export async function runSetup(
  ch: ByteChannel,
  role: Role,
  config: GameConfig,
  seed: number,
  timeoutMs?: number,
): Promise<SetupResult> {
  if (role === 'host') {
    const count = await countMaster(ch, timeoutMs);
    // re-arm the slaves' next count round (master.c:245), then start + send data.
    ch.sendByte(MIDI_COUNT_PLAYERS);
    await ch.readByte(timeoutMs);
    ch.sendByte(MIDI_START_GAME);
    await ch.readByte(timeoutMs);
    ch.sendByte(MIDI_SEND_DATA);
    await ch.readByte(timeoutMs);

    const maze = loadMazeById(config.mazeId);
    const block = encodeSendData({ names: [config.playerName], maze, config, seed });
    ch.send(block);
    for (let i = 0; i < block.length; i++) await ch.readByte(timeoutMs); // echoes
    return { config, maze, seed, ownNumber: count.ownNumber, machinesOnline: count.machinesOnline };
  }

  // join: process control bytes until the data block arrives.
  let machinesOnline = 1;
  let ownNumber = 0;
  for (;;) {
    const b = await waitForControl(ch, timeoutMs);
    if (b === MIDI_COUNT_PLAYERS) {
      const c = await countSlave(ch, timeoutMs);
      machinesOnline = c.machinesOnline;
      ownNumber = c.ownNumber;
    } else if (b === MIDI_START_GAME) {
      const sd = await receiveData(ch, machinesOnline, timeoutMs);
      return { config: sd.config, maze: sd.maze, seed: sd.seed, ownNumber, machinesOnline };
    }
  }
}
