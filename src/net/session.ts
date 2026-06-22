// Network session lifecycle (EPIC-24 STORY-02). The connection is opened *early* and
// held idle — connected, auto-reconnecting on drop, but sending no handshake/game
// bytes until the player picks a role at Start. The handshake itself is `runSetup`
// (EPIC-13) run later over this same channel. DOM-free, so it is unit-testable with a
// fake socket.
import type { NetConfig } from './netconfig';
import { ByteChannel } from './ring';
import {
  type SocketFactory,
  Transport,
  type TransportOptions,
  type TransportStatus,
} from './transport';

/** A live, idle link to the orchestrator: a connected transport + its byte channel. */
export interface IdleLink {
  transport: Transport;
  channel: ByteChannel;
  /** Resolves on the first successful open (drive the connect screen off this). */
  opened: Promise<void>;
}

export interface IdleOptions {
  /** Status callback: connecting / open / reconnecting / closed (drives the icon). */
  onStatus?: (status: TransportStatus) => void;
  /** Injectable socket factory (tests); defaults to the native WebSocket. */
  createSocket?: SocketFactory;
}

/**
 * Open the orchestrator link and keep it alive. Matches the original: nodes sit on the
 * ring before the master triggers COUNT/SEND-DATA/START. Auto-reconnects on drop (the
 * net-status icon shows the gap); inbound bytes simply buffer in the channel until the
 * handshake arms over it. `opened` resolves on first connect — close the transport to
 * stop reconnecting.
 */
export function connectIdle(net: NetConfig, opts: IdleOptions = {}): IdleLink {
  let resolveOpen!: () => void;
  const opened = new Promise<void>((res) => {
    resolveOpen = res;
  });

  let ch!: ByteChannel;
  const tOpts: TransportOptions = {
    url: net.url,
    room: net.room, // empty string → default room (buildUrl omits the query)
    reconnect: true, // hold the link idle; recover transparently from drops
    onBytes: (b) => ch.push(b),
    onStatus: (s) => {
      opts.onStatus?.(s);
      if (s === 'open') resolveOpen();
    },
  };
  if (opts.createSocket) tOpts.createSocket = opts.createSocket;
  const transport = new Transport(tOpts);
  ch = new ByteChannel((bytes) => transport.send(bytes));
  transport.connect();

  return { transport, channel: ch, opened };
}
