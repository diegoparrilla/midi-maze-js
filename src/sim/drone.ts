// Drone AI (drone.c). Deterministic — drones write player_joy_table[] — so each
// piece is golden-tested against the C, like the rest of the sim (C-02).
import { mulsDivs } from './fixed';
import { createPlayer, type Player } from './player';
import { MAZE_FIELD_EMPTY, MAZE_MAX_SIZE } from '../maze';
import { JOYSTICK_BUTTON, JOYSTICK_LEFT, JOYSTICK_RIGHT, JOYSTICK_UP } from './movement';
import { PLAYER_MOTION_ROTATE } from './speed-table';
import { rotate2d } from './trig';
import {
  MAZE_FIELD_SHIFT,
  PLAYER_DIR_EAST,
  PLAYER_DIR_NORTH,
  PLAYER_DIR_NORTHEAST,
  PLAYER_DIR_NORTHWEST,
  PLAYER_DIR_SOUTH,
  PLAYER_DIR_SOUTHEAST,
  PLAYER_DIR_SOUTHWEST,
  PLAYER_DIR_WEST,
  type World,
} from './world';

// Drone type tags (globals.h) — the original stores the menu key char code.
export const DRONE_TARGET = 114; // 'r' — wanders, never fires
export const DRONE_STANDARD = 108; // 'l' — chases + fires
export const DRONE_NINJA = 107; // 'k' — pathfinds
export const DRONE_TYPES = 3;

/**
 * calc_drone_angle_table: a 33-entry reverse lookup that turns a 0..32 X/Y ratio
 * into a viewing angle, used by the drone aiming code. Built from rotate2d, with
 * gaps filled from the previous entry.
 */
export function calcDroneAngleTable(): number[] {
  const table = new Array<number>(33).fill(-1);
  for (let i = 32; i >= 0; i--) {
    const [y, x] = rotate2d(1000, 0, i);
    table[mulsDivs(32, x, y)] = i;
  }
  for (let i = 0; i <= 32; i++) {
    if (table[i] === -1) table[i] = table[i - 1]!;
  }
  return table;
}

export const droneAngleTable: readonly number[] = calcDroneAngleTable();

/**
 * Assign drone types to the slots after the human players (maingame.c). Drones
 * are appended in type order: target, then standard, then ninja.
 */
export function assignDroneTypes(world: World, humanPlayers: number): void {
  const tags = [DRONE_TARGET, DRONE_STANDARD, DRONE_NINJA];
  let j = humanPlayers;
  for (let k = 0; k < DRONE_TYPES; k++) {
    for (let i = 0; world.activeDronesByType[k]! > i; i++) {
      world.players[j]!.dr_type = tags[k]!;
      j++;
    }
  }
}

/**
 * drone_setup: before a game, give every standard/ninja drone a current and a
 * permanent target. Team mode assigns a specific player from another team (round
 * robin); solo mode assigns a rotating human player (drones only attack humans).
 * Ported verbatim from drone.c — including its quirks (e.g. a target drone in
 * solo mode inherits dr_currentTarget = -1 from a stale enemy-list index).
 */
export function droneSetup(world: World, humanPlayers: number): void {
  const p = world.players;
  const team0: number[] = new Array<number>(18);
  const team1: number[] = new Array<number>(18);
  const team2: number[] = new Array<number>(18);
  const team3: number[] = new Array<number>(18);
  const humanSoloPlayerList: number[] = new Array<number>(18);

  let currentHumanSoloPlayer = 0;
  let team0Index = 0;
  let team1Index = 0;
  let team2Index = 0;
  let team3Index = 0;
  let team0HasMembers = false;
  let team1HasMembers = false;
  let team2HasMembers = false;
  let team3HasMembers = false;
  let team0Attackable = false;
  let team1Attackable = false;
  let team2Attackable = false;
  let team3Attackable = false;
  let teamCount = 0;

  const allPlayerCount =
    world.activeDronesByType[0]! +
    world.activeDronesByType[1]! +
    world.activeDronesByType[2]! +
    humanPlayers;

  const isShooter = (i: number) =>
    p[i]!.dr_type === DRONE_NINJA || p[i]!.dr_type === DRONE_STANDARD;

  if (world.teamFlag) {
    for (let playerIndex = 0; playerIndex < allPlayerCount; playerIndex++) {
      switch (p[playerIndex]!.ply_team) {
        case 0:
          team0[team0Index++] = playerIndex;
          break;
        case 1:
          team1[team1Index++] = playerIndex;
          break;
        case 2:
          team2[team2Index++] = playerIndex;
          break;
        case 3:
          team3[team3Index++] = playerIndex;
          break;
      }
    }
    team0[team0Index] = -1;
    team1[team1Index] = -1;
    team2[team2Index] = -1;
    team3[team3Index] = -1;

    if (team0[0] !== -1) {
      teamCount++;
      team0HasMembers = team0Attackable = true;
    }
    if (team1[0] !== -1) {
      teamCount++;
      team1HasMembers = team1Attackable = true;
    }
    if (team2[0] !== -1) {
      teamCount++;
      team2HasMembers = team2Attackable = true;
    }
    if (team3[0] !== -1) {
      teamCount++;
      team3HasMembers = team3Attackable = true;
    }

    if (teamCount === 1) {
      for (let playerIndex = 0; playerIndex < allPlayerCount; playerIndex++)
        p[playerIndex]!.dr_currentTarget = -1;
    } else {
      team0Index = team1Index = team2Index = team3Index = 0;
      for (let playerIndex = 0; playerIndex < allPlayerCount; playerIndex++) {
        switch (p[playerIndex]!.ply_team) {
          case 0:
            if (isShooter(playerIndex)) {
              if (team1HasMembers && team1Attackable) {
                if (team1[team1Index] === -1) team1Index = 0;
                p[playerIndex]!.dr_currentTarget = team1[team1Index++]!;
                if (team2HasMembers || team3HasMembers) team1Attackable = false;
                if (team2HasMembers) team2Attackable = true;
                if (team3HasMembers) team3Attackable = true;
              } else if (team2HasMembers && team2Attackable) {
                if (team2[team2Index] === -1) team2Index = 0;
                p[playerIndex]!.dr_currentTarget = team2[team2Index++]!;
                if (team1HasMembers || team3HasMembers) team2Attackable = false;
                if (team3HasMembers) team3Attackable = true;
                else if (team1HasMembers) team1Attackable = true;
              } else if (team3HasMembers && team3Attackable) {
                if (team3[team3Index] === -1) team3Index = 0;
                p[playerIndex]!.dr_currentTarget = team3[team3Index++]!;
                if (team1HasMembers || team2HasMembers) team3Attackable = false;
                if (team1HasMembers) team1Attackable = true;
                if (team2HasMembers) team2Attackable = true;
              }
              p[playerIndex]!.dr_permanentTarget = p[playerIndex]!.dr_currentTarget;
            }
            break;
          case 1:
            if (isShooter(playerIndex)) {
              if (team0HasMembers && team0Attackable) {
                if (team0[team0Index] === -1) team0Index = 0;
                p[playerIndex]!.dr_currentTarget = team0[team0Index++]!;
                if (team3HasMembers || team2HasMembers) team0Attackable = false;
                if (team3HasMembers) team3Attackable = true;
                if (team2HasMembers) team2Attackable = true;
              } else if (team2HasMembers && team2Attackable) {
                if (team2[team2Index] === -1) team2Index = 0;
                p[playerIndex]!.dr_currentTarget = team2[team2Index++]!;
                if (team0HasMembers || team3HasMembers) team2Attackable = false;
                if (team3HasMembers) team3Attackable = true;
                else if (team0HasMembers) team0Attackable = true;
              } else if (team3HasMembers && team3Attackable) {
                if (team3[team3Index] === -1) team3Index = 0;
                p[playerIndex]!.dr_currentTarget = team3[team3Index++]!;
                if (team0HasMembers || team2HasMembers) team3Attackable = false;
                if (team0HasMembers) team0Attackable = true;
                if (team2HasMembers) team2Attackable = true;
              }
              p[playerIndex]!.dr_permanentTarget = p[playerIndex]!.dr_currentTarget;
            }
            break;
          case 2:
            if (isShooter(playerIndex)) {
              if (team1HasMembers && team1Attackable) {
                if (team1[team1Index] === -1) team1Index = 0;
                p[playerIndex]!.dr_currentTarget = team1[team1Index++]!;
                if (team0HasMembers || team3HasMembers) team1Attackable = false;
                if (team0HasMembers) team0Attackable = true;
                if (team3HasMembers) team3Attackable = true;
              } else if (team0HasMembers && team0Attackable) {
                if (team0[team0Index] === -1) team0Index = 0;
                p[playerIndex]!.dr_currentTarget = team0[team0Index++]!;
                if (team1HasMembers || team3HasMembers) team0Attackable = false;
                if (team3HasMembers) team3Attackable = true;
                else if (team1HasMembers) team1Attackable = true;
              } else if (team3HasMembers && team3Attackable) {
                if (team3[team3Index] === -1) team3Index = 0;
                p[playerIndex]!.dr_currentTarget = team3[team3Index++]!;
                if (team0HasMembers || team1HasMembers) team3Attackable = false;
                if (team0HasMembers) team0Attackable = true;
                if (team1HasMembers) team1Attackable = true;
              }
              p[playerIndex]!.dr_permanentTarget = p[playerIndex]!.dr_currentTarget;
            }
            break;
          case 3:
            if (isShooter(playerIndex)) {
              if (team1HasMembers && team1Attackable) {
                if (team1[team1Index] === -1) team1Index = 0;
                p[playerIndex]!.dr_currentTarget = team1[team1Index++]!;
                if (team2HasMembers || team0HasMembers) team1Attackable = false;
                if (team2HasMembers) team2Attackable = true;
                if (team0HasMembers) team0Attackable = true;
              } else if (team2HasMembers && team2Attackable) {
                if (team2[team2Index] === -1) team2Index = 0;
                p[playerIndex]!.dr_currentTarget = team2[team2Index++]!;
                if (team0HasMembers || team1HasMembers) team2Attackable = false;
                if (team0HasMembers) team0Attackable = true;
                else if (team1HasMembers) team1Attackable = true;
              } else if (team0HasMembers && team0Attackable) {
                if (team0[team0Index] === -1) team0Index = 0;
                p[playerIndex]!.dr_currentTarget = team0[team0Index++]!;
                if (team1HasMembers || team2HasMembers) team0Attackable = false;
                if (team1HasMembers) team1Attackable = true;
                if (team2HasMembers) team2Attackable = true;
              }
              p[playerIndex]!.dr_permanentTarget = p[playerIndex]!.dr_currentTarget;
            }
            break;
        }
      }
    }
  } else {
    let playerIndex = 0;
    for (playerIndex = 0; playerIndex < humanPlayers; playerIndex++)
      humanSoloPlayerList[playerIndex] = playerIndex;
    humanSoloPlayerList[playerIndex] = -1;

    for (playerIndex = humanPlayers; playerIndex < allPlayerCount; playerIndex++) {
      if (isShooter(playerIndex)) {
        for (team0Index = 0; humanSoloPlayerList[team0Index] !== -1; team0Index++)
          p[playerIndex]!.dr_humanEnemies[team0Index] = humanSoloPlayerList[team0Index]!;
      }
      p[playerIndex]!.dr_humanEnemies[team0Index] = -1;

      if (humanSoloPlayerList[currentHumanSoloPlayer] === -1) {
        currentHumanSoloPlayer = 0;
        p[playerIndex]!.dr_currentTarget = p[playerIndex]!.dr_humanEnemies[currentHumanSoloPlayer]!;
        p[playerIndex]!.dr_permanentTarget = p[playerIndex]!.dr_currentTarget;
      } else {
        p[playerIndex]!.dr_currentTarget =
          p[playerIndex]!.dr_humanEnemies[currentHumanSoloPlayer++]!;
        p[playerIndex]!.dr_permanentTarget = p[playerIndex]!.dr_currentTarget;
      }
    }
  }
}

// A drone with dr_currentTarget < 0 (a solo-mode target drone — drone.c's
// stale-index quirk in drone_setup) has no real target. The original then reads
// player_data[-1]; that struct's ply_y/ply_x sit ~120 bytes before player_data[0],
// in zero-initialised BSS (before the config shorts), so the original reads (0,0):
// the drone steers toward the top-left corner, deterministically and without ever
// freezing. We model that as a fixed ghost target at (0,0). This branch is
// unreachable when dr_currentTarget >= 0, so it leaves the golden traces faithful.
const NO_TARGET: Player = createPlayer();

/** Resolve a drone's target player; see NO_TARGET for the dr_currentTarget < 0 case. */
function droneTarget(world: World, p: Player): Player {
  return p.dr_currentTarget >= 0 ? world.players[p.dr_currentTarget]! : NO_TARGET;
}

// drone.c file-scope scratch flags, shared between the helpers below (mirrors the
// C statics). The sim runs one drone at a time, single-threaded, so this is safe.
let droneCanNorth = false;
let droneCanSouth = false;
let droneCanEast = false;
let droneCanWest = false;
let droneNeeds2GoNorth = false;
let droneNeeds2GoSouth = false;
let droneNeeds2GoEast = false;
let droneNeeds2GoWest = false;

interface Dirs {
  n: boolean;
  s: boolean;
  e: boolean;
  w: boolean;
}

/**
 * drone_check_directions: which of the 4 neighbouring cells are open. The ninja
 * planner also calls it with explicit field coords (useAltCoord), so this returns
 * the flags; callers either store them locally or copy them into the module flags.
 */
function droneCheckDirsAt(
  world: World,
  player: number,
  useAltCoord: boolean,
  altYField: number,
  altXField: number,
): Dirs {
  let yField: number;
  let xField: number;
  if (!useAltCoord) {
    const p = world.players[player]!;
    yField = (p.ply_y >> MAZE_FIELD_SHIFT) | 1;
    xField = (p.ply_x >> MAZE_FIELD_SHIFT) | 1;
  } else {
    yField = altYField;
    xField = altXField;
  }
  return {
    n: world.getMazeData(yField - 1, xField) === MAZE_FIELD_EMPTY,
    s: world.getMazeData(yField + 1, xField) === MAZE_FIELD_EMPTY,
    w: world.getMazeData(yField, xField - 1) === MAZE_FIELD_EMPTY,
    e: world.getMazeData(yField, xField + 1) === MAZE_FIELD_EMPTY,
  };
}

/** drone_check_directions writing the module-level can-go flags (player coords). */
function droneCheckDirections(world: World, player: number): void {
  const d = droneCheckDirsAt(world, player, false, 0, 0);
  droneCanNorth = d.n;
  droneCanSouth = d.s;
  droneCanEast = d.e;
  droneCanWest = d.w;
}

/** drone_delta_into_direction: angle (0..255, 0 = north) towards a deltaY/deltaX. */
function droneDeltaIntoDirection(deltaY: number, deltaX: number): number {
  const deltaYIsPositive = deltaY >= 0 ? 1 : 0;
  deltaY = Math.abs(deltaY);
  const deltaXIsPositive = deltaX >= 0 ? 1 : 0;
  deltaX = Math.abs(deltaX);
  let angle: number;
  if (deltaX <= deltaY) angle = droneAngleTable[mulsDivs(32, deltaX, deltaY)]!;
  else angle = 64 - droneAngleTable[mulsDivs(32, deltaY, deltaX)]!;
  switch ((deltaYIsPositive << 1) + deltaXIsPositive) {
    case 0:
      angle += 128;
      break;
    case 1:
      angle = 128 - angle;
      break;
    case 2:
      angle = 256 - angle;
      break;
    case 3:
      break;
  }
  return (128 - angle) & 0xff;
}

/** drone_aim2target: turn to face the target if within ~3 fields and alive. */
function droneAim2target(world: World, player: number): boolean {
  const p = world.players[player]!;
  const t = droneTarget(world, p);
  const deltaY = t.ply_y - p.ply_y;
  const deltaX = t.ply_x - p.ply_x;
  if (Math.abs(deltaY) > 800 || Math.abs(deltaX) > 800 || t.ply_lives <= 0) return false;
  if (!p.dr_targetLocked) p.dr_fireDirection = p.ply_dir;
  p.ply_dir = droneDeltaIntoDirection(deltaY, deltaX);
  return true;
}

// drone_isTargetIsVisible{North,South,East,West}: line-of-sight along an axis.
// fieldY/fieldX override the player's own field (the ninja planner scans from
// hypothetical positions); 0 means "use the player's current field".
function droneVisibleNorth(world: World, player: number, fieldY = 0, fieldX = 0): boolean {
  const p = world.players[player]!;
  const t = droneTarget(world, p);
  if (t.ply_lives <= 0) return false;
  const targetFieldY = (t.ply_y >> MAZE_FIELD_SHIFT) | 1;
  const targetFieldX = (t.ply_x >> MAZE_FIELD_SHIFT) | 1;
  let playerFieldY = fieldY ? fieldY : (p.ply_y >> MAZE_FIELD_SHIFT) | 1;
  const playerFieldX = fieldX ? fieldX : (p.ply_x >> MAZE_FIELD_SHIFT) | 1;
  if (targetFieldX !== playerFieldX || playerFieldY < targetFieldY) return false;
  if (playerFieldY <= 1) return false;
  if (targetFieldX === playerFieldX && targetFieldY === playerFieldY) return true;
  while (
    world.getMazeData(playerFieldY - 1, playerFieldX) === MAZE_FIELD_EMPTY &&
    targetFieldY !== playerFieldY
  ) {
    playerFieldY -= 2;
    if (playerFieldY === 0) break;
  }
  return targetFieldY === playerFieldY;
}

function droneVisibleSouth(world: World, player: number, fieldY = 0, fieldX = 0): boolean {
  const p = world.players[player]!;
  const t = droneTarget(world, p);
  if (t.ply_lives <= 0) return false;
  const targetFieldY = (t.ply_y >> MAZE_FIELD_SHIFT) | 1;
  const targetFieldX = (t.ply_x >> MAZE_FIELD_SHIFT) | 1;
  let playerFieldY = fieldY ? fieldY : (p.ply_y >> MAZE_FIELD_SHIFT) | 1;
  const playerFieldX = fieldX ? fieldX : (p.ply_x >> MAZE_FIELD_SHIFT) | 1;
  if (targetFieldX !== playerFieldX || playerFieldY > targetFieldY) return false;
  if (playerFieldY > MAZE_MAX_SIZE - 1) return false;
  if (targetFieldX === playerFieldX && targetFieldY === playerFieldY) return true;
  while (
    world.getMazeData(playerFieldY + 1, playerFieldX) === MAZE_FIELD_EMPTY &&
    targetFieldY !== playerFieldY
  ) {
    playerFieldY += 2;
    if (playerFieldY > MAZE_MAX_SIZE - 1) break;
  }
  return targetFieldY === playerFieldY;
}

