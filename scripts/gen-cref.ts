// Compile and run the C reference harness, writing golden vectors to
// src/sim/golden/primitives.json. Generates a maze-fixture header so the C and
// the TypeScript share the exact same grid. Requires cc. Run: npm run cref
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

// Shared placement fixture parameters (the TS golden test reads these back from JSON).
const FIXTURE_MAZE = 'midimaze';
const PLACEMENT_SEED = 1234;
const PLACEMENT_COUNT = 6;

const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));
const src = here('cref/mmref.c');
const outDir = here('../src/sim/golden');
const work = `${tmpdir()}/mmref-build`;
mkdirSync(work, { recursive: true });

const maze = JSON.parse(
  readFileSync(here(`../src/assets/generated/mazes/${FIXTURE_MAZE}.json`), 'utf8'),
) as { size: number; data: number[] };

writeFileSync(
  `${work}/maze_fixture.h`,
  [
    `#define MAZE_FIXTURE_SIZE ${maze.size}`,
    `#define MAZE_FIXTURE_NAME "${FIXTURE_MAZE}"`,
    `#define PLACEMENT_SEED ${PLACEMENT_SEED}`,
    `#define PLACEMENT_COUNT ${PLACEMENT_COUNT}`,
    `static const signed char maze_fixture[${maze.data.length}] = {${maze.data.join(',')}};`,
    '',
  ].join('\n'),
);

const bin = `${work}/mmref`;
execFileSync('cc', ['-O2', '-w', `-I${work}`, '-o', bin, src, '-lm'], { stdio: 'inherit' });
const json = execFileSync(bin, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
JSON.parse(json); // fail loudly on malformed JSON
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/primitives.json`, json);
console.log(`wrote src/sim/golden/primitives.json (${json.length} bytes)`);
