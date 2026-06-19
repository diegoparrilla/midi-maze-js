import './style.css';
import { BASE_HEIGHT, BASE_WIDTH, integerScale } from './upscale';

const canvas = document.querySelector<HTMLCanvasElement>('#screen');
if (!canvas) throw new Error('#screen canvas not found');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2D context unavailable');

/** Integer-upscale the 320x200 canvas to fill the window (D-04). */
function fit(c: HTMLCanvasElement): void {
  const scale = integerScale(window.innerWidth, window.innerHeight);
  c.style.width = `${BASE_WIDTH * scale}px`;
  c.style.height = `${BASE_HEIGHT * scale}px`;
}

/** Placeholder frame: confirms the dev server, build, and canvas pipeline work. */
function drawPlaceholder(g: CanvasRenderingContext2D): void {
  g.fillStyle = '#1b3a5b';
  g.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT / 2);
  g.fillStyle = '#3a3a3a';
  g.fillRect(0, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT / 2);
  g.fillStyle = '#e0e0e0';
  g.textAlign = 'center';
  g.font = '16px monospace';
  g.fillText('MIDI MAZE', BASE_WIDTH / 2, BASE_HEIGHT / 2 - 8);
  g.font = '8px monospace';
  g.fillText('320x200 scaffold', BASE_WIDTH / 2, BASE_HEIGHT / 2 + 8);
}

window.addEventListener('resize', () => fit(canvas));
fit(canvas);
drawPlaceholder(ctx);