function droneVisibleEast(world: World, player: number, fieldY = 0, fieldX = 0): boolean {
  const p = world.players[player]!;
  const t = droneTarget(world, p);
  if (t.ply_lives <= 0) return false;
  const targetFieldX = (t.ply_x >> MAZE_FIELD_SHIFT) | 1;
  const targetFieldY = (t.ply_y >> MAZE_FIELD_SHIFT) | 1;
  const playerFieldY = fieldY ? fieldY : (p.ply_y >> MAZE_FIELD_SHIFT) | 1;
  let playerFieldX = fieldX ? fieldX : (p.ply_x >> MAZE_FIELD_SHIFT) | 1;
  if (targetFieldY !== playerFieldY || targetFieldX < playerFieldX) return false;
  if (playerFieldX > MAZE_MAX_SIZE - 1) return false;
  if (targetFieldX === playerFieldX && targetFieldY === playerFieldY) return true;
  while (
    world.getMazeData(playerFieldY, playerFieldX + 1) === MAZE_FIELD_EMPTY &&
    targetFieldX !== playerFieldX
  ) {
    playerFieldX += 2;
    if (playerFieldX > MAZE_MAX_SIZE - 1) break;
  }
  return targetFieldX === playerFieldX;
}

function droneVisibleWest(world: World, player: number, fieldY = 0, fieldX = 0): boolean {
  const p = world.players[player]!;
  const t = droneTarget(world, p);
  if (t.ply_lives <= 0) return false;
  const targetFieldX = (t.ply_x >> MAZE_FIELD_SHIFT) | 1;
  const targetFieldY = (t.ply_y >> MAZE_FIELD_SHIFT) | 1;
  const playerFieldY = fieldY ? fieldY : (p.ply_y >> MAZE_FIELD_SHIFT) | 1;
  let playerFieldX = fieldX ? fieldX : (p.ply_x >> MAZE_FIELD_SHIFT) | 1;
  if (targetFieldY !== playerFieldY || playerFieldX < targetFieldX) return false;
  if (playerFieldX <= 1) return false;
  if (targetFieldX === playerFieldX && targetFieldY === playerFieldY) return true;
  while (
    world.getMazeData(playerFieldY, playerFieldX - 1) === MAZE_FIELD_EMPTY &&
    targetFieldX !== playerFieldX
  ) {
    playerFieldX -= 2;
    if (playerFieldX === 0) break;
  }
  return targetFieldX === playerFieldX;
}

/** drone_set_position: snap an idle drone onto a field centre facing an open way. */
function droneSetPosition(world: World, player: number, dir: string): void {
  const p = world.players[player]!;
  const playerFieldY = (p.ply_y >> MAZE_FIELD_SHIFT) | 1;
  const playerFieldX = (p.ply_x >> MAZE_FIELD_SHIFT) | 1;
  const snap = (facing: number) => {
    p.ply_dir = facing;
    p.ply_y = playerFieldY << MAZE_FIELD_SHIFT;
    p.ply_x = playerFieldX << MAZE_FIELD_SHIFT;
    world.setObject(player, p.ply_y, p.ply_x);
    p.ply_plist = MAZE_FIELD_EMPTY;
  };
  switch (dir) {
    case 'n':
      snap(PLAYER_DIR_NORTH);
      droneCanSouth = droneCanEast = droneCanWest = false;
      droneCanNorth = true;
      break;
    case 's':
      snap(PLAYER_DIR_SOUTH);
      droneCanNorth = droneCanEast = droneCanWest = false;
      droneCanSouth = true;
      break;
    case 'e':
      snap(PLAYER_DIR_EAST);
      droneCanNorth = droneCanSouth = droneCanWest = false;
      droneCanEast = true;
      break;
    case 'w':
      snap(PLAYER_DIR_WEST);
      droneCanNorth = droneCanSouth = droneCanEast = false;
      droneCanWest = true;
      break;
  }
}

// drone movement primitives — each writes the generated joystick byte.
function droneMoveUpright(world: World, player: number, joy: number[]): void {
  const p = world.players[player]!;
  p.dr_upRotationCounter = 256 / PLAYER_MOTION_ROTATE / 8 - 1;
  joy[player] = p.dr_joystick = p.dr_targetLocked
    ? JOYSTICK_BUTTON | JOYSTICK_RIGHT | JOYSTICK_UP
    : JOYSTICK_RIGHT | JOYSTICK_UP;
}

function droneMoveUpleft(world: World, player: number, joy: number[]): void {
  const p = world.players[player]!;
  p.dr_upRotationCounter = 256 / PLAYER_MOTION_ROTATE / 8 - 1;
  joy[player] = p.dr_joystick = p.dr_targetLocked
    ? JOYSTICK_BUTTON | JOYSTICK_LEFT | JOYSTICK_UP
    : JOYSTICK_LEFT | JOYSTICK_UP;
}

function droneMoveUp(world: World, player: number, joy: number[]): void {
  const p = world.players[player]!;
  joy[player] = p.dr_joystick = p.dr_targetLocked ? JOYSTICK_BUTTON | JOYSTICK_UP : JOYSTICK_UP;
}

function droneTurnAround(world: World, player: number, joy: number[]): void {
  const p = world.players[player]!;
  p.dr_rotateCounter = 256 / PLAYER_MOTION_ROTATE / 2 - 1;
  joy[player] = p.dr_joystick = p.dr_targetLocked
    ? JOYSTICK_BUTTON | JOYSTICK_RIGHT
    : JOYSTICK_RIGHT;
}

/**
 * drone_sub_findMoveToTarget: cheat-ish steering — the drone knows where its
 * target is and turns towards it through open neighbouring cells.
 */
function droneSubFindMoveToTarget(world: World, player: number): void {
  const p = world.players[player]!;
  droneNeeds2GoNorth = droneNeeds2GoSouth = droneNeeds2GoEast = droneNeeds2GoWest = false;
  droneCanNorth = droneCanSouth = droneCanEast = droneCanWest = false;
  const t = droneTarget(world, p);
  const playerY = p.ply_y;
  const playerX = p.ply_x;
  const targetY = t.ply_y;
  const targetX = t.ply_x;
  p.dr_targetLocked = 0;
  p.dr_fireDirection = -1;
  const targetDistanceY = targetY - playerY;
  const targetDistanceX = targetX - playerX;
  droneCheckDirections(world, player);
  if (targetDistanceY === 0) {
    if (targetDistanceX < 0 && droneCanWest) droneNeeds2GoWest = true;
    else if (targetDistanceX > 0 && droneCanEast) droneNeeds2GoEast = true;
  } else if (targetDistanceX === 0) {
    if (targetDistanceY < 0 && droneCanNorth) droneNeeds2GoNorth = true;
    else if (targetDistanceY > 0 && droneCanSouth) droneNeeds2GoSouth = true;
  } else {
    if (targetDistanceY < 0) {
      if (droneCanNorth) droneNeeds2GoNorth = true;
      else if (targetDistanceX < 0 && droneCanWest) droneNeeds2GoWest = true;
      else if (targetDistanceX > 0 && droneCanEast) droneNeeds2GoEast = true;
    } else if (targetDistanceY > 0) {
      if (droneCanSouth) droneNeeds2GoSouth = true;
      else if (targetDistanceX < 0 && droneCanWest) droneNeeds2GoWest = true;
      else if (targetDistanceX > 0 && droneCanEast) droneNeeds2GoEast = true;
    }
  }
  if (
    !droneNeeds2GoNorth &&
    !droneNeeds2GoSouth &&
    !droneNeeds2GoEast &&
    !droneNeeds2GoWest &&
    !p.dr_dir[0]
  ) {
    if (p.ply_dir > PLAYER_DIR_NORTH && p.ply_dir <= PLAYER_DIR_NORTHEAST && droneCanNorth) {
      p.ply_dir = PLAYER_DIR_NORTH;
      droneNeeds2GoNorth = true;
    } else if (
      p.ply_dir > PLAYER_DIR_NORTHEAST &&
      p.ply_dir <= PLAYER_DIR_SOUTHEAST &&
      droneCanEast
    ) {
      p.ply_dir = PLAYER_DIR_EAST;
      droneNeeds2GoEast = true;
    } else if (
      p.ply_dir > PLAYER_DIR_SOUTHEAST &&
      p.ply_dir <= PLAYER_DIR_SOUTHWEST &&
      droneCanSouth
    ) {
      p.ply_dir = PLAYER_DIR_SOUTH;
      droneNeeds2GoSouth = true;
    } else if (
      p.ply_dir > PLAYER_DIR_SOUTHWEST &&
      p.ply_dir <= PLAYER_DIR_NORTHWEST &&
      droneCanWest
    ) {
      p.ply_dir = PLAYER_DIR_WEST;
      droneNeeds2GoWest = true;
    } else if (
      p.ply_dir > PLAYER_DIR_NORTHWEST &&
      p.ply_dir < PLAYER_DIR_NORTH + 256 &&
      droneCanNorth
    ) {
      p.ply_dir = PLAYER_DIR_NORTH;
      droneNeeds2GoNorth = true;
    }
  }
  if (p.dr_dir[0]) return;
  if (droneNeeds2GoNorth) {
    p.ply_dir = PLAYER_DIR_NORTH;
    droneCanSouth = droneCanEast = droneCanWest = false;
    droneCanNorth = true;
    return;
  }
  if (droneNeeds2GoSouth) {
    p.ply_dir = PLAYER_DIR_SOUTH;
    droneCanNorth = droneCanEast = droneCanWest = false;
    droneCanSouth = true;
    return;
  }
  if (droneNeeds2GoEast) {
    p.ply_dir = PLAYER_DIR_EAST;
    droneCanNorth = droneCanSouth = droneCanWest = false;
    droneCanEast = true;
    return;
  }
  if (droneNeeds2GoWest) {
    p.ply_dir = PLAYER_DIR_WEST;
    droneCanNorth = droneCanSouth = droneCanEast = false;
    droneCanWest = true;
  }
}

/**
 * drone_move: basic targetless motion shared by all drone types. Returns true if
 * it already generated a joystick value (a pending rotation), false otherwise.
 */
function droneMove(world: World, player: number, joy: number[]): boolean {
  const p = world.players[player]!;
  const joystickMaskAlwaysZero = 0x00;
  if (p.dr_targetLocked) return false;
  if (p.dr_isInactive && !p.dr_targetLocked && p.dr_type === DRONE_NINJA && !p.dr_dir[0]) {
    p.dr_dir[0] = 0;
    p.dr_fieldIndex = 0;
    p.dr_isInactive = 0;
    p.dr_upRotationCounter = 0;
    p.dr_rotateCounter = 0;
    droneCheckDirections(world, player);
    if (droneCanNorth) droneSetPosition(world, player, 'n');
    else if (droneCanSouth) droneSetPosition(world, player, 's');
    else if (droneCanEast) droneSetPosition(world, player, 'e');
    else if (droneCanWest) droneSetPosition(world, player, 'w');
    return false;
  }
  if (p.dr_rotateCounter > 0) {
    p.dr_rotateCounter--;
    joy[player] = p.dr_joystick;
    return true;
  }
  if (p.dr_rotateCounter < 0) {
    p.dr_rotateCounter++;
    joy[player] = p.dr_joystick;
    return true;
  }
  if (p.dr_isInactive && p.dr_rotateCounter === 0) {
    if (p.ply_dir === PLAYER_DIR_NORTH || p.ply_dir === PLAYER_DIR_EAST) {
      p.dr_isInactive = 0;
      if (world.rng.rnd(256) & 1) {
        p.dr_rotateCounter = 256 / PLAYER_MOTION_ROTATE / 4 - 1;
        joy[player] = p.dr_joystick = joystickMaskAlwaysZero | JOYSTICK_RIGHT;
        // Same text as the `if` above, but each rnd() call advances the RNG (drone.c).
        // eslint-disable-next-line no-dupe-else-if
      } else if (world.rng.rnd(256) & 1) {
        p.dr_rotateCounter = -(256 / PLAYER_MOTION_ROTATE / 4 - 1);
        joy[player] = p.dr_joystick = joystickMaskAlwaysZero | JOYSTICK_LEFT;
      } else {
        p.dr_rotateCounter = 256 / PLAYER_MOTION_ROTATE / 2 - 2;
        joy[player] = p.dr_joystick = JOYSTICK_LEFT;
      }
    } else if (p.ply_dir === PLAYER_DIR_SOUTH || p.ply_dir === PLAYER_DIR_WEST) {
      p.dr_isInactive = 0;
      if (world.rng.rnd(256) & 1) {
        p.dr_rotateCounter = -(256 / PLAYER_MOTION_ROTATE / 4 - 1);
        joy[player] = p.dr_joystick = joystickMaskAlwaysZero | JOYSTICK_LEFT;
        // Same text as the `if` above, but each rnd() call advances the RNG (drone.c).
        // eslint-disable-next-line no-dupe-else-if
      } else if (world.rng.rnd(256) & 1) {
        p.dr_rotateCounter = 256 / PLAYER_MOTION_ROTATE / 4 - 1;
        joy[player] = p.dr_joystick = joystickMaskAlwaysZero | JOYSTICK_RIGHT;
      } else {
        p.dr_rotateCounter = 256 / PLAYER_MOTION_ROTATE / 2 - 2;
        joy[player] = p.dr_joystick = JOYSTICK_RIGHT;
      }
    } else {
      droneSubFindMoveToTarget(world, player);
      p.dr_isInactive = 0;
      return false;
    }
    return true;
  }
  if (p.dr_upRotationCounter) {
    joy[player] = p.dr_joystick;
    p.dr_upRotationCounter--;
    return true;
  }
  return false;
}

/** drone_generate_joystickdata: turn the can-go flags + facing into a joystick byte. */
function droneGenerateJoystickdata(world: World, player: number, joy: number[]): void {
  const p = world.players[player]!;
  const dir = p.ply_dir;
  if (p.dr_targetLocked) {
    joy[player] = JOYSTICK_BUTTON;
    return;
  }
  if (dir === PLAYER_DIR_NORTH && droneCanNorth) {
    if (p.dr_type === DRONE_TARGET) droneMoveUp(world, player, joy);
    else if (droneCanEast) droneMoveUpright(world, player, joy);
    else if (droneCanWest) droneMoveUpleft(world, player, joy);
    else droneMoveUp(world, player, joy);
    return;
  }
  if (dir === PLAYER_DIR_EAST && droneCanEast) {
    if (p.dr_type === DRONE_TARGET) droneMoveUp(world, player, joy);
    else if (droneCanSouth) droneMoveUpright(world, player, joy);
    else if (droneCanNorth) droneMoveUpleft(world, player, joy);
    else droneMoveUp(world, player, joy);
    return;
  }
  if (dir === PLAYER_DIR_SOUTH && droneCanSouth) {
    if (p.dr_type === DRONE_TARGET) droneMoveUp(world, player, joy);
    else if (droneCanEast) droneMoveUpleft(world, player, joy);
    else if (droneCanWest) droneMoveUpright(world, player, joy);
    else droneMoveUp(world, player, joy);
    return;
  }
  if (dir === PLAYER_DIR_WEST && droneCanWest) {
    if (p.dr_type === DRONE_TARGET) droneMoveUp(world, player, joy);
    else if (droneCanSouth) droneMoveUpleft(world, player, joy);
    else if (droneCanNorth) droneMoveUpright(world, player, joy);
    else droneMoveUp(world, player, joy);
    return;
  }
  if (dir === PLAYER_DIR_NORTH && !droneCanNorth) {
    if (droneCanEast) droneMoveUpright(world, player, joy);
    else if (droneCanWest) droneMoveUpleft(world, player, joy);
    else droneTurnAround(world, player, joy);
    return;
  }
  if (dir === PLAYER_DIR_EAST && !droneCanEast) {
    if (droneCanNorth) droneMoveUpleft(world, player, joy);
    else if (droneCanSouth) droneMoveUpright(world, player, joy);
    else droneTurnAround(world, player, joy);
    return;
  }
  if (dir === PLAYER_DIR_SOUTH && !droneCanSouth) {
    if (droneCanEast) droneMoveUpleft(world, player, joy);
    else if (droneCanWest) droneMoveUpright(world, player, joy);
    else droneTurnAround(world, player, joy);
    return;
  }
  if (dir === PLAYER_DIR_WEST && !droneCanWest) {
    if (droneCanNorth) droneMoveUpright(world, player, joy);
    else if (droneCanSouth) droneMoveUpleft(world, player, joy);
    else droneTurnAround(world, player, joy);
    return;
  }
}

/** drone_sub_standard: look down an axis for the target, lock + fire or re-steer. */
function droneSubStandard(world: World, player: number): void {
  const p = world.players[player]!;
  const gunmanType: number = world.players[p.ply_gunman]!.dr_type;
  // drone.c bug: `!= NINJA || != STANDARD` is always true, so when hit the target
  // is always the gunman. Preserved verbatim (the cast keeps it from short-circuiting).
  const gunmanNotBothDroneTypes =
    gunmanType !== DRONE_NINJA || (gunmanType as number) !== DRONE_STANDARD;
  const target_player =
    p.ply_hitflag && gunmanNotBothDroneTypes ? p.ply_gunman : p.dr_currentTarget;
  const t = world.players[target_player]!;
  const playerFieldY = (p.ply_y >> MAZE_FIELD_SHIFT) | 1;
  const playerFieldX = (p.ply_x >> MAZE_FIELD_SHIFT) | 1;
  const targetFieldY = (t.ply_y >> MAZE_FIELD_SHIFT) | 1;
  const targetFieldX = (t.ply_x >> MAZE_FIELD_SHIFT) | 1;
  const targetDistanceY = targetFieldY - playerFieldY;
  const targetDistanceX = targetFieldX - playerFieldX;
  if (p.ply_hitflag) {
    p.ply_dir = droneDeltaIntoDirection(targetDistanceY, targetDistanceX);
    return;
  }
  const seek = (visible: boolean) => {
    if (visible) {
      if (droneAim2target(world, player)) p.dr_targetLocked = 1;
      else if (p.dr_targetLocked) {
        droneSubFindMoveToTarget(world, player);
        p.dr_targetLocked = 0;
      }
    } else if (p.dr_targetLocked) {
      droneSubFindMoveToTarget(world, player);
      p.dr_targetLocked = 0;
    }
  };
  if (targetDistanceY === 0) {
    if (targetDistanceX < 0) seek(droneVisibleWest(world, player));
    else if (targetDistanceX > 0) seek(droneVisibleEast(world, player));
  } else if (targetDistanceX === 0) {
    if (targetDistanceY < 0) seek(droneVisibleNorth(world, player));
    else if (targetDistanceY > 0) seek(droneVisibleSouth(world, player));
  } else {
    if (p.dr_targetLocked) {
      p.dr_targetLocked = 0;
      droneSubFindMoveToTarget(world, player);
    }
  }
}

