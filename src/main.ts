import './style.css';
import dashboardUrl from './assets/generated/main-screen.png';
import {
  applyConfig,
  defaultConfig,
  type GameConfig,
  maxDrones,
  TIME_REGEN_FAST,
  TIME_REGEN_SLOW,
  TIME_RELOAD_FAST,
  TIME_RELOAD_SLOW,
  TIME_REVIVE_FAST,
  TIME_REVIVE_SLOW,
  totalDrones,
} from './game/config';
import { findWinner, GameFlow, GAMEOVER_TICKS } from './game/flow';
import { KillLog } from './game/kills';
import { Input, type Control } from './game/input';
import { loadMazeById, MAZE_OPTIONS } from './game/mazes';
import {
  defaultNetConfig,
  defaultOrchestratorUrl,
  isValidUrl,
  type NetConfig,
} from './net/netconfig';
import { type NetEnd, NetGame } from './net/netgame';
import { MIDI_NAME_DIALOG, MIDI_TERMINATE_GAME } from './net/protocol';
import { countMaster, type CountResult, electMaster } from './net/ring';
import { connectIdle, type IdleLink } from './net/session';
import {
  exchangeNames,
  hostCount,
  hostStart,
  nameBarrier,
  runSetup,
  type SetupResult,
} from './net/setup';
import type { TransportStatus } from './net/transport';
import { drawCrosshair, drawHappyIndicator, drawKillsWindow, drawScoreboard } from './render/hud';
import { drawMap2D } from './render/map2d';
import { VIEW_SCREEN_X, VIEW_SCREEN_Y, VIEW_WIDTH } from './render/projection';
import {
  BODY_SHAPE_FRONT_VIEW,
  BODY_SHAPE_MAX_SIZE,
  BODY_SHAPE_NO_SHADOW,
  drawLoseTongue,
  drawShape,
  drawWinLashes,
} from './render/shapes';
import { drawView3D } from './render/view3d';
import { assignDroneTypes, droneSetup } from './sim/drone';
import { Rng } from './sim/rng';
import { initAllPlayer } from './sim/setup';
import { step } from './sim/step';
import { World } from './sim/world';
import { BASE_HEIGHT, BASE_WIDTH, displaySize } from './upscale';

const $ = <T extends HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`${sel} not found`);
  return el;
};

const canvas = $<HTMLCanvasElement>('#screen');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2D context unavailable');
const status = document.querySelector<HTMLElement>('#status');
const app = $<HTMLElement>('#app');
const touchControls = $<HTMLElement>('#touch-controls');
const rotateOverlay = $<HTMLElement>('#rotate-overlay');
const menuOverlay = $<HTMLElement>('#menu-overlay');
const lobby = $<HTMLElement>('#lobby');
const modeMenu = $<HTMLElement>('#mode-menu');
const connectScreen = $<HTMLElement>('#connect-screen');
const netStatusEl = $<HTMLElement>('#net-status');
const conUrl = $<HTMLInputElement>('#con-url');
const conRoom = $<HTMLInputElement>('#con-room');
const conMsg = $<HTMLElement>('#con-msg');
const conConnect = $<HTMLButtonElement>('#con-connect');
const lobbyStart = $<HTMLButtonElement>('#lobby-start');
const lobbyTitle = $<HTMLElement>('#lobby-title');
const waitingScreen = $<HTMLElement>('#waiting-screen');
const playBtn = $<HTMLButtonElement>('#play-btn');
const namesBtn = $<HTMLButtonElement>('#names-btn');
const roleModal = $<HTMLElement>('#role-modal');
const roleModalText = $<HTMLElement>('#role-modal-text');
const nameModal = $<HTMLElement>('#name-modal');
const nameInput = $<HTMLInputElement>('#name-input');
const debugOverlay = $<HTMLElement>('#debug-overlay');
const debugContent = $<HTMLElement>('#debug-content');

const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
// iPhone Safari exposes no Fullscreen API; iPad/desktop do. Detect real support.
const fullscreenSupported =
  document.fullscreenEnabled === true && typeof app.requestFullscreen === 'function';
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

// Solo game: the human camera (player 0) versus the drones configured in the lobby,
// all racing to GAME_WIN_SCORE. The lobby (EPIC-20) builds the GameConfig.
const HUMAN_COUNT = 1;
let seed = 7;
let lastSeed = 0; // the seed the current world was built with (debug panel)
const config: GameConfig = defaultConfig();
config.drones = [1, 1, 1]; // a lively default: one of each drone type

/** Build a fresh world from the current lobby config (called on Start). */
function newWorld(cfg: GameConfig): World {
  lastSeed = seed;
  const w = new World(loadMazeById(cfg.mazeId), new Rng(seed++));
  w.machinesOnline = HUMAN_COUNT;
  applyConfig(w, cfg, HUMAN_COUNT);
  assignDroneTypes(w, HUMAN_COUNT);
  droneSetup(w, HUMAN_COUNT);
  const total =
    HUMAN_COUNT + w.activeDronesByType[0]! + w.activeDronesByType[1]! + w.activeDronesByType[2]!;
  initAllPlayer(w, total, true);
  w.names = [cfg.playerName];
  w.weDontHaveAWinner = 1;
  return w;
}

let world = newWorld(config);
const killLog = new KillLog(); // the camera player's kills, for the pop chart (EPIC-22)
const flow = new GameFlow();
const input = new Input();
let mapMode = false;
let orientationBlocked = false;

