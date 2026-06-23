import { describe, expect, it } from 'vitest';
import {
  defaultNetConfig,
  defaultOrchestratorUrl,
  isValidNet,
  isValidUrl,
  PRODUCTION_HOST,
} from './netconfig';

describe('NetConfig', () => {
  it('defaults to solo with the orchestrator URL', () => {
    const c = defaultNetConfig();
    expect(c.mode).toBe('solo');
    expect(c.room).toBe('');
    expect(c.url).toMatch(/^ws:\/\/.+:5006\/$/);
  });

  it('builds the orchestrator URL from a hostname (dev: host:5006, scheme follows page)', () => {
    expect(defaultOrchestratorUrl('192.168.1.5')).toBe('ws://192.168.1.5:5006/'); // default http:
    expect(defaultOrchestratorUrl('192.168.1.5', 'http:')).toBe('ws://192.168.1.5:5006/');
    expect(defaultOrchestratorUrl('192.168.1.5', 'https:')).toBe('wss://192.168.1.5:5006/');
  });

  it('uses the same-origin /ws path (no port) on the production host', () => {
    expect(defaultOrchestratorUrl(PRODUCTION_HOST, 'http:')).toBe(`ws://${PRODUCTION_HOST}/ws`);
    expect(defaultOrchestratorUrl(PRODUCTION_HOST, 'https:')).toBe(`wss://${PRODUCTION_HOST}/ws`);
  });

  it('solo is always valid; host/join need a ws URL', () => {
    expect(isValidNet({ mode: 'solo', url: '', room: '' })).toBe(true);
    expect(isValidNet({ mode: 'host', url: 'ws://h:5006/', room: '' })).toBe(true);
    expect(isValidNet({ mode: 'join', url: 'wss://h/', room: 'ABC' })).toBe(true);
    expect(isValidNet({ mode: 'host', url: '', room: '' })).toBe(false);
    expect(isValidNet({ mode: 'join', url: 'http://nope', room: '' })).toBe(false);
  });

  it('isValidUrl accepts ws/wss and rejects anything else', () => {
    expect(isValidUrl('ws://host:5006/')).toBe(true);
    expect(isValidUrl('  wss://host/  ')).toBe(true);
    expect(isValidUrl('http://host')).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });
});