// The ninja plan encodes "north" as PLAYER_DIR_NORTH + 256 in dr_dir[], so that a
// non-zero dr_dir[0] means "a plan exists" (PLAYER_DIR_NORTH itself is 0).
const NINJA_PLAN_NORTH = PLAYER_DIR_NORTH + 256;

/**
 * Faithful to drone.c's `if(a()){} else if(b()){} ...` planner chains: try each in
 * order and stop at the first that returns true. Each attempt has side effects
 * (it may write the drone's plan), and the RNG inside an attempt is only consumed
 * when that attempt is reached — matching the original's short-circuit order.
 */
function tryPlans(...attempts: Array<() => boolean>): void {
  for (const a of attempts) if (a()) return;
}

/**
 * drone_sub_ninja: the ninja's per-tick brain. If it has no plan, search the four
 * axes for the target (aim+lock when visible) or build a route around walls via
 * the planners. If it has a plan, advance/execute it (with a 78-step timeout).
 */
function droneSubNinja(world: World, player: number): void {
  const p = world.players[player]!;
  droneNeeds2GoNorth = droneNeeds2GoSouth = droneNeeds2GoEast = droneNeeds2GoWest = false;
  const t = droneTarget(world, p);
  const playerFieldY = (p.ply_y >> MAZE_FIELD_SHIFT) | 1;
  const playerFieldX = (p.ply_x >> MAZE_FIELD_SHIFT) | 1;
  const targetFieldY = (t.ply_y >> MAZE_FIELD_SHIFT) | 1;
  const targetFieldX = (t.ply_x >> MAZE_FIELD_SHIFT) | 1;
  const deltaY = targetFieldY - playerFieldY;
  const deltaX = targetFieldX - playerFieldX;

  droneCheckDirections(world, player);

  const seek = (visible: boolean) => {
    if (visible) {
      if (droneAim2target(world, player)) p.dr_targetLocked = 1;
      else if (p.dr_targetLocked) droneSubFindMoveToTarget(world, player);
    } else if (p.dr_targetLocked) droneSubFindMoveToTarget(world, player);
  };

  if (deltaY === 0 && !p.dr_dir[0]) {
    if (deltaX < 0) {
      if (droneCanWest) {
        droneNeeds2GoWest = true;
        seek(droneVisibleWest(world, player));
      } else {
        tryPlans(
          () => droneSubNinjaPlan(world, player, 'w'),
          () => (world.rng.rnd(256) & 1) !== 0 && droneSubNinjaNorth(world, player, 'w'),
          () => droneSubNinjaNorth(world, player, 'e'),
          () => droneSubNinjaNorth(world, player, 'w'),
          () => droneSubNinjaSouth(world, player, 'w'),
          () => droneSubNinjaEast(world, player, 'n'),
          () => droneSubNinjaEast(world, player, 's'),
        );
      }
    } else if (deltaX > 0) {
      if (droneCanEast) {
        droneNeeds2GoEast = true;
        seek(droneVisibleEast(world, player));
      } else {
        tryPlans(
          () => droneSubNinjaPlan(world, player, 'e'),
          () => (world.rng.rnd(256) & 1) !== 0 && droneSubNinjaNorth(world, player, 'e'),
          () => droneSubNinjaNorth(world, player, 'w'),
          () => droneSubNinjaNorth(world, player, 'e'),
          () => droneSubNinjaSouth(world, player, 'e'),
          () => droneSubNinjaWest(world, player, 'n'),
          () => droneSubNinjaWest(world, player, 's'),
        );
      }
    }
  } else if (deltaX === 0 && !p.dr_dir[0]) {
    if (deltaY < 0) {
      if (droneCanNorth) {
        droneNeeds2GoNorth = true;
        seek(droneVisibleNorth(world, player));
      } else {
        tryPlans(
          () => droneSubNinjaPlan(world, player, 'n'),
          () => (world.rng.rnd(256) & 1) !== 0 && droneSubNinjaWest(world, player, 's'),
          () => droneSubNinjaWest(world, player, 'n'),
          () => droneSubNinjaWest(world, player, 's'),
          () => droneSubNinjaEast(world, player, 'n'),
          () => droneSubNinjaSouth(world, player, 'e'),
          () => droneSubNinjaSouth(world, player, 'w'),
        );
      }
    } else if (deltaY > 0) {
      if (droneCanSouth) {
        droneNeeds2GoSouth = true;
        seek(droneVisibleSouth(world, player));
      } else {
        tryPlans(
          () => droneSubNinjaPlan(world, player, 's'),
          () => (world.rng.rnd(256) & 1) !== 0 && droneSubNinjaEast(world, player, 'n'),
          () => droneSubNinjaEast(world, player, 's'),
          () => droneSubNinjaEast(world, player, 'n'),
          () => droneSubNinjaWest(world, player, 's'),
          () => droneSubNinjaNorth(world, player, 'e'),
          () => droneSubNinjaNorth(world, player, 'w'),
        );
      }
    }
  } else if (deltaY < 0 && !p.dr_dir[0]) {
    if (p.dr_targetLocked) {
      droneSubFindMoveToTarget(world, player);
    } else if (droneCanNorth) {
      droneNeeds2GoNorth = true;
    } else if (deltaX < 0 && droneCanWest) {
      droneNeeds2GoWest = true;
    } else if (deltaX > 0 && droneCanEast) {
      droneNeeds2GoEast = true;
    } else if (!droneCanNorth && deltaX > 0 && !droneCanEast) {
      tryPlans(
        () => (world.rng.rnd(256) & 1) !== 0 && droneSubNinjaWest(world, player, 's'),
        () => droneSubNinjaWest(world, player, 'n'),
        () => droneSubNinjaWest(world, player, 's'),
        () => droneSubNinjaSouth(world, player, 'e'),
        () => droneSubNinjaSouth(world, player, 'w'),
      );
    } else if (!droneCanNorth && deltaX < 0 && !droneCanWest) {
      tryPlans(
        () => (world.rng.rnd(256) & 1) !== 0 && droneSubNinjaEast(world, player, 's'),
        () => droneSubNinjaEast(world, player, 'n'),
        () => droneSubNinjaEast(world, player, 's'),
        () => droneSubNinjaSouth(world, player, 'w'),
        () => droneSubNinjaSouth(world, player, 'e'),
      );
    }
  } else if (deltaY > 0 && !p.dr_dir[0]) {
    if (p.dr_targetLocked) {
      droneSubFindMoveToTarget(world, player);
    } else if (droneCanSouth) {
      droneNeeds2GoSouth = true;
    } else if (deltaX < 0 && droneCanWest) {
      droneNeeds2GoWest = true;
    } else if (deltaX > 0 && droneCanEast) {
      droneNeeds2GoEast = true;
    } else if (!droneCanSouth && deltaX < 0 && !droneCanWest) {
      tryPlans(
        () => (world.rng.rnd(256) & 1) !== 0 && droneSubNinjaEast(world, player, 'n'),
        () => droneSubNinjaEast(world, player, 's'),
        () => droneSubNinjaEast(world, player, 'n'),
        () => droneSubNinjaNorth(world, player, 'e'),
        () => droneSubNinjaNorth(world, player, 'w'),
      );
    } else if (!droneCanSouth && deltaX > 0 && !droneCanEast) {
      tryPlans(
        () => (world.rng.rnd(256) & 1) !== 0 && droneSubNinjaWest(world, player, 'n'),
        () => droneSubNinjaWest(world, player, 's'),
        () => droneSubNinjaWest(world, player, 'n'),
        () => droneSubNinjaNorth(world, player, 'w'),
        () => droneSubNinjaNorth(world, player, 'e'),
      );
    }
  }

  // Does the drone have a plan? Execute it.
  if (p.dr_dir[0]) {
    let fieldIndex = p.dr_fieldIndex;
    // reached the destination field? advance to the next plan step.
    if (p.dr_field[fieldIndex]!.y === playerFieldY && p.dr_field[fieldIndex]!.x === playerFieldX) {
      p.dr_fieldIndex++;
      fieldIndex = p.dr_fieldIndex;
      p.dr_fieldResetTimer = 0;
    }
    // after 78 steps, time out and give up on the plan.
    if (p.dr_fieldResetTimer++ > 78) {
      p.dr_field[fieldIndex]!.y = 0;
      p.dr_fieldResetTimer = 0;
    }

    if (p.dr_field[fieldIndex]!.y === 0 || p.dr_dir[fieldIndex] === -1) {
      p.dr_dir[0] = 0;
      p.dr_fieldIndex = 0;
      p.dr_upRotationCounter = 0;
      p.dr_rotateCounter = 0;
      // take the last plan step's direction as our intended move.
      if (fieldIndex > 0) {
        if (p.dr_dir[fieldIndex - 1] === NINJA_PLAN_NORTH) droneNeeds2GoNorth = true;
        else if (p.dr_dir[fieldIndex - 1] === PLAYER_DIR_EAST) droneNeeds2GoEast = true;
        else if (p.dr_dir[fieldIndex - 1] === PLAYER_DIR_SOUTH) droneNeeds2GoSouth = true;
        else if (p.dr_dir[fieldIndex - 1] === PLAYER_DIR_WEST) droneNeeds2GoWest = true;
      }
      // else: drone.c has a dead #if-0 block here (fieldIndex-1 == -1); no-op.
    } else if (p.dr_dir[fieldIndex] === NINJA_PLAN_NORTH && droneCanNorth) {
      if (fieldIndex === 0 && p.ply_dir) droneSetPosition(world, player, 'n');
      droneNeeds2GoNorth = true;
      if (deltaX === 0 && deltaY < 0) {
        if (droneVisibleNorth(world, player)) {
          if (droneAim2target(world, player)) {
            p.dr_targetLocked = 1;
            p.dr_dir[0] = 0;
            p.dr_fieldIndex = 0;
            p.dr_upRotationCounter = 0;
            p.dr_rotateCounter = 0;
          } else if (p.dr_targetLocked) droneSubFindMoveToTarget(world, player);
        } else if (p.dr_targetLocked) droneSubFindMoveToTarget(world, player);
      }
    } else if (p.dr_dir[fieldIndex] === PLAYER_DIR_EAST && droneCanEast) {
      if (fieldIndex === 0 && p.ply_dir !== PLAYER_DIR_EAST) droneSetPosition(world, player, 'e');
      droneNeeds2GoEast = true;
      if (deltaY === 0 && deltaX > 0) {
        if (droneVisibleEast(world, player)) {
          if (droneAim2target(world, player)) {
            p.dr_targetLocked = 1;
            p.dr_dir[0] = 0;
            p.dr_fieldIndex = 0;
            p.dr_upRotationCounter = 0;
            p.dr_rotateCounter = 0;
          } else if (p.dr_targetLocked) droneSubFindMoveToTarget(world, player);
        } else if (p.dr_targetLocked) droneSubFindMoveToTarget(world, player);
      }
    } else if (p.dr_dir[fieldIndex] === PLAYER_DIR_SOUTH && droneCanSouth) {
      if (p.ply_dir !== PLAYER_DIR_SOUTH && fieldIndex === 0) droneSetPosition(world, player, 's');
      droneNeeds2GoSouth = true;
      if (deltaX === 0 && deltaY > 0) {
        if (droneVisibleSouth(world, player)) {
          if (droneAim2target(world, player)) {
            p.dr_targetLocked = 1;
            p.dr_dir[0] = 0;
            p.dr_fieldIndex = 0;
            p.dr_upRotationCounter = 0;
            p.dr_rotateCounter = 0;
          } else if (p.dr_targetLocked) droneSubFindMoveToTarget(world, player);
        } else if (p.dr_targetLocked) droneSubFindMoveToTarget(world, player);
      }
    } else if (p.dr_dir[fieldIndex] === PLAYER_DIR_WEST && droneCanWest) {
      if (p.ply_dir !== PLAYER_DIR_WEST && fieldIndex === 0) droneSetPosition(world, player, 'w');
      droneNeeds2GoWest = true;
      if (deltaY === 0 && deltaX < 0) {
        if (droneVisibleWest(world, player)) {
          if (droneAim2target(world, player)) {
            p.dr_targetLocked = 1;
            p.dr_dir[0] = 0;
            p.dr_fieldIndex = 0;
            p.dr_upRotationCounter = 0;
            p.dr_rotateCounter = 0;
          } else if (p.dr_targetLocked) droneSubFindMoveToTarget(world, player);
        } else if (p.dr_targetLocked) droneSubFindMoveToTarget(world, player);
      }
    }
  }

  // collapse the needs2go intent into the can-go flags for joystick generation.
  if (droneNeeds2GoNorth) {
    droneCanSouth = droneCanEast = droneCanWest = false;
    droneCanNorth = true;
  } else if (droneNeeds2GoSouth) {
    droneCanNorth = droneCanEast = droneCanWest = false;
    droneCanSouth = true;
  } else if (droneNeeds2GoEast) {
    droneCanNorth = droneCanSouth = droneCanWest = false;
    droneCanEast = true;
  } else if (droneNeeds2GoWest) {
    droneCanNorth = droneCanSouth = droneCanEast = false;
    droneCanWest = true;
  }
}

