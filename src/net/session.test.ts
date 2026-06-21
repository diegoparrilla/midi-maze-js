import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../game/config';
import { defaultNetConfig } from './netconfig';
import { connectSession } from './session';
import type { SocketLike } from './transport';

/** A self-echoing fake WebSocket (orchestrator ring-of-one): opens async, echoes
 *  every sent frame back as an inbound message. */
class FakeEchoSocket implements SocketLike {
  binaryType = '';
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  constructor() {
    queueMicrotask(() => this.onopen?.());
  }
  send(data: ArrayBufferView | ArrayBuffer): void {
    const u8 = new Uint8Array(data as ArrayBuffer);
    const copy = u8.slice();
    queueMicrotask(() => this.onmessage?.({ data: copy.buffer }));
  }
  close(): void {
    this.onclose?.();
  }
}

/** A socket that opens but never delivers a byte (handshake will time out). */
class FakeSilentSocket extends FakeEchoSocket {
  override send(): void {
    /* swallow — nothing echoes back */
  }
}

describe('connectSession (host, self-echo)', () => {
  it('connects and resolves the shared world', async () => {
    const net = { ...defaultNetConfig(), mode: 'host' as const };
    const config = defaultConfig();
    config.playerName = 'HOST';
    const statuses: string[] = [];
    const session = await connectSession(net, config, 0x1234, {
      createSocket: () => new FakeEchoSocket(),
      onStatus: (s) => statuses.push(s),
    });
    expect(session.setup.machinesOnline).toBe(1);
    expect(session.setup.ownNumber).toBe(0);
    expect(session.setup.seed).toBe(0x1234);
    expect(statuses).toContain('open');
    session.transport.close();
  });

  it('rejects when the handshake stalls (ring boo-boo)', async () => {
    const net = { ...defaultNetConfig(), mode: 'host' as const };
    await expect(
      connectSession(net, defaultConfig(), 0, {
        createSocket: () => new FakeSilentSocket(),
        handshakeTimeoutMs: 40,
      }),
    ).rejects.toThrow(/timeout/);
  });
});
