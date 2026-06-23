import { describe, expect, it } from 'vitest';
import { fetchRooms, parseRooms, roomsEndpoint } from './rooms';

describe('roomsEndpoint', () => {
  it('maps ws → http and wss → https, path /rooms', () => {
    expect(roomsEndpoint('ws://host:5006/')).toBe('http://host:5006/rooms');
    expect(roomsEndpoint('wss://maze.example/ws')).toBe('https://maze.example/rooms');
  });

  it('derives the same-origin /rooms from the production /ws URL', () => {
    expect(roomsEndpoint('wss://midimaze.sidecartridge.com/ws')).toBe(
      'https://midimaze.sidecartridge.com/rooms',
    );
    expect(roomsEndpoint('ws://midimaze.sidecartridge.com/ws')).toBe(
      'http://midimaze.sidecartridge.com/rooms',
    );
  });

  it('drops any query/hash', () => {
    expect(roomsEndpoint('wss://h/ws?room=X#y')).toBe('https://h/rooms');
  });

  it('returns null for an unparseable URL', () => {
    expect(roomsEndpoint('not a url')).toBeNull();
  });
});

describe('parseRooms', () => {
  it('accepts a bare array and sorts by room', () => {
    expect(
      parseRooms([
        { room: 'B', players: 2 },
        { room: 'A', players: 1 },
      ]),
    ).toEqual([
      { room: 'A', players: 1 },
      { room: 'B', players: 2 },
    ]);
  });

  it('accepts a { rooms: [...] } envelope and aliased fields', () => {
    const r = parseRooms({ rooms: [{ name: 'X', count: 3, cap: 16, phase: 'lobby' }] });
    expect(r).toEqual([{ room: 'X', players: 3, cap: 16, phase: 'lobby' }]);
  });

  it('tolerates missing/garbage fields', () => {
    expect(parseRooms([{}, { players: 'x' }])).toEqual([
      { room: '', players: 0 },
      { room: '', players: 0 },
    ]);
    expect(parseRooms(null)).toEqual([]);
  });
});

describe('fetchRooms', () => {
  it('returns parsed rooms on a 200', async () => {
    const fakeFetch = (async () => ({
      ok: true,
      json: async () => [{ room: 'A', players: 1 }],
    })) as unknown as typeof fetch;
    expect(await fetchRooms('ws://h/', fakeFetch)).toEqual([{ room: 'A', players: 1 }]);
  });

  it('returns null on a non-ok response', async () => {
    const fakeFetch = (async () => ({
      ok: false,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    expect(await fetchRooms('ws://h/', fakeFetch)).toBeNull();
  });

  it('returns null when fetch throws (CORS / unreachable)', async () => {
    const fakeFetch = (async () => {
      throw new Error('network');
    }) as unknown as typeof fetch;
    expect(await fetchRooms('ws://h/', fakeFetch)).toBeNull();
  });
});
