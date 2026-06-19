import './style.css';
import midimazeRaw from './assets/generated/mazes/midimaze.json';
import { drawMap2D } from './render/map2d';
import { Rng } from './sim/rng';
import { initAllPlayer } from './sim/setup';
import { World } from './sim/world';
import { BASE_HEIGHT, BASE_WIDTH, integerScale } from './upscale';

const canvas = document.querySelector<HTMLCanvasElement>('#screen');
if (!canvas) throw new Error('#screen canvas not found');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2D context unavailable');
const status = document.querySelector<HTMLElement>('#status');

const mazeJson = midimazeRaw as { size: number; data: number[] };
const maze = { size: mazeJson.size, data: Int8Array.from(mazeJson.data), defect: false };
const PLAYER_COUNT = 6;
let seed = 1234;

/** Integer-upscale the 320x200 canvas to fill the window (D-04). */
function fit(c: HTMLCanvasElement): void {
  const scale = integerScale(window.innerWidth, window.innerHeight);
  c.style.width = `${BASE_WIDTH * scale}px`;
  c.style.height = `${BASE_HEIGHT * scale}px`;
}

/** Place players deterministically from `seed` and draw the 2D map. */
function render(): void {
  const world = new World(maze, new Rng(seed));
  initAllPlayer(world, PLAYER_COUNT);
  drawMap2D(ctx!, world);
  if (status) {
    status.textContent = `2D map · maze "${mazeJson.size}×${mazeJson.size}" · seed ${seed} · ${PLAYER_COUNT} players · click to reseed`;
  }
}

canvas.addEventListener('click', () => {
  seed = Math.floor(Math.random() * 65536) - 32768;
  render();
});
window.addEventListener('resize', () => fit(canvas));
fit(canvas);
render();
