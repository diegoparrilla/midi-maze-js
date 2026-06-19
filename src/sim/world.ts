// Mutable runtime world: the working maze grid + object bookkeeping + players +
// shared RNG. Mirrors the global state in maze_obj.c / gamelogi.c so the sim can
// place and move objects exactly like the original.
import { MAZE_FIELD_EMPTY, MAZE_FIELD_WALL, MAZE_MAX_SIZE, type Maze } from '../maze';
import { createPlayer, type Player } from './player';
import { Rng } from './rng';

export const MAZE_FIELD_SHIFT = 7; // 1<<7 == MAZE_CELL_SIZE/2
export const PLAYER_MAX_COUNT = 16;
export const PLAYER_MAX_LIVES = 3;
export const GAME_WIN_SCORE = 10;

export const PLAYER_DIR_NORTH = 0x00;
export const PLAYER_DIR_EAST = 0x40;
export const PLAYER_DIR_SOUTH = 0x80;
export const PLAYER_DIR_WEST = 0xc0;

interface ObjectSlot {
  y: number;
  x: number;
  index: number;
}

export class World {
  /** Working copy of maze_datas (mutated as objects are placed). */
  readonly grid: Int8Array;
  readonly mazeSize: number;
  readonly players: Player[];
  readonly rng: Rng;
  playerAndDroneCount = 0;
  weDontHaveAWinner = 0;
  objektAnz = 0;
  readonly objectTable: ObjectSlot[];

  constructor(maze: Maze, rng: Rng) {
    this.grid = Int8Array.from(maze.data);
    this.mazeSize = maze.size;
    this.rng = rng;
    this.players = Array.from({ length: PLAYER_MAX_COUNT }, createPlayer);
    this.objectTable = Array.from({ length: PLAYER_MAX_COUNT * 2 }, () => ({
      y: 0,
      x: 0,
      index: 0,
    }));
  }

  /** get_maze_data: out-of-grid returns the 1x1 checkerboard; `flipped` swaps axes. */
  getMazeData(fieldY: number, fieldX: number, flipped = false): number {
    if (fieldY < 0 || fieldY > MAZE_MAX_SIZE - 1 || fieldX < 0 || fieldX > MAZE_MAX_SIZE - 1) {
      return fieldY & fieldX & 1 ? MAZE_FIELD_EMPTY : MAZE_FIELD_WALL;
    }
    return flipped
      ? this.grid[fieldX * MAZE_MAX_SIZE + fieldY]!
      : this.grid[fieldY * MAZE_MAX_SIZE + fieldX]!;
  }

  /** set_maze_data: ignores out-of-grid writes. */
  setMazeData(fieldY: number, fieldX: number, val: number): void {
    if (fieldY < 0 || fieldY > MAZE_MAX_SIZE - 1 || fieldX < 0 || fieldX > MAZE_MAX_SIZE - 1)
      return;
    this.grid[fieldY * MAZE_MAX_SIZE + fieldX] = val;
  }

  /**
   * set_object: place object `index` (0..15 player, 16..31 shot) at unit coords
   * (y,x). Empty cell → write the index and record it; occupied cell → append to
   * that cell's object linked list (ply_plist / ply_slist).
   */
  setObject(newObjectIndex: number, y: number, x: number): void {
    const fieldY = (y >> MAZE_FIELD_SHIFT) | 1;
    const fieldX = (x >> MAZE_FIELD_SHIFT) | 1;
    let cell = this.getMazeData(fieldY, fieldX);
    if (cell === MAZE_FIELD_EMPTY) {
      this.setMazeData(fieldY, fieldX, newObjectIndex);
      const slot = this.objectTable[this.objektAnz]!;
      slot.y = fieldY;
      slot.x = fieldX;
      slot.index = newObjectIndex;
      this.objektAnz++;
      return;
    }
    for (;;) {
      const next =
        cell < PLAYER_MAX_COUNT
          ? this.players[cell]!.ply_plist
          : this.players[cell - PLAYER_MAX_COUNT]!.ply_slist;
      if (next === MAZE_FIELD_EMPTY) break;
      cell = next;
    }
    if (cell < PLAYER_MAX_COUNT) this.players[cell]!.ply_plist = newObjectIndex;
    else this.players[cell - PLAYER_MAX_COUNT]!.ply_slist = newObjectIndex;
  }

  /** set_all_player: rebuild the maze object map from current player/shot positions. */
  setAllPlayer(): void {
    while (this.objektAnz > 0) {
      this.objektAnz--;
      const slot = this.objectTable[this.objektAnz]!;
      this.setMazeData(slot.y, slot.x, MAZE_FIELD_EMPTY);
    }
    for (let i = 0; i < this.playerAndDroneCount; i++) {
      const p = this.players[i]!;
      if (p.ply_lives > 0 || p.ply_hitflag) {
        this.setObject(i, p.ply_y, p.ply_x);
        p.ply_plist = MAZE_FIELD_EMPTY;
      }
      if (p.ply_shoot > 0) {
        this.setObject(i + PLAYER_MAX_COUNT, p.ply_shooty, p.ply_shootx);
        p.ply_slist = MAZE_FIELD_EMPTY;
      }
    }
  }
}