// Networking (EPIC-24). Entry flow: mode menu → (network) connect screen → idle link →
// election (master/slave) → master: ready (P → preferences → Start) / slave: wait → game.
const netConfig: NetConfig = defaultNetConfig();
netConfig.url = defaultOrchestratorUrl(location.hostname || 'localhost');
let cameraIndex = 0; // the local player's index (0 for solo, ownNumber when networked)
let netActive = false; // true while connecting / previewing / playing a networked game
let quitRequested = false; // local quit during net play → inject TERMINATE_GAME

// Which pre-game screen is showing (only meaningful while flow.phase === 'lobby').
// 'ready' is the main screen waiting for P/▶ (the master's MAZE→Play); the preferences
// 'lobby' opens only from there — the original never auto-opens it.
type Route = 'mode' | 'connect' | 'ready' | 'lobby' | 'waiting';
let route: Route = 'mode';
let isNetwork = false; // network chosen at the mode menu (vs solo)
let lastWasNetwork = false; // how the just-finished game started → where any-key returns
let idle: IdleLink | null = null; // the held, idle orchestrator link (network mode)
let netCount: CountResult | null = null; // master's COUNT-PLAYERS result (taken on Play)
let netRole: 'solo' | 'master' | 'slave' = 'solo'; // for the debug panel

/** Online humans: the master's COUNT (network) or just us (solo). Caps drone slots and
 *  is shown in the lobby — the original's `machines_online`. */
function humanCount(): number {
  return isNetwork && netCount ? netCount.machinesOnline : HUMAN_COUNT;
}

// Handshake patience: the master drives COUNT/START tightly; a slave waits — possibly
// for minutes — for the master to start, so its reads are patient (cancel ends it).
const HOST_SETUP_MS = 8000;
const SLAVE_WAIT_MS = 600_000;
// Start-map preview: the original's "5s delay to allow the player to see the map"
// (maingame.c:218, 300 Vsync). Wall-clock so it's exactly 5s regardless of frame rate.
const PREVIEW_MS = 5000;

/** Show the screen for the current pre-game route; hide all once a game is running. */
function refreshScreens(): void {
  const pre = flow.phase === 'lobby';
  modeMenu.hidden = !(pre && route === 'mode');
  connectScreen.hidden = !(pre && route === 'connect');
  waitingScreen.hidden = !(pre && route === 'waiting');
  lobby.hidden = !(pre && route === 'lobby');
  playBtn.hidden = !(pre && route === 'ready'); // the ▶ Play affordance
  namesBtn.hidden = !(pre && route === 'ready' && isNetwork); // master-only name dialog
}

function hideOverlays(): void {
  modeMenu.hidden = true;
  connectScreen.hidden = true;
  waitingScreen.hidden = true;
  lobby.hidden = true;
  playBtn.hidden = true;
  namesBtn.hidden = true;
  roleModal.hidden = true;
  nameModal.hidden = true;
}

/** Net-status dot beside the fullscreen button (STORY-03); null hides it (solo). */
function setNetStatus(s: TransportStatus | null): void {
  if (!s) {
    netStatusEl.hidden = true;
    return;
  }
  netStatusEl.hidden = false;
  const cls = s === 'open' ? 'connected' : s === 'connecting' ? 'connecting' : 'dropped';
  netStatusEl.classList.remove('connecting', 'connected', 'dropped');
  netStatusEl.classList.add(cls);
  netStatusEl.title = `network: ${s}`;
}

/** Close and forget the idle link (leaving network mode / after a game). */
function teardownIdle(): void {
  if (idle) {
    idle.transport.close();
    idle = null;
  }
  setNetStatus(null);
}

function goMode(): void {
  teardownIdle();
  roleModal.hidden = true;
  isNetwork = false;
  netConfig.mode = 'solo';
  netCount = null;
  netRole = 'solo';
  route = 'mode';
  refreshScreens();
}

function goConnect(): void {
  isNetwork = true;
  route = 'connect';
  conUrl.value = netConfig.url;
  conRoom.value = netConfig.room;
  conMsg.textContent = '';
  refreshScreens();
}

function goLobby(): void {
  route = 'lobby';
  // The lobby is the master's screen in network mode — say so (the original pops
  // "This is the MASTER machine"); solo keeps the plain title.
  lobbyTitle.textContent = isNetwork ? 'MASTER' : 'MIDI MAZE';
  renderLobby();
  refreshScreens();
}

function goWaiting(): void {
  route = 'waiting';
  refreshScreens();
}

/** The "ready" main screen: wait for P / ▶ to open preferences (the master's Play). A
 *  network node has already been elected master here; solo just waits for the player. */
function goReady(): void {
  route = 'ready';
  setStatus(isNetwork ? 'MASTER · press P or ▶ to play' : 'press P or ▶ to play');
  refreshScreens();
}

/** P / ▶ from the ready screen → open the preferences lobby. The master first runs
 *  COUNT-PLAYERS (master.c: COUNT happens on Play, before the dialog) so the lobby can
 *  show how many humans are online and cap the drone slots; solo opens it directly. */
function onPlay(): void {
  if (route !== 'ready' || !roleModal.hidden) return; // wait until the role modal is dismissed
  if (isNetwork) void openMasterLobby();
  else goLobby();
}

async function openMasterLobby(): Promise<void> {
  if (!idle) return;
  playBtn.disabled = true;
  setStatus('MASTER · counting players…');
  const count = await hostCount(idle.channel, HOST_SETUP_MS).catch(() => null);
  playBtn.disabled = false;
  if (!count) {
    setStatus('MASTER · MIDI ring boo-boo — press P to retry');
    return; // stay on the ready screen
  }
  netCount = count;
  goLobby();
}

/** Announce the master role (the original's "This is the MASTER machine." alert). It
 *  overlays the ready screen; OK just dismisses it. A slave needs no modal — its
 *  waiting screen already reads "You are a SLAVE." */
