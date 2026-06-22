import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../game/config';
import { defaultNetConfig } from './netconfig';
import { connectIdle } from './session';
import { runSetup } from './setup';
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

/** A socket that opens but never delivers a byte (the handshake will time out). */
class FakeSilentSocket extends FakeEchoSocket {
  override send(): void {
    /* swallow — nothing echoes back */
  }
}

describe('connectIdle + handshake (host, self-echo)', () => {
  it('opens an idle link, then resolves the shared world on handshake', async () => {
    const net = defaultNetConfig();
    const statuses: string[] = [];
    const link = connectIdle(net, {
      createSocket: () => new FakeEchoSocket(),
      onStatus: (s) => statuses.push(s),
    });

    await link.opened; // idle: connected, no game traffic yet
    expect(statuses).toContain('open');

    const config = defaultConfig();
    config.playerName = 'HOST';
    const setup = await runSetup(link.channel, 'host', config, 0x1234);
    expect(setup.machinesOnline).toBe(1);
    expect(setup.ownNumber).toBe(0);
    expect(setup.seed).toBe(0x1234);
    link.transport.close();
  });

  it('rejects when the handshake stalls over the idle link (ring boo-boo)', async () => {
    const link = connectIdle(defaultNetConfig(), {
      createSocket: () => new FakeSilentSocket(),
    });
    await link.opened;
    await expect(runSetup(link.channel, 'host', defaultConfig(), 0, 40)).rejects.toThrow(/timeout/);
    link.transport.close();
  });
});
