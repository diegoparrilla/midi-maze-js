import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MAZE_FIELD_EMPTY, MAZE_FIELD_WALL, getMazeData, mazeToAscii, parseMaz } from './maze';

function loadFixture(name: string): Uint8Array {
  const url = new URL(`../assets-src/mazes/${name}`, import.meta.url);
  return new Uint8Array(readFileSync(fileURLToPath(url)));
}

describe('parseMaz', () => {
  it('reads the size from the ASCII header', () => {
    expect(parseMaz(loadFixture('midimaze.maz')).size).toBe(14);
    expect(parseMaz(loadFixture('bigstart.maz')).size).toBe(24);
  });

  it('matches an independent ASCII parse of the file (every file cell)', () => {
    for (const name of ['midimaze.maz', 'bigstart.maz', 'hudson.maz']) {
      const bytes = loadFixture(name);
      const maze = parseMaz(bytes);
      // Independent parse: split the raw text into lines and read chars directly.
      const lines = new TextDecoder().decode(bytes).split('\n');
      for (let y = 0; y <= maze.size; y++) {
        const row = lines[y + 1]!; // line 0 is the size header
        for (let x = 0; x <= maze.size; x++) {
          const expected = row[x] === 'X' ? MAZE_FIELD_WALL : MAZE_FIELD_EMPTY;
          expect(getMazeData(maze, y, x)).toBe(expected);
        }
      }
    }
  });

  it('has a solid wall border on the default maze', () => {
    const maze = parseMaz(loadFixture('midimaze.maz'));
    for (let x = 0; x <= maze.size; x++) {
      expect(getMazeData(maze, 0, x)).toBe(MAZE_FIELD_WALL);
      expect(getMazeData(maze, maze.size, x)).toBe(MAZE_FIELD_WALL);
    }
  });

  it('fills outside the maze with the 1x1 checkerboard', () => {
    const maze = parseMaz(loadFixture('midimaze.maz'));
    // Out-of-grid coords (get_maze_data): odd&odd -> empty, else wall.
    expect(getMazeData(maze, -1, -1)).toBe(MAZE_FIELD_EMPTY);
    expect(getMazeData(maze, -1, 0)).toBe(MAZE_FIELD_WALL);
    expect(getMazeData(maze, 64, 64)).toBe(MAZE_FIELD_WALL);
    // In-grid but beyond the file region is the same checkerboard.
    expect(getMazeData(maze, 63, 63)).toBe(MAZE_FIELD_EMPTY);
    expect(getMazeData(maze, 62, 63)).toBe(MAZE_FIELD_WALL);
  });

  it('flipped access swaps axes', () => {
    const maze = parseMaz(loadFixture('bigstart.maz'));
    for (let y = 0; y <= maze.size; y++) {
      for (let x = 0; x <= maze.size; x++) {
        expect(getMazeData(maze, y, x, true)).toBe(getMazeData(maze, x, y, false));
      }
    }
  });

  it('produces a square ASCII dump', () => {
    const ascii = mazeToAscii(parseMaz(loadFixture('midimaze.maz')));
    const rows = ascii.split('\n');
    expect(rows).toHaveLength(15); // size 14 -> cells 0..14
    expect(rows.every((r) => r.length === 15)).toBe(true);
  });
});
