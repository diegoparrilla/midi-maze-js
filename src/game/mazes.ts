// Registry of the vendored mazes (extracted in EPIC-03) the lobby can pick from.
// Maps a stable id to its loaded grid. Custom .MAZ upload is out of scope (EPIC-20).
import bigstart from '../assets/generated/mazes/bigstart.json';
import hudson from '../assets/generated/mazes/hudson.json';
import midimaze from '../assets/generated/mazes/midimaze.json';
import type { Maze } from '../maze';

interface RawMaze {
  size: number;
  data: number[];
}

function toMaze(raw: RawMaze): Maze {
  return { size: raw.size, data: Int8Array.from(raw.data), defect: false };
}

export interface MazeOption {
  id: string;
  label: string;
}

/** Selectable mazes, in lobby display order. */
export const MAZE_OPTIONS: readonly MazeOption[] = [
  { id: 'midimaze', label: 'MIDI MAZE' },
  { id: 'hudson', label: 'HUDSON' },
  { id: 'bigstart', label: 'BIG START' },
];

const RAW: Record<string, RawMaze> = {
  midimaze: midimaze as RawMaze,
  hudson: hudson as RawMaze,
  bigstart: bigstart as RawMaze,
};

export const DEFAULT_MAZE_ID = 'midimaze';

/** Load a maze by id, falling back to the default for an unknown id. */
export function loadMazeById(id: string): Maze {
  return toMaze(RAW[id] ?? RAW[DEFAULT_MAZE_ID]!);
}
