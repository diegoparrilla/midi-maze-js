import { describe, expect, it } from 'vitest';
import { defaultNetConfig, defaultOrchestratorUrl, isValidNet } from './netconfig';

describe('NetConfig', () => {
  it('defaults to solo with the orchestrator URL', () => {
    const c = defaultNetConfig();
    expect(c.mode).toBe('solo');
    expect(c.room).toBe('');
    expect(c.url).toMatch(/^ws:\/\/.+:5006\/$/);
  });

  it('builds the orchestrator URL from a hostname', () => {
    expect(defaultOrchestratorUrl('192.168.1.5')).toBe('ws://192.168.1.5:5006/');
  });

  it('solo is always valid; host/join need a ws URL', () => {
    expect(isValidNet({ mode: 'solo', url: '', room: '' })).toBe(true);
    expect(isValidNet({ mode: 'host', url: 'ws://h:5006/', room: '' })).toBe(true);
    expect(isValidNet({ mode: 'join', url: 'wss://h/', room: 'ABC' })).toBe(true);
    expect(isValidNet({ mode: 'host', url: '', room: '' })).toBe(false);
    expect(isValidNet({ mode: 'join', url: 'http://nope', room: '' })).toBe(false);
  });
});
