// WebSocket transport to the md-MIDI2IP orchestrator (D-08). An opaque binary byte
// pipe — the MIDI Maze stream (D-02) is carried unchanged; the browser's native
// WebSocket does all RFC 6455 framing, so there is no codec here. Handles connect,
// reconnect (capped backoff) and status. The socket + timer are injectable so the
// whole thing is unit-tested with no real network.

export type TransportStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

/** The slice of `WebSocket` we use, so tests can supply a fake. */
export interface SocketLike {
  binaryType: string;
  send(data: ArrayBufferView | ArrayBuffer): void;
  close(code?: number, reason?: string): void;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
}

export type SocketFactory = (url: string) => SocketLike;

export interface TransportOptions {
  /** Orchestrator WebSocket URL, e.g. ws://host:5006/. */
  url: string;
  /** Optional room key (see notes on the browser Authorization limitation). */
  room?: string;
  onBytes: (data: Uint8Array) => void;
  onStatus?: (status: TransportStatus) => void;
  /** Auto-reconnect on unexpected close (default true). */
  reconnect?: boolean;
  backoffBaseMs?: number;
  backoffMaxMs?: number;
  /** Injectable for tests; defaults to the native WebSocket. */
  createSocket?: SocketFactory;
  setTimeoutFn?: (fn: () => void, ms: number) => number;
  clearTimeoutFn?: (id: number) => void;
}

const defaultFactory: SocketFactory = (url) => new WebSocket(url) as unknown as SocketLike;

/**
 * Build the connect URL. The orchestrator reads a private-room key from
 * `Authorization: Bearer` (orchestrator.py), which a browser cannot set on a
 * WebSocket — so a keyed join needs orchestrator support for a query param. We plumb
 * `?room=KEY` here; with no key the connection lands in the default room (which works
 * today). See EPIC-12 STORY-03 notes.
 */
export function buildUrl(url: string, room?: string): string {
  if (!room) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}room=${encodeURIComponent(room)}`;
}

export class Transport {
  private readonly opts: Required<
    Pick<TransportOptions, 'reconnect' | 'backoffBaseMs' | 'backoffMaxMs'>
  > &
    TransportOptions;
  private readonly createSocket: SocketFactory;
  private readonly setT: (fn: () => void, ms: number) => number;
  private readonly clearT: (id: number) => void;

  private socket: SocketLike | null = null;
  private _status: TransportStatus = 'idle';
  private manualClose = false;
  private attempt = 0;
  private retryTimer: number | null = null;

  constructor(opts: TransportOptions) {
    this.opts = {
      reconnect: opts.reconnect ?? true,
      backoffBaseMs: opts.backoffBaseMs ?? 500,
      backoffMaxMs: opts.backoffMaxMs ?? 8000,
      ...opts,
    };
    this.createSocket = opts.createSocket ?? defaultFactory;
    this.setT = opts.setTimeoutFn ?? ((fn, ms) => setTimeout(fn, ms) as unknown as number);
    this.clearT = opts.clearTimeoutFn ?? ((id) => clearTimeout(id));
  }

  get status(): TransportStatus {
    return this._status;
  }

  /** Delay before reconnect attempt `n` (0-based): base*2^n, capped. */
  backoffMs(n: number): number {
    return Math.min(this.opts.backoffBaseMs * 2 ** n, this.opts.backoffMaxMs);
  }

  private setStatus(s: TransportStatus): void {
    this._status = s;
    this.opts.onStatus?.(s);
  }

  /** Open the connection (idempotent while already connecting/open). */
  connect(): void {
    if (this._status === 'connecting' || this._status === 'open') return;
    this.manualClose = false;
    this.open();
  }

  private open(): void {
    this.setStatus('connecting');
    const sock = this.createSocket(buildUrl(this.opts.url, this.opts.room));
    sock.binaryType = 'arraybuffer';
    this.socket = sock;
    sock.onopen = () => {
      this.attempt = 0;
      this.setStatus('open');
    };
    sock.onmessage = (ev) => {
      const data = ev.data;
      if (data instanceof ArrayBuffer) this.opts.onBytes(new Uint8Array(data));
      else if (ArrayBuffer.isView(data))
        this.opts.onBytes(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      // text frames are not part of the byte pipe — ignored
    };
    sock.onerror = () => {
      /* the close handler drives reconnect; nothing to do here */
    };
    sock.onclose = () => {
      this.socket = null;
      if (this.manualClose || !this.opts.reconnect) {
        this.setStatus('closed');
        return;
      }
      this.setStatus('reconnecting');
      const delay = this.backoffMs(this.attempt++);
      this.retryTimer = this.setT(() => this.open(), delay);
    };
  }

  /** Send opaque bytes. No-op (returns false) when not open. */
  send(bytes: Uint8Array): boolean {
    if (this._status !== 'open' || !this.socket) return false;
    this.socket.send(bytes);
    return true;
  }

  /** Close for good — stops reconnect attempts. */
  close(): void {
    this.manualClose = true;
    if (this.retryTimer !== null) {
      this.clearT(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.setStatus('closed');
  }
}
