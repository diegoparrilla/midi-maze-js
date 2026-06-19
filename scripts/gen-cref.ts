// Compile and run the C reference harness, writing golden vectors to
// src/sim/golden/primitives.json. Requires a C compiler (cc). Run: npm run cref
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));
const src = here('cref/mmref.c');
const outDir = here('../src/sim/golden');
const bin = `${tmpdir()}/mmref`;

execFileSync('cc', ['-O2', '-w', '-o', bin, src, '-lm'], { stdio: 'inherit' });
const json = execFileSync(bin, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
JSON.parse(json); // fail loudly if the harness emitted malformed JSON
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/primitives.json`, json);
console.log(`wrote src/sim/golden/primitives.json (${json.length} bytes)`);
