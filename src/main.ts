import './style.css';
import dashboardUrl from './assets/generated/main-screen.png';
import midimazeRaw from './assets/generated/mazes/midimaze.json';
import { drawCrosshair, drawHappyIndicator, drawScoreboard } from './render/hud';
import { drawMap2D } from './render/map2d';
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

// Solo demo: the human camera (player 0) versus three drones — one target drone
// (wanders), one standard drone (hunts the camera and fires), and one ninja drone
// (pathfinds around walls toward the camera and fires).
const HUMAN_COUNT = 1;
const PLAYER_COUNT = 4;
const world = new World(maze, new Rng(7));
world.reloadTime = 10;
world.regenTime = 100;
world.reviveTime = 50;
world.reviveLives = 2;
world.machinesOnline = HUMAN_COUNT;
world.activeDronesByType[0] = 1; // one target drone
world.activeDronesByType[1] = 1; // one standard drone
world.activeDronesByType[2] = 1; // one ninja drone
assignDroneTypes(world, HUMAN_COUNT);
droneSetup(world, HUMAN_COUNT);
initAllPlayer(world, PLAYER_COUNT, true);
const dronesActive = PLAYER_COUNT > HUMAN_COUNT ? 1 : 0;

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

function frame(): void {
  const joyTable = [joyByte(), 0, 0, 0]; // player 0 is the camera; drone slots are filled by step()
  step(world, joyTable, dronesActive);
  const p = world.players[0]!;
  if (mapMode) {
    drawMap2D(ctx!, world);
  } else {
    if (dashboardReady) ctx!.drawImage(dashboard, 0, 0);
    else {
      ctx!.fillStyle = '#000';
      ctx!.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    }
    drawView3D(ctx!, world, p.ply_y, p.ply_x, p.ply_dir, 0);
    if (p.ply_reload === 0 && p.ply_lives > 0) drawCrosshair(ctx!, 0);
    drawHappyIndicator(ctx!, world, 0);
    drawScoreboard(ctx!, world);
  }
  if (status) {
    status.textContent = `first-person · field (${p.ply_x >> 7},${p.ply_y >> 7}) dir ${p.ply_dir} · arrows move/turn, space fire, M = map`;
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => fit(canvas));
fit(canvas);
requestAnimationFrame(frame);