function showMasterModal(): void {
  roleModalText.textContent = 'This is the MASTER machine.';
  roleModal.hidden = false;
}

// Name dialog (EPIC-24): a shared modal for editing this node's player name, resolved as
// a promise so the ring name exchange can wait for the user to confirm.
let nameConfirm: ((name: string) => void) | null = null;
function openNameModal(current: string): Promise<string> {
  nameInput.value = current;
  nameModal.hidden = false;
  nameInput.focus();
  nameInput.select();
  return new Promise((resolve) => {
    nameConfirm = resolve;
  });
}

/** Show the agreed names (a NAME_DIALOG round completed). */
function applyNames(names: string[]): void {
  setStatus(`names · ${names.join(' · ')}`);
}

// ---- Hidden debug panel (press D) ----
let debugTimer = 0;
function toggleDebug(): void {
  if (!debugOverlay.hidden) {
    debugOverlay.hidden = true;
    window.clearInterval(debugTimer);
    return;
  }
  const refresh = (): void => {
    debugContent.textContent = buildDebugInfo();
  };
  refresh();
  debugOverlay.hidden = false;
  debugTimer = window.setInterval(refresh, 250); // live snapshot while shown
}

/** A read-only snapshot of the ring + game state, built from local memory (no ring I/O). */
function buildDebugInfo(): string {
  const fastSlow = (v: number, fast: number): string => (v === fast ? 'fast' : 'slow');
  const role = netRole === 'master' ? 'MASTER' : netRole === 'slave' ? 'SLAVE' : 'SOLO';
  const conn = idle ? idle.transport.status : 'offline';
  const w = world;
  const L: string[] = [];
  L.push(`role         : ${role}`);
  L.push(`connection   : ${conn}`);
  L.push(`server       : ${netConfig.url}`);
  L.push(`room         : ${netConfig.room || '(default)'}`);
  L.push(`your player# : ${cameraIndex}`);
  L.push('');
  L.push(`nodes online : ${w.machinesOnline}`);
  for (let i = 0; i < w.machinesOnline; i++) {
    L.push(`  [${i}] ${w.names[i] || '(unnamed)'}${i === cameraIndex ? '  <- you' : ''}`);
  }
  L.push('');
  L.push('--- shared config ---');
  L.push(`maze         : ${w.mazeSize}x${w.mazeSize}`);
  L.push(`reload       : ${w.reloadTime} (${fastSlow(w.reloadTime, TIME_RELOAD_FAST)})`);
  L.push(`regen        : ${w.regenTime} (${fastSlow(w.regenTime, TIME_REGEN_FAST)})`);
  L.push(`revive       : ${w.reviveTime} (${fastSlow(w.reviveTime, TIME_REVIVE_FAST)})`);
  L.push(`lives        : ${w.reviveLives}`);
  L.push(
    `drones       : target ${w.activeDronesByType[0]}  std ${w.activeDronesByType[1]}  ninja ${w.activeDronesByType[2]}`,
  );
  L.push(`teams        : ${w.teamFlag ? 'on' : 'off'}`);
  L.push(`friendly fire: ${w.friendlyFire ? 'on' : 'off'}`);
  L.push(`seed         : 0x${(lastSeed & 0xffff).toString(16).padStart(4, '0')}`);
  L.push('');
  L.push(`--- players (live, phase=${flow.phase}) ---`);
  for (let i = 0; i < w.playerAndDroneCount; i++) {
    const p = w.players[i]!;
    const who = i < w.machinesOnline ? w.names[i] || `P${i}` : `drone${i}`;
    const live = p.ply_lives > 0 ? 'ALIVE' : 'DEAD ';
    L.push(
      `  [${i}] ${live} cell(${p.ply_x >> 7},${p.ply_y >> 7}) dir=${p.ply_dir} score=${p.ply_score} lives=${p.ply_lives}  ${who}`,
    );
  }
  return L.join('\n');
}

/** Master Names (N / button): run the live NAME_DIALOG round (master.c MAZE_SET_NAMES) —
 *  a `0x86` count token round the ring, then edit our own name, then exchange every name
 *  so all nodes (incl. real STs) agree. */
function editNames(): void {
  if (route !== 'ready' || !isNetwork || !roleModal.hidden || !nameModal.hidden) return;
  void runMasterNameRound();
}

async function runMasterNameRound(): Promise<void> {
  if (!idle) return;
  const ch = idle.channel;
  ch.flush();
  const count = await countMaster(ch, HOST_SETUP_MS, MIDI_NAME_DIALOG).catch(() => null);
  if (!count) {
    setStatus('MASTER · names: MIDI ring boo-boo');
    return;
  }
  const name = await openNameModal(config.playerName);
  config.playerName = name;
  await nameBarrier(ch, count.machinesOnline, SLAVE_WAIT_MS); // wait for every node to finish editing
  const names = await exchangeNames(ch, 0, count.machinesOnline, name, SLAVE_WAIT_MS).catch(
    () => null,
  );
  if (names) applyNames(names);
}

/** Build the shared world from a completed setup handshake (networked game). */
function buildNetWorld(setup: SetupResult): World {
  const w = new World(setup.maze, new Rng(setup.seed));
  w.machinesOnline = setup.machinesOnline;
  applyConfig(w, setup.config, setup.machinesOnline);
  assignDroneTypes(w, setup.machinesOnline);
  droneSetup(w, setup.machinesOnline);
  const total =
    setup.machinesOnline +
    w.activeDronesByType[0]! +
    w.activeDronesByType[1]! +
    w.activeDronesByType[2]!;
  initAllPlayer(w, total, true);
  w.names = setup.names; // every player's real name, from the ring exchange
  lastSeed = setup.seed;
  w.weDontHaveAWinner = 1;
  return w;
}

