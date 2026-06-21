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

/** A sensible default URL: the orchestrator on the page's own host (LAN dev setup). */
export function defaultOrchestratorUrl(hostname = 'localhost'): string {
  return `ws://${hostname}:${ORCHESTRATOR_PORT}/`;
}

export function defaultNetConfig(): NetConfig {
  return { mode: 'solo', url: defaultOrchestratorUrl(), room: '' };
}

/** Whether the config is usable: solo always; host/join need a ws(s) URL. */
export function isValidNet(net: NetConfig): boolean {
  if (net.mode === 'solo') return true;
  return /^wss?:\/\/.+/i.test(net.url.trim());
}
