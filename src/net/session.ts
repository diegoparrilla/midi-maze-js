// Open a networked session: connect the transport, run the setup handshake in the
// chosen role, and hand back the live channel + shared game definition. DOM-free, so
// the host path is unit-testable with a fake socket (EPIC-15 STORY-02).
import type { GameConfig } from '../game/config';
import type { NetConfig } from './netconfig';
import { ByteChannel } from './ring';
import { runSetup, type SetupResult } from './setup';
import {
  type SocketFactory,
  Transport,
  type TransportOptions,
  type TransportStatus,
} from './transport';

export interface Session {
  transport: Transport;
  channel: ByteChannel;
  setup: SetupResult;
}

export interface ConnectOptions {
  /** Status callback: connecting / open (then the handshake runs) / closed. */
  onStatus?: (status: TransportStatus) => void;
  connectTimeoutMs?: number;
  handshakeTimeoutMs?: number;
  /** Injectable socket factory (tests); defaults to the native WebSocket. */
  createSocket?: SocketFactory;
}

/**
 * Connect + handshake. The host authors the shared block (its `config`, the selected
 * maze, and `seed`); a join adopts the host's. Resolves once the world is agreed, or
 * rejects on a connect/handshake failure (the ring "boo-boo") — no reconnect during
 * setup so a failure surfaces cleanly. Membership is frozen at this point (C-04).
 */
export async function connectSession(
  net: NetConfig,
  config: GameConfig,
  seed: number,
  opts: ConnectOptions = {},
): Promise<Session> {
  const role = net.mode === 'host' ? 'host' : 'join';

  let ch!: ByteChannel;
  let resolveOpen!: () => void;
  let rejectOpen!: (e: Error) => void;
  const opened = new Promise<void>((res, rej) => {
    resolveOpen = res;
    rejectOpen = rej;
  });

  const tOpts: TransportOptions = {
    url: net.url,
    room: net.room, // empty string → default room (buildUrl omits the query)
    reconnect: false, // a drop during setup is a clean failure, not a retry
    onBytes: (b) => ch.push(b),
    onStatus: (s) => {
      opts.onStatus?.(s);
      if (s === 'open') resolveOpen();
      else if (s === 'closed') rejectOpen(new Error('connection closed'));
    },
  };
  if (opts.createSocket) tOpts.createSocket = opts.createSocket;
  const transport = new Transport(tOpts);
  ch = new ByteChannel((bytes) => transport.send(bytes));
  transport.connect();

  const timer = setTimeout(
    () => rejectOpen(new Error('connect timeout')),
    opts.connectTimeoutMs ?? 5000,
  );
  try {
    await opened;
  } finally {
    clearTimeout(timer);
  }

  const setup = await runSetup(ch, role, config, seed, opts.handshakeTimeoutMs);
  return { transport, channel: ch, setup };
}