/** A player's display name (the ring-exchanged name, or a fallback). */
function playerName(i: number): string {
  return world.names[i] || `Player ${i + 1}`;
}

function setStatus(text: string): void {
  if (status && !hintActive) status.textContent = text;
}

/** The Start button: solo game, or (network) host the ring as the elected master. */
function onStart(): void {
  if (isNetwork) {
    hideOverlays();
    void runNetSession('host');
  } else {
    startSolo();
  }
}

/** Start a solo (offline) game from the lobby. */
function startSolo(): void {
  hideOverlays();
  mapMode = false;
  quitRequested = false;
  lastWasNetwork = false;
  netRole = 'solo';
  cameraIndex = 0;
  setNetStatus(null);
  world = newWorld(config);
  killLog.reset();
  flow.startGame();
}

/** Handshake over the held link, then drive the lock-step game; clean up on end. The
 *  role was decided by the election (`enterNetwork`): host drives, slave waits. */
async function runNetSession(role: 'host' | 'join'): Promise<void> {
  const link = idle;
  if (!link) return;
  netActive = true;
  mapMode = false;
  quitRequested = false;
  lastWasNetwork = true;
  netConfig.mode = role;
  const roleLabel = role === 'host' ? 'MASTER' : 'SLAVE';
  drawDashboard();
  setStatus(role === 'host' ? 'MASTER — starting…' : 'SLAVE — waiting for the MASTER…');

  const timeoutMs = role === 'host' ? HOST_SETUP_MS : SLAVE_WAIT_MS;
  const seedVal = (seed++ & 0xffff) | 1;
  // The master already counted the ring on Play (`openMasterLobby`); Start just sends
  // START + SEND_DATA with that count. The slave follows the whole handshake.
  const handshake =
    role === 'host'
      ? hostStart(
          link.channel,
          config,
          seedVal,
          netCount ?? { machinesOnline: 1, ownNumber: 0 },
          timeoutMs,
        )
      : runSetup(link.channel, 'join', config, seedVal, timeoutMs, {
          // master pressed Names → edit our own and join the ring exchange (slave.c:150)
          onNameDialog: () => openNameModal(config.playerName),
          onNames: applyNames,
        });
  const setup = await handshake.catch((e: unknown) => {
    setStatus(`handshake failed — ${(e as Error).message}`);
    return null;
  });
  if (!setup) {
    netActive = false;
    flow.restart();
    // host failure keeps the link (retry: P → preferences → Start); a slave cancel/drop exits.
    if (role === 'host' && idle) goReady();
    else goMode();
    return;
  }

  hideOverlays();
  world = buildNetWorld(setup);
  cameraIndex = setup.ownNumber;
  killLog.reset(); // clear the kills window for the new game (maingame.c:178)

  // Map preview: a fixed 5s look at the start map (maingame.c:218), synchronised by
  // the handshake completing on every node.
  flow.startGame(); // phase = 'preview'
  const previewStart = performance.now();
  for (let elapsed = 0; elapsed < PREVIEW_MS; elapsed = performance.now() - previewStart) {
    renderWorld();
    setStatus(`${roleLabel} · get ready — ${Math.ceil((PREVIEW_MS - elapsed) / 1000)}s`);
    await nextFrame();
  }
  flow.phase = 'playing';

  const game = new NetGame({
    world,
    ownNumber: setup.ownNumber,
    machinesOnline: setup.machinesOnline,
    localInput: () => (quitRequested ? MIDI_TERMINATE_GAME : input.joyByte()),
    onTick: () => {
      const p = world.players[cameraIndex]!;
      killLog.update(p.ply_score, p.ply_looser); // record kills for the pop chart
      renderWorld();
      setStatus(`${roleLabel} · field (${p.ply_x >> 7},${p.ply_y >> 7}) · score ${p.ply_score}/10`);
    },
  });

  let end: NetEnd | null = null;
  try {
    do {
      end = await game.runTick(link.channel);
      // A *slave's* TERMINATE can't reach joy[0], so it just leaves its own loop. The
      // *master* must NOT short-circuit here: it injects TERMINATE through localInput (→
      // joy[0]) on the next tick, and runTick drives the two-step confirm so the slave/ST
      // ends cleanly. Cutting the master off early would never put TERMINATE on the wire.
      if (!end && quitRequested && role !== 'host') end = 'terminated';
      // Pace the ring to the display refresh, like the solo loop (one step per frame);
      // without this the lock-step runs flat-out over a fast local link.
      if (!end) await nextFrame();
    } while (!end);
  } catch {
    end = 'timeout';
  }

  // Show the result briefly (both nodes see who won), unless we quit on purpose.
  if (!quitRequested) {
    flow.winner = end === 'winner' ? findWinner(world) : -1;
    flow.phase = 'gameover';
    for (let t = 0; t < GAMEOVER_TICKS; t++) {
      flow.timer = GAMEOVER_TICKS - t; // counts down so drawGameOver's end animation advances
      renderWorld();
      await nextFrame();
    }
    flow.timer = 0;
  }
  netActive = false;

  // A game over never drops back to the Solo/Network menu: return to the elected role's
  // idle state — master → ready (press P to host again), slave → wait for the next game.
  // The link is kept (it auto-reconnects); only an explicit Esc disconnects.
  flow.restart();
  if (!idle) {
    goMode();
    return;
  }
  if (role === 'host') {
    showMasterModal();
    goReady();
  } else {
    goWaiting();
    void runNetSession('join'); // re-arm the wait loop for the master's next game
  }
}

