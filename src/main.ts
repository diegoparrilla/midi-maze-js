import './style.css';
import dashboardUrl from './assets/generated/main-screen.png';
import midimazeRaw from './assets/generated/mazes/midimaze.json';
import { GameFlow } from './game/flow';
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
import {
  JOYSTICK_BUTTON,
  JOYSTICK_DOWN,
  JOYSTICK_LEFT,
  JOYSTICK_RIGHT,
  JOYSTICK_UP,
} from './sim/movement';
import { Rng } from './sim/rng';
import { initAllPlayer } from './sim/setup';
import { step } from './sim/step';
import { World } from './sim/world';
import { BASE_HEIGHT, BASE_WIDTH, integerScale } from './upscale';

const canvas = document.querySelector<HTMLCanvasElement>('#screen');
if (!canvas) throw new Error('#screen canvas not found');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2D context unavailable');
const status = document.querySelector<HTMLElement>('#status');

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

// Synth-dashboard background (the maze view + HUD are drawn into its panels).
const dashboard = new Image();
let dashboardReady = false;
dashboard.onload = () => {
  dashboardReady = true;
};
dashboard.src = dashboardUrl;

let mapMode = false;
const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
  // After a finished game, any key starts a fresh one.
  if (flow.canRestart()) {
    world = newWorld();
    flow.restart();
    e.preventDefault();
    return;
  }
  keys.add(e.key);
  if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault();
  if (e.key === 'm' || e.key === 'M') mapMode = !mapMode;
});
window.addEventListener('keyup', (e) => keys.delete(e.key));

function joyByte(): number {
  let j = 0;
  if (keys.has('ArrowUp')) j |= JOYSTICK_UP;
  if (keys.has('ArrowDown')) j |= JOYSTICK_DOWN;
  if (keys.has('ArrowLeft')) j |= JOYSTICK_LEFT;
  if (keys.has('ArrowRight')) j |= JOYSTICK_RIGHT;
  if (keys.has(' ')) j |= JOYSTICK_BUTTON;
  return j;
}

/** Integer-upscale the 320x200 canvas to fill the window (D-04). */
function fit(c: HTMLCanvasElement): void {
  const scale = integerScale(window.innerWidth, window.innerHeight);
  c.style.width = `${BASE_WIDTH * scale}px`;
  c.style.height = `${BASE_HEIGHT * scale}px`;
}

/** Centred text inside the 3D view window. */
function viewText(text: string, dy: number, color = '#000'): void {
  ctx!.font = '8px monospace';
  ctx!.textAlign = 'center';
  ctx!.fillStyle = color;
  ctx!.fillText(text, VIEW_SCREEN_X + VIEW_WIDTH / 2, VIEW_SCREEN_Y + dy);
  ctx!.textAlign = 'left';
}

/** Fill the 3D view window with a flat colour (used by the dead / game-over screens). */
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
  const stepNow = flow.tick(world);
  if (stepNow) {
    const joyTable = [joyByte(), 0, 0, 0]; // player 0 is the camera; drone slots filled by step()
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
      // Flash the view when the camera takes a hit (maingame.c:235-245).
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

  if (status) {
    if (flow.phase === 'preview') {
      status.textContent = `get ready — ${Math.ceil(flow.timer / 60)}s · arrows move/turn, space fire, M = map`;
    } else if (flow.phase === 'gameover') {
      const who = flow.winner === 0 ? 'you win' : `player ${flow.winner} wins`;
      status.textContent = flow.canRestart()
        ? `game over — ${who} · press any key`
        : `game over — ${who}`;
    } else {
      status.textContent = `first-person · field (${p.ply_x >> 7},${p.ply_y >> 7}) dir ${p.ply_dir} · score ${p.ply_score}/10 · arrows move/turn, space fire, M = map`;
    }
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => fit(canvas));
fit(canvas);
requestAnimationFrame(frame);