// --- Ninja route planners (drone.c, transformed verbatim). Deeply nested
// do/while scans that build a multi-step dr_dir[]/dr_field[] plan around walls. ---
function droneSubNinjaPlan(world: World, player: number, wantedDirChar: string): boolean {
  const p = world.players[player]!;
  let d: Dirs = { n: false, s: false, e: false, w: false };
  let target_player = 0;
  let targetFieldX = 0;
  let targetFieldY = 0;
  let playerFieldX = 0;
  let playerFieldY = 0;

  target_player = p.dr_currentTarget;
  targetFieldY = (world.players[target_player]!.ply_y >> MAZE_FIELD_SHIFT) | 1;
  targetFieldX = (world.players[target_player]!.ply_x >> MAZE_FIELD_SHIFT) | 1;
  playerFieldY = (p.ply_y >> MAZE_FIELD_SHIFT) | 1;
  playerFieldX = (p.ply_x >> MAZE_FIELD_SHIFT) | 1;
  p.dr_fieldIndex = 0;
  p.dr_upRotationCounter = 0;
  p.dr_rotateCounter = 0;
  p.dr_dir[0] = 0;
  p.dr_field[0]!.y = 0;
  d = droneCheckDirsAt(world, player, false, 0, 0);

  if (wantedDirChar === 'n') {
    if (d.w) {
      /* Move West, North (check for target), East (check for target), ... */
      p.dr_dir[0] = PLAYER_DIR_WEST;
      do {
        d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
        if (!d.w) break;
        playerFieldX -= 2;
        if (playerFieldX <= 0) break;
        d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
        if (!d.s && !d.n && !d.w) {
          /* dead end? */
          playerFieldX = (p.ply_x >> MAZE_FIELD_SHIFT) | 1; /* reset player position and exit */
          break;
        }
        if (d.n) {
          p.dr_field[0]!.y = playerFieldY;
          p.dr_field[0]!.x = playerFieldX;
          p.dr_dir[1] = NINJA_PLAN_NORTH;
          do {
            d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
            if (!d.n) {
              playerFieldY = p.dr_field[0]!.y;
              break;
            }
            playerFieldY -= 2;
            if (playerFieldY <= 0) {
              playerFieldY = p.dr_field[0]!.y;
              break;
            }
            d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
            if (!d.w && !d.n && !d.e) {
              /* dead end? */
              playerFieldY = p.dr_field[0]!.y;
              break;
            }
            if (d.n && droneVisibleNorth(world, player, playerFieldY, playerFieldX)) {
              p.dr_field[1]!.y = playerFieldY;
              p.dr_field[1]!.x = playerFieldX;
              p.dr_field[2]!.y = 0;
              p.dr_dir[2] = -1;
              return true;
            }
            if (d.e) {
              p.dr_field[1]!.y = playerFieldY;
              p.dr_field[1]!.x = playerFieldX;
              p.dr_field[2]!.y = 0;
              p.dr_dir[2] = PLAYER_DIR_EAST;
              p.dr_dir[3] = -1;
              if (droneVisibleEast(world, player, playerFieldY, playerFieldX)) {
                p.dr_field[2]!.y = playerFieldY;
                p.dr_field[2]!.x = playerFieldX + 2;
                p.dr_field[3]!.y = 0;
                return true;
              }
              do {
                d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                if (!d.e) {
                  playerFieldX = p.dr_field[1]!.x;
                  break;
                }
                playerFieldX += 2;
                if (playerFieldX > MAZE_MAX_SIZE - 1) {
                  playerFieldX = p.dr_field[1]!.x;
                  break;
                }
                d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                if (!d.n && !d.s && !d.e) {
                  /* dead end? */
                  playerFieldX = p.dr_field[1]!.x;
                  break;
                }
                if (!d.e && targetFieldY < playerFieldY && !d.n) {
                  playerFieldX = p.dr_field[1]!.x;
                  break;
                }
                if (!d.e && targetFieldY > playerFieldY && !d.s) {
                  playerFieldX = p.dr_field[1]!.x;
                  break;
                }
                if (d.n || d.s) {
                  p.dr_field[2]!.y = playerFieldY;
                  p.dr_field[2]!.x = playerFieldX;
                  p.dr_field[3]!.y = 0;
                  if (targetFieldY < playerFieldY && d.n) {
                    p.dr_dir[3] = NINJA_PLAN_NORTH;
                    p.dr_dir[4] = -1;
                    do {
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (!d.n) {
                        playerFieldY = p.dr_field[2]!.y;
                        break;
                      }
                      playerFieldY -= 2;
                      if (playerFieldY <= 0) break;
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (droneVisibleNorth(world, player, playerFieldY, playerFieldX)) {
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (!d.w && !d.n && !d.e) {
                        /* dead end? */
                        playerFieldY = p.dr_field[2]!.y;
                        break;
                      }
                      if (targetFieldX < playerFieldX && d.w) {
                        p.dr_dir[4] = PLAYER_DIR_WEST;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (targetFieldX > playerFieldX && d.e) {
                        p.dr_dir[4] = PLAYER_DIR_EAST;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                    } while (d.n);
                  } else if (targetFieldY > playerFieldY && d.s) {
                    p.dr_dir[3] = PLAYER_DIR_SOUTH;
                    p.dr_dir[4] = -1;
                    do {
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (!d.s) {
                        playerFieldY = p.dr_field[2]!.y;
                        break;
                      }
                      playerFieldY += 2;
                      if (playerFieldY > MAZE_MAX_SIZE - 1) break;
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (droneVisibleSouth(world, player, playerFieldY, playerFieldX)) {
                        p.dr_field[4]!.y = playerFieldY;
                        p.dr_field[4]!.x = playerFieldX;
                        p.dr_field[5]!.y = 0;
                        return true;
                      }
                      if (!d.e && !d.w && !d.s) {
                        /* dead end? */
                        playerFieldY = p.dr_field[2]!.x;
                        break;
                      }
                      if (targetFieldX < playerFieldX && d.w) {
                        p.dr_dir[4] = PLAYER_DIR_WEST;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (targetFieldX > playerFieldX && d.e) {
                        p.dr_dir[4] = PLAYER_DIR_EAST;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                    } while (d.s);
                  }
                }
              } while (d.e);
              p.dr_dir[0] = 0;
              p.dr_fieldIndex = 0;
              break;
            }
          } while (d.n);
          p.dr_dir[0] = 0;
          p.dr_fieldIndex = 0;
          break;
        }
      } while (d.w);
      p.dr_dir[0] = 0;
      p.dr_fieldIndex = 0;
      d = droneCheckDirsAt(world, player, false, 0, 0);
      playerFieldY = (p.ply_y >> MAZE_FIELD_SHIFT) | 1; /* reset player position */
      playerFieldX = (p.ply_x >> MAZE_FIELD_SHIFT) | 1;
    }
    if (d.e) {
      p.dr_dir[0] = PLAYER_DIR_EAST;
      do {
        d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
        if (!d.e) break;
        playerFieldX += 2;
        if (playerFieldX > MAZE_MAX_SIZE - 1) break;
        d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
        if (!d.n && !d.e && !d.s) break; /* dead end? */
        if (d.n) {
          p.dr_field[0]!.y = playerFieldY;
          p.dr_field[0]!.x = playerFieldX;
          p.dr_dir[1] = NINJA_PLAN_NORTH;
          do {
            d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
            if (!d.n) {
              playerFieldY = p.dr_field[0]!.y;
              break;
            }
            playerFieldY -= 2;
            if (playerFieldY <= 0) {
              playerFieldY = p.dr_field[0]!.y;
              break;
            }
            d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
            if (!d.w && !d.n && !d.e) {
              /* dead end? */
              playerFieldY = p.dr_field[0]!.y;
              break;
            }
            if (d.n && droneVisibleNorth(world, player, playerFieldY, playerFieldX)) {
              p.dr_field[1]!.y = playerFieldY;
              p.dr_field[1]!.x = playerFieldX;
              p.dr_field[2]!.y = 0;
              p.dr_dir[2] = -1;
              return true;
            }
            if (d.w) {
              p.dr_field[1]!.y = playerFieldY;
              p.dr_field[1]!.x = playerFieldX;
              p.dr_field[2]!.y = 0;
              p.dr_dir[2] = PLAYER_DIR_WEST;
              p.dr_dir[3] = -1;
              if (droneVisibleWest(world, player, playerFieldY, playerFieldX)) {
                p.dr_field[2]!.y = playerFieldY;
                p.dr_field[2]!.x = playerFieldX - 2;
                p.dr_field[3]!.y = 0;
                return true;
              }
              do {
                d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                if (!d.w) {
                  playerFieldX = p.dr_field[1]!.x;
                  break;
                }
                playerFieldX -= 2;
                if (playerFieldX <= 0) {
                  playerFieldX = p.dr_field[1]!.x;
                  break;
                }
                d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                if (!d.s && !d.n && !d.w) {
                  /* dead end? */
                  playerFieldX = p.dr_field[1]!.x;
                  break;
                }
                if (!d.n && targetFieldX < playerFieldX && !d.w) {
                  playerFieldX = p.dr_field[1]!.x;
                  break;
                }
                if (!d.s && targetFieldX > playerFieldX && !d.w) {
                  playerFieldX = p.dr_field[1]!.x;
                  break;
                }
                if (d.n || d.s) {
                  p.dr_field[2]!.y = playerFieldY;
                  p.dr_field[2]!.x = playerFieldX;
                  p.dr_field[3]!.y = 0;
                  if (targetFieldY < playerFieldY && d.n) {
                    p.dr_dir[3] = NINJA_PLAN_NORTH;
                    p.dr_dir[4] = -1;
                    do {
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (!d.n) {
                        playerFieldY = p.dr_field[2]!.y;
                        break;
                      }
                      playerFieldY -= 2;
                      if (playerFieldY <= 0) {
                        playerFieldY = p.dr_field[2]!.y;
                        break;
                      }
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (droneVisibleNorth(world, player, playerFieldY, playerFieldX)) {
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (!d.e && !d.n && !d.w) {
                        /* dead end? */
                        playerFieldY = p.dr_field[2]!.y;
                        break;
                      }
                      if (targetFieldX < playerFieldX && d.w) {
                        p.dr_dir[4] = PLAYER_DIR_WEST;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (targetFieldX > playerFieldX && d.e) {
                        p.dr_dir[4] = PLAYER_DIR_EAST;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                    } while (d.n);
                  } else if (targetFieldY > playerFieldY && d.s) {
                    p.dr_dir[3] = PLAYER_DIR_SOUTH;
                    p.dr_dir[4] = -1;
                    do {
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (!d.s) {
                        playerFieldY = p.dr_field[2]!.y;
                        break;
                      }
                      playerFieldY += 2;
                      if (playerFieldY > MAZE_MAX_SIZE - 1) {
                        playerFieldY = p.dr_field[2]!.y;
                        break;
                      }
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (droneVisibleSouth(world, player, playerFieldY, playerFieldX)) {
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (!d.e && !d.w && !d.s) {
                        /* dead end? */
                        playerFieldY = p.dr_field[2]!.y;
                        break;
                      }
                      if (targetFieldX < playerFieldX && d.w) {
                        p.dr_dir[4] = PLAYER_DIR_WEST;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (targetFieldX > playerFieldX && d.e) {
                        p.dr_dir[4] = PLAYER_DIR_EAST;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                    } while (d.s);
                  }
                }
              } while (d.e);
              p.dr_dir[0] = 0;
              p.dr_fieldIndex = 0;
              break;
            }
          } while (d.n);
          p.dr_dir[0] = 0;
          p.dr_fieldIndex = 0;
          return false;
        }
      } while (d.w);
    }
    p.dr_dir[0] = 0;
    p.dr_fieldIndex = 0;
    return false;
  }
  if (wantedDirChar === 's') {
    if (d.w) {
      p.dr_dir[0] = PLAYER_DIR_WEST;
      do {
        d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
        if (!d.w) break;
        playerFieldX -= 2;
        if (playerFieldX <= 0) {
          playerFieldX = (p.ply_x >> MAZE_FIELD_SHIFT) | 1; /* reset player position and exit */
          break;
        }
        d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
        if (!d.s && !d.n && !d.w) {
          /* dead end? */
          playerFieldX = (p.ply_x >> MAZE_FIELD_SHIFT) | 1; /* reset player position and exit */
          break;
        }
        if (d.s) {
          p.dr_field[0]!.y = playerFieldY;
          p.dr_field[0]!.x = playerFieldX;
          p.dr_dir[1] = PLAYER_DIR_SOUTH;
          do {
            d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
            if (!d.s) {
              playerFieldY = p.dr_field[0]!.y;
              break;
            }
            playerFieldY += 2;
            if (playerFieldY > MAZE_MAX_SIZE - 1) {
              playerFieldY = p.dr_field[0]!.y;
              break;
            }
            d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
            if (!d.w && !d.s && !d.e) {
              /* dead end? */
              playerFieldY = p.dr_field[0]!.y;
              break;
            }
            if (d.s && droneVisibleSouth(world, player, playerFieldY, playerFieldX)) {
              p.dr_field[1]!.y = playerFieldY;
              p.dr_field[1]!.x = playerFieldX;
              p.dr_field[2]!.y = 0;
              p.dr_dir[2] = -1;
              return true;
            }
            if (d.e) {
              p.dr_field[1]!.y = playerFieldY;
              p.dr_field[1]!.x = playerFieldX;
              p.dr_field[2]!.y = 0;
              p.dr_dir[2] = PLAYER_DIR_EAST;
              p.dr_dir[3] = -1;
              if (droneVisibleEast(world, player, playerFieldY, playerFieldX)) {
                p.dr_field[2]!.y = playerFieldY;
                p.dr_field[2]!.x = playerFieldX + 2;
                p.dr_field[3]!.y = 0;
                return true;
              }
              do {
                d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                if (!d.e) {
                  playerFieldX = p.dr_field[1]!.x;
                  break;
                }
                playerFieldX += 2;
                if (playerFieldX > MAZE_MAX_SIZE - 1) {
                  playerFieldX = p.dr_field[1]!.x;
                  break;
                }
                d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                if (!d.n && !d.s && !d.e) {
                  /* dead end? */
                  playerFieldX = p.dr_field[1]!.x;
                  break;
                }
                if (!d.e && targetFieldY < playerFieldY && !d.n) {
                  playerFieldX = p.dr_field[1]!.x;
                  break;
                }
                if (!d.e && targetFieldY > playerFieldY && !d.s) {
                  playerFieldX = p.dr_field[1]!.x;
                  break;
                }
                if (d.n || d.s) {
                  p.dr_field[2]!.y = playerFieldY;
                  p.dr_field[2]!.x = playerFieldX;
                  p.dr_field[3]!.y = 0;
                  if (targetFieldY < playerFieldY && d.n) {
                    p.dr_dir[3] = NINJA_PLAN_NORTH;
                    p.dr_dir[4] = -1;
                    do {
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (!d.n) {
                        playerFieldY = p.dr_field[2]!.y;
                        break;
                      }
                      playerFieldY -= 2;
                      if (playerFieldY < 0) {
                        playerFieldY = p.dr_field[2]!.y;
                        break;
                      }
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (droneVisibleNorth(world, player, playerFieldY, playerFieldX)) {
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (!d.w && !d.n && !d.e) {
                        /* dead end? */
                        playerFieldY = p.dr_field[2]!.y;
                        break;
                      }
                      if (targetFieldX < playerFieldX && d.w) {
                        p.dr_dir[4] = PLAYER_DIR_WEST;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[4]!.y = 0;
                      } else {
                        if (targetFieldX > playerFieldX && d.e) {
                          p.dr_dir[4] = PLAYER_DIR_EAST;
                          p.dr_dir[5] = -1;
                          p.dr_field[3]!.x = playerFieldX;
                          p.dr_field[3]!.y = playerFieldY;
                          p.dr_field[4]!.y = 0;
                          return true;
                        }
                      }
                    } while (d.n);
                  } else if (targetFieldY > playerFieldY && d.s) {
                    p.dr_dir[3] = PLAYER_DIR_SOUTH;
                    p.dr_dir[4] = -1;
                    do {
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (!d.s) {
                        playerFieldY = p.dr_field[2]!.y;
                        break;
                      }
                      playerFieldY += 2;
                      if (playerFieldY > MAZE_MAX_SIZE - 1) {
                        playerFieldY = p.dr_field[2]!.y;
                        break;
                      }
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (droneVisibleSouth(world, player, playerFieldY, playerFieldX)) {
                        p.dr_field[4]!.y = playerFieldY;
                        p.dr_field[4]!.x = playerFieldX;
                        p.dr_field[5]!.y = 0;
                        return true;
                      }
                      if (!d.e && !d.w && !d.s) {
                        /* dead end? */
                        playerFieldY = p.dr_field[2]!.x;
                        break;
                      }
                      if (targetFieldX < playerFieldX && d.w) {
                        p.dr_dir[4] = PLAYER_DIR_WEST;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (targetFieldX > playerFieldX && d.e) {
                        p.dr_dir[4] = PLAYER_DIR_EAST;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                    } while (d.s);
                  }
                }
              } while (d.e);
              p.dr_dir[0] = 0;
              p.dr_fieldIndex = 0;
              break;
            }
          } while (d.s);
          p.dr_dir[0] = 0;
          p.dr_fieldIndex = 0;
          break;
        }
      } while (d.w);
      p.dr_dir[0] = 0;
      p.dr_fieldIndex = 0;
      d = droneCheckDirsAt(world, player, false, 0, 0);
      playerFieldY = (p.ply_y >> MAZE_FIELD_SHIFT) | 1; /* reset player position */
      playerFieldX = (p.ply_x >> MAZE_FIELD_SHIFT) | 1;
    }
    if (d.e) {
      p.dr_dir[0] = PLAYER_DIR_EAST;
      do {
        d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
        if (!d.e) break;
        playerFieldX += 2;
        if (playerFieldX > MAZE_MAX_SIZE - 1) break;
        d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
        if (!d.n && !d.e && !d.s) break; /* dead end? */
        if (d.s) {
          p.dr_field[0]!.y = playerFieldY;
          p.dr_field[0]!.x = playerFieldX;
          p.dr_dir[1] = PLAYER_DIR_SOUTH;
          do {
            d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
            if (!d.s) {
              playerFieldY = p.dr_field[0]!.y;
              break;
            }
            playerFieldY += 2;
            if (playerFieldY > MAZE_MAX_SIZE - 1) {
              playerFieldY = p.dr_field[0]!.y;
              break;
            }
            d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
            if (!d.w && !d.s && !d.e) {
              /* dead end? */
              playerFieldY = p.dr_field[0]!.y;
              break;
            }
            if (d.s && droneVisibleSouth(world, player, playerFieldY, playerFieldX)) {
              p.dr_field[1]!.y = playerFieldY;
              p.dr_field[1]!.x = playerFieldX;
              p.dr_field[2]!.y = 0;
              p.dr_dir[2] = -1;
              return true;
            }
            if (d.w) {
              p.dr_field[1]!.y = playerFieldY;
              p.dr_field[1]!.x = playerFieldX;
              p.dr_field[2]!.y = 0;
              p.dr_dir[2] = PLAYER_DIR_WEST;
              p.dr_dir[3] = -1;
              if (droneVisibleWest(world, player, playerFieldY, playerFieldX)) {
                p.dr_field[2]!.y = playerFieldY;
                p.dr_field[2]!.x = playerFieldX - 2;
                p.dr_field[3]!.y = 0;
                return true;
              }
              do {
                d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                if (!d.w) {
                  playerFieldX = p.dr_field[1]!.x;
                  break;
                }
                playerFieldX -= 2;
                if (playerFieldX <= 0) {
                  playerFieldX = p.dr_field[1]!.x;
                  break;
                }
                d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                if (!d.s && !d.n && !d.w) {
                  /* dead end? */
                  playerFieldX = p.dr_field[1]!.x;
                  break;
                }
                if (!d.n && targetFieldX < playerFieldX && !d.w) {
                  playerFieldX = p.dr_field[1]!.x;
                  break;
                }
                if (!d.s && targetFieldX > playerFieldX && !d.w) {
                  playerFieldX = p.dr_field[1]!.x;
                  break;
                }
                if (d.n || d.s) {
                  p.dr_field[2]!.y = playerFieldY;
                  p.dr_field[2]!.x = playerFieldX;
                  p.dr_field[3]!.y = 0;
                  if (targetFieldY < playerFieldY && d.n) {
                    p.dr_dir[3] = NINJA_PLAN_NORTH;
                    p.dr_dir[4] = -1;
                    do {
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (!d.n) {
                        playerFieldY = p.dr_field[2]!.y;
                        break;
                      }
                      playerFieldY -= 2;
                      if (playerFieldY <= 0) {
                        playerFieldY = p.dr_field[2]!.y;
                        break;
                      }
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (droneVisibleNorth(world, player, playerFieldY, playerFieldX)) {
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (!d.e && !d.n && !d.w) {
                        /* dead end? */
                        playerFieldY = p.dr_field[2]!.y;
                        break;
                      }
                      if (targetFieldX < playerFieldX && d.w) {
                        p.dr_dir[4] = PLAYER_DIR_WEST;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (targetFieldX > playerFieldX && d.e) {
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[4]!.y = 0;
                        p.dr_dir[3] = PLAYER_DIR_EAST;
                        p.dr_dir[4] = -1;
                        return true;
                      }
                    } while (d.n);
                  } else if (targetFieldY > playerFieldY && d.s) {
                    p.dr_dir[3] = PLAYER_DIR_SOUTH;
                    p.dr_dir[4] = -1;
                    do {
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (!d.s) {
                        playerFieldY = p.dr_field[2]!.y;
                        break;
                      }
                      playerFieldY += 2;
                      if (playerFieldY > MAZE_MAX_SIZE - 1) {
                        playerFieldY = p.dr_field[2]!.y;
                        break;
                      }
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (droneVisibleSouth(world, player, playerFieldY, playerFieldX)) {
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (!d.e && !d.w && !d.s) {
                        /* dead end? */
                        playerFieldY = p.dr_field[2]!.y;
                        break;
                      }
                      if (targetFieldX < playerFieldX && d.w) {
                        p.dr_dir[4] = PLAYER_DIR_WEST;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (targetFieldX > playerFieldX && d.e) {
                        p.dr_dir[4] = PLAYER_DIR_EAST;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                    } while (d.s);
                  }
                }
              } while (d.e);
              p.dr_dir[0] = 0;
              p.dr_fieldIndex = 0;
              break;
            }
          } while (d.s);
          p.dr_dir[0] = 0;
          p.dr_fieldIndex = 0;
          return false;
        }
      } while (d.w);
    }
    p.dr_dir[0] = 0;
    p.dr_fieldIndex = 0;
    return false;
  }
  if (wantedDirChar === 'w') {
    if (d.s) {
      p.dr_dir[0] = PLAYER_DIR_SOUTH;
      do {
        d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
        if (!d.s) break;
        playerFieldY += 2;
        if (playerFieldY > MAZE_MAX_SIZE - 1) {
          playerFieldY = (p.ply_y >> MAZE_FIELD_SHIFT) | 1;
          break;
        }
        d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
        if (!d.s && !d.e && !d.w) {
          /* dead end? */
          playerFieldY = (p.ply_y >> MAZE_FIELD_SHIFT) | 1;
          break;
        }
        if (d.w) {
          p.dr_field[0]!.y = playerFieldY;
          p.dr_field[0]!.x = playerFieldX;
          p.dr_dir[1] = PLAYER_DIR_WEST;
          do {
            d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
            if (!d.w) {
              playerFieldX = p.dr_field[0]!.x;
              break;
            }
            playerFieldX -= 2;
            if (playerFieldX <= 0) {
              playerFieldX = p.dr_field[0]!.x;
              break;
            }
            d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
            if (!d.w && !d.n && !d.s) {
              /* dead end? */
              playerFieldX = p.dr_field[0]!.x;
              break;
            }
            if (d.w && droneVisibleWest(world, player, playerFieldY, playerFieldX)) {
              p.dr_field[1]!.y = playerFieldY;
              p.dr_field[1]!.x = playerFieldX;
              p.dr_field[2]!.y = 0;
              p.dr_dir[2] = -1;
              return true;
            }
            if (d.n) {
              p.dr_field[1]!.y = playerFieldY;
              p.dr_field[1]!.x = playerFieldX;
              p.dr_field[2]!.y = 0;
              p.dr_dir[2] = NINJA_PLAN_NORTH;
              p.dr_dir[3] = -1;
              if (droneVisibleNorth(world, player, playerFieldY, playerFieldX)) {
                p.dr_field[2]!.y = playerFieldY - 2;
                p.dr_field[2]!.x = playerFieldX;
                p.dr_field[3]!.y = 0;
                return true;
              }
              do {
                d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                if (!d.n) {
                  playerFieldY = p.dr_field[1]!.y;
                  break;
                }
                playerFieldY -= 2;
                if (playerFieldY < 0) {
                  playerFieldY = p.dr_field[0]!.y;
                  break;
                }
                d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                if (!d.n && !d.w && !d.e) {
                  /* dead end? */
                  playerFieldY = p.dr_field[1]!.y;
                  break;
                }
                if (!d.n && targetFieldX < playerFieldX && !d.w) {
                  playerFieldY = p.dr_field[1]!.y;
                  break;
                }
                if (!d.n && targetFieldX > playerFieldX && !d.e) {
                  playerFieldY = p.dr_field[1]!.y;
                  break;
                }
                if (d.w || d.e) {
                  p.dr_field[2]!.y = playerFieldY;
                  p.dr_field[2]!.x = playerFieldX;
                  p.dr_field[3]!.y = 0;
                  if (targetFieldX < playerFieldX && d.w) {
                    p.dr_dir[3] = PLAYER_DIR_WEST;
                    p.dr_dir[4] = -1;
                    do {
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (!d.w) {
                        playerFieldX = p.dr_field[2]!.x;
                        break;
                      }
                      playerFieldX -= 2;
                      if (playerFieldX <= 0) {
                        playerFieldX = p.dr_field[2]!.x;
                        break;
                      }
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (droneVisibleWest(world, player, playerFieldY, playerFieldX)) {
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (!d.w && !d.n && !d.s) {
                        /* dead end? */
                        playerFieldX = p.dr_field[2]!.x;
                        break;
                      }
                      if (targetFieldY < playerFieldY && d.n) {
                        p.dr_dir[4] = NINJA_PLAN_NORTH;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (targetFieldY > playerFieldY && d.s) {
                        p.dr_dir[4] = PLAYER_DIR_SOUTH;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                    } while (d.w);
                  } else if (targetFieldX > playerFieldX && d.e) {
                    p.dr_dir[3] = PLAYER_DIR_EAST;
                    p.dr_dir[4] = -1;
                    do {
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (!d.e) {
                        playerFieldX = p.dr_field[2]!.x;
                        break;
                      }
                      playerFieldX += 2;
                      if (playerFieldX > MAZE_MAX_SIZE - 1) {
                        playerFieldX = p.dr_field[2]!.x;
                        break;
                      }
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (droneVisibleEast(world, player, playerFieldY, playerFieldX)) {
                        p.dr_field[4]!.y = playerFieldY;
                        p.dr_field[4]!.x = playerFieldX;
                        p.dr_field[5]!.y = 0;
                        return true;
                      }
                      if (!d.e && !d.n && !d.s) {
                        /* dead end? */
                        playerFieldX = p.dr_field[2]!.x;
                        break;
                      }
                      if (targetFieldY < playerFieldY && d.n) {
                        p.dr_dir[4] = NINJA_PLAN_NORTH;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (targetFieldY > playerFieldY && d.s) {
                        p.dr_dir[4] = PLAYER_DIR_SOUTH;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                    } while (d.e);
                  }
                }
              } while (d.n);
              p.dr_dir[0] = 0;
              p.dr_fieldIndex = 0;
              break;
            }
          } while (d.w);
          p.dr_dir[0] = 0;
          p.dr_fieldIndex = 0;
          break;
        }
      } while (d.s);
      p.dr_dir[0] = 0;
      p.dr_fieldIndex = 0;
      d = droneCheckDirsAt(world, player, false, 0, 0);
      playerFieldY = (p.ply_y >> MAZE_FIELD_SHIFT) | 1; /* reset player position */
      playerFieldX = (p.ply_x >> MAZE_FIELD_SHIFT) | 1;
    }
    if (d.n) {
      p.dr_dir[0] = NINJA_PLAN_NORTH;
      do {
        d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
        if (!d.n) break;
        playerFieldY -= 2;
        if (playerFieldY < 0) break;
        d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
        if (!d.n && !d.e && !d.w) break; /* dead end? */
        if (d.w) {
          p.dr_field[0]!.y = playerFieldY;
          p.dr_field[0]!.x = playerFieldX;
          p.dr_dir[1] = PLAYER_DIR_WEST;
          p.dr_dir[2] = -1;
          do {
            d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
            if (!d.w) {
              playerFieldX = p.dr_field[0]!.x;
              break;
            }
            playerFieldX -= 2;
            if (playerFieldX <= 0) {
              playerFieldX = p.dr_field[0]!.x;
              break;
            }
            d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
            if (!d.w && !d.n && !d.s) {
              /* dead end? */
              playerFieldX = p.dr_field[0]!.x;
              break;
            }
            if (d.w && droneVisibleWest(world, player, playerFieldY, playerFieldX)) {
              p.dr_field[1]!.y = playerFieldY;
              p.dr_field[1]!.x = playerFieldX;
              p.dr_field[2]!.y = 0;
              p.dr_dir[2] = -1;
              return true;
            }
            if (d.s) {
              p.dr_field[1]!.y = playerFieldY;
              p.dr_field[1]!.x = playerFieldX;
              p.dr_field[2]!.y = 0;
              p.dr_dir[2] = PLAYER_DIR_SOUTH;
              p.dr_dir[3] = -1;
              if (droneVisibleSouth(world, player, playerFieldY, playerFieldX)) {
                p.dr_field[2]!.y = playerFieldY + 2;
                p.dr_field[2]!.x = playerFieldX;
                p.dr_field[3]!.y = 0;
                return true;
              }
              do {
                d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                if (!d.s) {
                  playerFieldY = p.dr_field[0]!.y;
                  break;
                }
                playerFieldY += 2;
                if (playerFieldY > MAZE_MAX_SIZE - 1) {
                  playerFieldY = p.dr_field[0]!.y;
                  break;
                }
                d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                if (!d.s && !d.e && !d.w) {
                  /* dead end? */
                  playerFieldY = p.dr_field[1]!.y;
                  break;
                }
                if (!d.s && targetFieldX < playerFieldX && !d.w) {
                  playerFieldY = p.dr_field[1]!.y;
                  break;
                }
                if (!d.s && targetFieldX > playerFieldX && !d.e) {
                  playerFieldY = p.dr_field[1]!.y;
                  break;
                }
                if (d.w || d.e) {
                  p.dr_field[2]!.y = playerFieldY;
                  p.dr_field[2]!.x = playerFieldX;
                  p.dr_field[3]!.y = 0;
                  if (targetFieldX < playerFieldX && d.w) {
                    p.dr_dir[3] = PLAYER_DIR_WEST;
                    p.dr_dir[4] = -1;
                    do {
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (!d.w) {
                        playerFieldX = p.dr_field[2]!.x;
                        break;
                      }
                      playerFieldX -= 2;
                      if (playerFieldX <= 0) {
                        playerFieldX = p.dr_field[2]!.x;
                        break;
                      }
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (droneVisibleWest(world, player, playerFieldY, playerFieldX)) {
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (!d.w && !d.n && !d.s) {
                        /* dead end? */
                        playerFieldX = p.dr_field[2]!.x;
                        break;
                      }
                      if (targetFieldY < playerFieldY && d.n) {
                        p.dr_dir[4] = NINJA_PLAN_NORTH;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (targetFieldY > playerFieldY && d.s) {
                        p.dr_dir[4] = PLAYER_DIR_SOUTH;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                    } while (d.w);
                  } else if (targetFieldX > playerFieldX && d.e) {
                    p.dr_dir[3] = PLAYER_DIR_EAST;
                    p.dr_dir[4] = -1;
                    do {
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (!d.e) {
                        playerFieldX = p.dr_field[2]!.x;
                        break;
                      }
                      playerFieldX += 2;
                      if (playerFieldX > MAZE_MAX_SIZE - 1) {
                        playerFieldX = p.dr_field[2]!.x;
                        break;
                      }
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (droneVisibleEast(world, player, playerFieldY, playerFieldX)) {
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (!d.e && !d.n && !d.s) {
                        /* dead end? */
                        playerFieldX = p.dr_field[2]!.x;
                        break;
                      }
                      if (targetFieldY < playerFieldY && d.n) {
                        p.dr_dir[4] = NINJA_PLAN_NORTH;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (targetFieldY > playerFieldY && d.s) {
                        p.dr_dir[4] = PLAYER_DIR_SOUTH;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                    } while (d.e);
                  }
                }
              } while (d.s);
              p.dr_dir[0] = 0;
              p.dr_fieldIndex = 0;
              break;
            }
          } while (d.w);
          p.dr_dir[0] = 0;
          p.dr_fieldIndex = 0;
          return false;
        }
      } while (d.n);
    }
    p.dr_dir[0] = 0;
    p.dr_fieldIndex = 0;
    return false;
  }
  if (wantedDirChar === 'e') {
    if (d.s) {
      p.dr_dir[0] = PLAYER_DIR_SOUTH;
      p.dr_dir[1] = -1;
      do {
        d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
        if (!d.s) break;
        playerFieldY += 2;
        if (playerFieldY > MAZE_MAX_SIZE - 1) {
          playerFieldY = (p.ply_y >> MAZE_FIELD_SHIFT) | 1;
          break;
        }
        d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
        if (!d.s && !d.e && !d.w) {
          /* dead end? */
          playerFieldY = (p.ply_y >> MAZE_FIELD_SHIFT) | 1;
          break;
        }
        if (d.e) {
          p.dr_field[0]!.y = playerFieldY;
          p.dr_field[0]!.x = playerFieldX;
          p.dr_dir[1] = PLAYER_DIR_EAST;
          p.dr_dir[2] = -1;
          do {
            d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
            if (!d.e) {
              playerFieldX = p.dr_field[0]!.x;
              break;
            }
            playerFieldX += 2;
            if (playerFieldX > MAZE_MAX_SIZE - 1) {
              playerFieldX = p.dr_field[0]!.x;
              break;
            }
            d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
            if (!d.e && !d.n && !d.s) {
              /* dead end? */
              playerFieldX = p.dr_field[0]!.x;
              break;
            }
            if (d.e && droneVisibleEast(world, player, playerFieldY, playerFieldX)) {
              p.dr_field[1]!.y = playerFieldY;
              p.dr_field[1]!.x = playerFieldX;
              p.dr_field[2]!.y = 0;
              p.dr_dir[2] = -1;
              return true;
            }
            if (d.n) {
              p.dr_field[1]!.y = playerFieldY;
              p.dr_field[1]!.x = playerFieldX;
              p.dr_field[2]!.y = 0;
              p.dr_dir[2] = NINJA_PLAN_NORTH;
              p.dr_dir[3] = -1;
              if (droneVisibleNorth(world, player, playerFieldY, playerFieldX)) {
                p.dr_field[2]!.y = playerFieldY - 2;
                p.dr_field[2]!.x = playerFieldX;
                p.dr_field[3]!.y = 0;
                return true;
              }
              do {
                d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                if (!d.n) {
                  playerFieldY = p.dr_field[1]!.y;
                  break;
                }
                playerFieldY -= 2;
                if (playerFieldY < 0) {
                  playerFieldY = p.dr_field[1]!.y;
                  break;
                }
                d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                if (!d.n && !d.w && !d.e) {
                  /* dead end? */
                  playerFieldY = p.dr_field[1]!.y;
                  break;
                }
                if (!d.n && targetFieldX < playerFieldX && !d.w) {
                  playerFieldY = p.dr_field[1]!.y;
                  break;
                }
                if (!d.n && targetFieldX > playerFieldX && !d.e) {
                  playerFieldY = p.dr_field[1]!.y;
                  break;
                }
                if (d.w || d.e) {
                  p.dr_field[2]!.y = playerFieldY;
                  p.dr_field[2]!.x = playerFieldX;
                  p.dr_field[3]!.y = 0;
                  if (targetFieldX < playerFieldX && d.w) {
                    p.dr_dir[3] = PLAYER_DIR_WEST;
                    p.dr_dir[4] = -1;
                    do {
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (!d.w) {
                        playerFieldX = p.dr_field[2]!.x;
                        break;
                      }
                      playerFieldX -= 2;
                      if (playerFieldX <= 0) {
                        playerFieldX = p.dr_field[2]!.x;
                        break;
                      }
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (droneVisibleWest(world, player, playerFieldY, playerFieldX)) {
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (!d.w && !d.n && !d.s) {
                        /* dead end? */
                        playerFieldX = p.dr_field[2]!.x;
                        break;
                      }
                      if (targetFieldY < playerFieldY && d.n) {
                        p.dr_dir[4] = NINJA_PLAN_NORTH;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (targetFieldY > playerFieldY && d.s) {
                        p.dr_dir[4] = PLAYER_DIR_SOUTH;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                    } while (d.w);
                  } else if (targetFieldX > playerFieldX && d.e) {
                    p.dr_dir[3] = PLAYER_DIR_EAST;
                    p.dr_dir[4] = -1;
                    do {
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (!d.e) {
                        playerFieldX = p.dr_field[2]!.x;
                        break;
                      }
                      playerFieldX += 2;
                      if (playerFieldX > MAZE_MAX_SIZE - 1) {
                        playerFieldX = p.dr_field[2]!.x;
                        break;
                      }
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (droneVisibleEast(world, player, playerFieldY, playerFieldX)) {
                        p.dr_field[4]!.y = playerFieldY;
                        p.dr_field[4]!.x = playerFieldX;
                        p.dr_field[5]!.y = 0;
                        return true;
                      }
                      if (!d.e && !d.n && !d.s) {
                        /* dead end? */
                        playerFieldX = p.dr_field[2]!.x;
                        break;
                      }
                      if (targetFieldY < playerFieldY && d.n) {
                        p.dr_dir[4] = NINJA_PLAN_NORTH;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (targetFieldY > playerFieldY && d.s) {
                        p.dr_dir[4] = PLAYER_DIR_SOUTH;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                    } while (d.e);
                  }
                }
              } while (d.n);
              p.dr_dir[0] = 0;
              p.dr_fieldIndex = 0;
              break;
            }
          } while (d.e);
          p.dr_dir[0] = 0;
          p.dr_fieldIndex = 0;
          break;
        }
      } while (d.s);
      p.dr_dir[0] = 0;
      p.dr_fieldIndex = 0;
      d = droneCheckDirsAt(world, player, false, 0, 0);
      playerFieldY = (p.ply_y >> MAZE_FIELD_SHIFT) | 1; /* reset player position */
      playerFieldX = (p.ply_x >> MAZE_FIELD_SHIFT) | 1;
    }
    if (d.n) {
      p.dr_dir[0] = NINJA_PLAN_NORTH;
      do {
        d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
        if (!d.n) break;
        playerFieldY -= 2;
        if (playerFieldY < 0) break;
        d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
        if (d.e) {
          p.dr_field[0]!.y = playerFieldY;
          p.dr_field[0]!.x = playerFieldX;
          p.dr_dir[1] = PLAYER_DIR_EAST;
          do {
            d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
            if (!d.e) {
              playerFieldX = p.dr_field[0]!.x;
              break;
            }
            playerFieldX += 2;
            if (playerFieldX > MAZE_MAX_SIZE - 1) {
              playerFieldX = p.dr_field[0]!.x;
              break;
            }
            d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
            if (!d.e && !d.n && !d.s) {
              /* dead end? */
              playerFieldX = p.dr_field[0]!.x;
              break;
            }
            if (d.e && droneVisibleEast(world, player, playerFieldY, playerFieldX)) {
              p.dr_field[1]!.y = playerFieldY;
              p.dr_field[1]!.x = playerFieldX;
              p.dr_field[2]!.y = 0;
              p.dr_dir[2] = -1;
              return true;
            }
            if (d.s) {
              p.dr_field[1]!.y = playerFieldY;
              p.dr_field[1]!.x = playerFieldX;
              p.dr_field[2]!.y = 0;
              p.dr_dir[2] = PLAYER_DIR_SOUTH;
              p.dr_dir[3] = -1;
              do {
                d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                if (!d.s) {
                  playerFieldY = p.dr_field[1]!.y;
                  break;
                }
                playerFieldY += 2;
                if (playerFieldY > MAZE_MAX_SIZE - 1) {
                  playerFieldY = p.dr_field[0]!.y;
                  break;
                }
                d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                if (d.s && droneVisibleSouth(world, player, playerFieldY, playerFieldX)) {
                  p.dr_field[2]!.y = playerFieldY + 2;
                  p.dr_field[2]!.x = playerFieldX;
                  p.dr_field[3]!.y = 0;
                  return true;
                }
                if (!d.s && !d.e && !d.w) {
                  /* dead end? */
                  playerFieldY = p.dr_field[1]!.y;
                  break;
                }
                if (!d.s && targetFieldX < playerFieldX && !d.w) {
                  playerFieldY = p.dr_field[1]!.y;
                  break;
                }
                if (!d.s && targetFieldX > playerFieldX && !d.e) {
                  playerFieldY = p.dr_field[1]!.y;
                  break;
                }
                if (d.w || d.e) {
                  p.dr_field[2]!.y = playerFieldY;
                  p.dr_field[2]!.x = playerFieldX;
                  p.dr_field[3]!.y = 0;
                  if (targetFieldX < playerFieldX && d.w) {
                    p.dr_dir[3] = PLAYER_DIR_WEST;
                    p.dr_dir[4] = -1;
                    do {
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (!d.w) {
                        playerFieldX = p.dr_field[2]!.x;
                        break;
                      }
                      playerFieldX -= 2;
                      if (playerFieldX <= 0) {
                        playerFieldX = p.dr_field[2]!.x;
                        break;
                      }
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (droneVisibleWest(world, player, playerFieldY, playerFieldX)) {
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (!d.w && !d.n && !d.s) {
                        /* dead end? */
                        playerFieldX = p.dr_field[2]!.x;
                        break;
                      }
                      if (targetFieldY < playerFieldY && d.n) {
                        p.dr_dir[4] = NINJA_PLAN_NORTH;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (targetFieldY > playerFieldY && d.s) {
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        p.dr_dir[3] = PLAYER_DIR_SOUTH;
                        p.dr_dir[4] = -1;
                        return true;
                      }
                    } while (d.w);
                  } else if (targetFieldX > playerFieldX && d.e) {
                    p.dr_dir[3] = PLAYER_DIR_EAST;
                    p.dr_dir[4] = -1;
                    do {
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (!d.e) {
                        playerFieldX = p.dr_field[2]!.x;
                        break;
                      }
                      playerFieldX += 2;
                      if (playerFieldX > MAZE_MAX_SIZE - 1) {
                        playerFieldX = p.dr_field[2]!.x;
                        break;
                      }
                      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                      if (droneVisibleEast(world, player, playerFieldY, playerFieldX)) {
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (!d.e && !d.n && !d.s) {
                        /* dead end? */
                        playerFieldX = p.dr_field[2]!.x;
                        break;
                      }
                      if (targetFieldY < playerFieldY && d.n) {
                        p.dr_dir[4] = NINJA_PLAN_NORTH;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                      if (targetFieldY > playerFieldY && d.s) {
                        p.dr_dir[4] = PLAYER_DIR_SOUTH;
                        p.dr_dir[5] = -1;
                        p.dr_field[3]!.y = playerFieldY;
                        p.dr_field[3]!.x = playerFieldX;
                        p.dr_field[4]!.y = 0;
                        return true;
                      }
                    } while (d.e);
                  }
                }
              } while (d.s);
              p.dr_dir[0] = 0;
              p.dr_fieldIndex = 0;
              break;
            }
          } while (d.e);
          p.dr_dir[0] = 0;
          p.dr_fieldIndex = 0;
          return false;
        }
      } while (d.n);
    }
    p.dr_dir[0] = 0;
    p.dr_fieldIndex = 0;
    return false;
  }
  p.dr_dir[0] = 0;
  p.dr_fieldIndex = 0;
  return false;
}

function droneSubNinjaNorth(world: World, player: number, wantedDirChar: string): boolean {
  const p = world.players[player]!;
  let d: Dirs = { n: false, s: false, e: false, w: false };
  let target_player = 0;
  let targetPlayerFieldX = 0;
  let playerFieldX = 0;
  let playerFieldY = 0;

  p.dr_fieldIndex = 0;
  p.dr_upRotationCounter = 0;
  p.dr_rotateCounter = 0;
  p.dr_dir[0] = 0;
  p.dr_field[0]!.y = 0;
  target_player = p.dr_currentTarget;
  playerFieldY = (p.ply_y >> MAZE_FIELD_SHIFT) | 1;
  playerFieldX = (p.ply_x >> MAZE_FIELD_SHIFT) | 1;
  targetPlayerFieldX = (world.players[target_player]!.ply_x >> MAZE_FIELD_SHIFT) | 1;
  d = droneCheckDirsAt(world, player, false, 0, 0);
  if (wantedDirChar === 'e' && !d.e && !d.n && d.w) {
    do {
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.w) break;
      playerFieldX -= 2;
      if (playerFieldX <= 0) break;
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (d.n) {
        p.dr_field[0]!.y = playerFieldY;
        p.dr_field[0]!.x = playerFieldX;
        do {
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.n) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          playerFieldY -= 2;
          if (playerFieldY <= 0) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.n && !d.e) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          if (d.e) {
            p.dr_field[1]!.y = playerFieldY;
            p.dr_field[1]!.x = playerFieldX;
            do {
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.e) {
                playerFieldX = p.dr_field[1]!.x;
                break;
              }
              playerFieldX += 2;
              if (playerFieldX > MAZE_MAX_SIZE - 1) {
                playerFieldX = p.dr_field[1]!.x;
                break;
              }
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.s && !d.e) {
                playerFieldX = p.dr_field[1]!.x;
                break;
              }
              if (d.s) {
                p.dr_field[2]!.y = playerFieldY;
                p.dr_field[2]!.x = playerFieldX;
                p.dr_field[3]!.y = playerFieldY + 2;
                p.dr_field[3]!.x = playerFieldX;
                p.dr_field[4]!.y = 0;
                p.dr_dir[0] = PLAYER_DIR_WEST;
                p.dr_dir[1] = NINJA_PLAN_NORTH;
                p.dr_dir[2] = PLAYER_DIR_EAST;
                p.dr_dir[3] = PLAYER_DIR_SOUTH;
                p.dr_dir[4] = -1;
                p.dr_fieldIndex = 0;
                return true;
              }
            } while (d.e);
            p.dr_dir[0] = 0;
            p.dr_fieldIndex = 0;
            return false;
          }
        } while (d.n);
        p.dr_dir[0] = 0;
        p.dr_fieldIndex = 0;
        return false;
      }
    } while (d.w);
    p.dr_dir[0] = 0;
    p.dr_fieldIndex = 0;
    return false;
  }
  if (wantedDirChar === 'w' && !d.w && !d.n && d.e) {
    do {
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.e) break;
      playerFieldX += 2;
      if (playerFieldX > MAZE_MAX_SIZE - 1) break;
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (d.n) {
        p.dr_field[0]!.y = playerFieldY;
        p.dr_field[0]!.x = playerFieldX;
        do {
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.n) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          playerFieldY -= 2;
          if (playerFieldY <= 0) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.n && !d.w) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          if (d.w) {
            p.dr_field[1]!.y = playerFieldY;
            p.dr_field[1]!.x = playerFieldX;
            do {
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.w) {
                playerFieldX = p.dr_field[1]!.x;
                break;
              }
              playerFieldX -= 2;
              if (playerFieldX < 0) {
                playerFieldX = p.dr_field[1]!.x;
                break;
              }
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.w && !d.s) {
                playerFieldX = p.dr_field[1]!.x;
                break;
              }
              if (d.s) {
                p.dr_field[2]!.y = playerFieldY;
                p.dr_field[2]!.x = playerFieldX;
                p.dr_field[3]!.y = playerFieldY + 2;
                p.dr_field[3]!.x = playerFieldX;
                p.dr_field[4]!.y = 0;
                p.dr_dir[0] = PLAYER_DIR_EAST;
                p.dr_dir[1] = NINJA_PLAN_NORTH;
                p.dr_dir[2] = PLAYER_DIR_WEST;
                p.dr_dir[3] = PLAYER_DIR_SOUTH;
                p.dr_dir[4] = -1;
                p.dr_fieldIndex = 0;
                return true;
              }
            } while (d.w);
            p.dr_dir[0] = 0;
            p.dr_fieldIndex = 0;
            return false;
          }
        } while (d.n);
        p.dr_dir[0] = 0;
        p.dr_fieldIndex = 0;
        return false;
      }
    } while (d.e);
    p.dr_dir[0] = 0;
    p.dr_fieldIndex = 0;
    return false;
  }
  if (d.n) {
    do {
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.n) break;
      playerFieldY -= 2;
      if (playerFieldY < 0) break;
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (wantedDirChar === 'w' && d.w) {
        p.dr_field[0]!.y = playerFieldY;
        p.dr_field[0]!.x = playerFieldX;
        do {
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.w) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          playerFieldX -= 2;
          if (playerFieldX <= 0) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.w && !d.s) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          if (d.s) {
            p.dr_field[1]!.y = playerFieldY;
            p.dr_field[1]!.x = playerFieldX;
            do {
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.s) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              playerFieldY += 2;
              if (playerFieldY > MAZE_MAX_SIZE - 1) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.s && !d.e && !d.w) {
                /* dead end? */
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              if (playerFieldX === targetPlayerFieldX || d.s || d.e || d.w) {
                p.dr_field[2]!.y = playerFieldY;
                p.dr_field[2]!.x = playerFieldX;
                p.dr_field[3]!.y = 0;
                p.dr_dir[0] = NINJA_PLAN_NORTH;
                p.dr_dir[1] = PLAYER_DIR_WEST;
                p.dr_dir[2] = PLAYER_DIR_SOUTH;
                p.dr_dir[3] = -1;
                p.dr_fieldIndex = 0;
                return true;
              }
            } while (d.s);
          }
        } while (d.w);
      } else {
        if (wantedDirChar === 'e' && d.e) {
          p.dr_field[0]!.y = playerFieldY;
          p.dr_field[0]!.x = playerFieldX;
          do {
            d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
            if (!d.e) {
              playerFieldX = p.dr_field[0]!.x;
              break;
            }
            playerFieldX += 2;
            if (playerFieldX > MAZE_MAX_SIZE - 1) {
              playerFieldX = p.dr_field[0]!.x;
              break;
            }
            d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
            if (!d.e && !d.s) {
              playerFieldX = p.dr_field[0]!.x;
              break;
            }
            if (d.s) {
              p.dr_field[1]!.y = playerFieldY;
              p.dr_field[1]!.x = playerFieldX;
              do {
                d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                if (!d.s) {
                  playerFieldY = p.dr_field[1]!.y;
                  break;
                }
                playerFieldY += 2;
                if (playerFieldY > MAZE_MAX_SIZE - 1) {
                  playerFieldY = p.dr_field[1]!.y;
                  break;
                }
                d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                if (!d.e && !d.s && !d.w) {
                  /* dead end? */
                  playerFieldY = p.dr_field[1]!.y;
                  break;
                }
                if (playerFieldX === targetPlayerFieldX || d.s || d.e || d.w) {
                  p.dr_field[2]!.y = playerFieldY;
                  p.dr_field[2]!.x = playerFieldX;
                  p.dr_field[3]!.y = 0;
                  p.dr_dir[0] = NINJA_PLAN_NORTH;
                  p.dr_dir[1] = PLAYER_DIR_EAST;
                  p.dr_dir[2] = PLAYER_DIR_SOUTH;
                  p.dr_dir[3] = -1;
                  p.dr_fieldIndex = 0;
                  return true;
                }
              } while (d.s);
            }
          } while (d.e);
        }
      }
    } while (d.n);
  }
  playerFieldY = (p.ply_y >> MAZE_FIELD_SHIFT) | 1;
  playerFieldX = (p.ply_x >> MAZE_FIELD_SHIFT) | 1;
  d = droneCheckDirsAt(world, player, false, 0, 0);
  if (wantedDirChar === 'w' && d.n) {
    do {
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.n) break;
      playerFieldY -= 2;
      if (playerFieldY <= 0) break;
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (d.e) {
        p.dr_field[0]!.y = playerFieldY;
        p.dr_field[0]!.x = playerFieldX;
        do {
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.e) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          playerFieldX += 2;
          if (playerFieldX > MAZE_MAX_SIZE - 1) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.e && !d.n) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          if (d.n) {
            p.dr_field[1]!.y = playerFieldY;
            p.dr_field[1]!.x = playerFieldX;
            do {
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.n) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              playerFieldY -= 2;
              if (playerFieldY <= 0) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.n && !d.w) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              if (d.w) {
                p.dr_field[2]!.y = playerFieldY;
                p.dr_field[2]!.x = playerFieldX;
                p.dr_field[3]!.y = playerFieldY;
                p.dr_field[3]!.x = playerFieldX - 2;
                p.dr_field[4]!.y = 0;
                p.dr_dir[0] = NINJA_PLAN_NORTH;
                p.dr_dir[1] = PLAYER_DIR_EAST;
                p.dr_dir[2] = NINJA_PLAN_NORTH;
                p.dr_dir[3] = PLAYER_DIR_WEST;
                p.dr_dir[4] = -1;
                p.dr_fieldIndex = 0;
                return true;
              }
            } while (d.n);
            p.dr_dir[0] = 0;
            p.dr_fieldIndex = 0;
            return false;
          }
        } while (d.e);
        p.dr_dir[0] = 0;
        p.dr_fieldIndex = 0;
        return false;
      }
    } while (d.n);
    p.dr_dir[0] = 0;
    p.dr_fieldIndex = 0;
    return false;
  }
  if (wantedDirChar === 'e' && d.n) {
    do {
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.n) break;
      playerFieldY -= 2;
      if (playerFieldY <= 0) {
        playerFieldY = p.dr_field[0]!.y;
        break;
      }
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (d.w) {
        p.dr_field[0]!.y = playerFieldY;
        p.dr_field[0]!.x = playerFieldX;
        do {
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.w) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          playerFieldX -= 2;
          if (playerFieldX <= 0) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.w && !d.n) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          if (d.n) {
            p.dr_field[1]!.y = playerFieldY;
            p.dr_field[1]!.x = playerFieldX;
            do {
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.n) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              playerFieldY -= 2;
              if (playerFieldY <= 0) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.n && !d.e) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              if (d.e) {
                p.dr_field[2]!.y = playerFieldY;
                p.dr_field[2]!.x = playerFieldX;
                p.dr_field[3]!.y = playerFieldY;
                p.dr_field[3]!.x = playerFieldX + 2;
                p.dr_field[4]!.y = 0;
                p.dr_dir[0] = NINJA_PLAN_NORTH;
                p.dr_dir[1] = PLAYER_DIR_WEST;
                p.dr_dir[2] = NINJA_PLAN_NORTH;
                p.dr_dir[3] = PLAYER_DIR_EAST;
                p.dr_dir[4] = -1;
                p.dr_fieldIndex = 0;
                return true;
              }
            } while (d.n);
            p.dr_dir[0] = 0;
            p.dr_fieldIndex = 0;
            return false;
          }
        } while (d.w);
        p.dr_dir[0] = 0;
        p.dr_fieldIndex = 0;
        return false;
      }
    } while (d.n);
    p.dr_dir[0] = 0;
    p.dr_fieldIndex = 0;
    return false;
  }
  p.dr_dir[0] = 0;
  p.dr_fieldIndex = 0;
  return false;
}

function droneSubNinjaSouth(world: World, player: number, wantedDirChar: string): boolean {
  const p = world.players[player]!;
  let d: Dirs = { n: false, s: false, e: false, w: false };
  let target_player = 0;
  let targetPlayerFieldX = 0;
  let playerFieldX = 0;
  let playerFieldY = 0;

  p.dr_fieldIndex = 0;
  p.dr_upRotationCounter = 0;
  p.dr_rotateCounter = 0;
  p.dr_dir[0] = 0;
  p.dr_field[0]!.y = 0;
  target_player = p.dr_currentTarget;
  playerFieldY = (p.ply_y >> MAZE_FIELD_SHIFT) | 1;
  playerFieldX = (p.ply_x >> MAZE_FIELD_SHIFT) | 1;
  targetPlayerFieldX = (world.players[target_player]!.ply_x >> MAZE_FIELD_SHIFT) | 1;
  d = droneCheckDirsAt(world, player, false, 0, 0);
  if (wantedDirChar === 'e' && !d.e && !d.s && d.w) {
    do {
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.w) break;
      playerFieldX -= 2;
      if (playerFieldX <= 0) break;
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (d.s) {
        p.dr_field[0]!.y = playerFieldY;
        p.dr_field[0]!.x = playerFieldX;
        do {
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.s) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          playerFieldY += 2;
          if (playerFieldY > MAZE_MAX_SIZE - 1) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.s && !d.e) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          if (d.e) {
            p.dr_field[1]!.y = playerFieldY;
            p.dr_field[1]!.x = playerFieldX;
            p.dr_field[2]!.y = playerFieldY;
            p.dr_field[2]!.x = playerFieldX + 2;
            p.dr_field[3]!.y = 0;
            p.dr_dir[0] = PLAYER_DIR_WEST;
            p.dr_dir[1] = PLAYER_DIR_SOUTH;
            p.dr_dir[2] = PLAYER_DIR_EAST;
            p.dr_dir[3] = -1;
            p.dr_fieldIndex = 0;
            return true;
          }
        } while (d.s);
        p.dr_dir[0] = 0;
        p.dr_fieldIndex = 0;
        return false;
      }
    } while (d.w);
    p.dr_dir[0] = 0;
    p.dr_fieldIndex = 0;
    return false;
  }
  if (wantedDirChar === 'w' && !d.w && !d.s && d.e) {
    do {
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.e) break;
      playerFieldX += 2;
      if (playerFieldX > MAZE_MAX_SIZE - 1) break;
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (d.s) {
        p.dr_field[0]!.y = playerFieldY;
        p.dr_field[0]!.x = playerFieldX;
        do {
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.s) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          playerFieldY += 2;
          if (playerFieldY > MAZE_MAX_SIZE - 1) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.s && !d.w) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          if (d.w) {
            p.dr_field[1]!.y = playerFieldY;
            p.dr_field[1]!.x = playerFieldX;
            p.dr_field[2]!.y = playerFieldY;
            p.dr_field[2]!.x = playerFieldX - 2;
            p.dr_field[3]!.y = 0;
            p.dr_dir[0] = PLAYER_DIR_EAST;
            p.dr_dir[1] = PLAYER_DIR_SOUTH;
            p.dr_dir[2] = PLAYER_DIR_WEST;
            p.dr_dir[3] = -1;
            p.dr_fieldIndex = 0;
            return true;
          }
        } while (d.s);
        p.dr_dir[0] = 0;
        p.dr_fieldIndex = 0;
        return false;
      }
    } while (d.e);
    p.dr_dir[0] = 0;
    p.dr_fieldIndex = 0;
    return false;
  }
  if (d.s) {
    do {
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.s) break;
      playerFieldY += 2;
      if (playerFieldY > MAZE_MAX_SIZE - 1) break;
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.s && !d.e && !d.w) break; /* dead end? */
      if (wantedDirChar === 'w' && d.w) {
        p.dr_field[0]!.y = playerFieldY;
        p.dr_field[0]!.x = playerFieldX;
        do {
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.w) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          playerFieldX -= 2;
          if (playerFieldX <= 0) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.n && !d.w) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          if (d.n) {
            p.dr_field[1]!.y = playerFieldY;
            p.dr_field[1]!.x = playerFieldX;
            do {
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.n) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              playerFieldY -= 2;
              if (playerFieldY <= 0) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.n && !d.e && !d.w) {
                /* dead end? */
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              if (playerFieldX === targetPlayerFieldX || d.n || d.e || d.w) {
                p.dr_field[2]!.y = playerFieldY;
                p.dr_field[2]!.x = playerFieldX;
                p.dr_field[3]!.y = 0;
                p.dr_dir[0] = PLAYER_DIR_SOUTH;
                p.dr_dir[1] = PLAYER_DIR_WEST;
                p.dr_dir[2] = NINJA_PLAN_NORTH;
                p.dr_dir[3] = -1;
                p.dr_fieldIndex = 0;
                return true;
              }
            } while (d.n);
          }
        } while (d.w);
      } else {
        if (wantedDirChar === 'e' && d.e) {
          p.dr_field[0]!.y = playerFieldY;
          p.dr_field[0]!.x = playerFieldX;
          do {
            d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
            if (!d.e) {
              playerFieldX = p.dr_field[0]!.x;
              break;
            }
            playerFieldX += 2;
            if (playerFieldX > MAZE_MAX_SIZE - 1) {
              playerFieldX = p.dr_field[0]!.x;
              break;
            }
            d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
            if (!d.n && !d.e) {
              playerFieldX = p.dr_field[0]!.x;
              break;
            }
            if (d.n) {
              p.dr_field[1]!.y = playerFieldY;
              p.dr_field[1]!.x = playerFieldX;
              do {
                d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                if (!d.n) {
                  playerFieldY = p.dr_field[1]!.y;
                  break;
                }
                playerFieldY -= 2;
                if (playerFieldY <= 0) {
                  playerFieldY = p.dr_field[1]!.y;
                  break;
                }
                d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                if (!d.n && !d.e && !d.w) {
                  /* dead end? */
                  playerFieldY = p.dr_field[1]!.y;
                  break;
                }
                if (playerFieldX === targetPlayerFieldX || d.n || d.e || d.w) {
                  p.dr_field[2]!.y = playerFieldY;
                  p.dr_field[2]!.x = playerFieldX;
                  p.dr_field[3]!.y = 0;
                  p.dr_dir[0] = PLAYER_DIR_SOUTH;
                  p.dr_dir[1] = PLAYER_DIR_EAST;
                  p.dr_dir[2] = NINJA_PLAN_NORTH;
                  p.dr_dir[3] = -1;
                  p.dr_fieldIndex = 0;
                  return true;
                }
              } while (d.n);
            }
          } while (d.e);
        }
      }
    } while (d.s);
  }
  playerFieldY = (p.ply_y >> MAZE_FIELD_SHIFT) | 1;
  playerFieldX = (p.ply_x >> MAZE_FIELD_SHIFT) | 1;
  d = droneCheckDirsAt(world, player, false, 0, 0);
  if (wantedDirChar === 'w' && d.s) {
    do {
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.s) break;
      playerFieldY += 2;
      if (playerFieldY > MAZE_MAX_SIZE - 1) break;
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (d.w) {
        p.dr_field[0]!.y = playerFieldY;
        p.dr_field[0]!.x = playerFieldX;
        do {
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.w) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          playerFieldX -= 2;
          if (playerFieldX <= 0) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.w && !d.s) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          if (d.s) {
            p.dr_field[1]!.y = playerFieldY;
            p.dr_field[1]!.x = playerFieldX;
            do {
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.s) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              playerFieldY += 2;
              if (playerFieldY > MAZE_MAX_SIZE - 1) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.s && !d.e) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              if (d.e) {
                p.dr_field[2]!.y = playerFieldY;
                p.dr_field[2]!.x = playerFieldX;
                p.dr_field[3]!.y = playerFieldY;
                p.dr_field[3]!.x = playerFieldX + 2;
                p.dr_field[4]!.y = 0;
                p.dr_dir[0] = PLAYER_DIR_SOUTH;
                p.dr_dir[1] = PLAYER_DIR_WEST;
                p.dr_dir[2] = PLAYER_DIR_SOUTH;
                p.dr_dir[3] = PLAYER_DIR_EAST;
                p.dr_dir[4] = -1;
                p.dr_fieldIndex = 0;
                return true;
              }
            } while (d.s);
            p.dr_dir[0] = 0;
            p.dr_fieldIndex = 0;
            return false;
          }
        } while (d.w);
        p.dr_dir[0] = 0;
        p.dr_fieldIndex = 0;
        return false;
      }
    } while (d.s);
    p.dr_dir[0] = 0;
    p.dr_fieldIndex = 0;
    return false;
  }
  if (wantedDirChar === 'e' && d.s) {
    do {
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.s) break;
      playerFieldY += 2;
      if (playerFieldY > MAZE_MAX_SIZE - 1) break;
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (d.e) {
        p.dr_field[0]!.y = playerFieldY;
        p.dr_field[0]!.x = playerFieldX;
        do {
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.e) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          playerFieldX += 2;
          if (playerFieldX > MAZE_MAX_SIZE - 1) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.e && !d.s) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          if (d.s) {
            p.dr_field[1]!.y = playerFieldY;
            p.dr_field[1]!.x = playerFieldX;
            do {
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.s) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              playerFieldY += 2;
              if (playerFieldY > MAZE_MAX_SIZE - 1) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.s && !d.w) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              if (d.w) {
                p.dr_field[2]!.y = playerFieldY;
                p.dr_field[2]!.x = playerFieldX;
                p.dr_field[3]!.y = playerFieldY;
                p.dr_field[3]!.x = playerFieldX - 2;
                p.dr_field[4]!.y = 0;
                p.dr_dir[0] = PLAYER_DIR_SOUTH;
                p.dr_dir[1] = PLAYER_DIR_EAST;
                p.dr_dir[2] = PLAYER_DIR_SOUTH;
                p.dr_dir[3] = PLAYER_DIR_WEST;
                p.dr_dir[4] = -1;
                p.dr_fieldIndex = 0;
                return true;
              }
            } while (d.s);
            p.dr_dir[0] = 0;
            p.dr_fieldIndex = 0;
            return false;
          }
        } while (d.e);
        p.dr_dir[0] = 0;
        p.dr_fieldIndex = 0;
        return false;
      }
    } while (d.s);
    p.dr_dir[0] = 0;
    p.dr_fieldIndex = 0;
    return false;
  }
  p.dr_dir[0] = 0;
  p.dr_fieldIndex = 0;
  return false;
}

