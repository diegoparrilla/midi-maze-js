// Ordered log of the players/drones the local player has killed, for the kills window
// (the "pop chart", popchart.c). The sim gives us the running kill count (`ply_score`)
// and the last victim (`ply_looser`); we snapshot the victim each time the count rises,
// matching the original's `add_one_smily(currentScore, ply_looser)` (maingame.c:339).

export class KillLog {
  /** Killed player indices, in kill order — one face per entry. */
  readonly victims: number[] = [];
  private count = 0;

  /**
   * Record any kills implied by a new score. `looser` is the player just killed (the
   * camera player's `ply_looser`). Multiple kills in one tick all attribute to `looser`
   * (the sim only tracks the last victim); a non-increasing score is a no-op.
   */
  update(score: number, looser: number): void {
    while (this.count < score) {
      this.victims.push(looser);
      this.count++;
    }
  }

  /** Clear the log for a new game (the window is erased at game start, maingame.c:178). */
  reset(): void {
    this.victims.length = 0;
    this.count = 0;
  }
}
