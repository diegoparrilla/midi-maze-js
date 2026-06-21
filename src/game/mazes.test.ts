import { describe, expect, it } from 'vitest';
import { DEFAULT_MAZE_ID, loadMazeById, MAZE_OPTIONS } from './mazes';

describe('maze registry', () => {
  it('offers the three vendored mazes', () => {
    expect(MAZE_OPTIONS.map((m) => m.id)).toEqual(['midimaze', 'hudson', 'bigstart']);
  });

  it('loads a maze by id with a non-empty grid', () => {
    const m = loadMazeById('hudson');
    expect(m.size).toBeGreaterThan(0);
    expect(m.data.length).toBeGreaterThan(0);
  });

  it('falls back to the default maze for an unknown id', () => {
    const fallback = loadMazeById('does-not-exist');
    const def = loadMazeById(DEFAULT_MAZE_ID);
    expect(fallback.size).toBe(def.size);
    expect([...fallback.data]).toEqual([...def.data]);
  });
});
