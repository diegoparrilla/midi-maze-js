// Asset extractor (EPIC-03 STORY-01): decode the original MIDIMAZE.D8A and the
// vendored .MAZ files in assets-src/ into web-loadable files under
// src/assets/generated/. Run with: npm run assets
//
// D8A layout (README/D8AFileFormat.md, read_d8a.py):
//   0x00000 colour title screen | 0x05076 mono title screen
//   0x0AAD8 sine table (65 big-endian words, sin*256)
//   0x0AB5A ball shapes (24, 1bpp, compressed by height)
//   0x0B7BE face shapes (24 sizes x 20 rotations, 1bpp)
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { mazeToAscii, parseMaz } from '../src/maze.ts';

const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));
const ROOT = here('..');
const D8A = `${ROOT}/assets-src/MIDIMAZE.D8A`;
const OUT = `${ROOT}/src/assets/generated`;

// Atari STE 3-bit-per-channel palette used by MIDI Maze (read_d8a.py).
const PALETTE_STE = [
  0x000, 0x566, 0x455, 0x227, 0x444, 0x122, 0x344, 0x233, 0x770, 0x740, 0x403, 0x707, 0x057, 0x060,
  0x700, 0x777,
];

const SINE_OFF = 0x0aad8;
const SINE_WORDS = 65;
const BALL_OFF = 0x0ab5a;
const BALL_LEN = 0x0c64;
const FACE_OFF = 0x0b7be;
const FACE_LEN = 0xf7d0;
const BODY_SHAPE_COUNT = 24;
const BODY_SHAPE_FACE_COUNT = 20;

interface Shape {
  /** scale 1..32 driving size; height in lines; width in 16-bit words. */
  scale: number;
  height: number;
  widthWords: number;
  /** One big-endian u16 mask word per (line, word-column), row-major. */
  rows: number[];
}

/** Geometry of body shape `shapeIndex` (read_d8a.py print_body_shapes). */
function shapeGeometry(shapeIndex: number): { scale: number; height: number; widthWords: number } {
  let scale = BODY_SHAPE_COUNT - shapeIndex;
  if (scale > 16) scale = ((scale - 16) << 1) + 16;
  const height = Math.floor((Math.floor((scale * 40) / 12) + 1) / 2);
  const widthWords = Math.floor((scale - 1) / 8) + 1;
  return { scale, height, widthWords };
}

/** Read one shape's 1bpp word rows starting at `off`; returns shape + next offset. */
function readShape(data: Uint8Array, off: number, shapeIndex: number): [Shape, number] {
  const { scale, height, widthWords } = shapeGeometry(shapeIndex);
  const rows: number[] = [];
  for (let line = 0; line < height; line++) {
    for (let w = 0; w < widthWords; w++) {
      rows.push((data[off]! << 8) | data[off + 1]!);
      off += 2;
    }
  }
  return [{ scale, height, widthWords, rows }, off];
}

/** Decode `faceCount` shapes per size (1 for ball, 20 for faces). */
function readShapes(data: Uint8Array, start: number, len: number, faceCount: number): Shape[][] {
  let off = start;
  const out: Shape[][] = [];
  for (let s = 0; s < BODY_SHAPE_COUNT; s++) {
    const variants: Shape[] = [];
    for (let f = 0; f < faceCount; f++) {
      const [shape, next] = readShape(data, off, s);
      variants.push(shape);
      off = next;
    }
    out.push(variants);
  }
  if (off - start !== len) {
    throw new Error(`shape block consumed ${off - start} bytes, expected ${len}`);
  }
  return out;
}

/** Render a 1bpp shape to ASCII ('#'/space) for the manual visual check. */
function shapeToAscii(shape: Shape): string {
  const lines: string[] = [];
  for (let line = 0; line < shape.height; line++) {
    let row = '';
    for (let w = 0; w < shape.widthWords; w++) {
      const word = shape.rows[line * shape.widthWords + w]!;
      for (let b = 15; b >= 0; b--) row += (word >> b) & 1 ? '#' : ' ';
    }
    lines.push(row.replace(/\s+$/, ''));
  }
  return lines.join('\n');
}

function writeJson(name: string, value: unknown): void {
  writeFileSync(`${OUT}/${name}`, JSON.stringify(value));
  console.log(`  wrote ${name}`);
}

// --- main-screen (synth dashboard) image: RLE + 4 bitplanes -> 320x200 indices ---
const SCREEN_COLOR_OFF = 0x00000;
const SCREEN_W = 320;
const SCREEN_H = 200;

