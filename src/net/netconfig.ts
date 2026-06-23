// How the player connects: solo (offline) or networked via the orchestrator as host
// (master) or join (slave) — D-05 / D-11. Pure model; the lobby edits it and the
// session layer (STORY-02) acts on it.

export type NetMode = 'solo' | 'host' | 'join';

export interface NetConfig {
  mode: NetMode;
  /** Orchestrator WebSocket URL (host/join). */
  url: string;
  /** Optional room key → orchestrator `?room=` (EPIC-12 / D-14). */
  room: string;
}

/** The orchestrator's default WebSocket port (D-08). */
export const ORCHESTRATOR_PORT = 5006;

/** The production demo host: a single Cloudflare-proxied origin that reverse-proxies
 *  `/ws` → the orchestrator WebSocket and `/rooms` → its REST. */
export const PRODUCTION_HOST = 'midimaze.sidecartridge.com';

/**
 * The default orchestrator WebSocket URL for the page. The scheme follows the page: an
 * `https:` page gets `wss://` (an `http:` page `ws://`) — a secure page can't open an
 * insecure socket. On the production host (`midimaze.sidecartridge.com`) the orchestrator
 * shares the origin at the `/ws` path (no port); anywhere else (localhost/LAN dev) it's
 * the orchestrator on the page's own host at `:5006`. `/rooms` is then derived from this
 * URL by `roomsEndpoint` (scheme-swapped, path → `/rooms`).
 */
export function defaultOrchestratorUrl(hostname = 'localhost', protocol = 'http:'): string {
  const ws = protocol === 'https:' ? 'wss:' : 'ws:';
  if (hostname === PRODUCTION_HOST) return `${ws}//${PRODUCTION_HOST}/ws`;
  return `${ws}//${hostname}:${ORCHESTRATOR_PORT}/`;
}

export function defaultNetConfig(): NetConfig {
  return { mode: 'solo', url: defaultOrchestratorUrl(), room: '' };
}

/** A usable orchestrator WebSocket URL (ws:// or wss://). */
export function isValidUrl(url: string): boolean {
  return /^wss?:\/\/.+/i.test(url.trim());
}

/** Whether the config is usable: solo always; host/join need a ws(s) URL. */
export function isValidNet(net: NetConfig): boolean {
  if (net.mode === 'solo') return true;
  return isValidUrl(net.url);
}
