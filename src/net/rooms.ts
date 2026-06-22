// Room browser (EPIC-23). The orchestrator exposes `GET /rooms` (open) listing active
// rooms with a per-room summary (ORCHESTRATOR-CONTRACT). Rooms already work via `?room=`;
// this just lets a player pick one instead of typing the key. Best-effort: an orchestrator
// without the endpoint (or behind a CORS-restricting proxy) simply yields an empty list.

export interface RoomInfo {
  room: string;
  players: number;
  cap?: number;
  phase?: string;
}

/**
 * Derive the `GET /rooms` HTTP(S) URL from the WebSocket URL: `ws→http`, `wss→https`,
 * same host/port, path replaced with `/rooms` (query/hash dropped). Returns null if the
 * URL can't be parsed.
 */
export function roomsEndpoint(wsUrl: string): string | null {
  try {
    const u = new URL(wsUrl);
    u.protocol = u.protocol === 'wss:' ? 'https:' : u.protocol === 'ws:' ? 'http:' : u.protocol;
    u.pathname = '/rooms';
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

/** Normalize the orchestrator's `/rooms` JSON into a sorted `RoomInfo[]`. Tolerant of
 *  either an array or a `{ rooms: [...] }` envelope, and of missing fields. */
export function parseRooms(data: unknown): RoomInfo[] {
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as { rooms?: unknown[] })?.rooms)
      ? (data as { rooms: unknown[] }).rooms
      : [];
  const rooms: RoomInfo[] = [];
  for (const item of list) {
    const o = item as Record<string, unknown>;
    const name = typeof o.room === 'string' ? o.room : typeof o.name === 'string' ? o.name : '';
    const players = Number(o.players ?? o.count ?? 0);
    const info: RoomInfo = { room: name, players: Number.isFinite(players) ? players : 0 };
    if (typeof o.cap === 'number') info.cap = o.cap;
    if (typeof o.phase === 'string') info.phase = o.phase;
    rooms.push(info);
  }
  return rooms.sort((a, b) => a.room.localeCompare(b.room));
}

/** Fetch + parse the active rooms, or null on any failure (endpoint missing, CORS, etc.). */
export async function fetchRooms(
  wsUrl: string,
  fetchFn: typeof fetch = fetch,
): Promise<RoomInfo[] | null> {
  const endpoint = roomsEndpoint(wsUrl);
  if (!endpoint) return null;
  try {
    const res = await fetchFn(endpoint, { method: 'GET' });
    if (!res.ok) return null;
    return parseRooms(await res.json());
  } catch {
    return null;
  }
}