/** Any-key at game over → back where the game started, keeping a live network link. */
function returnToPreGame(): void {
  flow.restart();
  if (lastWasNetwork && idle)
    goReady(); // master, link held → ready (can host again)
  else if (lastWasNetwork)
    goMode(); // link dropped → mode menu
  else goReady(); // solo
}

/** In-game "Quit game": end the current game and return to the ready screen (the link
 *  stays connected in network mode). To disconnect, Esc out from the ready screen. */
function quitGame(): void {
  if (netActive) {
    quitRequested = true; // the net loop injects TERMINATE → clean end → ready / re-arm
    return;
  }
  flow.restart();
  goReady();
}

/** Resolve on the next animation frame (paces the networked preview). */
function nextFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
}

// Synth-dashboard background (the maze view + HUD are drawn into its panels).
const dashboard = new Image();
let dashboardReady = false;
dashboard.onload = () => {
  dashboardReady = true;
};
dashboard.src = dashboardUrl;

// A short-lived message in the status line (used for the iOS fullscreen hint).
// While active, the per-frame status update is suppressed so it stays readable.
let hintTimer = 0;
let hintActive = false;
function hint(message: string): void {
  if (!status) return;
  status.textContent = message;
  hintActive = true;
  window.clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => {
    hintActive = false;
  }, 4000);
}

