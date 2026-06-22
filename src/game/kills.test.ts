import { describe, expect, it } from 'vitest';
import { KillLog } from './kills';

describe('KillLog', () => {
  it('records one victim per score increment, in order', () => {
    const k = new KillLog();
    k.update(0, 0); // no kills yet
    expect(k.victims).toEqual([]);
    k.update(1, 3); // killed player 3
    expect(k.victims).toEqual([3]);
    k.update(1, 3); // same score → no new face
    expect(k.victims).toEqual([3]);
    k.update(2, 5); // killed player 5
    expect(k.victims).toEqual([3, 5]);
  });

  it('fills the gap when the score jumps in one tick', () => {
    const k = new KillLog();
    k.update(2, 7); // two kills at once → both attributed to the last victim
    expect(k.victims).toEqual([7, 7]);
  });

  it('resets for a new game', () => {
    const k = new KillLog();
    k.update(3, 1);
    k.reset();
    expect(k.victims).toEqual([]);
    k.update(1, 2);
    expect(k.victims).toEqual([2]);
  });
});