function droneSubNinjaEast(world: World, player: number, wantedDirChar: string): boolean {
  const p = world.players[player]!;
  let d: Dirs = { n: false, s: false, e: false, w: false };
  let target_player = 0;
  let targetPlayerFieldY = 0;
  let playerFieldX = 0;
  let playerFieldY = 0;

  p.dr_fieldIndex = 0;
  p.dr_upRotationCounter = 0;
  p.dr_rotateCounter = 0;
  p.dr_dir[0] = 0;
  p.dr_field[0]!.y = 0;
  target_player = p.dr_currentTarget;
  playerFieldY = (p.ply_y >> MAZE_FIELD_SHIFT) | 1;
  playerFieldX = (p.ply_x >> MAZE_FIELD_SHIFT) | 1;
  targetPlayerFieldY = (world.players[target_player]!.ply_y >> MAZE_FIELD_SHIFT) | 1;
  d = droneCheckDirsAt(world, player, false, 0, 0);
  if (wantedDirChar === 'n' && !d.n && !d.e && d.s) {
    do {
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.s) break;
      playerFieldY += 2;
      if (playerFieldY > MAZE_MAX_SIZE - 1) break;
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (d.e) {
        p.dr_field[0]!.y = playerFieldY;
        p.dr_field[0]!.x = playerFieldX;
        do {
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.e) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          playerFieldX += 2;
          if (playerFieldX > MAZE_MAX_SIZE - 1) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.e && !d.n) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          if (d.n) {
            p.dr_field[1]!.y = playerFieldY;
            p.dr_field[1]!.x = playerFieldX;
            do {
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.n) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              playerFieldY -= 2;
              if (playerFieldY <= 0) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.n && !d.w) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              if (d.w) {
                p.dr_field[2]!.y = playerFieldY;
                p.dr_field[2]!.x = playerFieldX;
                p.dr_field[3]!.y = playerFieldY;
                p.dr_field[3]!.x = playerFieldX - 2;
                p.dr_field[4]!.y = 0;
                p.dr_dir[0] = PLAYER_DIR_SOUTH;
                p.dr_dir[1] = PLAYER_DIR_EAST;
                p.dr_dir[2] = NINJA_PLAN_NORTH;
                p.dr_dir[3] = PLAYER_DIR_WEST;
                p.dr_dir[4] = -1;
                p.dr_fieldIndex = 0;
                return true;
              }
            } while (d.n);
            p.dr_dir[0] = 0;
            p.dr_fieldIndex = 0;
            return false;
          }
        } while (d.e);
        p.dr_dir[0] = 0;
        p.dr_fieldIndex = 0;
        return false;
      }
    } while (d.s);
    p.dr_dir[0] = 0;
    p.dr_fieldIndex = 0;
    return false;
  }
  if (wantedDirChar === 's' && !d.s && !d.e && d.n) {
    do {
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.n) break;
      playerFieldY -= 2;
      if (playerFieldY <= 0) break;
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (d.e) {
        p.dr_field[0]!.y = playerFieldY;
        p.dr_field[0]!.x = playerFieldX;
        do {
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.e) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          playerFieldX += 2;
          if (playerFieldX > MAZE_MAX_SIZE - 1) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.e && !d.s) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          if (d.s) {
            p.dr_field[1]!.y = playerFieldY;
            p.dr_field[1]!.x = playerFieldX;
            do {
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.s) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              playerFieldY += 2;
              if (playerFieldY > MAZE_MAX_SIZE - 1) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.s && !d.w) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              if (d.w) {
                p.dr_field[2]!.y = playerFieldY;
                p.dr_field[2]!.x = playerFieldX;
                p.dr_field[3]!.y = playerFieldY;
                p.dr_field[3]!.x = playerFieldX - 2;
                p.dr_field[4]!.y = 0;
                p.dr_dir[0] = NINJA_PLAN_NORTH;
                p.dr_dir[1] = PLAYER_DIR_EAST;
                p.dr_dir[2] = PLAYER_DIR_SOUTH;
                p.dr_dir[3] = PLAYER_DIR_WEST;
                p.dr_dir[4] = -1;
                p.dr_fieldIndex = 0;
                return true;
              }
            } while (d.s);
            p.dr_dir[0] = 0;
            p.dr_fieldIndex = 0;
            return false;
          }
        } while (d.e);
        p.dr_dir[0] = 0;
        p.dr_fieldIndex = 0;
        return false;
      }
    } while (d.n);
    p.dr_dir[0] = 0;
    p.dr_fieldIndex = 0;
    return false;
  }
  if (d.e) {
    do {
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.e) break;
      playerFieldX += 2;
      if (playerFieldX > MAZE_MAX_SIZE - 1) break;
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (wantedDirChar === 'n' && d.n) {
        p.dr_field[0]!.y = playerFieldY;
        p.dr_field[0]!.x = playerFieldX;
        do {
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.n) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          playerFieldY -= 2;
          if (playerFieldY <= 0) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.n && !d.w) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          if (d.w) {
            p.dr_field[1]!.y = playerFieldY;
            p.dr_field[1]!.x = playerFieldX;
            do {
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.w) {
                playerFieldX = p.dr_field[1]!.x;
                break;
              }
              playerFieldX -= 2;
              if (playerFieldX <= 0) {
                playerFieldX = p.dr_field[1]!.x;
                break;
              }
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.w && !d.n && !d.s) {
                /* dead end? */
                playerFieldX = p.dr_field[1]!.x;
                break;
              }
              if (playerFieldY === targetPlayerFieldY || d.w || d.n || d.s) {
                p.dr_field[2]!.y = playerFieldY;
                p.dr_field[2]!.x = playerFieldX;
                p.dr_field[3]!.y = 0;
                p.dr_dir[0] = PLAYER_DIR_EAST;
                p.dr_dir[1] = NINJA_PLAN_NORTH;
                p.dr_dir[2] = PLAYER_DIR_WEST;
                p.dr_dir[3] = -1;
                p.dr_fieldIndex = 0;
                return true;
              }
            } while (d.w);
          }
        } while (d.n);
      } else {
        if (wantedDirChar === 's' && d.s) {
          p.dr_field[0]!.y = playerFieldY;
          p.dr_field[0]!.x = playerFieldX;
          do {
            d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
            if (!d.s) break;
            playerFieldY += 2;
            if (playerFieldY > MAZE_MAX_SIZE - 1) {
              playerFieldY = p.dr_field[0]!.y;
              break;
            }
            d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
            if (!d.s && !d.w) {
              playerFieldY = p.dr_field[0]!.y;
              break;
            }
            if (d.w) {
              p.dr_field[1]!.y = playerFieldY;
              p.dr_field[1]!.x = playerFieldX;
              do {
                d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                if (!d.w) {
                  playerFieldX = p.dr_field[1]!.x;
                  break;
                }
                playerFieldX -= 2;
                if (playerFieldX <= 0) {
                  playerFieldX = p.dr_field[1]!.x;
                  break;
                }
                d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                if (!d.n && !d.w && !d.s) {
                  /* dead end? */
                  playerFieldX = p.dr_field[1]!.x;
                  break;
                }
                if (playerFieldY === targetPlayerFieldY || d.w || d.n || d.s) {
                  p.dr_field[2]!.y = playerFieldY;
                  p.dr_field[2]!.x = playerFieldX;
                  p.dr_field[3]!.y = 0;
                  p.dr_dir[0] = PLAYER_DIR_EAST;
                  p.dr_dir[1] = PLAYER_DIR_SOUTH;
                  p.dr_dir[2] = PLAYER_DIR_WEST;
                  p.dr_dir[3] = -1;
                  p.dr_fieldIndex = 0;
                  return true;
                }
              } while (d.w);
            }
          } while (d.s);
        }
      }
    } while (d.e);
  }
  playerFieldY = (p.ply_y >> MAZE_FIELD_SHIFT) | 1;
  playerFieldX = (p.ply_x >> MAZE_FIELD_SHIFT) | 1;
  d = droneCheckDirsAt(world, player, false, 0, 0);
  if (wantedDirChar === 'n' && d.e) {
    do {
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.e) break;
      playerFieldX += 2;
      if (playerFieldX > MAZE_MAX_SIZE - 1) break;
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.e && !d.s) break;
      if (d.s) {
        p.dr_field[0]!.y = playerFieldY;
        p.dr_field[0]!.x = playerFieldX;
        do {
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.s) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          playerFieldY += 2;
          if (playerFieldY > MAZE_MAX_SIZE - 1) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.s && !d.e) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          if (d.e) {
            p.dr_field[1]!.y = playerFieldY;
            p.dr_field[1]!.x = playerFieldX;
            do {
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.e) {
                playerFieldX = p.dr_field[1]!.x;
                break;
              }
              playerFieldX += 2;
              if (playerFieldX > MAZE_MAX_SIZE - 1) {
                playerFieldX = p.dr_field[1]!.x;
                break;
              }
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.e && !d.n) {
                playerFieldX = p.dr_field[1]!.x;
                break;
              }
              if (d.n) {
                p.dr_field[2]!.y = playerFieldY;
                p.dr_field[2]!.x = playerFieldX;
                p.dr_field[3]!.y = playerFieldY - 2;
                p.dr_field[3]!.x = playerFieldX;
                p.dr_field[4]!.y = 0;
                p.dr_dir[0] = PLAYER_DIR_EAST;
                p.dr_dir[1] = PLAYER_DIR_SOUTH;
                p.dr_dir[2] = PLAYER_DIR_EAST;
                p.dr_dir[3] = NINJA_PLAN_NORTH;
                p.dr_dir[4] = -1;
                p.dr_fieldIndex = 0;
                return true;
              }
            } while (d.e);
            p.dr_dir[0] = 0;
            p.dr_fieldIndex = 0;
            return false;
          }
        } while (d.s);
        p.dr_dir[0] = 0;
        p.dr_fieldIndex = 0;
        return false;
      }
    } while (d.e);
    p.dr_dir[0] = 0;
    p.dr_fieldIndex = 0;
    return false;
  }
  if (wantedDirChar === 's' && d.e) {
    do {
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.e) break;
      playerFieldX += 2;
      if (playerFieldX > MAZE_MAX_SIZE - 1) break;
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.e && !d.n) break;
      if (d.n) {
        p.dr_field[0]!.y = playerFieldY;
        p.dr_field[0]!.x = playerFieldX;
        do {
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.n) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          playerFieldY -= 2;
          if (playerFieldY <= 0) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.n && !d.e) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          if (d.e) {
            p.dr_field[1]!.y = playerFieldY;
            p.dr_field[1]!.x = playerFieldX;
            do {
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.e) {
                playerFieldX = p.dr_field[1]!.x;
                break;
              }
              playerFieldX += 2;
              if (playerFieldX > MAZE_MAX_SIZE - 1) {
                playerFieldX = p.dr_field[1]!.y;
                break;
              }
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.e && !d.s) {
                playerFieldX = p.dr_field[1]!.x;
                break;
              }
              if (d.s) {
                p.dr_field[2]!.y = playerFieldY;
                p.dr_field[2]!.x = playerFieldX;
                p.dr_field[3]!.y = playerFieldY + 2;
                p.dr_field[3]!.x = playerFieldX;
                p.dr_field[4]!.y = 0;
                p.dr_dir[0] = PLAYER_DIR_EAST;
                p.dr_dir[1] = NINJA_PLAN_NORTH;
                p.dr_dir[2] = PLAYER_DIR_EAST;
                p.dr_dir[3] = PLAYER_DIR_SOUTH;
                p.dr_dir[4] = -1;
                p.dr_fieldIndex = 0;
                return true;
              }
            } while (d.e);
            p.dr_dir[0] = 0;
            p.dr_fieldIndex = 0;
            return false;
          }
        } while (d.n);
        p.dr_dir[0] = 0;
        p.dr_fieldIndex = 0;
        return false;
      }
    } while (d.e);
    p.dr_dir[0] = 0;
    p.dr_fieldIndex = 0;
    return false;
  }
  p.dr_dir[0] = 0;
  p.dr_fieldIndex = 0;
  return false;
}