// ---- Responsive layout (D-04 / D-12) ----
function fit(): void {
  // Prefer the visual viewport so we fill correctly as iOS toolbars show/hide.
  const vw = window.visualViewport?.width ?? window.innerWidth;
  const vh = window.visualViewport?.height ?? window.innerHeight;
  const { width, height } = displaySize(vw, vh, isTouch);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

// ---- Orientation gate (STORY-02) ----
function updateOrientation(): void {
  orientationBlocked = isTouch && window.innerHeight > window.innerWidth;
  rotateOverlay.hidden = !orientationBlocked;
}

async function lockLandscape(): Promise<void> {
  // Best-effort; only works where supported (Android, usually in fullscreen).
  try {
    await (
      screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
    ).lock?.('landscape');
  } catch {
    /* iOS Safari etc. — the rotate overlay is the fallback */
  }
}

// ---- Fullscreen (STORY-03) ----
async function toggleFullscreen(): Promise<void> {
  // iPhone Safari has no Fullscreen API — guide the user to install instead.
  if (!fullscreenSupported) {
    hint(
      isStandalone ? 'already fullscreen' : 'iPhone: Share → "Add to Home Screen" for fullscreen',
    );
    return;
  }
  try {
    if (!document.fullscreenElement) {
      await app.requestFullscreen();
      await lockLandscape();
    } else {
      await document.exitFullscreen?.();
    }
  } catch {
    /* denied — ignore */
  }
}

// ---- Menu overlay (STORY-05) ----
const menuOpen = (): boolean => !menuOverlay.hidden;
function openMenu(): void {
  input.clearButtons(); // pause input underneath
  menuOverlay.hidden = false;
}
function closeMenu(): void {
  menuOverlay.hidden = true;
}
menuOverlay.addEventListener('click', (e) => {
  // Tap on the dimmed backdrop (the overlay itself) closes the menu.
  if (e.target === menuOverlay) {
    closeMenu();
    return;
  }
  const action = (e.target as HTMLElement).dataset.action;
  if (!action) return;
  if (action === 'fullscreen') void toggleFullscreen();
  else if (action === 'restart') quitGame();
  closeMenu();
});

// ---- Keyboard input ----
window.addEventListener('keydown', (e) => {
  // Hidden debug panel (D), available anywhere — except while typing in a text field.
  if (
    (e.key === 'd' || e.key === 'D') &&
    (document.activeElement as HTMLElement | null)?.tagName !== 'INPUT'
  ) {
    toggleDebug();
    e.preventDefault();
    return;
  }
  // The ready screen waits for P/▶ to open preferences (the master's Play); Escape
  // backs out to the mode menu (tearing down any network link).
  if (flow.phase === 'lobby' && route === 'ready') {
    if (!nameModal.hidden || !roleModal.hidden) return; // a modal is open: keys go to it
    if (e.key === 'p' || e.key === 'P') {
      onPlay();
      e.preventDefault();
    } else if ((e.key === 'n' || e.key === 'N') && isNetwork) {
      editNames();
      e.preventDefault();
    } else if (e.key === 'Escape') {
      goMode();
    }
    return;
  }
  // Slave waiting screen: no Cancel button — Esc is the quiet way to disconnect.
  if (route === 'waiting' && e.key === 'Escape') {
    cancelWaiting();
    return;
  }
  // In the other pre-game screens, let the DOM controls (fields, buttons) handle keys.
  if (flow.phase === 'lobby') return;
  // Escape toggles the menu (the only keyboard path to quit mid-game on desktop).
  if (e.key === 'Escape') {
    if (menuOpen()) closeMenu();
    else openMenu();
    return;
  }
  if (menuOpen()) return; // menu swallows gameplay keys while open
  if (flow.canRestart()) {
    returnToPreGame();
    e.preventDefault();
    return;
  }
  input.keyDown(e.key);
  if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault();
  if (e.key === 'm' || e.key === 'M') mapMode = !mapMode;
  if (e.key === 'f' || e.key === 'F') void toggleFullscreen();
});
window.addEventListener('keyup', (e) => input.keyUp(e.key));

// ---- Touch controls (STORY-04 placement + STORY-06 wiring) ----
function wireTouchControls(): void {
  if (!isTouch) return;
  touchControls.hidden = false;

  for (const btn of touchControls.querySelectorAll<HTMLElement>('[data-control]')) {
    const control = btn.dataset.control as Control;
    const press = (on: boolean) => (e: Event) => {
      e.preventDefault();
      // A finished game returns to the pre-game screen on any control press.
      if (on && flow.canRestart()) {
        returnToPreGame();
        return;
      }
      input.setButton(control, on);
      btn.classList.toggle('held', on);
    };
    btn.addEventListener('pointerdown', press(true));
    btn.addEventListener('pointerup', press(false));
    btn.addEventListener('pointercancel', press(false));
    btn.addEventListener('pointerleave', press(false));
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  $<HTMLElement>('#menu-btn').addEventListener('click', openMenu);
  $<HTMLElement>('#map-btn').addEventListener('click', () => {
    mapMode = !mapMode;
  });
}

const fullscreenBtn = $<HTMLButtonElement>('#fullscreen-btn');
fullscreenBtn.addEventListener('click', () => void toggleFullscreen());
// Hide the button when there's nothing it can do: already standalone, or a touch
// device with no Fullscreen API (iPhone) where it would only ever show the hint.
if (isStandalone || (!fullscreenSupported && isTouch)) fullscreenBtn.hidden = true;
// Fullscreen in the menu only makes sense on desktop; drop it on touch devices.
if (isTouch) {
  const menuFs = menuOverlay.querySelector<HTMLElement>('[data-action="fullscreen"]');
  if (menuFs) menuFs.hidden = true;
}

// ---- Lobby (EPIC-20 STORY-02/03/04), GEM-styled widgets ----
/** Current selected value for a radio group, as a data-val string. */
function radioValue(group: string): string {
  switch (group) {
    case 'reload':
      return config.reloadTime === TIME_RELOAD_FAST ? 'fast' : 'slow';
    case 'regen':
      return config.regenTime === TIME_REGEN_FAST ? 'fast' : 'slow';
    case 'revive':
      return config.reviveTime === TIME_REVIVE_FAST ? 'fast' : 'slow';
    case 'lives':
      return String(config.reviveLives);
    default:
      return '';
  }
}

function applyRadio(group: string, val: string): void {
  switch (group) {
    case 'reload':
      config.reloadTime = val === 'fast' ? TIME_RELOAD_FAST : TIME_RELOAD_SLOW;
      break;
    case 'regen':
      config.regenTime = val === 'fast' ? TIME_REGEN_FAST : TIME_REGEN_SLOW;
      break;
    case 'revive':
      config.reviveTime = val === 'fast' ? TIME_REVIVE_FAST : TIME_REVIVE_SLOW;
      break;
    case 'lives':
      config.reviveLives = Number(val);
      break;
  }
}

function renderLobby(): void {
  const mazeVal = lobby.querySelector<HTMLElement>('#cfg-maze-val');
  if (mazeVal)
    mazeVal.textContent = MAZE_OPTIONS.find((m) => m.id === config.mazeId)?.label ?? config.mazeId;

  // radio groups: mark the selected option
  lobby.querySelectorAll<HTMLElement>('.gem-radios').forEach((grp) => {
    const sel = radioValue(grp.dataset.radio ?? '');
    grp.querySelectorAll<HTMLElement>('.gem-radio').forEach((btn) => {
      btn.classList.toggle('sel', btn.dataset.val === sel);
    });
  });

  // checkboxes
  lobby
    .querySelector<HTMLElement>('[data-check="friendly"]')
    ?.classList.toggle('on', config.friendlyFire);
  lobby.querySelector<HTMLElement>('[data-check="teams"]')?.classList.toggle('on', config.teamFlag);

  for (let i = 0; i < 3; i++) {
    const v = lobby.querySelector<HTMLElement>(`[data-drone="${i}"]`);
    if (v) v.textContent = String(config.drones[i]);
  }
  // Players online (master only): the COUNT-PLAYERS result taken on Play.
  const playersRow = lobby.querySelector<HTMLElement>('#cfg-players-row');
  if (playersRow) playersRow.hidden = !isNetwork;
  const playersVal = lobby.querySelector<HTMLElement>('#cfg-players');
  if (playersVal) playersVal.textContent = String(humanCount());
}

function wireLobby(): void {
  lobby.querySelectorAll<HTMLElement>('.gem-radios').forEach((grp) => {
    const group = grp.dataset.radio ?? '';
    grp.querySelectorAll<HTMLElement>('.gem-radio').forEach((btn) => {
      btn.addEventListener('click', () => {
        applyRadio(group, btn.dataset.val ?? '');
        renderLobby();
      });
    });
  });
  lobby.querySelectorAll<HTMLElement>('[data-check]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.check === 'friendly') config.friendlyFire = !config.friendlyFire;
      else if (btn.dataset.check === 'teams') config.teamFlag = !config.teamFlag;
      renderLobby();
    });
  });
  lobby.querySelectorAll<HTMLElement>('[data-maze]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dir = Number(btn.dataset.maze); // -1 or +1
      const n = MAZE_OPTIONS.length;
      const idx = MAZE_OPTIONS.findIndex((m) => m.id === config.mazeId);
      config.mazeId = MAZE_OPTIONS[(idx + dir + n) % n]!.id;
      renderLobby();
    });
  });
  lobby.querySelectorAll<HTMLElement>('[data-drone-up]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.droneUp);
      if (totalDrones(config.drones) < maxDrones(humanCount())) {
        config.drones[i] = (config.drones[i] ?? 0) + 1;
      }
      renderLobby();
    });
  });
  lobby.querySelectorAll<HTMLElement>('[data-drone-dn]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.droneDn);
      config.drones[i] = Math.max(0, (config.drones[i] ?? 0) - 1);
      renderLobby();
    });
  });
  lobbyStart.addEventListener('click', onStart);
}

