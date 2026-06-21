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
import { GameFlow } from './game/flow';
import { Input, type Control } from './game/input';
import { loadMazeById, MAZE_OPTIONS } from './game/mazes';
import { drawCrosshair, drawHappyIndicator, drawScoreboard } from './render/hud';
import { drawMap2D } from './render/map2d';
import { VIEW_SCREEN_X, VIEW_SCREEN_Y, VIEW_WIDTH } from './render/projection';
import {
  BODY_SHAPE_FRONT_VIEW,
  BODY_SHAPE_MAX_SIZE,
  BODY_SHAPE_NO_SHADOW,
  drawShape,
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
const config: GameConfig = defaultConfig();
config.drones = [1, 1, 1]; // a lively default: one of each drone type

/** Build a fresh world from the current lobby config (called on Start). */
function newWorld(cfg: GameConfig): World {
  const w = new World(loadMazeById(cfg.mazeId), new Rng(seed++));
  w.machinesOnline = HUMAN_COUNT;
  applyConfig(w, cfg, HUMAN_COUNT);
  assignDroneTypes(w, HUMAN_COUNT);
  droneSetup(w, HUMAN_COUNT);
  const total =
    HUMAN_COUNT + w.activeDronesByType[0]! + w.activeDronesByType[1]! + w.activeDronesByType[2]!;
  initAllPlayer(w, total, true);
  w.weDontHaveAWinner = 1;
  return w;
}

let world = newWorld(config);
const flow = new GameFlow();
const input = new Input();
let mapMode = false;
let orientationBlocked = false;

/** Leave the lobby and start a configured game. */
function startGame(): void {
  world = newWorld(config);
  mapMode = false;
  flow.startGame();
  lobby.hidden = true;
}

/** End the current game and return to the lobby. */
function quitToLobby(): void {
  flow.restart(); // -> 'lobby'
  lobby.hidden = false;
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
  else if (action === 'restart') quitToLobby();
  closeMenu();
});

// ---- Keyboard input ----
window.addEventListener('keydown', (e) => {
  // In the lobby, let the DOM controls (name field, buttons) handle keys.
  if (flow.phase === 'lobby') return;
  // Escape toggles the menu (the only keyboard path to quit mid-game on desktop).
  if (e.key === 'Escape') {
    if (menuOpen()) closeMenu();
    else openMenu();
    return;
  }
  if (menuOpen()) return; // menu swallows gameplay keys while open
  if (flow.canRestart()) {
    quitToLobby();
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
      // A finished game returns to the lobby on any control press.
      if (on && flow.canRestart()) {
        quitToLobby();
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
  const name = lobby.querySelector<HTMLInputElement>('#cfg-name');
  if (name && name.value !== config.playerName) name.value = config.playerName;
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
      if (totalDrones(config.drones) < maxDrones(HUMAN_COUNT)) {
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
  lobby.querySelector<HTMLInputElement>('#cfg-name')?.addEventListener('input', (e) => {
    config.playerName = (e.target as HTMLInputElement).value.toUpperCase().slice(0, 8);
  });
  $<HTMLButtonElement>('#lobby-start').addEventListener('click', startGame);
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
  const gunman = world.players[0]!.ply_gunman;
  fillView('#6b6b6b');
  drawShape(ctx!, 48, BODY_SHAPE_MAX_SIZE, BODY_SHAPE_FRONT_VIEW, BODY_SHAPE_NO_SHADOW, gunman);
  viewText(`Player ${gunman} says:`, 14);
  viewText('"Have a nice day!"', 92);
}

/** End screen: the winner's face + result text, then "press any key". */
function drawGameOver(): void {
  drawDashboard();
  fillView('#9a9a9a');
  const w = flow.winner;
  if (w >= 0) {
    drawShape(ctx!, 48, BODY_SHAPE_MAX_SIZE, BODY_SHAPE_FRONT_VIEW, BODY_SHAPE_NO_SHADOW, w);
    viewText(w === 0 ? 'You win!' : `Player ${w} wins!`, 14);
  }
  if (flow.canRestart()) viewText('press any key', 92);
}

function frame(): void {
  if (orientationBlocked || menuOpen()) {
    requestAnimationFrame(frame); // hold the game until landscape / menu close
    return;
  }

  // Lobby: the GEM dialog floats over the (frozen) playfield. Render the maze view
  // behind it, but don't step the sim.
  if (flow.phase === 'lobby') {
    lobby.hidden = false;
    const lp = world.players[0]!;
    drawDashboard();
    drawView3D(ctx!, world, lp.ply_y, lp.ply_x, lp.ply_dir, 0);
    drawHappyIndicator(ctx!, world, 0);
    drawScoreboard(ctx!, world);
    requestAnimationFrame(frame);
    return;
  }

  const stepNow = flow.tick(world);
  if (stepNow) {
    const joyTable = [input.joyByte(), 0, 0, 0]; // player 0 is the camera; drones filled by step()
    const dronesActive = world.playerAndDroneCount > world.machinesOnline ? 1 : 0;
    step(world, joyTable, dronesActive);
  }
  const p = world.players[0]!;

  if (flow.phase === 'gameover') {
    drawGameOver();
  } else if (flow.phase === 'preview' || mapMode) {
    // The 2D map is drawn inside the game view window (draw2d.c), with the HUD
    // around it — not full-screen. Preview also shows the map.
    drawDashboard();
    drawMap2D(ctx!, world);
    drawHappyIndicator(ctx!, world, 0);
    drawScoreboard(ctx!, world);
  } else {
    drawDashboard();
    if (p.ply_lives > 0) {
      drawView3D(ctx!, world, p.ply_y, p.ply_x, p.ply_dir, 0);
      if (p.ply_reload === 0) drawCrosshair(ctx!, 0);
      if (p.ply_hitflag) {
        ctx!.fillStyle = 'rgba(255,0,0,0.45)';
        ctx!.fillRect(VIEW_SCREEN_X, VIEW_SCREEN_Y, VIEW_WIDTH, 100);
      }
    } else {
      drawDeadView();
    }
    drawHappyIndicator(ctx!, world, 0);
    drawScoreboard(ctx!, world);
  }

  if (status && !hintActive) {
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
renderLobby();
lobby.hidden = false; // start in the lobby
fit();
updateOrientation();
requestAnimationFrame(frame);
