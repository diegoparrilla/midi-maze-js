// Solo game-flow controller (maingame.c solo path): map preview -> play -> game
// over -> restart. Pure logic, no DOM, so it is unit-testable. The win *condition*
// is the sim's golden-tested `weDontHaveAWinner` flag; this only sequences phases.
import { GAME_WIN_SCORE, type World } from '../sim/world';

export type Phase = 'lobby' | 'preview' | 'playing' | 'gameover';

// Faithful-ish frame budgets at ~60fps. The original shows the start map for ~300
// Vsync frames (maingame.c:218) before play; the game-over screen holds briefly
// before accepting a restart.
export const PREVIEW_TICKS = 300;
export const GAMEOVER_TICKS = 180;

/**
 * findWinner: index of the player whose score (team-aware) reached GAME_WIN_SCORE,
 * or -1 if there is no winner yet. Mirrors maingame.c:496-499 (first match wins).
 */
export function findWinner(world: World): number {
  for (let i = 0; i < world.playerAndDroneCount; i++) {
    const score = world.teamFlag
      ? world.teamScores[world.players[i]!.ply_team]!
      : world.players[i]!.ply_score;
    if (score === GAME_WIN_SCORE) return i;
  }
  return -1;
}

/**
 * One-frame-at-a-time flow controller. The caller drives it: each frame call
 * `tick(world)` first; if it returns true, advance the sim (`step`) this frame.
 * Render according to `phase`. On `gameover`, once `canRestart()` is true and the
 * player presses a key, the caller resets the world and calls `restart()`.
 */
export class GameFlow {
  // Lobby-first: the player configures a game and presses Start (EPIC-20).
  phase: Phase = 'lobby';
  timer = 0;
  /** Winning player index once `phase === 'gameover'`, else -1. */
  winner = -1;

  /** Leave the lobby and begin a configured game (caller has built the world). */
  startGame(): void {
    this.phase = 'preview';
    this.timer = PREVIEW_TICKS;
    this.winner = -1;
  }

  /** Advance the flow before rendering. Returns true if the sim should be stepped. */
  tick(world: World): boolean {
    switch (this.phase) {
      case 'lobby':
        return false;
      case 'preview':
        if (--this.timer <= 0) {
          this.phase = 'playing';
        }
        return false;
      case 'playing':
        // The winning shot set weDontHaveAWinner=0 on the previous step.
        if (world.weDontHaveAWinner === 0) {
          this.winner = findWinner(world);
          this.phase = 'gameover';
          this.timer = GAMEOVER_TICKS;
          return false;
        }
        return true;
      case 'gameover':
        if (this.timer > 0) this.timer--;
        return false;
    }
  }

  /** True once the game-over screen has been shown long enough to accept a restart. */
  canRestart(): boolean {
    return this.phase === 'gameover' && this.timer <= 0;
  }

  /** Back to the lobby after a finished game (the caller shows the lobby UI). */
  restart(): void {
    this.phase = 'lobby';
    this.timer = 0;
    this.winner = -1;
  }
}