/** Mode menu (STORY-01) → solo ready screen or the network connect screen. */
function wireModeMenu(): void {
  modeMenu.addEventListener('click', (e) => {
    const m = (e.target as HTMLElement).dataset.mode;
    if (m === 'solo') {
      isNetwork = false;
      netConfig.mode = 'solo';
      goReady();
    } else if (m === 'network') {
      goConnect();
    }
  });
  playBtn.addEventListener('click', onPlay);
  namesBtn.addEventListener('click', editNames);
  const confirmName = (): void => {
    const name = nameInput.value.trim() || 'Player';
    nameModal.hidden = true;
    const cb = nameConfirm;
    nameConfirm = null;
    cb?.(name);
  };
  $<HTMLButtonElement>('#name-ok').addEventListener('click', confirmName);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmName();
  });
}

/** Connect screen (STORY-02): edit server/room, open the idle link, then elect a role. */
function wireConnectScreen(): void {
  conUrl.addEventListener('input', () => {
    netConfig.url = conUrl.value.trim();
  });
  conRoom.addEventListener('input', () => {
    netConfig.room = conRoom.value.trim().toUpperCase();
  });
  conConnect.addEventListener('click', () => void doConnect());
  $<HTMLButtonElement>('#con-back').addEventListener('click', goMode);
  $<HTMLButtonElement>('#role-modal-ok').addEventListener('click', () => {
    roleModal.hidden = true;
  });
}

/** Open the orchestrator link and hold it idle; on success, run the master election. */
async function doConnect(): Promise<void> {
  if (!isValidUrl(netConfig.url)) {
    conMsg.textContent = 'enter a ws:// or wss:// server';
    return;
  }
  teardownIdle(); // drop any earlier attempt
  conMsg.textContent = 'connecting…';
  conConnect.disabled = true;

  // Resolve on the first open; reject if the socket closes before opening — an
  // orchestrator room refusal (HTTP 403) and an unreachable server both look like
  // this to a browser, so the message is room-aware but hedged.
  let settled = false;
  const connected = new Promise<void>((resolve, reject) => {
    idle = connectIdle(netConfig, {
      onStatus: (s) => {
        setNetStatus(s);
        if (settled) return; // after open, drops just blink the icon (reconnecting)
        if (s === 'open') {
          settled = true;
          resolve();
        } else if (s === 'reconnecting' || s === 'closed') {
          settled = true;
          reject(new Error('refused'));
        }
      },
    });
  });
  let timer = 0;
  const timeout = new Promise<never>((_, rej) => {
    timer = window.setTimeout(() => rej(new Error('timeout')), 6000);
  });
  try {
    await Promise.race([connected, timeout]);
  } catch {
    teardownIdle();
    conMsg.textContent = netConfig.room
      ? `room "${netConfig.room}" was refused — check it exists and isn't full`
      : 'could not reach the server — is it running?';
    conConnect.disabled = false;
    return;
  } finally {
    window.clearTimeout(timer);
  }
  conConnect.disabled = false;
  await enterNetwork();
}

/** Decide master vs slave by sending a MASTER message round the ring (dispatch.c),
 *  announce the role, then route: master → ready (wait for P), slave → wait for the game. */
async function enterNetwork(): Promise<void> {
  if (!idle) return;
  conMsg.textContent = 'joining ring…';
  const role = await electMaster(idle.channel);
  netRole = role === 'host' ? 'master' : 'slave';
  if (role === 'host') {
    showMasterModal(); // "This is the MASTER machine." over the ready screen
    goReady(); // we own the ring: wait for P → preferences → Start drives the handshake
  } else {
    goWaiting();
    void runNetSession('join'); // slave: patient wait for the master, then play
  }
}

/** Cancel a slave's wait for the host: abort the pending read so the session exits. */
function cancelWaiting(): void {
  idle?.channel.abort('cancelled'); // runNetSession('join') → null setup → goMode()
}

// ---- Rendering ----
function viewText(text: string, dy: number, color = '#000'): void {
  ctx!.font = '8px monospace';
  ctx!.textAlign = 'center';
  ctx!.fillStyle = color;
  ctx!.fillText(text, VIEW_SCREEN_X + VIEW_WIDTH / 2, VIEW_SCREEN_Y + dy);
  ctx!.textAlign = 'left';
}

function fillView(color: string): void {
  ctx!.fillStyle = color;
  ctx!.fillRect(VIEW_SCREEN_X, VIEW_SCREEN_Y, VIEW_WIDTH, 100);
}

function drawDashboard(): void {
  if (dashboardReady) ctx!.drawImage(dashboard, 0, 0);
  else {
    ctx!.fillStyle = '#000';
    ctx!.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
  }
}

/** Killer's face + greeting, shown while the player waits to respawn (maingame.c). */
function drawDeadView(): void {
  const gunman = world.players[cameraIndex]!.ply_gunman;
  fillView('#6b6b6b');
  drawShape(ctx!, 48, BODY_SHAPE_MAX_SIZE, BODY_SHAPE_FRONT_VIEW, BODY_SHAPE_NO_SHADOW, gunman);
  viewText(`${playerName(gunman)} says:`, 14);
  viewText('"Have a nice day!"', 92);
}

// End-screen animation (endshape.c): the winner's face turns around once if you won, or
// shakes twice if you lost. Sprite (face direction 0..19) per frame.
// prettier-ignore
const WINNER_ANIM = [0,0,0,19,19,18,17,16,15,14,13,12,11,10,10,10,10,10,10,9,8,7,6,5,4,3,2,1,0];
// prettier-ignore
const LOSE_ANIM = [0,1,2,3,3,2,1,0,19,18,17,17,18,19,0,1,2,3,3,2,1,0,19,18,17,17,18,19,0];
const ANIM_PACE = 2; // ticks per animation frame

