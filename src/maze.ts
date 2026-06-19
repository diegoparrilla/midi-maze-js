// Maze model + .MAZ loader, faithful to the original game (loadmaze.c, maze_obj.c).
// The original MIDI Maze loads plain-ASCII .MAZ files (NOT the encrypted .MZE of
// MIDI Maze 2). See docs/epics/DECISIONS.md and EPIC-05.

/** Grid is always MAZE_MAX_SIZE x MAZE_MAX_SIZE; the file fills cells 0..size. */
export const MAZE_MAX_SIZE = 64;
/** Internal units per cell (globals.h). Positions are in 1/256-cell units. */
export const MAZE_CELL_SIZE = 256;
export const MAZE_FIELD_WALL = 1;
export const MAZE_FIELD_EMPTY = -1;

export interface Maze {
  /** Inner size from the file header (e.g. 14). Cells 0..size come from the file. */
  size: number;
  /** Row-major MAZE_MAX_SIZE*MAZE_MAX_SIZE grid of MAZE_FIELD_WALL / MAZE_FIELD_EMPTY. */
  data: Int8Array;
  /** True if the file had format issues (odd/odd not '.', or unknown chars). */
  defect: boolean;
}

const CH_0 = 0x30; // '0'
const CH_9 = 0x39; // '9'
const CH_CR = 0x0d; // '\r'
const CH_X = 0x58; // 'X'
const CH_DOT = 0x2e; // '.'

/**
 * Parse a .MAZ file (loadmaze.c). Layout: two ASCII size digits, a CR/LF, then
 * `size+1` rows each `size+1` chars of 'X' (wall) / '.' (empty) + line terminator.
 * Cells beyond `size` (up to 63) are filled with the 1x1 checkerboard the engine
 * uses outside the maze.
 */
export function parseMaz(bytes: Uint8Array): Maze {
  let pos = 0;
  const next = (): number => {
    if (pos >= bytes.length) throw new Error('.MAZ truncated');
    return bytes[pos++]!;
  };

  const d0 = next();
  const d1 = next();
  if (d0 < CH_0 || d0 > CH_9 || d1 < CH_0 || d1 > CH_9) {
    throw new Error('.MAZ header boo-boo: size is not two ASCII digits');
  }
  const size = (d0 - CH_0) * 10 + (d1 - CH_0);
  if (size > MAZE_MAX_SIZE) throw new Error(`.MAZ size ${size} exceeds ${MAZE_MAX_SIZE}`);

  // Skip the CR/LF after the size (one byte; a second if it was CR of a CRLF).
  if (next() === CH_CR) next();

  const data = new Int8Array(MAZE_MAX_SIZE * MAZE_MAX_SIZE);
  let defect = false;

  for (let y = 0; y < MAZE_MAX_SIZE; y++) {
    let line: Uint8Array | null = null;
    if (y <= size) {
      const lineLen = size + 2; // size+1 content chars + 1 terminator
      if (pos + lineLen > bytes.length) throw new Error('.MAZ: error reading line');
      line = bytes.subarray(pos, pos + lineLen);
      pos += lineLen;
      if (line[size + 1] === CH_CR) next(); // consume the LF of a CRLF row
    }
    for (let x = 0; x < MAZE_MAX_SIZE; x++) {
      if (y <= size && x <= size) {
        const c = line![x]!;
        if ((y & 1) === 1 && (x & 1) === 1 && c !== CH_DOT) defect = true;
        if (c === CH_X) data[y * MAZE_MAX_SIZE + x] = MAZE_FIELD_WALL;
        else if (c === CH_DOT) data[y * MAZE_MAX_SIZE + x] = MAZE_FIELD_EMPTY;
        else defect = true;
      } else {
        // Outside the maze: 1x1 boxes (checkerboard), so stray positions are walls.
        data[y * MAZE_MAX_SIZE + x] = y & x & 1 ? MAZE_FIELD_EMPTY : MAZE_FIELD_WALL;
      }
    }
  }

  return { size, data, defect };
}

/**
 * Read a cell (get_maze_data). Coordinates outside the grid return the 1x1
 * checkerboard. `flipped` swaps the axes (used by the renderer's symmetry).
 */
export function getMazeData(maze: Maze, y: number, x: number, flipped = false): number {
  if (y < 0 || y > MAZE_MAX_SIZE - 1 || x < 0 || x > MAZE_MAX_SIZE - 1) {
    return y & x & 1 ? MAZE_FIELD_EMPTY : MAZE_FIELD_WALL;
  }
  return flipped ? maze.data[x * MAZE_MAX_SIZE + y]! : maze.data[y * MAZE_MAX_SIZE + x]!;
}

/** ASCII dump of the file region (0..size) — 'X' wall, '.' empty — for debugging. */
export function mazeToAscii(maze: Maze): string {
  const rows: string[] = [];
  for (let y = 0; y <= maze.size; y++) {
    let row = '';
    for (let x = 0; x <= maze.size; x++) {
      row += getMazeData(maze, y, x) === MAZE_FIELD_WALL ? 'X' : '.';
    }
    rows.push(row);
  }
  return rows.join('\n');
}
