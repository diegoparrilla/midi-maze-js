import { describe, expect, it } from 'vitest';
import {
  buildUrl,
  type SocketLike,
  Transport,
  type TransportOptions,
  type TransportStatus,
} from './transport';

/** A controllable fake WebSocket: tests drive open/message/close by hand. */
class FakeSocket implements SocketLike {
  binaryType = '';
  sent: Uint8Array[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;

  send(data: ArrayBufferView | ArrayBuffer): void {
    this.sent.push(new Uint8Array(data as ArrayBuffer));
  }
  close(): void {
    this.closed = true;
  }
  // test helpers
  fireOpen(): void {
    this.onopen?.();
  }
  fireMessage(data: unknown): void {
    this.onmessage?.({ data });
  }
  fireClose(): void {
    this.onclose?.();
  }
}

/** A manual timer queue so backoff is deterministic. */
function fakeTimers() {
  const pending = new Map<number, () => void>();
  let next = 1;
  return {
    set: (fn: () => void) => {
      const id = next++;
      pending.set(id, fn);
      return id;
    },
    clear: (id: number) => {
      pending.delete(id);
    },
    runAll: () => {
      for (const [id, fn] of [...pending]) {
        pending.delete(id);
        fn();
      }
    },
    size: () => pending.size,
  };
}

function setup(over: Partial<TransportOptions> = {}) {
  const sockets: FakeSocket[] = [];
  const bytes: Uint8Array[] = [];
  const statuses: TransportStatus[] = [];
  const timers = fakeTimers();
  const t = new Transport({
    url: 'ws://host:5006/',
    onBytes: (b) => bytes.push(b),
    onStatus: (s) => statuses.push(s),
    createSocket: () => {
      const s = new FakeSocket();
      sockets.push(s);
      return s;
    },
    setTimeoutFn: timers.set,
    clearTimeoutFn: timers.clear,
    ...over,
  });
  return { t, sockets, bytes, statuses, timers };
}

describe('buildUrl', () => {
  it('returns the bare url with no room (default room)', () => {
    expect(buildUrl('ws://h:5006/')).toBe('ws://h:5006/');
  });
  it('appends the room as a query param', () => {
    expect(buildUrl('ws://h:5006/', 'ABC')).toBe('ws://h:5006/?room=ABC');
    expect(buildUrl('ws://h:5006/?x=1', 'A B')).toBe('ws://h:5006/?x=1&room=A%20B');
  });
});

describe('Transport byte pipe (STORY-01)', () => {
  it('connects, sets arraybuffer, and reports status', () => {
    const { t, sockets, statuses } = setup();
    t.connect();
    expect(statuses).toEqual(['connecting']);
    expect(sockets[0]!.binaryType).toBe('arraybuffer');
    sockets[0]!.fireOpen();
    expect(t.status).toBe('open');
    expect(statuses).toEqual(['connecting', 'open']);
  });

  it('forwards inbound ArrayBuffer frames as Uint8Array', () => {
    const { t, sockets, bytes } = setup();
    t.connect();
    sockets[0]!.fireOpen();
    sockets[0]!.fireMessage(new Uint8Array([0x10, 0x80, 0x00]).buffer);
    expect(bytes).toHaveLength(1);
    expect([...bytes[0]!]).toEqual([0x10, 0x80, 0x00]);
  });

  it('send() only writes when open', () => {
    const { t, sockets } = setup();
    expect(t.send(new Uint8Array([1]))).toBe(false); // not connected
    t.connect();
    expect(t.send(new Uint8Array([2]))).toBe(false); // connecting, not open
    sockets[0]!.fireOpen();
    expect(t.send(new Uint8Array([3]))).toBe(true);
    expect([...sockets[0]!.sent[0]!]).toEqual([3]);
  });
});

describe('Transport reconnect (STORY-02)', () => {
  it('reconnects with capped backoff after an unexpected close', () => {
    const { t, sockets, statuses, timers } = setup({ backoffBaseMs: 500, backoffMaxMs: 8000 });
    t.connect();
    sockets[0]!.fireOpen();
    expect(t.backoffMs(0)).toBe(500);
    expect(t.backoffMs(4)).toBe(8000); // 500*16 capped

    sockets[0]!.fireClose(); // drop
    expect(t.status).toBe('reconnecting');
    expect(timers.size()).toBe(1);
    timers.runAll(); // backoff elapses -> new socket
    expect(sockets).toHaveLength(2);
    sockets[1]!.fireOpen();
    expect(t.status).toBe('open');
    expect(statuses).toContain('reconnecting');
  });

  it('does not reconnect after an explicit close()', () => {
    const { t, sockets, timers } = setup();
    t.connect();
    sockets[0]!.fireOpen();
    t.close();
    expect(t.status).toBe('closed');
    expect(sockets[0]!.closed).toBe(true);
    sockets[0]!.fireClose(); // late close event must not schedule a retry
    expect(timers.size()).toBe(0);
    expect(sockets).toHaveLength(1);
  });

  it('honours reconnect:false (closes instead of retrying)', () => {
    const { t, sockets, timers } = setup({ reconnect: false });
    t.connect();
    sockets[0]!.fireOpen();
    sockets[0]!.fireClose();
    expect(t.status).toBe('closed');
    expect(timers.size()).toBe(0);
  });
});