/** End screen: the winner's face spins (win) / shakes (lose), then a blink (win) or a
 *  tongue (lose); then "press any key". */
function drawGameOver(): void {
  drawDashboard();
  fillView('#9a9a9a');
  const w = flow.winner;
  if (w >= 0) {
    const won =
      w === cameraIndex ||
      (!!world.teamFlag && world.players[w]!.ply_team === world.players[cameraIndex]!.ply_team);
    const elapsed = GAMEOVER_TICKS - flow.timer; // ticks since game over
    const anim = won ? WINNER_ANIM : LOSE_ANIM;
    const frame = Math.floor(elapsed / ANIM_PACE);
    const spinning = frame < anim.length;
    drawShape(
      ctx!,
      48,
      BODY_SHAPE_MAX_SIZE,
      spinning ? anim[frame]! : BODY_SHAPE_FRONT_VIEW,
      BODY_SHAPE_NO_SHADOW,
      w,
    );
    if (!spinning) {
      // after the turn: the winner blinks (lashes flash ~every 0.8s), the loser is shown a tongue
      if (won) {
        if ((elapsed - anim.length * ANIM_PACE) % 48 < 8) drawWinLashes(ctx!, w);
      } else {
        drawLoseTongue(ctx!);
      }
    }
    viewText(
      won
        ? world.teamFlag
          ? 'Your team wins!'
          : 'You win!'
        : world.teamFlag
          ? 'Your team loses!'
          : `${playerName(w)} wins!`,
      14,
    );
  }
  drawKillsWindow(ctx!, killLog.victims); // the kills persist through the end screen
  if (flow.canRestart()) viewText('press any key', 92);
}

/** Render the world for the current flow phase, from the local player's view. */
function renderWorld(): void {
  const p = world.players[cameraIndex]!;
  if (flow.phase === 'gameover') {
    drawGameOver();
  } else if (flow.phase === 'preview' || mapMode) {
    drawDashboard();
    drawMap2D(ctx!, world);
    drawHappyIndicator(ctx!, world, cameraIndex);
    drawScoreboard(ctx!, world);
    drawKillsWindow(ctx!, killLog.victims);
  } else {
    drawDashboard();
    if (p.ply_lives > 0) {
      drawView3D(ctx!, world, p.ply_y, p.ply_x, p.ply_dir, cameraIndex);
      if (p.ply_reload === 0) drawCrosshair(ctx!, cameraIndex);
      if (p.ply_hitflag) {
        ctx!.fillStyle = 'rgba(255,0,0,0.45)';
        ctx!.fillRect(VIEW_SCREEN_X, VIEW_SCREEN_Y, VIEW_WIDTH, 100);
      }
    } else {
      drawDeadView();
    }
    drawHappyIndicator(ctx!, world, cameraIndex);
    drawScoreboard(ctx!, world);
    drawKillsWindow(ctx!, killLog.victims);
  }
}

function frame(): void {
  // Touch gameplay controls belong to an active game only; the pre-game screens
  // (mode / connect / ready / lobby / waiting) all run in the 'lobby' phase.
  if (isTouch) touchControls.hidden = flow.phase === 'lobby';

  if (orientationBlocked || menuOpen()) {
    requestAnimationFrame(frame); // hold the game until landscape / menu close
    return;
  }

  // A networked game owns its own render (driven by the lock-step loop, gated by the
  // ring); the rAF loop steps aside until it ends.
  if (netActive) {
    requestAnimationFrame(frame);
    return;
  }

  // Pre-game: the active screen (mode / connect / ready / lobby / waiting) floats over
  // the (frozen) playfield. Render the maze view behind it, but don't step the sim.
  if (flow.phase === 'lobby') {
    refreshScreens();
    const lp = world.players[0]!;
    drawDashboard();
    drawView3D(ctx!, world, lp.ply_y, lp.ply_x, lp.ply_dir, 0);
    drawHappyIndicator(ctx!, world, 0);
    drawScoreboard(ctx!, world);
    requestAnimationFrame(frame);
    return;
  }

  // Solo (offline) loop: advance the flow, step the sim, render.
  const stepNow = flow.tick(world);
  if (stepNow) {
    const joyTable = [input.joyByte(), 0, 0, 0]; // player 0 is the camera; drones filled by step()
    const dronesActive = world.playerAndDroneCount > world.machinesOnline ? 1 : 0;
    step(world, joyTable, dronesActive);
    const me = world.players[cameraIndex]!;
    killLog.update(me.ply_score, me.ply_looser); // record kills for the pop chart
  }
  renderWorld();

  if (status && !hintActive) {
    const p = world.players[0]!;
    if (flow.phase === 'preview') {
      status.textContent = `get ready — ${Math.ceil(flow.timer / 60)}s`;
    } else if (flow.phase === 'gameover') {
      const who = flow.winner === 0 ? 'you win' : `player ${flow.winner} wins`;
      status.textContent = flow.canRestart()
        ? `game over — ${who} · press any key`
        : `game over — ${who}`;
    } else {
      status.textContent = `field (${p.ply_x >> 7},${p.ply_y >> 7}) · score ${p.ply_score}/10`;
    }
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  fit();
  updateOrientation();
});
window.addEventListener('orientationchange', () => {
  fit();
  updateOrientation();
});
document.addEventListener('fullscreenchange', fit);

wireTouchControls();
wireLobby();
wireModeMenu();
wireConnectScreen();
route = 'mode'; // start at the mode menu (EPIC-24)
refreshScreens();
fit();
updateOrientation();
requestAnimationFrame(frame);
