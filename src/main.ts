import './style.css';
import midimazeRaw from './assets/generated/mazes/midimaze.json';
import { drawMap2D } from './render/map2d';
import { drawView3D } from './render/view3d';
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

// Solo demo: a camera (player 0) plus two stationary opponents in the open row-1
// corridor, so the eyeball sprites are visible until drones/networking arrive.
const PLAYER_COUNT = 3;
const world = new World(maze, new Rng(7));
world.reloadTime = 10;
world.regenTime = 100;
world.reviveTime = 50;
world.reviveLives = 2;
initAllPlayer(world, PLAYER_COUNT);
const starts = [
  { y: 128, x: 128, dir: 64 }, // camera, facing east
  { y: 128, x: 640, dir: 192 }, // opponent at field (1,5), facing the camera
  { y: 128, x: 1152, dir: 192 }, // opponent at field (1,9)
];
starts.forEach((s, i) => {
  const p = world.players[i]!;
  p.ply_y = s.y;
  p.ply_x = s.x;
  p.ply_dir = s.dir;
});

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
  const joyTable = [joyByte(), 0, 0]; // only player 0 (the camera) is controlled
  step(world, joyTable);
  const p = world.players[0]!;
  if (mapMode) drawMap2D(ctx!, world);
  else drawView3D(ctx!, world, p.ply_y, p.ply_x, p.ply_dir, 0);
  if (status) {
    status.textContent = `first-person · field (${p.ply_x >> 7},${p.ply_y >> 7}) dir ${p.ply_dir} · arrows move/turn, space fire, M = map`;
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => fit(canvas));
fit(canvas);
requestAnimationFrame(frame);