function decodeMainScreen(d8a: Uint8Array): Uint8Array {
  const data = d8a.subarray(SCREEN_COLOR_OFF);
  const lineDataCount = (data[2]! << 8) | data[3]!;
  let offData = 4;
  let offImg = 4 + lineDataCount;
  const planes: number[] = [];
  for (let k = 0; k < lineDataCount >> 1; k++) {
    const nLines = data[offData++]!;
    for (let l = 0; l < nLines; l++) {
      planes.push((data[offImg]! << 8) | data[offImg + 1]!);
      offImg += 2;
    }
    const nSkip = data[offData++]!;
    for (let l = 0; l < nSkip; l++) planes.push(0);
  }
  // re-sort into Atari screen-buffer order
  const screen = new Array<number>(16000);
  for (let i = 0; i < 16000; i++) screen[i] = planes[(i % 80) * 200 + ((i / 80) | 0)]!;
  // 4 bitplanes -> palette indices
  const indices = new Uint8Array(SCREEN_W * SCREEN_H);
  for (let y = 0; y < SCREEN_H; y++) {
    const scro = y * 80;
    for (let xw = 0; xw < 80; xw += 4) {
      const p0 = screen[scro + xw]!;
      const p1 = screen[scro + xw + 1]!;
      const p2 = screen[scro + xw + 2]!;
      const p3 = screen[scro + xw + 3]!;
      for (let x = 15; x >= 0; x--) {
        const color =
          (((p3 >> x) & 1) << 3) |
          (((p2 >> x) & 1) << 2) |
          (((p1 >> x) & 1) << 1) |
          ((p0 >> x) & 1);
        indices[y * SCREEN_W + (15 - x) + xw * 4] = color;
      }
    }
  }
  return indices;
}

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}
function encodePng(width: number, height: number, rgb: Buffer): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0; // filter: none
    rgb.copy(raw, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3);
  }
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function main(): void {
  mkdirSync(`${OUT}/mazes`, { recursive: true });
  const data = new Uint8Array(readFileSync(D8A));
  console.log(`D8A ${data.length} bytes`);

  // --- sine table (65 big-endian words) ---
  const sine: number[] = [];
  for (let i = 0; i < SINE_WORDS; i++) {
    sine.push((data[SINE_OFF + i * 2]! << 8) | data[SINE_OFF + i * 2 + 1]!);
  }
  writeJson('sine.json', sine);

  // --- palette: STE 0xRGB (0..7 per channel) + 8-bit RGB triples ---
  const palette = PALETTE_STE.map((c) => {
    const r3 = (c >> 8) & 0xf;
    const g3 = (c >> 4) & 0xf;
    const b3 = c & 0xf;
    const conv = (v: number): number => Math.round((v * 255) / 7);
    return { ste: c, rgb: [conv(r3), conv(g3), conv(b3)] as [number, number, number] };
  });
  writeJson('palette.json', palette);

  // --- ball + face shapes ---
  const balls = readShapes(data, BALL_OFF, BALL_LEN, 1).map((v) => v[0]!);
  const faces = readShapes(data, FACE_OFF, FACE_LEN, BODY_SHAPE_FACE_COUNT);
  writeJson('ball-shapes.json', balls);
  writeJson('face-shapes.json', faces);

  // --- main-screen dashboard (synth panel) as a PNG background ---
  const screenIdx = decodeMainScreen(data);
  const rgb = Buffer.alloc(SCREEN_W * SCREEN_H * 3);
  for (let i = 0; i < screenIdx.length; i++) {
    const c = palette[screenIdx[i]!]!.rgb;
    rgb[i * 3] = c[0];
    rgb[i * 3 + 1] = c[1];
    rgb[i * 3 + 2] = c[2];
  }
  writeFileSync(`${OUT}/main-screen.png`, encodePng(SCREEN_W, SCREEN_H, rgb));
  console.log('  wrote main-screen.png');

  // --- ASCII preview: largest ball + the 20 faces of the largest size ---
  const preview: string[] = ['# Shape preview (largest size) — manual visual check', ''];
  preview.push('## Ball (frame, used for players and shots)', shapeToAscii(balls[0]!), '');
  for (let f = 0; f < BODY_SHAPE_FACE_COUNT; f++) {
    preview.push(`## Face ${f}`, shapeToAscii(faces[0]![f]!), '');
  }
  writeFileSync(`${OUT}/shapes-preview.txt`, preview.join('\n'));
  console.log('  wrote shapes-preview.txt');

  console.log(
    `shapes: ${balls.length} ball, ${faces.length}x${faces[0]!.length} face; sine ${sine.length} words`,
  );

  // --- mazes: parse each vendored .MAZ to a canonical JSON grid + ASCII ---
  const mazeDir = `${ROOT}/assets-src/mazes`;
  for (const file of readdirSync(mazeDir).filter((f) => f.endsWith('.maz'))) {
    const name = file.replace(/\.maz$/, '');
    const bytes = new Uint8Array(readFileSync(`${mazeDir}/${file}`));
    const maze = parseMaz(bytes);
    writeFileSync(
      `${OUT}/mazes/${name}.json`,
      JSON.stringify({ name, size: maze.size, data: Array.from(maze.data) }),
    );
    writeFileSync(`${OUT}/mazes/${name}.txt`, mazeToAscii(maze));
    console.log(`  wrote mazes/${name}.json (size ${maze.size})`);
  }
}

main();
