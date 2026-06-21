import { describe, expect, it } from 'vitest';
import type { Maze } from '../maze';
import { Rng } from '../sim/rng';
import { GAME_WIN_SCORE, World } from '../sim/world';
import { findWinner, GameFlow, GAMEOVER_TICKS, PREVIEW_TICKS } from './flow';

const dummyMaze: Maze = { size: 1, data: new Int8Array(1), defect: false };

function makeWorld(count: number): World {
  const w = new World(dummyMaze, new Rng(0));
  w.playerAndDroneCount = count;
  w.weDontHaveAWinner = 1;
  return w;
}

describe('findWinner', () => {
  it('returns -1 when nobody has reached the win score', () => {
    const w = makeWorld(3);
    w.players[0]!.ply_score = 9;
    expect(findWinner(w)).toBe(-1);
  });

  it('returns the index of the player at GAME_WIN_SCORE', () => {
    const w = makeWorld(3);
    w.players[2]!.ply_score = GAME_WIN_SCORE;
    expect(findWinner(w)).toBe(2);
  });

  it('uses team scores in team mode', () => {
    const w = makeWorld(4);
    w.teamFlag = 1;
    w.players[3]!.ply_team = 2;
    w.teamScores[2] = GAME_WIN_SCORE;
    expect(findWinner(w)).toBe(3);
  });
});

describe('GameFlow', () => {
  it('starts in preview and does not step the sim until the timer elapses', () => {
    const w = makeWorld(2);
    const flow = new GameFlow();
    expect(flow.phase).toBe('preview');
    for (let i = 0; i < PREVIEW_TICKS - 1; i++) {
      expect(flow.tick(w)).toBe(false);
      expect(flow.phase).toBe('preview');
    }
    // final preview tick flips to playing (still no step this frame)
    expect(flow.tick(w)).toBe(false);
    expect(flow.phase).toBe('playing');
  });

  it('steps the sim while playing and stops when a winner appears', () => {
    const w = makeWorld(2);
    const flow = new GameFlow();
    flow.phase = 'playing';
    flow.timer = 0;
    expect(flow.tick(w)).toBe(true); // playing -> step the sim

    // a winning shot lands: sim clears the flag and sets the score
    w.weDontHaveAWinner = 0;
    w.players[1]!.ply_score = GAME_WIN_SCORE;
    expect(flow.tick(w)).toBe(false);
    expect(flow.phase).toBe('gameover');
    expect(flow.winner).toBe(1);
    expect(flow.timer).toBe(GAMEOVER_TICKS);
  });

  it('holds the game-over screen, then allows restart back to preview', () => {
    const w = makeWorld(2);
    const flow = new GameFlow();
    flow.phase = 'gameover';
    flow.timer = GAMEOVER_TICKS;
    flow.winner = 1;
    expect(flow.canRestart()).toBe(false);
    for (let i = 0; i < GAMEOVER_TICKS; i++) flow.tick(w);
    expect(flow.canRestart()).toBe(true);

    flow.restart();
    expect(flow.phase).toBe('preview');
    expect(flow.timer).toBe(PREVIEW_TICKS);
    expect(flow.winner).toBe(-1);
  });
});