function droneSubNinjaWest(world: World, player: number, wantedDirChar: string): boolean {
  const p = world.players[player]!;
  let d: Dirs = { n: false, s: false, e: false, w: false };
  let target_player = 0;
  let targetPlayerFieldY = 0;
  let playerFieldX = 0;
  let playerFieldY = 0;

  p.dr_fieldIndex = 0;
  p.dr_upRotationCounter = 0;
  p.dr_rotateCounter = 0;
  p.dr_dir[0] = 0;
  p.dr_field[0]!.y = 0;
  target_player = p.dr_currentTarget;
  playerFieldY = (p.ply_y >> MAZE_FIELD_SHIFT) | 1;
  playerFieldX = (p.ply_x >> MAZE_FIELD_SHIFT) | 1;
  targetPlayerFieldY = (world.players[target_player]!.ply_y >> MAZE_FIELD_SHIFT) | 1;
  d = droneCheckDirsAt(world, player, false, 0, 0);
  if (wantedDirChar === 'n' && !d.n && !d.w && d.s) {
    do {
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.s) break;
      playerFieldY += 2;
      if (playerFieldY > MAZE_MAX_SIZE - 1) break;
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.s && !d.w) break;
      if (d.w) {
        p.dr_field[0]!.y = playerFieldY;
        p.dr_field[0]!.x = playerFieldX;
        do {
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.w) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          playerFieldX -= 2;
          if (playerFieldX <= 0) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.w && !d.n) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          if (d.n) {
            p.dr_field[1]!.y = playerFieldY;
            p.dr_field[1]!.x = playerFieldX;
            do {
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.n) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              playerFieldY -= 2;
              if (playerFieldY <= 0) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.n && !d.e) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              if (d.e) {
                p.dr_field[2]!.y = playerFieldY;
                p.dr_field[2]!.x = playerFieldX;
                p.dr_field[3]!.y = playerFieldY;
                p.dr_field[3]!.x = playerFieldX + 2;
                p.dr_field[4]!.y = 0;
                p.dr_dir[0] = PLAYER_DIR_SOUTH;
                p.dr_dir[1] = PLAYER_DIR_WEST;
                p.dr_dir[2] = NINJA_PLAN_NORTH;
                p.dr_dir[3] = PLAYER_DIR_EAST;
                p.dr_dir[4] = -1;
                p.dr_fieldIndex = 0;
                return true;
              }
            } while (d.n);
            p.dr_dir[0] = 0;
            p.dr_fieldIndex = 0;
            return false;
          }
        } while (d.w);
        p.dr_dir[0] = 0;
        p.dr_fieldIndex = 0;
        return false;
      }
    } while (d.s);
    p.dr_dir[0] = 0;
    p.dr_fieldIndex = 0;
    return false;
  }
  if (wantedDirChar === 's' && !d.s && !d.w && d.n) {
    do {
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.n) break;
      playerFieldY -= 2;
      if (playerFieldY <= 0) break;
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.n && !d.w) break;
      if (d.w) {
        p.dr_field[0]!.y = playerFieldY;
        p.dr_field[0]!.x = playerFieldX;
        do {
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.w) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          playerFieldX -= 2;
          if (playerFieldX <= 0) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.w && !d.s) {
            playerFieldX = p.dr_field[0]!.x;
            break;
          }
          if (d.s) {
            p.dr_field[1]!.y = playerFieldY;
            p.dr_field[1]!.x = playerFieldX;
            do {
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.s) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              playerFieldY += 2;
              if (playerFieldY > MAZE_MAX_SIZE - 1) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.s && !d.e) {
                playerFieldY = p.dr_field[1]!.y;
                break;
              }
              if (d.e) {
                p.dr_field[2]!.y = playerFieldY;
                p.dr_field[2]!.x = playerFieldX;
                p.dr_field[3]!.y = playerFieldY;
                p.dr_field[3]!.x = playerFieldX + 2;
                p.dr_field[4]!.y = 0;
                p.dr_dir[0] = NINJA_PLAN_NORTH;
                p.dr_dir[1] = PLAYER_DIR_WEST;
                p.dr_dir[2] = PLAYER_DIR_SOUTH;
                p.dr_dir[3] = PLAYER_DIR_EAST;
                p.dr_dir[4] = -1;
                p.dr_fieldIndex = 0;
                return true;
              }
            } while (d.s);
            p.dr_dir[0] = 0;
            p.dr_fieldIndex = 0;
            return false;
          }
        } while (d.w);
        p.dr_dir[0] = 0;
        p.dr_fieldIndex = 0;
        return false;
      }
    } while (d.n);
    p.dr_dir[0] = 0;
    p.dr_fieldIndex = 0;
    return false;
  }
  if (d.w) {
    do {
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.w) break;
      playerFieldX -= 2;
      if (playerFieldX <= 0) break;
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (wantedDirChar === 'n' && d.n) {
        p.dr_field[0]!.y = playerFieldY;
        p.dr_field[0]!.x = playerFieldX;
        do {
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.n) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          playerFieldY -= 2;
          if (playerFieldY <= 0) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.n && !d.e) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          if (d.e) {
            p.dr_field[1]!.y = playerFieldY;
            p.dr_field[1]!.x = playerFieldX;
            do {
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.e) {
                playerFieldX = p.dr_field[1]!.x;
                break;
              }
              playerFieldX += 2;
              if (playerFieldX > MAZE_MAX_SIZE - 1) {
                playerFieldX = p.dr_field[1]!.x;
                break;
              }
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.w && !d.e && !d.n) {
                /* dead end? */
                playerFieldX = p.dr_field[1]!.x;
                break;
              }
              if (playerFieldY === targetPlayerFieldY || d.e || d.w || d.n) {
                p.dr_field[2]!.y = playerFieldY;
                p.dr_field[2]!.x = playerFieldX;
                p.dr_field[3]!.y = 0;
                p.dr_dir[0] = PLAYER_DIR_WEST;
                p.dr_dir[1] = NINJA_PLAN_NORTH;
                p.dr_dir[2] = PLAYER_DIR_EAST;
                p.dr_dir[3] = -1;
                p.dr_fieldIndex = 0;
                return true;
              }
            } while (d.e);
          }
        } while (d.n);
      } else {
        if (wantedDirChar === 's' && d.s) {
          p.dr_field[0]!.y = playerFieldY;
          p.dr_field[0]!.x = playerFieldX;
          do {
            d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
            if (!d.s) {
              playerFieldY = p.dr_field[0]!.y;
              break;
            }
            playerFieldY += 2;
            if (playerFieldY > MAZE_MAX_SIZE - 1) {
              playerFieldY = p.dr_field[0]!.y;
              break;
            }
            d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
            if (!d.s && !d.e) {
              playerFieldY = p.dr_field[0]!.y;
              break;
            }
            if (d.e) {
              p.dr_field[1]!.y = playerFieldY;
              p.dr_field[1]!.x = playerFieldX;
              do {
                d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                if (!d.e) {
                  playerFieldX = p.dr_field[1]!.x;
                  break;
                }
                playerFieldX += 2;
                if (playerFieldX > MAZE_MAX_SIZE - 1) {
                  playerFieldX = p.dr_field[1]!.x;
                  break;
                }
                d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
                if (!d.w && !d.e && !d.s) {
                  /* dead end? */
                  playerFieldX = p.dr_field[1]!.x;
                  break;
                }
                if (playerFieldY === targetPlayerFieldY || d.e || d.s || d.w) {
                  p.dr_field[2]!.y = playerFieldY;
                  p.dr_field[2]!.x = playerFieldX;
                  p.dr_field[3]!.y = 0;
                  p.dr_dir[0] = PLAYER_DIR_WEST;
                  p.dr_dir[1] = PLAYER_DIR_SOUTH;
                  p.dr_dir[2] = PLAYER_DIR_EAST;
                  p.dr_dir[3] = -1;
                  p.dr_fieldIndex = 0;
                  return true;
                }
              } while (d.e);
            }
          } while (d.s);
        }
      }
    } while (d.w);
  }
  playerFieldY = (p.ply_y >> MAZE_FIELD_SHIFT) | 1;
  playerFieldX = (p.ply_x >> MAZE_FIELD_SHIFT) | 1;
  d = droneCheckDirsAt(world, player, false, 0, 0);
  if (wantedDirChar === 'n' && d.w) {
    do {
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.w) break;
      playerFieldX -= 2;
      if (playerFieldX <= 0) break;
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.w && !d.s) break;
      if (d.s) {
        p.dr_field[0]!.y = playerFieldY;
        p.dr_field[0]!.x = playerFieldX;
        do {
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.s) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          playerFieldY += 2;
          if (playerFieldY > MAZE_MAX_SIZE - 1) {
            playerFieldY = p.dr_field[0]!.x;
            break;
          }
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.s && !d.w) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          if (d.w) {
            p.dr_field[1]!.y = playerFieldY;
            p.dr_field[1]!.x = playerFieldX;
            do {
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.w) {
                playerFieldX = p.dr_field[1]!.x;
                break;
              }
              playerFieldX -= 2;
              if (playerFieldX <= 0) {
                playerFieldX = p.dr_field[1]!.x;
                break;
              }
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.w && !d.n) {
                playerFieldX = p.dr_field[1]!.x;
                break;
              }
              if (d.n) {
                p.dr_field[2]!.y = playerFieldY;
                p.dr_field[2]!.x = playerFieldX;
                p.dr_field[3]!.y = playerFieldY - 2;
                p.dr_field[3]!.x = playerFieldX;
                p.dr_field[4]!.y = 0;
                p.dr_dir[0] = PLAYER_DIR_WEST;
                p.dr_dir[1] = PLAYER_DIR_SOUTH;
                p.dr_dir[2] = PLAYER_DIR_WEST;
                p.dr_dir[3] = NINJA_PLAN_NORTH;
                p.dr_dir[4] = -1;
                p.dr_fieldIndex = 0;
                return true;
              }
            } while (d.w);
            p.dr_dir[0] = 0;
            p.dr_fieldIndex = 0;
            return false;
          }
        } while (d.s);
        p.dr_dir[0] = 0;
        p.dr_fieldIndex = 0;
        return false;
      }
    } while (d.w);
    p.dr_dir[0] = 0;
    p.dr_fieldIndex = 0;
    return false;
  }
  if (wantedDirChar === 's' && d.w) {
    do {
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.w) break;
      playerFieldX -= 2;
      if (playerFieldX <= 0) break;
      d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
      if (!d.w && !d.n) break;
      if (d.n) {
        p.dr_field[0]!.y = playerFieldY;
        p.dr_field[0]!.x = playerFieldX;
        do {
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.n) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          playerFieldY -= 2;
          if (playerFieldY <= 0) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
          if (!d.n && !d.w) {
            playerFieldY = p.dr_field[0]!.y;
            break;
          }
          if (d.w) {
            p.dr_field[1]!.y = playerFieldY;
            p.dr_field[1]!.x = playerFieldX;
            do {
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.w) {
                playerFieldX = p.dr_field[1]!.x;
                break;
              }
              playerFieldX -= 2;
              if (playerFieldX <= 0) {
                playerFieldX = p.dr_field[1]!.x;
                break;
              }
              d = droneCheckDirsAt(world, player, true, playerFieldY, playerFieldX);
              if (!d.w && !d.s) {
                playerFieldX = p.dr_field[1]!.x;
                break;
              }
              if (d.s) {
                p.dr_field[2]!.y = playerFieldY;
                p.dr_field[2]!.x = playerFieldX;
                p.dr_field[3]!.y = playerFieldY + 2;
                p.dr_field[3]!.x = playerFieldX;
                p.dr_field[4]!.y = 0;
                p.dr_dir[0] = PLAYER_DIR_WEST;
                p.dr_dir[1] = NINJA_PLAN_NORTH;
                p.dr_dir[2] = PLAYER_DIR_WEST;
                p.dr_dir[3] = PLAYER_DIR_SOUTH;
                p.dr_dir[4] = -1;
                p.dr_fieldIndex = 0;
                return true;
              }
            } while (d.w);
            p.dr_dir[0] = 0;
            p.dr_fieldIndex = 0;
            return false;
          }
        } while (d.n);
        p.dr_dir[0] = 0;
        p.dr_fieldIndex = 0;
        return false;
      }
    } while (d.w);
    p.dr_dir[0] = 0;
    p.dr_fieldIndex = 0;
    return false;
  }
  p.dr_dir[0] = 0;
  p.dr_fieldIndex = 0;
  return false;
}

