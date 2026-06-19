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
