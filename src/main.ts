import './style.css';
import dashboardUrl from './assets/generated/main-screen.png';
import midimazeRaw from './assets/generated/mazes/midimaze.json';
import { GameFlow } from './game/flow';
import { Input, type Control } from './game/input';
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

const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
// iPhone Safari exposes no Fullscreen API; iPad/desktop do. Detect real support.
const fullscreenSupported =
  document.fullscreenEnabled === true && typeof app.requestFullscreen === 'function';
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const mazeJson = midimazeRaw as { size: number; data: number[] };
const maze = { size: mazeJson.size, data: Int8Array.from(mazeJson.data), defect: false };

// Solo game: the human camera (player 0) versus three drones — target (wanders),
// standard (hunts on straight corridors) and ninja (pathfinds), all to GAME_WIN_SCORE.
const HUMAN_COUNT = 1;
const PLAYER_COUNT = 4;
const DRONES_ACTIVE = PLAYER_COUNT > HUMAN_COUNT ? 1 : 0;
let seed = 7;

/** Build a fresh, configured world for a new game (used at start and on restart). */
function newWorld(): World {
  const w = new World(maze, new Rng(seed++));
  w.reloadTime = 10;
  w.regenTime = 100;
  w.reviveTime = 50;
  w.reviveLives = 2;
  w.machinesOnline = HUMAN_COUNT;
  w.activeDronesByType[0] = 1; // target drone
  w.activeDronesByType[1] = 1; // standard drone
  w.activeDronesByType[2] = 1; // ninja drone
  assignDroneTypes(w, HUMAN_COUNT);
  droneSetup(w, HUMAN_COUNT);
  initAllPlayer(w, PLAYER_COUNT, true);
  w.weDontHaveAWinner = 1;
  return w;
}

let world = newWorld();
const flow = new GameFlow();
const input = new Input();
let mapMode = false;
let orientationBlocked = false;

function restartGame(): void {
  world = newWorld();
  flow.restart();
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
  if (action === 'map') mapMode = !mapMode;
  else if (action === 'fullscreen') void toggleFullscreen();
  else if (action === 'restart') restartGame();
  closeMenu();
});

// ---- Keyboard input ----
window.addEventListener('keydown', (e) => {
  // Escape toggles the menu (the only keyboard path to restart mid-game on desktop).
  if (e.key === 'Escape') {
    if (menuOpen()) closeMenu();
    else openMenu();
    return;
  }
  if (menuOpen()) return; // menu swallows gameplay keys while open
  if (flow.canRestart()) {
    restartGame();
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
      // A finished game restarts on any control press.
      if (on && flow.canRestart()) {
        restartGame();
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

  const stepNow = flow.tick(world);
  if (stepNow) {
    const joyTable = [input.joyByte(), 0, 0, 0]; // player 0 is the camera; drones filled by step()
    step(world, joyTable, DRONES_ACTIVE);
  }
  const p = world.players[0]!;

  if (flow.phase === 'gameover') {
    drawGameOver();
  } else if (flow.phase === 'preview') {
    drawMap2D(ctx!, world);
  } else if (mapMode) {
    drawMap2D(ctx!, world);
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
fit();
updateOrientation();
requestAnimationFrame(frame);