/**
 * drone_action: pick a joystick byte for one drone slot, writing `joy[player]`.
 * Handles all three drone types (TARGET, STANDARD, NINJA).
 */
export function droneAction(world: World, player: number, joy: number[]): void {
  const p = world.players[player]!;
  switch (p.dr_type) {
    case DRONE_NINJA: {
      if (p.ply_lives <= 0) {
        p.dr_dir[0] = 0;
        p.dr_targetLocked = 0;
        p.dr_fieldIndex = 0;
        p.dr_field[0]!.y = 0;
        p.dr_upRotationCounter = 0;
        p.dr_rotateCounter = 0;
        break;
      }
      const gunman = world.players[p.ply_gunman]!;
      if (
        p.ply_hitflag &&
        p.ply_gunman !== p.dr_currentTarget &&
        gunman.dr_type !== DRONE_NINJA &&
        gunman.dr_type !== DRONE_STANDARD
      ) {
        if ((gunman.ply_team !== p.ply_team && world.teamFlag) || !world.teamFlag) {
          p.dr_currentTarget = p.ply_gunman;
          p.dr_dir[0] = 0;
          p.dr_targetLocked = 0;
          p.dr_fieldIndex = 0;
          p.dr_field[0]!.y = 0;
          p.dr_upRotationCounter = 0;
          p.dr_rotateCounter = 0;
        }
      }
      let target_player = p.dr_currentTarget;
      if (target_player < 0 && world.teamFlag) {
        droneCheckDirections(world, player);
        droneGenerateJoystickdata(world, player, joy);
        break;
      }
      if (droneTarget(world, p).ply_lives <= 0 && !world.teamFlag) {
        p.dr_dir[0] = 0;
        p.dr_fieldIndex = 0;
        p.dr_field[0]!.y = 0;
        p.dr_upRotationCounter = 0;
        p.dr_rotateCounter = 0;
        if (p.dr_targetLocked) droneSubFindMoveToTarget(world, player);
        if (world.players[p.dr_permanentTarget]!.ply_lives > 0) {
          p.dr_currentTarget = p.dr_permanentTarget;
          target_player = p.dr_currentTarget;
        } else {
          for (let i = 0; p.dr_humanEnemies[i] !== -1; i++) {
            const enemy = world.players[i]!;
            if (
              enemy.ply_lives > 0 &&
              enemy.dr_type !== DRONE_NINJA &&
              enemy.dr_type !== DRONE_STANDARD
            ) {
              p.dr_currentTarget = p.dr_humanEnemies[i]!;
              target_player = p.dr_currentTarget;
              break;
            }
          }
        }
      } else if (droneTarget(world, p).ply_lives <= 0 && world.teamFlag) {
        p.dr_dir[0] = 0;
        p.dr_fieldIndex = 0;
        p.dr_field[0]!.y = 0;
        p.dr_targetLocked = 0;
        p.dr_fireDirection = -1;
        p.dr_upRotationCounter = 0;
        p.dr_rotateCounter = 0;
        droneCheckDirections(world, player);
        droneGenerateJoystickdata(world, player, joy);
        break;
      }
      void target_player;
      if (droneTarget(world, p).ply_lives <= 0) {
        p.dr_dir[0] = 0;
        p.dr_fieldIndex = 0;
        p.dr_field[0]!.y = 0;
        p.dr_targetLocked = 0;
        p.dr_upRotationCounter = 0;
        p.dr_rotateCounter = 0;
        droneCheckDirections(world, player);
        droneGenerateJoystickdata(world, player, joy);
        break;
      }
      if (droneMove(world, player, joy)) return;
      droneSubNinja(world, player);
      droneGenerateJoystickdata(world, player, joy);
      break;
    }
    case DRONE_TARGET:
      if (p.ply_lives <= 0) {
        p.dr_dir[0] = 0;
        p.dr_targetLocked = 0;
        p.dr_upRotationCounter = 0;
        p.dr_rotateCounter = 0;
      }
      if (droneMove(world, player, joy)) return;
      droneCheckDirections(world, player);
      droneGenerateJoystickdata(world, player, joy);
      break;
    case DRONE_STANDARD: {
      if (p.ply_lives <= 0) {
        p.dr_dir[0] = 0;
        p.dr_targetLocked = 0;
        p.dr_fieldIndex = 0;
        p.dr_field[0]!.y = 0;
        p.dr_upRotationCounter = 0;
        p.dr_rotateCounter = 0;
        break;
      }
      const gunman = world.players[p.ply_gunman]!;
      if (
        p.ply_hitflag &&
        p.ply_gunman !== p.dr_currentTarget &&
        gunman.dr_type !== DRONE_NINJA &&
        gunman.dr_type !== DRONE_STANDARD
      ) {
        if ((gunman.ply_team !== p.ply_team && world.teamFlag) || !world.teamFlag) {
          p.dr_currentTarget = p.ply_gunman;
          p.dr_dir[0] = 0;
          p.dr_targetLocked = 0;
          p.dr_fieldIndex = 0;
          p.dr_field[0]!.y = 0;
          p.dr_upRotationCounter = 0;
          p.dr_rotateCounter = 0;
        }
      }
      const target_player = p.dr_currentTarget;
      if (droneTarget(world, p).ply_lives <= 0 || (world.teamFlag && target_player < 0)) {
        p.dr_dir[0] = 0;
        p.dr_targetLocked = 0;
        p.dr_upRotationCounter = 0;
        p.dr_rotateCounter = 0;
        droneCheckDirections(world, player);
        droneGenerateJoystickdata(world, player, joy);
        break;
      }
      if (droneMove(world, player, joy)) return;
      droneCheckDirections(world, player);
      droneSubStandard(world, player);
      droneGenerateJoystickdata(world, player, joy);
      break;
    }
  }
}
