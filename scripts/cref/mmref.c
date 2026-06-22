/*
 * MIDI Maze reference harness (EPIC-04).
 *
 * Self-contained copy of the small, fully-specified integer logic from the
 * original source (mulsdivs.c, fastmath.c, rnd.c, gamelogi.c, maze_obj.c,
 * setup.c), compiled with the system cc so REAL C short/int/long semantics
 * produce the golden vectors our TypeScript must match bit-for-bit (C-02). The
 * maze fixture + seed/count come from a generated header so C and TS share the
 * exact same grid. Sound/AES/MIDI externs are stubbed (no effect on the sim).
 * Emits JSON on stdout. Run: npm run cref
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include "maze_fixture.h" /* generated: maze_fixture[4096], MAZE_FIXTURE_SIZE/NAME, PLACEMENT_SEED/COUNT */

#define MAZE_MAX_SIZE 64
#define MAZE_CELL_SIZE 256
#define MAZE_FIELD_SHIFT 7
#define MAZE_FIELD_EMPTY -1
#define MAZE_FIELD_WALL 1
#define PLAYER_MAX_COUNT 16
#define PLAYER_MAX_LIVES 3
#define PLAYER_MAX_TEAMS 4
#define PLAYER_MOTION_SPEED 32
#define PLAYER_MOTION_ROTATE 8
#define PLAYER_RADIUS 48
#define PLAYER_WALL_DISTANCE 65
#define GAME_WIN_SCORE 10
#define PLAYER_DIR_NORTH 0x00
#define PLAYER_DIR_NORTHEAST 0x20
#define PLAYER_DIR_EAST 0x40
#define PLAYER_DIR_SOUTHEAST 0x60
#define PLAYER_DIR_SOUTH 0x80
#define PLAYER_DIR_SOUTHWEST 0xa0
#define PLAYER_DIR_WEST 0xc0
#define PLAYER_DIR_NORTHWEST 0xe0
#define JOYSTICK_UP 0x01
#define JOYSTICK_DOWN 0x02
#define JOYSTICK_LEFT 0x04
#define JOYSTICK_RIGHT 0x08
#define JOYSTICK_BUTTON 0x10
#define TRUE 1
#define FALSE 0
#define YES 1
#define NO 0
#define SUCCESS 1
#define FAILURE 0
#define CON 2

short sine_table[65];

/* --- mulsdivs.c / fastmath.c --- */
short muls_divs(short a, short b, short c) {
  if (c == 0) return a;
  return (a * b) / c;
}
static int fast_sin(int factor, int angle) {
  angle &= 255;
  if (angle >= 128) {
    angle -= 128;
    factor = -factor;
  }
  if (angle >= 64) angle = 128 - angle;
  return muls_divs(factor, sine_table[angle], 256);
}
static int fast_cos(int factor, int angle) { return fast_sin(factor, 64 - angle); }
void rotate2d(int *px, int *py, int angle) {
  int retX = fast_cos(*px, angle) - fast_sin(*py, angle);
  *py = fast_sin(*px, angle) + fast_cos(*py, angle);
  *px = retX;
}

/* draw3d.c: perspective projection. Colour-mode viewport constants. */
#define VIEW_HCENTER 80
#define VIEW_HALFWIDTH 80
#define VIEW_CELL_PIXELS 20
void calc_yx_to_xh(int *pinY_outX, int *pinX_outH) {
  int newX = muls_divs(*pinX_outH, VIEW_HALFWIDTH, *pinY_outX);
  int newH = VIEW_CELL_PIXELS;
  newH *= MAZE_CELL_SIZE;
  newH = newH / *pinY_outX;
  *pinY_outX = -newX + VIEW_HCENTER;
  *pinX_outH = -newH;
}

typedef struct {
  int deltaY, deltaX;
} XY_SPEED_TABLE;
XY_SPEED_TABLE xy_speed_table[256];
void calc_sin_table(void) {
  for (int angle = 0; angle < 256; angle++) {
    int y = -PLAYER_MOTION_SPEED, x = 0;
    rotate2d(&y, &x, -angle);
    xy_speed_table[angle].deltaY = y;
    xy_speed_table[angle].deltaX = x;
  }
}

/* --- drone.c: angle lookup table --- */
short drone_angle_table[33];
void calc_drone_angle_table(void) {
  for (int i = 0; i <= 32; i++) drone_angle_table[i] = -1;
  for (int i = 32; i >= 0; i--) {
    int y = 1000, x = 0;
    rotate2d(&y, &x, i);
    drone_angle_table[muls_divs(32, x, y)] = i;
  }
  for (int i = 0; i <= 32; i++)
    if (drone_angle_table[i] == -1) drone_angle_table[i] = drone_angle_table[i - 1];
}

/* --- rnd.c --- */
short _random_seed;
static int _random(void) {
  _random_seed = (long)(_random_seed * 6907) + 130253L;
  return _random_seed;
}
int _rnd(int maxVal) {
  int maxUnscaledVal = 256 / maxVal * maxVal;
  int randVal;
  while ((randVal = (_random() >> 4) & 0xff) >= maxUnscaledVal) {
  }
  return randVal % maxVal;
}

/* --- player model + maze objects (globals.h, maze_obj.c) --- */
typedef struct {
  int ply_y, ply_x, ply_dir, ply_lives, ply_refresh, ply_hitflag, ply_reload, ply_score;
  int ply_gunman, ply_looser, ply_team, ply_plist, ply_slist;
  int ply_shoot, ply_shootr, ply_shooty, ply_shootx;
  int dr_type, dr_rotateCounter, dr_targetLocked, dr_isInactive;
  int dr_upRotationCounter, dr_joystick, dr_fireDirection;
  int dr_humanEnemies[PLAYER_MAX_COUNT + 2], dr_currentTarget, dr_permanentTarget;
  int dr_dir[6];
  struct {
    int y, x;
  } dr_field[6];
  int dr_fieldIndex, dr_fieldResetTimer;
} PLY;
PLY player_data[PLAYER_MAX_COUNT];
short player_joy_table[PLAYER_MAX_COUNT];
int active_drones_by_type[3];
#define DRONE_TARGET 'r'
#define DRONE_STANDARD 'l'
#define DRONE_NINJA 'k'
#define DRONE_TYPES 3
signed char maze_datas[MAZE_MAX_SIZE * MAZE_MAX_SIZE];
short maze_size;
int playerAndDroneCount, we_dont_have_a_winner, objekt_anz;
struct {
  short y, x, index;
} object_table[PLAYER_MAX_COUNT * 2];

/* combat/UI externs referenced by move_player/move_shoot, stubbed (no sim effect) */
short reload_time, regen_time, revive_time, revive_lives, friendly_fire, team_flag;
int team_scores[PLAYER_MAX_TEAMS];
int own_number = -1;
int display_2d_map_flag;
void *sound_shot_ptr, *sound_hit_ptr;
void Dosound(void *p) { (void)p; }
void Bconout(int dev, int val) {
  (void)dev;
  (void)val;
}
void update_happiness_quotient_indicator(void) {}

int get_maze_data(int fieldY, int fieldX, int flipped) {
  if (fieldY < 0 || fieldY > MAZE_MAX_SIZE - 1 || fieldX < 0 || fieldX > MAZE_MAX_SIZE - 1)
    return (fieldY & fieldX & 1) ? MAZE_FIELD_EMPTY : MAZE_FIELD_WALL;
  return !flipped ? maze_datas[fieldY * MAZE_MAX_SIZE + fieldX]
                  : maze_datas[fieldX * MAZE_MAX_SIZE + fieldY];
}
void set_maze_data(int fieldY, int fieldX, int val) {
  if (fieldY < 0 || fieldY > MAZE_MAX_SIZE - 1 || fieldX < 0 || fieldX > MAZE_MAX_SIZE - 1) return;
  maze_datas[fieldY * MAZE_MAX_SIZE + fieldX] = val;
}
void set_object(int newObjectIndex, int y, int x) {
  int nextObject, mazaFieldData, fieldX, fieldY;
  fieldY = (y >> MAZE_FIELD_SHIFT) | 1;
  fieldX = (x >> MAZE_FIELD_SHIFT) | 1;
  mazaFieldData = get_maze_data(fieldY, fieldX, 0);
  if (mazaFieldData == MAZE_FIELD_EMPTY) {
    set_maze_data(fieldY, fieldX, newObjectIndex);
    object_table[objekt_anz].y = fieldY;
    object_table[objekt_anz].x = fieldX;
    object_table[objekt_anz++].index = newObjectIndex;
  } else {
    do {
      nextObject = (mazaFieldData < PLAYER_MAX_COUNT) ? player_data[mazaFieldData].ply_plist
                                                      : player_data[mazaFieldData - PLAYER_MAX_COUNT].ply_slist;
      if (nextObject == MAZE_FIELD_EMPTY) break;
      mazaFieldData = nextObject;
    } while (1);
    if (mazaFieldData < PLAYER_MAX_COUNT)
      player_data[mazaFieldData].ply_plist = newObjectIndex;
    else
      player_data[mazaFieldData - PLAYER_MAX_COUNT].ply_slist = newObjectIndex;
  }
}
void set_all_player(void) {
  int i;
  while (objekt_anz > 0) {
    objekt_anz--;
    set_maze_data(object_table[objekt_anz].y, object_table[objekt_anz].x, MAZE_FIELD_EMPTY);
  }
  for (i = 0; i < playerAndDroneCount; i++) {
    if (player_data[i].ply_lives > 0 || player_data[i].ply_hitflag) {
      set_object(i, player_data[i].ply_y, player_data[i].ply_x);
      player_data[i].ply_plist = MAZE_FIELD_EMPTY;
    }
    if (player_data[i].ply_shoot > 0) {
      set_object(i + PLAYER_MAX_COUNT, player_data[i].ply_shooty, player_data[i].ply_shootx);
      player_data[i].ply_slist = MAZE_FIELD_EMPTY;
    }
  }
}

/* --- setup.c --- */
int hunt_ply_pos(int player) {
  int distance, dir, deltaX, deltaY, i, noValidPositionFound, wallCount, fieldX, fieldY, tries;
  noValidPositionFound = TRUE;
  for (tries = 0; tries < 666 && noValidPositionFound; tries++) {
    fieldY = _rnd(maze_size) | 1;
    fieldX = _rnd(maze_size) | 1;
    if (get_maze_data(fieldY, fieldX, 0) != MAZE_FIELD_EMPTY) continue;
    wallCount = 0;
    if (get_maze_data(fieldY - 1, fieldX, 0) == MAZE_FIELD_WALL) wallCount++;
    if (get_maze_data(fieldY, fieldX - 1, 0) == MAZE_FIELD_WALL) wallCount++;
    if (get_maze_data(fieldY + 1, fieldX, 0) == MAZE_FIELD_WALL) wallCount++;
    if (get_maze_data(fieldY, fieldX + 1, 0) == MAZE_FIELD_WALL) wallCount++;
    if (wallCount == 4) continue;
    noValidPositionFound = FALSE;
    player_data[player].ply_y = fieldY << MAZE_FIELD_SHIFT;
    player_data[player].ply_x = fieldX << MAZE_FIELD_SHIFT;
    distance = (5 - tries / 20) * MAZE_CELL_SIZE;
    for (i = 0; i < playerAndDroneCount; i++) {
      if (player == i) continue;
      if (player_data[i].ply_lives <= 0) continue;
      deltaY = abs(player_data[i].ply_y - player_data[player].ply_y);
      deltaX = abs(player_data[i].ply_x - player_data[player].ply_x);
      if (deltaY < distance || deltaX < distance) {
        noValidPositionFound = TRUE;
        break;
      }
    }
  }
  if (noValidPositionFound) return NO;
  set_object(player, player_data[player].ply_y, player_data[player].ply_x);
  player_data[player].ply_plist = -1;
  dir = _rnd(256) & 0xf8;
  if (dir < PLAYER_DIR_EAST)
    dir = PLAYER_DIR_NORTH;
  else
    dir = (dir < PLAYER_DIR_SOUTH) ? PLAYER_DIR_EAST : dir < PLAYER_DIR_WEST ? PLAYER_DIR_SOUTH : PLAYER_DIR_WEST;
  player_data[player].ply_dir = dir;
  return YES;
}
int init_all_player(int playerCount, int isDrone) {
  int i, j;
  (void)isDrone;
  playerAndDroneCount = we_dont_have_a_winner = playerCount;
  for (i = 1; i <= MAZE_MAX_SIZE - 1; i += 2)
    for (j = 1; j <= MAZE_MAX_SIZE - 1; j += 2) set_maze_data(i, j, MAZE_FIELD_EMPTY);
  objekt_anz = 0;
  for (i = 0; i < playerAndDroneCount; i++) player_data[i].ply_lives = 0;
  for (i = 0; i < playerAndDroneCount; i++) {
    if (!hunt_ply_pos(i)) return NO;
    player_data[i].ply_lives = PLAYER_MAX_LIVES;
    player_data[i].ply_refresh = 0;
    player_data[i].ply_shoot = 0;
    player_data[i].ply_reload = 0;
    player_data[i].ply_score = 0;
    player_data[i].ply_hitflag = FALSE;
  }
  return YES;
}

/* --- gamelogi.c: move_player / move_shoot (verbatim) --- */
void move_shoot(int player);

int move_player(register int player, int joystickData, int dronesActiveFlag) {
  register int newFieldX, newFieldY, playerX, playerY;
  int surroundingWalls, oldDiffX, oldDiffY, speedX, speedY, objectID, distanceX, distanceY;
  int bumpOfWalls, xOffset, yOffset, tooCloseRight, tooCloseLeft, tooCloseBottom, tooCloseTop;
  int direction, cellXfract, cellYfract;

  if (player_data[player].ply_refresh > 0 && --player_data[player].ply_refresh == 0) {
    if (++player_data[player].ply_lives < PLAYER_MAX_LIVES) player_data[player].ply_refresh = regen_time;
    if (player_data[player].ply_lives == 1) {
      if ((player_data[player].ply_lives = revive_lives) == PLAYER_MAX_LIVES)
        player_data[player].ply_refresh = 0;
      if (!hunt_ply_pos(player)) return FAILURE;
      if (player == own_number) display_2d_map_flag = NO;
    }
    if (player == own_number) {
      Bconout(CON, 7);
      update_happiness_quotient_indicator();
    }
  }
  if (player_data[player].ply_lives == 0) {
    if (player_data[player].ply_shoot) move_shoot(player);
    if (player_data[player].ply_reload) player_data[player].ply_reload--;
    return SUCCESS;
  }

  playerY = player_data[player].ply_y;
  playerX = player_data[player].ply_x;
  direction = player_data[player].ply_dir;
  if (joystickData & JOYSTICK_LEFT)
    direction -= PLAYER_MOTION_ROTATE;
  else if (joystickData & JOYSTICK_RIGHT)
    direction += PLAYER_MOTION_ROTATE;
  direction &= 255;

  if (((joystickData & JOYSTICK_BUTTON) == JOYSTICK_BUTTON) && player_data[player].ply_reload == 0) {
    if (player == own_number) Dosound((void *)sound_shot_ptr);
    player_data[player].ply_shootr = direction;
    player_data[player].ply_shoot = 10;
    player_data[player].ply_reload = reload_time;
    player_data[player].ply_shooty = playerY;
    player_data[player].ply_shootx = playerX;
  }
  if (player_data[player].ply_shoot) move_shoot(player);
  if (player_data[player].ply_reload) player_data[player].ply_reload--;

  if (joystickData & JOYSTICK_UP) {
    speedY = xy_speed_table[direction].deltaY;
    speedX = xy_speed_table[direction].deltaX;
  } else if (joystickData & JOYSTICK_DOWN) {
    speedY = -xy_speed_table[direction].deltaY;
    speedX = -xy_speed_table[direction].deltaX;
  } else {
    speedY = 0;
    speedX = 0;
  }

  playerY = player_data[player].ply_y;
  playerY += speedY;
  playerX = player_data[player].ply_x;
  playerX += speedX;
  newFieldY = playerY;
  newFieldY >>= MAZE_FIELD_SHIFT;
  newFieldY |= 1;
  newFieldX = playerX;
  newFieldX >>= MAZE_FIELD_SHIFT;
  newFieldX |= 1;
  bumpOfWalls = TRUE;
  for (yOffset = -2; yOffset <= 2; yOffset += 2) {
    for (xOffset = -2; xOffset <= 2; xOffset += 2) {
      objectID = get_maze_data(yOffset + newFieldY, xOffset + newFieldX, 0);
      while (objectID != MAZE_FIELD_EMPTY) {
        if (objectID < PLAYER_MAX_COUNT) {
          if (player != objectID) {
            distanceY = abs(player_data[objectID].ply_y - playerY);
            distanceX = abs(player_data[objectID].ply_x - playerX);
            if (distanceY < PLAYER_RADIUS * 2 && distanceX < PLAYER_RADIUS * 2) {
              oldDiffY = abs(player_data[objectID].ply_y - player_data[player].ply_y);
              oldDiffX = abs(player_data[objectID].ply_x - player_data[player].ply_x);
              if (oldDiffY < PLAYER_RADIUS * 2) {
                speedX -= (speedX < 0) ? -(PLAYER_RADIUS * 2 - distanceX) : PLAYER_RADIUS * 2 - distanceX;
              } else if (oldDiffX < PLAYER_RADIUS * 2) {
                speedY -= (speedY < 0) ? -(PLAYER_RADIUS * 2 - distanceY) : PLAYER_RADIUS * 2 - distanceY;
              } else {
                if (distanceY > distanceX)
                  speedY -= (speedY < 0) ? -(PLAYER_RADIUS * 2 - distanceY) : PLAYER_RADIUS * 2 - distanceY;
                else
                  speedX -= (speedX < 0) ? -(PLAYER_RADIUS * 2 - distanceX) : PLAYER_RADIUS * 2 - distanceX;
              }
              playerY = player_data[player].ply_y;
              playerY += speedY;
              playerX = player_data[player].ply_x;
              playerX += speedX;
            }
          }
          objectID = player_data[objectID].ply_plist;
        } else {
          objectID = player_data[objectID - PLAYER_MAX_COUNT].ply_slist;
        }
      }
    }
  }

  newFieldY = playerY;
  newFieldY >>= MAZE_FIELD_SHIFT;
  newFieldY |= 1;
  newFieldX = playerX;
  newFieldX >>= MAZE_FIELD_SHIFT;
  newFieldX |= 1;
  cellYfract = playerY & (MAZE_CELL_SIZE - 1);
  cellXfract = playerX & (MAZE_CELL_SIZE - 1);
  tooCloseTop = cellYfract < PLAYER_WALL_DISTANCE;
  tooCloseBottom = cellYfract > (MAZE_CELL_SIZE - PLAYER_WALL_DISTANCE);
  tooCloseLeft = cellXfract < PLAYER_WALL_DISTANCE;
  tooCloseRight = cellXfract > (MAZE_CELL_SIZE - PLAYER_WALL_DISTANCE);
  yOffset = tooCloseTop ? -1 : tooCloseBottom ? 1 : 0;
  xOffset = tooCloseLeft ? -1 : tooCloseRight ? 1 : 0;
  if (bumpOfWalls) {
    if ((tooCloseTop || tooCloseBottom) && get_maze_data(yOffset + newFieldY, newFieldX, 0) == MAZE_FIELD_WALL) {
      playerY &= ~(MAZE_CELL_SIZE - 1);
      playerY += tooCloseBottom ? (MAZE_CELL_SIZE - PLAYER_WALL_DISTANCE) : PLAYER_WALL_DISTANCE;
      bumpOfWalls = FALSE;
    }
    if ((tooCloseLeft || tooCloseRight) && get_maze_data(newFieldY, xOffset + newFieldX, 0) == MAZE_FIELD_WALL) {
      playerX &= ~(MAZE_CELL_SIZE - 1);
      playerX += tooCloseRight ? (MAZE_CELL_SIZE - PLAYER_WALL_DISTANCE) : PLAYER_WALL_DISTANCE;
      bumpOfWalls = FALSE;
    }
  }
  if (bumpOfWalls && yOffset && xOffset && get_maze_data(yOffset + newFieldY, xOffset + newFieldX, 0) == MAZE_FIELD_WALL) {
    distanceY = tooCloseTop ? cellYfract : MAZE_CELL_SIZE - cellYfract;
    distanceX = tooCloseLeft ? cellXfract : MAZE_CELL_SIZE - cellXfract;
    if (distanceY >= distanceX) {
      playerY &= ~(MAZE_CELL_SIZE - 1);
      playerY += tooCloseBottom ? (MAZE_CELL_SIZE - PLAYER_WALL_DISTANCE) : PLAYER_WALL_DISTANCE;
    } else {
      playerX &= ~(MAZE_CELL_SIZE - 1);
      playerX += tooCloseRight ? (MAZE_CELL_SIZE - PLAYER_WALL_DISTANCE) : PLAYER_WALL_DISTANCE;
    }
  }

  if (dronesActiveFlag && playerY == player_data[player].ply_y && playerX == player_data[player].ply_x &&
      player_data[player].ply_dir == direction && player_data[player].dr_rotateCounter == 0 &&
      !player_data[player].dr_targetLocked) {
    player_data[player].dr_isInactive = TRUE;
  }

  player_data[player].ply_y = playerY;
  player_data[player].ply_x = playerX;
  player_data[player].ply_dir = direction;

  playerY >>= MAZE_FIELD_SHIFT;
  playerY |= 1;
  playerX >>= MAZE_FIELD_SHIFT;
  playerX |= 1;
  surroundingWalls = 0;
  if (get_maze_data(playerY - 1, playerX, 0) == MAZE_FIELD_WALL) surroundingWalls++;
  if (get_maze_data(playerY, playerX - 1, 0) == MAZE_FIELD_WALL) surroundingWalls++;
  if (get_maze_data(playerY + 1, playerX, 0) == MAZE_FIELD_WALL) surroundingWalls++;
  if (get_maze_data(playerY, playerX + 1, 0) == MAZE_FIELD_WALL) surroundingWalls++;
  if (surroundingWalls == 4) {
    if (!hunt_ply_pos(player)) return FAILURE;
  }
  return SUCCESS;
}

void move_shoot(register int player) {
  register int shotXField, shotYField, shotX, shotY;
  int saveShotXField, saveShotYField, distanceX, distanceY, objectID, zCoord, shotDirection, hasShot,
      yOffset, xOffset;
  hasShot = TRUE;
  shotY = player_data[player].ply_shooty;
  shotX = player_data[player].ply_shootx;
  shotDirection = player_data[player].ply_shootr;
  shotYField = shotY;
  shotYField >>= MAZE_FIELD_SHIFT;
  shotYField |= 1;
  shotXField = shotX;
  shotXField >>= MAZE_FIELD_SHIFT;
  shotXField |= 1;
  for (zCoord = 0; zCoord < 3; zCoord++) {
    shotY += xy_speed_table[shotDirection].deltaY;
    shotX += xy_speed_table[shotDirection].deltaX;
    saveShotYField = shotYField;
    saveShotXField = shotXField;
    shotYField = shotY;
    shotYField >>= MAZE_FIELD_SHIFT;
    shotYField |= 1;
    shotXField = shotX;
    shotXField >>= MAZE_FIELD_SHIFT;
    shotXField |= 1;
    if ((shotYField != saveShotYField || shotXField != saveShotXField) &&
        get_maze_data((saveShotYField + shotYField) >> 1, (saveShotXField + shotXField) >> 1, 0) == MAZE_FIELD_WALL) {
      player_data[player].ply_shoot = 0;
      break;
    }
    for (xOffset = -2; xOffset <= 2 && hasShot; xOffset += 2) {
      for (yOffset = -2; yOffset <= 2 && hasShot; yOffset += 2) {
        objectID = get_maze_data(xOffset + shotYField, yOffset + shotXField, 0);
        while (objectID != MAZE_FIELD_EMPTY) {
          if (objectID < PLAYER_MAX_COUNT) {
            if (player != objectID && player_data[objectID].ply_lives > 0) {
              distanceY = abs(player_data[objectID].ply_y - shotY);
              distanceX = abs(player_data[objectID].ply_x - shotX);
              if (distanceY <= PLAYER_RADIUS && distanceX <= PLAYER_RADIUS) {
                if (player == own_number) Dosound((void *)sound_hit_ptr);
                player_data[objectID].ply_hitflag = TRUE;
                player_data[objectID].ply_gunman = player;
                if (!team_flag || player_data[player].ply_team != player_data[objectID].ply_team ||
                    (!friendly_fire && player_data[objectID].ply_lives != 1)) {
                  player_data[objectID].ply_refresh = regen_time;
                  if (--player_data[objectID].ply_lives == 0) {
                    player_data[objectID].ply_refresh = revive_time;
                    player_data[player].ply_score++;
                    if (team_flag) {
                      if (++team_scores[player_data[player].ply_team] == GAME_WIN_SCORE)
                        we_dont_have_a_winner = NO;
                    } else {
                      if (player_data[player].ply_score == GAME_WIN_SCORE) we_dont_have_a_winner = NO;
                    }
                  }
                  player_data[player].ply_looser = objectID;
                }
                player_data[player].ply_shoot = 0;
                if (objectID == own_number) update_happiness_quotient_indicator();
                hasShot = FALSE;
              }
            }
            objectID = player_data[objectID].ply_plist;
          } else {
            objectID = player_data[objectID - PLAYER_MAX_COUNT].ply_slist;
          }
        }
      }
    }
  }
  player_data[player].ply_shooty = shotY;
  player_data[player].ply_shootx = shotX;
}

/* --- scenario harness --- */
static PLY mk(int y, int x, int dir, int lives) {
  PLY p;
  memset(&p, 0, sizeof p);
  p.ply_y = y;
  p.ply_x = x;
  p.ply_dir = dir;
  p.ply_lives = lives;
  p.ply_plist = -1;
  p.ply_slist = -1;
  return p;
}
static void reset_world(void) {
  for (int i = 0; i < MAZE_MAX_SIZE * MAZE_MAX_SIZE; i++) maze_datas[i] = maze_fixture[i];
  maze_size = MAZE_FIXTURE_SIZE;
  objekt_anz = 0;
  memset(player_data, 0, sizeof player_data);
}
static void emit_pos(PLY *p) { printf("{\"y\":%d,\"x\":%d,\"dir\":%d}", p->ply_y, p->ply_x, p->ply_dir); }
static void emit_state(PLY *p) {
  printf("{\"y\":%d,\"x\":%d,\"dir\":%d,\"lives\":%d}", p->ply_y, p->ply_x, p->ply_dir, p->ply_lives);
}
static void emit_full(PLY *p) {
  printf("{\"y\":%d,\"x\":%d,\"dir\":%d,\"lives\":%d,\"score\":%d,\"hitflag\":%d,\"reload\":%d,"
         "\"shoot\":%d,\"shootx\":%d,\"shooty\":%d}",
         p->ply_y, p->ply_x, p->ply_dir, p->ply_lives, p->ply_score, p->ply_hitflag, p->ply_reload,
         p->ply_shoot, p->ply_shootx, p->ply_shooty);
}
/* --- drone.c: drone_setup (verbatim port) --- */
void drone_setup(int humanPlayers) {
  int team3Attackable, team2Attackable, team1Attackable, team0Attackable;
  int teamCount, team3Index, team2Index, team1Index;
  int team3[18], team2[18], team1[18], team0[18];
  int team3HasMembers, team2HasMembers, team1HasMembers, team0HasMembers;
  int playerIndex, team0Index, allPlayerCount;
  int currentHumanSoloPlayer, humanSoloPlayerList[18];

  currentHumanSoloPlayer = 0;
  allPlayerCount = 0;
  team0Index = 0;
  team0HasMembers = team1HasMembers = team2HasMembers = team3HasMembers = FALSE;
  team0Index = team1Index = team2Index = team3Index = 0;
  teamCount = 0;
  team0Attackable = team1Attackable = team2Attackable = team3Attackable = FALSE;

  allPlayerCount =
      active_drones_by_type[0] + active_drones_by_type[1] + active_drones_by_type[2] + humanPlayers;

  if (team_flag) {
    for (playerIndex = 0; playerIndex < allPlayerCount; playerIndex++) {
      switch (player_data[playerIndex].ply_team) {
      case 0: team0[team0Index++] = playerIndex; break;
      case 1: team1[team1Index++] = playerIndex; break;
      case 2: team2[team2Index++] = playerIndex; break;
      case 3: team3[team3Index++] = playerIndex; break;
      }
    }
    team0[team0Index] = -1;
    team1[team1Index] = -1;
    team2[team2Index] = -1;
    team3[team3Index] = -1;

    if (team0[0] != -1) { teamCount++; team0HasMembers = team0Attackable = TRUE; }
    if (team1[0] != -1) { teamCount++; team1HasMembers = team1Attackable = TRUE; }
    if (team2[0] != -1) { teamCount++; team2HasMembers = team2Attackable = TRUE; }
    if (team3[0] != -1) { teamCount++; team3HasMembers = team3Attackable = TRUE; }

    if (teamCount == 1) {
      for (playerIndex = 0; playerIndex < allPlayerCount; playerIndex++)
        player_data[playerIndex].dr_currentTarget = -1;
    } else {
      team0Index = team1Index = team2Index = team3Index = 0;
      for (playerIndex = 0; playerIndex < allPlayerCount; playerIndex++) {
        switch (player_data[playerIndex].ply_team) {
        case 0:
          if (player_data[playerIndex].dr_type == DRONE_NINJA || player_data[playerIndex].dr_type == DRONE_STANDARD) {
            if (team1HasMembers && team1Attackable) {
              if (team1[team1Index] == -1) team1Index = 0;
              player_data[playerIndex].dr_currentTarget = team1[team1Index++];
              if (team2HasMembers || team3HasMembers) team1Attackable = FALSE;
              if (team2HasMembers) team2Attackable = TRUE;
              if (team3HasMembers) team3Attackable = TRUE;
            } else if (team2HasMembers && team2Attackable) {
              if (team2[team2Index] == -1) team2Index = 0;
              player_data[playerIndex].dr_currentTarget = team2[team2Index++];
              if (team1HasMembers || team3HasMembers) team2Attackable = FALSE;
              if (team3HasMembers) team3Attackable = TRUE;
              else if (team1HasMembers) team1Attackable = TRUE;
            } else if (team3HasMembers && team3Attackable) {
              if (team3[team3Index] == -1) team3Index = 0;
              player_data[playerIndex].dr_currentTarget = team3[team3Index++];
              if (team1HasMembers || team2HasMembers) team3Attackable = FALSE;
              if (team1HasMembers) team1Attackable = TRUE;
              if (team2HasMembers) team2Attackable = TRUE;
            }
            player_data[playerIndex].dr_permanentTarget = player_data[playerIndex].dr_currentTarget;
          }
          break;
        case 1:
          if (player_data[playerIndex].dr_type == DRONE_NINJA || player_data[playerIndex].dr_type == DRONE_STANDARD) {
            if (team0HasMembers && team0Attackable) {
              if (team0[team0Index] == -1) team0Index = 0;
              player_data[playerIndex].dr_currentTarget = team0[team0Index++];
              if (team3HasMembers || team2HasMembers) team0Attackable = FALSE;
              if (team3HasMembers) team3Attackable = TRUE;
              if (team2HasMembers) team2Attackable = TRUE;
            } else if (team2HasMembers && team2Attackable) {
              if (team2[team2Index] == -1) team2Index = 0;
              player_data[playerIndex].dr_currentTarget = team2[team2Index++];
              if (team0HasMembers || team3HasMembers) team2Attackable = FALSE;
              if (team3HasMembers) team3Attackable = TRUE;
              else if (team0HasMembers) team0Attackable = TRUE;
            } else if (team3HasMembers && team3Attackable) {
              if (team3[team3Index] == -1) team3Index = 0;
              player_data[playerIndex].dr_currentTarget = team3[team3Index++];
              if (team0HasMembers || team2HasMembers) team3Attackable = FALSE;
              if (team0HasMembers) team0Attackable = TRUE;
              if (team2HasMembers) team2Attackable = TRUE;
            }
            player_data[playerIndex].dr_permanentTarget = player_data[playerIndex].dr_currentTarget;
          }
          break;
        case 2:
          if (player_data[playerIndex].dr_type == DRONE_NINJA || player_data[playerIndex].dr_type == DRONE_STANDARD) {
            if (team1HasMembers && team1Attackable) {
              if (team1[team1Index] == -1) team1Index = 0;
              player_data[playerIndex].dr_currentTarget = team1[team1Index++];
              if (team0HasMembers || team3HasMembers) team1Attackable = FALSE;
              if (team0HasMembers) team0Attackable = TRUE;
              if (team3HasMembers) team3Attackable = TRUE;
            } else if (team0HasMembers && team0Attackable) {
              if (team0[team0Index] == -1) team0Index = 0;
              player_data[playerIndex].dr_currentTarget = team0[team0Index++];
              if (team1HasMembers || team3HasMembers) team0Attackable = FALSE;
              if (team3HasMembers) team3Attackable = TRUE;
              else if (team1HasMembers) team1Attackable = TRUE;
            } else if (team3HasMembers && team3Attackable) {
              if (team3[team3Index] == -1) team3Index = 0;
              player_data[playerIndex].dr_currentTarget = team3[team3Index++];
              if (team0HasMembers || team1HasMembers) team3Attackable = FALSE;
              if (team0HasMembers) team0Attackable = TRUE;
              if (team1HasMembers) team1Attackable = TRUE;
            }
            player_data[playerIndex].dr_permanentTarget = player_data[playerIndex].dr_currentTarget;
          }
          break;
        case 3:
          if (player_data[playerIndex].dr_type == DRONE_NINJA || player_data[playerIndex].dr_type == DRONE_STANDARD) {
            if (team1HasMembers && team1Attackable) {
              if (team1[team1Index] == -1) team1Index = 0;
              player_data[playerIndex].dr_currentTarget = team1[team1Index++];
              if (team2HasMembers || team0HasMembers) team1Attackable = FALSE;
              if (team2HasMembers) team2Attackable = TRUE;
              if (team0HasMembers) team0Attackable = TRUE;
            } else if (team2HasMembers && team2Attackable) {
              if (team2[team2Index] == -1) team2Index = 0;
              player_data[playerIndex].dr_currentTarget = team2[team2Index++];
              if (team0HasMembers || team1HasMembers) team2Attackable = FALSE;
              if (team0HasMembers) team0Attackable = TRUE;
              else if (team1HasMembers) team1Attackable = TRUE;
            } else if (team0HasMembers && team0Attackable) {
              if (team0[team0Index] == -1) team0Index = 0;
              player_data[playerIndex].dr_currentTarget = team0[team0Index++];
              if (team1HasMembers || team2HasMembers) team0Attackable = FALSE;
              if (team1HasMembers) team1Attackable = TRUE;
              if (team2HasMembers) team2Attackable = TRUE;
            }
            player_data[playerIndex].dr_permanentTarget = player_data[playerIndex].dr_currentTarget;
          }
          break;
        }
      }
    }
  } else {
    for (playerIndex = 0; playerIndex < humanPlayers; playerIndex++)
      humanSoloPlayerList[playerIndex] = playerIndex;
    humanSoloPlayerList[playerIndex] = -1;

    for (playerIndex = humanPlayers; playerIndex < allPlayerCount; playerIndex++) {
      if (player_data[playerIndex].dr_type == DRONE_NINJA || player_data[playerIndex].dr_type == DRONE_STANDARD) {
        for (team0Index = 0; humanSoloPlayerList[team0Index] != -1; team0Index++)
          player_data[playerIndex].dr_humanEnemies[team0Index] = humanSoloPlayerList[team0Index];
      }
      player_data[playerIndex].dr_humanEnemies[team0Index] = -1;

      if (humanSoloPlayerList[currentHumanSoloPlayer] == -1) {
        player_data[playerIndex].dr_currentTarget = player_data[playerIndex].dr_humanEnemies[currentHumanSoloPlayer = 0];
        player_data[playerIndex].dr_permanentTarget = player_data[playerIndex].dr_currentTarget;
      } else {
        player_data[playerIndex].dr_currentTarget = player_data[playerIndex].dr_humanEnemies[currentHumanSoloPlayer++];
        player_data[playerIndex].dr_permanentTarget = player_data[playerIndex].dr_currentTarget;
      }
    }
  }
}

/* --- drone.c: target + standard drone AI (verbatim ports; NINJA case omitted,
 * added in STORY-03). Module statics mirror drone.c's file-scope variables. --- */
static int drone_needs2GoSouth, drone_needs2GoWest, drone_can_east, drone_can_north;
static int drone_can_south, drone_needs2GoEast, drone_can_west, drone_needs2GoNorth;
/* dr_currentTarget < 0 (a solo target drone) makes the original read player_data[-1];
 * its ply_y/ply_x land in zero BSS, i.e. a target at (0,0). Model that explicitly so
 * the golden is defined (zeroed ghost) instead of depending on this harness's layout. */
static PLY drone_ghost;
static PLY *drone_tgt(int i) { return i >= 0 ? &player_data[i] : &drone_ghost; }
static void drone_check_directions(int player, int *canNorthPtr, int *canSouthPtr, int *canEastPtr,
                                   int *canWestPtr, int useAltCoord, int altYField, int altXField);
static void drone_sub_findMoveToTarget(int player);
static void drone_generate_joystickdata(int player);
static int drone_aim2target(int player);
static int drone_delta_into_direction(int deltaY, int deltaX);
static int drone_isTargetIsVisibleNorth(int player, int fieldY, int fieldX);
static int drone_isTargetIsVisibleSouth(int player, int fieldY, int fieldX);
static int drone_isTargetIsVisibleEast(int player, int fieldY, int fieldX);
static int drone_isTargetIsVisibleWest(int player, int fieldY, int fieldX);
static void drone_set_position(int player, int viewCompassDirChar);
static void drone_sub_standard(int player);
static void drone_move_upright(int player);
static void drone_move_upleft(int player);
static void drone_move_up(int player);
static void drone_turn_around(int player);
static void drone_sub_ninja(int player);
static int drone_sub_ninja_plan(int player, int wantedDirChar);
static int drone_sub_ninja_north(int player, int wantedDirChar);
static int drone_sub_ninja_south(int player, int wantedDirChar);
static int drone_sub_ninja_east(int player, int wantedDirChar);
static int drone_sub_ninja_west(int player, int wantedDirChar);

int drone_move(int player) {
  int joystickMaskAlwaysZero = 0x00;
  if (player_data[player].dr_targetLocked) return NO;
  if (player_data[player].dr_isInactive && !player_data[player].dr_targetLocked &&
      player_data[player].dr_type == DRONE_NINJA && !player_data[player].dr_dir[0]) {
    player_data[player].dr_dir[0] = 0;
    player_data[player].dr_fieldIndex = 0;
    player_data[player].dr_isInactive = FALSE;
    player_data[player].dr_upRotationCounter = 0;
    player_data[player].dr_rotateCounter = 0;
    drone_check_directions(player, &drone_can_north, &drone_can_south, &drone_can_east, &drone_can_west, 0, 0, 0);
    if (drone_can_north) drone_set_position(player, 'n');
    else if (drone_can_south) drone_set_position(player, 's');
    else if (drone_can_east) drone_set_position(player, 'e');
    else if (drone_can_west) drone_set_position(player, 'w');
    return NO;
  }
  if (player_data[player].dr_rotateCounter > 0) {
    player_data[player].dr_rotateCounter--;
    player_joy_table[player] = player_data[player].dr_joystick;
    return YES;
  }
  if (player_data[player].dr_rotateCounter < 0) {
    player_data[player].dr_rotateCounter++;
    player_joy_table[player] = player_data[player].dr_joystick;
    return YES;
  }
  if (player_data[player].dr_isInactive && player_data[player].dr_rotateCounter == 0) {
    if (player_data[player].ply_dir == PLAYER_DIR_NORTH || player_data[player].ply_dir == PLAYER_DIR_EAST) {
      player_data[player].dr_isInactive = FALSE;
      if (_rnd(256) & 1) {
        player_data[player].dr_rotateCounter = (256 / PLAYER_MOTION_ROTATE) / 4 - 1;
        player_joy_table[player] = player_data[player].dr_joystick = joystickMaskAlwaysZero | JOYSTICK_RIGHT;
      } else if (_rnd(256) & 1) {
        player_data[player].dr_rotateCounter = -((256 / PLAYER_MOTION_ROTATE) / 4 - 1);
        player_joy_table[player] = player_data[player].dr_joystick = joystickMaskAlwaysZero | JOYSTICK_LEFT;
      } else {
        player_data[player].dr_rotateCounter = (256 / PLAYER_MOTION_ROTATE) / 2 - 2;
        player_joy_table[player] = player_data[player].dr_joystick = JOYSTICK_LEFT;
      }
    } else if (player_data[player].ply_dir == PLAYER_DIR_SOUTH || player_data[player].ply_dir == PLAYER_DIR_WEST) {
      player_data[player].dr_isInactive = FALSE;
      if (_rnd(256) & 1) {
        player_data[player].dr_rotateCounter = -((256 / PLAYER_MOTION_ROTATE) / 4 - 1);
        player_joy_table[player] = player_data[player].dr_joystick = joystickMaskAlwaysZero | JOYSTICK_LEFT;
      } else if (_rnd(256) & 1) {
        player_data[player].dr_rotateCounter = (256 / PLAYER_MOTION_ROTATE) / 4 - 1;
        player_joy_table[player] = player_data[player].dr_joystick = joystickMaskAlwaysZero | JOYSTICK_RIGHT;
      } else {
        player_data[player].dr_rotateCounter = (256 / PLAYER_MOTION_ROTATE) / 2 - 2;
        player_joy_table[player] = player_data[player].dr_joystick = JOYSTICK_RIGHT;
      }
    } else {
      drone_sub_findMoveToTarget(player);
      player_data[player].dr_isInactive = FALSE;
      return NO;
    }
    return YES;
  }
  if (player_data[player].dr_upRotationCounter) {
    player_joy_table[player] = player_data[player].dr_joystick;
    player_data[player].dr_upRotationCounter--;
    return YES;
  }
  return NO;
}

void drone_check_directions(int player, int *canNorthPtr, int *canSouthPtr, int *canEastPtr,
                            int *canWestPtr, int useAltCoord, int altYField, int altXField) {
  int xField, yField, x, y;
  if (!useAltCoord) {
    y = player_data[player].ply_y;
    x = player_data[player].ply_x;
    yField = (y >> MAZE_FIELD_SHIFT) | 1;
    xField = (x >> MAZE_FIELD_SHIFT) | 1;
  } else {
    yField = altYField;
    xField = altXField;
  }
  *canNorthPtr = *canSouthPtr = *canEastPtr = *canWestPtr = FALSE;
  if (get_maze_data(yField - 1, xField, 0) == MAZE_FIELD_EMPTY) *canNorthPtr = TRUE;
  if (get_maze_data(yField + 1, xField, 0) == MAZE_FIELD_EMPTY) *canSouthPtr = TRUE;
  if (get_maze_data(yField, xField - 1, 0) == MAZE_FIELD_EMPTY) *canWestPtr = TRUE;
  if (get_maze_data(yField, xField + 1, 0) == MAZE_FIELD_EMPTY) *canEastPtr = TRUE;
}

void drone_sub_findMoveToTarget(int player) {
  int target_player, targetX, targetY, playerX, playerY, targetDistanceX, targetDistanceY;
  drone_needs2GoNorth = drone_needs2GoSouth = drone_needs2GoEast = drone_needs2GoWest = FALSE;
  drone_can_north = drone_can_south = drone_can_east = drone_can_west = FALSE;
  target_player = player_data[player].dr_currentTarget;
  playerY = player_data[player].ply_y;
  playerX = player_data[player].ply_x;
  targetY = drone_tgt(target_player)->ply_y;
  targetX = drone_tgt(target_player)->ply_x;
  player_data[player].dr_targetLocked = FALSE;
  player_data[player].dr_fireDirection = -1;
  targetDistanceY = targetY - playerY;
  targetDistanceX = targetX - playerX;
  if (drone_tgt(target_player)->ply_lives <= 0) player_data[player].dr_targetLocked = FALSE;
  drone_check_directions(player, &drone_can_north, &drone_can_south, &drone_can_east, &drone_can_west, 0, 0, 0);
  if (targetDistanceY == 0) {
    if (targetDistanceX < 0 && drone_can_west) drone_needs2GoWest = TRUE;
    else if (targetDistanceX > 0 && drone_can_east) drone_needs2GoEast = TRUE;
  } else if (targetDistanceX == 0) {
    if (targetDistanceY < 0 && drone_can_north) drone_needs2GoNorth = TRUE;
    else if (targetDistanceY > 0 && drone_can_south) drone_needs2GoSouth = TRUE;
  } else {
    if (targetDistanceY < 0) {
      if (drone_can_north) drone_needs2GoNorth = TRUE;
      else if (targetDistanceX < 0 && drone_can_west) drone_needs2GoWest = TRUE;
      else if (targetDistanceX > 0 && drone_can_east) drone_needs2GoEast = TRUE;
    } else if (targetDistanceY > 0) {
      if (drone_can_south) drone_needs2GoSouth = TRUE;
      else if (targetDistanceX < 0 && drone_can_west) drone_needs2GoWest = TRUE;
      else if (targetDistanceX > 0 && drone_can_east) drone_needs2GoEast = TRUE;
    }
  }
  if (!drone_needs2GoNorth && !drone_needs2GoSouth && !drone_needs2GoEast && !drone_needs2GoWest &&
      !player_data[player].dr_dir[0]) {
    if (player_data[player].ply_dir > PLAYER_DIR_NORTH && player_data[player].ply_dir <= PLAYER_DIR_NORTHEAST && drone_can_north) {
      player_data[player].ply_dir = PLAYER_DIR_NORTH;
      drone_needs2GoNorth = TRUE;
    } else if (player_data[player].ply_dir > PLAYER_DIR_NORTHEAST && player_data[player].ply_dir <= PLAYER_DIR_SOUTHEAST && drone_can_east) {
      player_data[player].ply_dir = PLAYER_DIR_EAST;
      drone_needs2GoEast = TRUE;
    } else if (player_data[player].ply_dir > PLAYER_DIR_SOUTHEAST && player_data[player].ply_dir <= PLAYER_DIR_SOUTHWEST && drone_can_south) {
      player_data[player].ply_dir = PLAYER_DIR_SOUTH;
      drone_needs2GoSouth = TRUE;
    } else if (player_data[player].ply_dir > PLAYER_DIR_SOUTHWEST && player_data[player].ply_dir <= PLAYER_DIR_NORTHWEST && drone_can_west) {
      player_data[player].ply_dir = PLAYER_DIR_WEST;
      drone_needs2GoWest = TRUE;
    } else if (player_data[player].ply_dir > PLAYER_DIR_NORTHWEST && player_data[player].ply_dir < (PLAYER_DIR_NORTH + 256) && drone_can_north) {
      player_data[player].ply_dir = PLAYER_DIR_NORTH;
      drone_needs2GoNorth = TRUE;
    }
  }
  if (player_data[player].dr_dir[0]) return;
  if (drone_needs2GoNorth) {
    player_data[player].ply_dir = PLAYER_DIR_NORTH;
    drone_can_south = drone_can_east = drone_can_west = FALSE;
    drone_can_north = TRUE;
    return;
  }
  if (drone_needs2GoSouth) {
    player_data[player].ply_dir = PLAYER_DIR_SOUTH;
    drone_can_north = drone_can_east = drone_can_west = FALSE;
    drone_can_south = TRUE;
    return;
  }
  if (drone_needs2GoEast) {
    player_data[player].ply_dir = PLAYER_DIR_EAST;
    drone_can_north = drone_can_south = drone_can_west = FALSE;
    drone_can_east = TRUE;
    return;
  }
  if (drone_needs2GoWest) {
    player_data[player].ply_dir = PLAYER_DIR_WEST;
    drone_can_north = drone_can_south = drone_can_east = FALSE;
    drone_can_west = TRUE;
  }
}

void drone_generate_joystickdata(int player) {
  int dir = player_data[player].ply_dir;
  if (player_data[player].dr_targetLocked) {
    player_joy_table[player] = JOYSTICK_BUTTON;
    return;
  }
  if (dir == PLAYER_DIR_NORTH && drone_can_north) {
    if (player_data[player].dr_type == DRONE_TARGET) drone_move_up(player);
    else if (drone_can_east) drone_move_upright(player);
    else if (drone_can_west) drone_move_upleft(player);
    else drone_move_up(player);
    return;
  }
  if (dir == PLAYER_DIR_EAST && drone_can_east) {
    if (player_data[player].dr_type == DRONE_TARGET) drone_move_up(player);
    else if (drone_can_south) drone_move_upright(player);
    else if (drone_can_north) drone_move_upleft(player);
    else drone_move_up(player);
    return;
  }
  if (dir == PLAYER_DIR_SOUTH && drone_can_south) {
    if (player_data[player].dr_type == DRONE_TARGET) drone_move_up(player);
    else if (drone_can_east) drone_move_upleft(player);
    else if (drone_can_west) drone_move_upright(player);
    else drone_move_up(player);
    return;
  }
  if (dir == PLAYER_DIR_WEST && drone_can_west) {
    if (player_data[player].dr_type == DRONE_TARGET) drone_move_up(player);
    else if (drone_can_south) drone_move_upleft(player);
    else if (drone_can_north) drone_move_upright(player);
    else drone_move_up(player);
    return;
  }
  if (dir == PLAYER_DIR_NORTH && !drone_can_north) {
    if (drone_can_east) drone_move_upright(player);
    else if (drone_can_west) drone_move_upleft(player);
    else drone_turn_around(player);
    return;
  }
  if (dir == PLAYER_DIR_EAST && !drone_can_east) {
    if (drone_can_north) drone_move_upleft(player);
    else if (drone_can_south) drone_move_upright(player);
    else drone_turn_around(player);
    return;
  }
  if (dir == PLAYER_DIR_SOUTH && !drone_can_south) {
    if (drone_can_east) drone_move_upleft(player);
    else if (drone_can_west) drone_move_upright(player);
    else drone_turn_around(player);
    return;
  }
  if (dir == PLAYER_DIR_WEST && !drone_can_west) {
    if (drone_can_north) drone_move_upright(player);
    else if (drone_can_south) drone_move_upleft(player);
    else drone_turn_around(player);
    return;
  }
}

int drone_aim2target(int player) {
  int target_player, deltaX, deltaY;
  target_player = player_data[player].dr_currentTarget;
  deltaY = player_data[target_player].ply_y - player_data[player].ply_y;
  deltaX = player_data[target_player].ply_x - player_data[player].ply_x;
  if (abs(deltaY) > 800 || abs(deltaX) > 800 || player_data[target_player].ply_lives <= 0) return NO;
  if (!player_data[player].dr_targetLocked) player_data[player].dr_fireDirection = player_data[player].ply_dir;
  player_data[player].ply_dir = drone_delta_into_direction(deltaY, deltaX);
  return YES;
}

int drone_delta_into_direction(int deltaY, int deltaX) {
  int angle, deltaXIsPositive, deltaYIsPositive;
  deltaYIsPositive = deltaY >= 0;
  deltaY = abs(deltaY);
  deltaXIsPositive = deltaX >= 0;
  deltaX = abs(deltaX);
  if (deltaX <= deltaY) angle = drone_angle_table[muls_divs(32, deltaX, deltaY)];
  else angle = 64 - drone_angle_table[muls_divs(32, deltaY, deltaX)];
  switch ((deltaYIsPositive << 1) + deltaXIsPositive) {
  case 0: angle += 128; break;
  case 1: angle = 128 - angle; break;
  case 2: angle = 256 - angle; break;
  case 3: break;
  }
  return (128 - angle) & 0xff;
}

int drone_isTargetIsVisibleNorth(int player, int fieldY, int fieldX) {
  int target_player, playerFieldX, playerFieldY, targetFieldX, targetFieldY;
  target_player = player_data[player].dr_currentTarget;
  if (player_data[target_player].ply_lives <= 0) return NO;
  targetFieldY = (player_data[target_player].ply_y >> MAZE_FIELD_SHIFT) | 1;
  targetFieldX = (player_data[target_player].ply_x >> MAZE_FIELD_SHIFT) | 1;
  playerFieldY = fieldY ? fieldY : (player_data[player].ply_y >> MAZE_FIELD_SHIFT) | 1;
  playerFieldX = fieldX ? fieldX : (player_data[player].ply_x >> MAZE_FIELD_SHIFT) | 1;
  if (targetFieldX != playerFieldX || playerFieldY < targetFieldY) return NO;
  if (playerFieldY <= 1) return NO;
  if (targetFieldX == playerFieldX && targetFieldY == playerFieldY) return YES;
  while (get_maze_data(playerFieldY - 1, playerFieldX, 0) == MAZE_FIELD_EMPTY && targetFieldY != playerFieldY) {
    playerFieldY -= 2;
    if (playerFieldY == 0) break;
  }
  if (targetFieldY != playerFieldY) return NO;
  return YES;
}

int drone_isTargetIsVisibleSouth(int player, int fieldY, int fieldX) {
  int target_player, playerFieldX, playerFieldY, targetFieldX, targetFieldY;
  target_player = player_data[player].dr_currentTarget;
  if (player_data[target_player].ply_lives <= 0) return NO;
  targetFieldY = (player_data[target_player].ply_y >> MAZE_FIELD_SHIFT) | 1;
  targetFieldX = (player_data[target_player].ply_x >> MAZE_FIELD_SHIFT) | 1;
  playerFieldY = fieldY ? fieldY : (player_data[player].ply_y >> MAZE_FIELD_SHIFT) | 1;
  playerFieldX = fieldX ? fieldX : (player_data[player].ply_x >> MAZE_FIELD_SHIFT) | 1;
  if (targetFieldX != playerFieldX || playerFieldY > targetFieldY) return NO;
  if (playerFieldY > MAZE_MAX_SIZE - 1) return NO;
  if (targetFieldX == playerFieldX && targetFieldY == playerFieldY) return YES;
  while (get_maze_data(playerFieldY + 1, playerFieldX, 0) == MAZE_FIELD_EMPTY && targetFieldY != playerFieldY) {
    playerFieldY += 2;
    if (playerFieldY > MAZE_MAX_SIZE - 1) break;
  }
  if (targetFieldY != playerFieldY) return NO;
  return YES;
}

int drone_isTargetIsVisibleEast(int player, int fieldY, int fieldX) {
  int target_player, playerFieldX, playerFieldY, targetFieldX, targetFieldY;
  target_player = player_data[player].dr_currentTarget;
  if (player_data[target_player].ply_lives <= 0) return NO;
  targetFieldX = (player_data[target_player].ply_x >> MAZE_FIELD_SHIFT) | 1;
  targetFieldY = (player_data[target_player].ply_y >> MAZE_FIELD_SHIFT) | 1;
  playerFieldY = fieldY ? fieldY : (player_data[player].ply_y >> MAZE_FIELD_SHIFT) | 1;
  playerFieldX = fieldX ? fieldX : (player_data[player].ply_x >> MAZE_FIELD_SHIFT) | 1;
  if (targetFieldY != playerFieldY || targetFieldX < playerFieldX) return NO;
  if (playerFieldX > MAZE_MAX_SIZE - 1) return NO;
  if (targetFieldX == playerFieldX && targetFieldY == playerFieldY) return YES;
  while (get_maze_data(playerFieldY, playerFieldX + 1, 0) == MAZE_FIELD_EMPTY && targetFieldX != playerFieldX) {
    playerFieldX += 2;
    if (playerFieldX > MAZE_MAX_SIZE - 1) break;
  }
  if (targetFieldX != playerFieldX) return NO;
  return YES;
}

int drone_isTargetIsVisibleWest(int player, int fieldY, int fieldX) {
  int target_player, playerFieldX, playerFieldY, targetFieldX, targetFieldY;
  target_player = player_data[player].dr_currentTarget;
  if (player_data[target_player].ply_lives <= 0) return NO;
  targetFieldX = (player_data[target_player].ply_x >> MAZE_FIELD_SHIFT) | 1;
  targetFieldY = (player_data[target_player].ply_y >> MAZE_FIELD_SHIFT) | 1;
  playerFieldY = fieldY ? fieldY : (player_data[player].ply_y >> MAZE_FIELD_SHIFT) | 1;
  playerFieldX = fieldX ? fieldX : (player_data[player].ply_x >> MAZE_FIELD_SHIFT) | 1;
  if (targetFieldY != playerFieldY || playerFieldX < targetFieldX) return NO;
  if (playerFieldX <= 1) return NO;
  if (targetFieldX == playerFieldX && targetFieldY == playerFieldY) return YES;
  while (get_maze_data(playerFieldY, playerFieldX - 1, 0) == MAZE_FIELD_EMPTY && targetFieldX != playerFieldX) {
    playerFieldX -= 2;
    if (playerFieldX == 0) break;
  }
  if (targetFieldX != playerFieldX) return NO;
  return YES;
}

void drone_set_position(int player, int viewCompassDirChar) {
  int playerFieldX, playerFieldY;
  playerFieldY = (player_data[player].ply_y >> MAZE_FIELD_SHIFT) | 1;
  playerFieldX = (player_data[player].ply_x >> MAZE_FIELD_SHIFT) | 1;
  switch (viewCompassDirChar) {
  case 'n':
    player_data[player].ply_dir = PLAYER_DIR_NORTH;
    player_data[player].ply_y = playerFieldY << MAZE_FIELD_SHIFT;
    player_data[player].ply_x = playerFieldX << MAZE_FIELD_SHIFT;
    set_object(player, player_data[player].ply_y, player_data[player].ply_x);
    player_data[player].ply_plist = MAZE_FIELD_EMPTY;
    drone_can_south = drone_can_east = drone_can_west = FALSE;
    drone_can_north = TRUE;
    break;
  case 's':
    player_data[player].ply_dir = PLAYER_DIR_SOUTH;
    player_data[player].ply_y = playerFieldY << MAZE_FIELD_SHIFT;
    player_data[player].ply_x = playerFieldX << MAZE_FIELD_SHIFT;
    set_object(player, player_data[player].ply_y, player_data[player].ply_x);
    player_data[player].ply_plist = MAZE_FIELD_EMPTY;
    drone_can_north = drone_can_east = drone_can_west = FALSE;
    drone_can_south = TRUE;
    break;
  case 'e':
    player_data[player].ply_dir = PLAYER_DIR_EAST;
    player_data[player].ply_y = playerFieldY << MAZE_FIELD_SHIFT;
    player_data[player].ply_x = playerFieldX << MAZE_FIELD_SHIFT;
    set_object(player, player_data[player].ply_y, player_data[player].ply_x);
    player_data[player].ply_plist = MAZE_FIELD_EMPTY;
    drone_can_north = drone_can_south = drone_can_west = FALSE;
    drone_can_east = TRUE;
    break;
  case 'w':
    player_data[player].ply_dir = PLAYER_DIR_WEST;
    player_data[player].ply_y = playerFieldY << MAZE_FIELD_SHIFT;
    player_data[player].ply_x = playerFieldX << MAZE_FIELD_SHIFT;
    set_object(player, player_data[player].ply_y, player_data[player].ply_x);
    player_data[player].ply_plist = MAZE_FIELD_EMPTY;
    drone_can_north = drone_can_south = drone_can_east = FALSE;
    drone_can_west = TRUE;
    break;
  default:
    return;
  }
}

void drone_sub_standard(int player) {
  int target_player, targetDistanceX, targetDistanceY, targetFieldX, targetFieldY, playerFieldX, playerFieldY;
  target_player = (player_data[player].ply_hitflag &&
                   (player_data[player_data[player].ply_gunman].dr_type != DRONE_NINJA ||
                    player_data[player_data[player].ply_gunman].dr_type != DRONE_STANDARD))
                      ? player_data[player].ply_gunman
                      : player_data[player].dr_currentTarget;
  playerFieldY = (player_data[player].ply_y >> MAZE_FIELD_SHIFT) | 1;
  playerFieldX = (player_data[player].ply_x >> MAZE_FIELD_SHIFT) | 1;
  targetFieldY = (player_data[target_player].ply_y >> MAZE_FIELD_SHIFT) | 1;
  targetFieldX = (player_data[target_player].ply_x >> MAZE_FIELD_SHIFT) | 1;
  targetDistanceY = targetFieldY - playerFieldY;
  targetDistanceX = targetFieldX - playerFieldX;
  if (player_data[player].ply_hitflag) {
    player_data[player].ply_dir = drone_delta_into_direction(targetDistanceY, targetDistanceX);
    return;
  }
  if (targetDistanceY == 0) {
    if (targetDistanceX < 0) {
      if (drone_isTargetIsVisibleWest(player, 0, 0)) {
        if (drone_aim2target(player)) player_data[player].dr_targetLocked = TRUE;
        else if (player_data[player].dr_targetLocked) { drone_sub_findMoveToTarget(player); player_data[player].dr_targetLocked = FALSE; }
      } else if (player_data[player].dr_targetLocked) { drone_sub_findMoveToTarget(player); player_data[player].dr_targetLocked = FALSE; }
    } else if (targetDistanceX > 0) {
      if (drone_isTargetIsVisibleEast(player, 0, 0)) {
        if (drone_aim2target(player)) player_data[player].dr_targetLocked = TRUE;
        else if (player_data[player].dr_targetLocked) { drone_sub_findMoveToTarget(player); player_data[player].dr_targetLocked = FALSE; }
      } else if (player_data[player].dr_targetLocked) { drone_sub_findMoveToTarget(player); player_data[player].dr_targetLocked = FALSE; }
    }
  } else if (targetDistanceX == 0) {
    if (targetDistanceY < 0) {
      if (drone_isTargetIsVisibleNorth(player, 0, 0)) {
        if (drone_aim2target(player)) player_data[player].dr_targetLocked = TRUE;
        else if (player_data[player].dr_targetLocked) { drone_sub_findMoveToTarget(player); player_data[player].dr_targetLocked = FALSE; }
      } else if (player_data[player].dr_targetLocked) { drone_sub_findMoveToTarget(player); player_data[player].dr_targetLocked = FALSE; }
    } else if (targetDistanceY > 0) {
      if (drone_isTargetIsVisibleSouth(player, 0, 0)) {
        if (drone_aim2target(player)) player_data[player].dr_targetLocked = TRUE;
        else if (player_data[player].dr_targetLocked) { drone_sub_findMoveToTarget(player); player_data[player].dr_targetLocked = FALSE; }
      } else if (player_data[player].dr_targetLocked) { drone_sub_findMoveToTarget(player); player_data[player].dr_targetLocked = FALSE; }
    }
  } else {
    if (player_data[player].dr_targetLocked) {
      player_data[player].dr_targetLocked = FALSE;
      drone_sub_findMoveToTarget(player);
    }
  }
}

void drone_move_upright(int player) {
  player_data[player].dr_upRotationCounter = (256 / PLAYER_MOTION_ROTATE) / 8 - 1;
  if (player_data[player].dr_targetLocked)
    player_joy_table[player] = player_data[player].dr_joystick = JOYSTICK_BUTTON | JOYSTICK_RIGHT | JOYSTICK_UP;
  else
    player_joy_table[player] = player_data[player].dr_joystick = JOYSTICK_RIGHT | JOYSTICK_UP;
}

void drone_move_upleft(int player) {
  player_data[player].dr_upRotationCounter = (256 / PLAYER_MOTION_ROTATE) / 8 - 1;
  if (player_data[player].dr_targetLocked)
    player_joy_table[player] = player_data[player].dr_joystick = JOYSTICK_BUTTON | JOYSTICK_LEFT | JOYSTICK_UP;
  else
    player_joy_table[player] = player_data[player].dr_joystick = JOYSTICK_LEFT | JOYSTICK_UP;
}

void drone_move_up(int player) {
  if (player_data[player].dr_targetLocked)
    player_joy_table[player] = player_data[player].dr_joystick = JOYSTICK_BUTTON | JOYSTICK_UP;
  else
    player_joy_table[player] = player_data[player].dr_joystick = JOYSTICK_UP;
}

void drone_turn_around(int player) {
  player_data[player].dr_rotateCounter = (256 / PLAYER_MOTION_ROTATE) / 2 - 1;
  if (player_data[player].dr_targetLocked)
    player_joy_table[player] = player_data[player].dr_joystick = JOYSTICK_BUTTON | JOYSTICK_RIGHT;
  else
    player_joy_table[player] = player_data[player].dr_joystick = JOYSTICK_RIGHT;
}

/* drone_action: TARGET + STANDARD cases (NINJA added in STORY-03). */
void drone_action(int player) {
  int target_player;
  int i;
  switch (player_data[player].dr_type) {
  case DRONE_NINJA:
    if (player_data[player].ply_lives <= 0) {
      player_data[player].dr_dir[0] = 0;
      player_data[player].dr_targetLocked = FALSE;
      player_data[player].dr_fieldIndex = 0;
      player_data[player].dr_field[0].y = 0;
      player_data[player].dr_upRotationCounter = 0;
      player_data[player].dr_rotateCounter = 0;
      break;
    }
    if (player_data[player].ply_hitflag && player_data[player].ply_gunman != player_data[player].dr_currentTarget &&
        player_data[player_data[player].ply_gunman].dr_type != DRONE_NINJA &&
        player_data[player_data[player].ply_gunman].dr_type != DRONE_STANDARD) {
      if (player_data[player_data[player].ply_gunman].ply_team != player_data[player].ply_team && team_flag) {
        player_data[player].dr_currentTarget = player_data[player].ply_gunman;
        player_data[player].dr_dir[0] = 0;
        player_data[player].dr_targetLocked = FALSE;
        player_data[player].dr_fieldIndex = 0;
        player_data[player].dr_field[0].y = 0;
        player_data[player].dr_upRotationCounter = 0;
        player_data[player].dr_rotateCounter = 0;
      } else if (!team_flag) {
        player_data[player].dr_currentTarget = player_data[player].ply_gunman;
        player_data[player].dr_dir[0] = 0;
        player_data[player].dr_targetLocked = FALSE;
        player_data[player].dr_fieldIndex = 0;
        player_data[player].dr_field[0].y = 0;
        player_data[player].dr_upRotationCounter = 0;
        player_data[player].dr_rotateCounter = 0;
      }
    }
    target_player = player_data[player].dr_currentTarget;
    if (target_player < 0 && team_flag) {
      drone_check_directions(player, &drone_can_north, &drone_can_south, &drone_can_east, &drone_can_west, 0, 0, 0);
      drone_generate_joystickdata(player);
      break;
    }
    if (drone_tgt(target_player)->ply_lives <= 0 && !team_flag) {
      player_data[player].dr_dir[0] = 0;
      player_data[player].dr_fieldIndex = 0;
      player_data[player].dr_field[0].y = 0;
      player_data[player].dr_upRotationCounter = 0;
      player_data[player].dr_rotateCounter = 0;
      if (player_data[player].dr_targetLocked) drone_sub_findMoveToTarget(player);
      if (player_data[player_data[player].dr_permanentTarget].ply_lives > 0) {
        player_data[player].dr_currentTarget = player_data[player].dr_permanentTarget;
        target_player = player_data[player].dr_currentTarget;
      } else {
        for (i = 0; player_data[player].dr_humanEnemies[i] != -1; i++) {
          if (player_data[i].ply_lives > 0 && player_data[i].dr_type != DRONE_NINJA &&
              player_data[i].dr_type != DRONE_STANDARD) {
            player_data[player].dr_currentTarget = player_data[player].dr_humanEnemies[i];
            target_player = player_data[player].dr_currentTarget;
            break;
          }
        }
      }
    } else if (drone_tgt(target_player)->ply_lives <= 0 && team_flag) {
      player_data[player].dr_dir[0] = 0;
      player_data[player].dr_fieldIndex = 0;
      player_data[player].dr_field[0].y = 0;
      player_data[player].dr_targetLocked = FALSE;
      player_data[player].dr_fireDirection = -1;
      player_data[player].dr_upRotationCounter = 0;
      player_data[player].dr_rotateCounter = 0;
      drone_check_directions(player, &drone_can_north, &drone_can_south, &drone_can_east, &drone_can_west, 0, 0, 0);
      drone_generate_joystickdata(player);
      break;
    }
    if (drone_tgt(target_player)->ply_lives <= 0) {
      player_data[player].dr_dir[0] = 0;
      player_data[player].dr_fieldIndex = 0;
      player_data[player].dr_field[0].y = 0;
      player_data[player].dr_targetLocked = FALSE;
      player_data[player].dr_upRotationCounter = 0;
      player_data[player].dr_rotateCounter = 0;
      drone_check_directions(player, &drone_can_north, &drone_can_south, &drone_can_east, &drone_can_west, 0, 0, 0);
      drone_generate_joystickdata(player);
      break;
    }
    if (drone_move(player)) return;
    drone_sub_ninja(player);
    drone_generate_joystickdata(player);
    break;
  case DRONE_TARGET:
    if (player_data[player].ply_lives <= 0) {
      player_data[player].dr_dir[0] = 0;
      player_data[player].dr_targetLocked = FALSE;
      player_data[player].dr_upRotationCounter = 0;
      player_data[player].dr_rotateCounter = 0;
    }
    if (drone_move(player)) return;
    drone_check_directions(player, &drone_can_north, &drone_can_south, &drone_can_east, &drone_can_west, 0, 0, 0);
    drone_generate_joystickdata(player);
    break;
  case DRONE_STANDARD:
    if (player_data[player].ply_lives <= 0) {
      player_data[player].dr_dir[0] = 0;
      player_data[player].dr_targetLocked = FALSE;
      player_data[player].dr_fieldIndex = 0;
      player_data[player].dr_field[0].y = 0;
      player_data[player].dr_upRotationCounter = 0;
      player_data[player].dr_rotateCounter = 0;
      break;
    }
    if (player_data[player].ply_hitflag && player_data[player].ply_gunman != player_data[player].dr_currentTarget &&
        player_data[player_data[player].ply_gunman].dr_type != DRONE_NINJA &&
        player_data[player_data[player].ply_gunman].dr_type != DRONE_STANDARD) {
      if (player_data[player_data[player].ply_gunman].ply_team != player_data[player].ply_team && team_flag) {
        player_data[player].dr_currentTarget = player_data[player].ply_gunman;
        player_data[player].dr_dir[0] = 0;
        player_data[player].dr_targetLocked = FALSE;
        player_data[player].dr_fieldIndex = 0;
        player_data[player].dr_field[0].y = 0;
        player_data[player].dr_upRotationCounter = 0;
        player_data[player].dr_rotateCounter = 0;
      } else if (!team_flag) {
        player_data[player].dr_currentTarget = player_data[player].ply_gunman;
        player_data[player].dr_dir[0] = 0;
        player_data[player].dr_targetLocked = FALSE;
        player_data[player].dr_fieldIndex = 0;
        player_data[player].dr_field[0].y = 0;
        player_data[player].dr_upRotationCounter = 0;
        player_data[player].dr_rotateCounter = 0;
      }
    }
    target_player = player_data[player].dr_currentTarget;
    if (drone_tgt(target_player)->ply_lives <= 0 || (team_flag && target_player < 0)) {
      player_data[player].dr_dir[0] = 0;
      player_data[player].dr_targetLocked = FALSE;
      player_data[player].dr_upRotationCounter = 0;
      player_data[player].dr_rotateCounter = 0;
      drone_check_directions(player, &drone_can_north, &drone_can_south, &drone_can_east, &drone_can_west, 0, 0, 0);
      drone_generate_joystickdata(player);
      break;
    }
    if (drone_move(player)) return;
    drone_check_directions(player, &drone_can_north, &drone_can_south, &drone_can_east, &drone_can_west, 0, 0, 0);
    drone_sub_standard(player);
    drone_generate_joystickdata(player);
    break;
  }
}

/* --- drone.c: ninja AI (verbatim port from drone.c) --- */
/************************************************************
 *** void drone_sub_ninja(int player)
 ************************************************************/
void drone_sub_ninja(int player) {
int target_player;
int fieldIndex;
int targetFieldX;
int targetFieldY;
int playerFieldX;
int playerFieldY;
int deltaX;
int deltaY;

    drone_needs2GoNorth = drone_needs2GoSouth = drone_needs2GoEast = drone_needs2GoWest = FALSE;
    target_player = player_data[player].dr_currentTarget;
    /* position of the player */
    playerFieldY = (player_data[player].ply_y >> MAZE_FIELD_SHIFT)|1;
    playerFieldX = (player_data[player].ply_x >> MAZE_FIELD_SHIFT)|1;
    /* position of the target */
    targetFieldY = (player_data[target_player].ply_y >> MAZE_FIELD_SHIFT)|1;
    targetFieldX = (player_data[target_player].ply_x >> MAZE_FIELD_SHIFT)|1;
    /* distance between us and the target (a human player would not have this info...) */
    deltaY = targetFieldY-playerFieldY;
    deltaX = targetFieldX-playerFieldX;

    drone_check_directions(player, &drone_can_north, &drone_can_south, &drone_can_east, &drone_can_west, 0, 0, 0);

    /* If the drone doesn't have a plan (!player_data[player].dr_dir[0]), */
    /* then do a similar search as the standard drone for the target, */
    /* if that is not possible, make a plan how to get to the target (ninja only feature) */
    if(deltaY == 0 && !player_data[player].dr_dir[0]) {
        if(deltaX < 0) {
            if(drone_can_west) {
                drone_needs2GoWest = TRUE;
                if(drone_isTargetIsVisibleWest(player, 0, 0)) {
                    if(drone_aim2target(player)) {
                        player_data[player].dr_targetLocked = TRUE;
                    } else if(player_data[player].dr_targetLocked) {
                        drone_sub_findMoveToTarget(player);
                    }
                } else if(player_data[player].dr_targetLocked) {
                    drone_sub_findMoveToTarget(player);
                }
            } else {
                /* drone wants to go west, but can't */
                if(drone_sub_ninja_plan(player, 'w')) { /* try via north/south to walk around the obstruction  */
                } else if((_rnd(256)&1) && drone_sub_ninja_north(player, 'w')) {
                } else if(drone_sub_ninja_north(player, 'e')) {
                } else if(drone_sub_ninja_north(player, 'w')) {
                } else if(drone_sub_ninja_south(player, 'w')) {
                } else if(drone_sub_ninja_east(player, 'n')) {
                } else {
                    drone_sub_ninja_east(player, 's');
                }
            }
        } else if(deltaX > 0) {
            if(drone_can_east) {
                drone_needs2GoEast = TRUE;
                if(drone_isTargetIsVisibleEast(player, 0, 0)) {
                    if(drone_aim2target(player)) {
                        player_data[player].dr_targetLocked = TRUE;
                    } else if(player_data[player].dr_targetLocked) {
                        drone_sub_findMoveToTarget(player);
                    }
                } else if(player_data[player].dr_targetLocked) {
                    drone_sub_findMoveToTarget(player);
                }
            } else {
                /* drone wants to go east, but can't */
                if(drone_sub_ninja_plan(player, 'e')) { /* try via north/south to walk around the obstruction */
                } else if((_rnd(256)&1) && drone_sub_ninja_north(player, 'e')) {
                } else if(drone_sub_ninja_north(player, 'w')) {
                } else if(drone_sub_ninja_north(player, 'e')) {
                } else if(drone_sub_ninja_south(player, 'e')) {
                } else if(drone_sub_ninja_west(player, 'n')) {
                } else {
                    drone_sub_ninja_west(player, 's');
                }
            }
        }
    } else if(deltaX == 0 && !player_data[player].dr_dir[0]) {
        if(deltaY < 0) {
            if(drone_can_north) {
                drone_needs2GoNorth = TRUE;
                if(drone_isTargetIsVisibleNorth(player, 0, 0)) {
                    if(drone_aim2target(player)) {
                        player_data[player].dr_targetLocked = TRUE;
                    } else if(player_data[player].dr_targetLocked) {
                        drone_sub_findMoveToTarget(player);
                    }
                } else if(player_data[player].dr_targetLocked) {
                    drone_sub_findMoveToTarget(player);
                }
            } else {
                /* drone wants to go north, but can't */
                if(drone_sub_ninja_plan(player, 'n')) { /* try via west/east to walk around the obstruction */
                } else if((_rnd(256)&1) && drone_sub_ninja_west(player, 's')) {
                } else if(drone_sub_ninja_west(player, 'n')) {
                } else if(drone_sub_ninja_west(player, 's')) {
                } else if(drone_sub_ninja_east(player, 'n')) {
                } else if(drone_sub_ninja_south(player, 'e')) {
                } else {
                    drone_sub_ninja_south(player, 'w');
                }
            }
        } else if(deltaY > 0) {
            if(drone_can_south) {
                drone_needs2GoSouth = TRUE;
                if(drone_isTargetIsVisibleSouth(player, 0, 0)) {
                    if(drone_aim2target(player)) {
                        player_data[player].dr_targetLocked = TRUE;
                    } else if(player_data[player].dr_targetLocked) {
                        drone_sub_findMoveToTarget(player);
                    }
                } else if(player_data[player].dr_targetLocked) {
                    drone_sub_findMoveToTarget(player);
                }
            } else {
                /* drone wants to go south, but can't */
                if(drone_sub_ninja_plan(player, 's')) { /* try via west/east to walk around the obstruction */
                } else if((_rnd(256)&1) && drone_sub_ninja_east(player, 'n')) {
                } else if(drone_sub_ninja_east(player, 's')) {
                } else if(drone_sub_ninja_east(player, 'n')) {
                } else if(drone_sub_ninja_west(player, 's')) {
                } else if(drone_sub_ninja_north(player, 'e')) {
                } else {
                    drone_sub_ninja_north(player, 'w');
                }
            }
        }
    } else if(deltaY < 0 && !player_data[player].dr_dir[0]) {
        if(player_data[player].dr_targetLocked) {
            drone_sub_findMoveToTarget(player);
        } else if(drone_can_north) {
            drone_needs2GoNorth = TRUE;
        } else if(deltaX < 0 && drone_can_west) {
            drone_needs2GoWest = TRUE;
        } else if(deltaX > 0 && drone_can_east) {
            drone_needs2GoEast = TRUE;
        } else if(!drone_can_north && deltaX > 0 && !drone_can_east) {
            if((_rnd(256)&1) && drone_sub_ninja_west(player, 's')) {
            } else if(drone_sub_ninja_west(player, 'n')) {
            } else if(drone_sub_ninja_west(player, 's')) {
            } else if(drone_sub_ninja_south(player, 'e')) {
            } else {
                drone_sub_ninja_south(player, 'w');
            }
        } else if(!drone_can_north && deltaX < 0 && !drone_can_west) {
            if((_rnd(256)&1) && drone_sub_ninja_east(player, 's')) {
            } else if(drone_sub_ninja_east(player, 'n')) {
            } else if(drone_sub_ninja_east(player, 's')) {
            } else if(drone_sub_ninja_south(player, 'w')) {
            } else {
                drone_sub_ninja_south(player, 'e');
            }
        }
    } else if(deltaY > 0 && !player_data[player].dr_dir[0]) {
        if(player_data[player].dr_targetLocked) {
            drone_sub_findMoveToTarget(player);
        } else if(drone_can_south) {
            drone_needs2GoSouth = TRUE;
        } else if(deltaX < 0 && drone_can_west) {
            drone_needs2GoWest = TRUE;
        } else if(deltaX > 0 && drone_can_east) {
            drone_needs2GoEast = TRUE;
        } else if(!drone_can_south && deltaX < 0 && !drone_can_west) {
            if((_rnd(256)&1) && drone_sub_ninja_east(player, 'n')) {
            } else if(drone_sub_ninja_east(player, 's')) {
            } else if(drone_sub_ninja_east(player, 'n')) {
            } else if(drone_sub_ninja_north(player, 'e')) {
            } else {
                drone_sub_ninja_north(player, 'w');
            }
        } else if(!drone_can_south && deltaX > 0 && !drone_can_east) {
            if((_rnd(256)&1) && drone_sub_ninja_west(player, 'n')) {
            } else if(drone_sub_ninja_west(player, 's')) {
            } else if(drone_sub_ninja_west(player, 'n')) {
            } else if(drone_sub_ninja_north(player, 'w')) {
            } else {
                drone_sub_ninja_north(player, 'e');
            }
        }
    }

    /* Does the drone have a plan? Execute that plan! */
    if(player_data[player].dr_dir[0]) {

        /* current position in our action list */
        fieldIndex = player_data[player].dr_fieldIndex;
        /* did the player reach the destination field? */
        if(player_data[player].dr_field[fieldIndex].y == playerFieldY && player_data[player].dr_field[fieldIndex].x == playerFieldX) {
            /* then increment to the next position */
            player_data[player].dr_fieldIndex++;
            fieldIndex = player_data[player].dr_fieldIndex;
            player_data[player].dr_fieldResetTimer = 0;
        }

        /* After 78 steps, we do time-out and give up */
        if(player_data[player].dr_fieldResetTimer++ > 78) {
            player_data[player].dr_field[fieldIndex].y = 0;
            player_data[player].dr_fieldResetTimer = 0;
        }

        if(player_data[player].dr_field[fieldIndex].y == 0 || player_data[player].dr_dir[fieldIndex] == -1) {
            /* reset motion plan */
            player_data[player].dr_dir[0] = 0;
            player_data[player].dr_fieldIndex = 0;
            player_data[player].dr_upRotationCounter = 0;
            player_data[player].dr_rotateCounter = 0;
            /* take the last destination as our target destination */
            if(fieldIndex > 0) {
                if(player_data[player].dr_dir[fieldIndex-1] == (PLAYER_DIR_NORTH+256)) {
                    drone_needs2GoNorth = TRUE;
                } else if(player_data[player].dr_dir[fieldIndex-1] == PLAYER_DIR_EAST) {
                    drone_needs2GoEast = TRUE;
                } else if(player_data[player].dr_dir[fieldIndex-1] == PLAYER_DIR_SOUTH) {
                    drone_needs2GoSouth = TRUE;
                } else if(player_data[player].dr_dir[fieldIndex-1] == PLAYER_DIR_WEST) {
                    drone_needs2GoWest = TRUE;
                }
            } else { /* BUG: this block is identical to the one above, which is a problem, because fieldIndex-1 == -1 here. */
#if 0
                if(player_data[player].dr_dir[fieldIndex-1] == (PLAYER_DIR_NORTH+256)) {
                    drone_needs2GoNorth = TRUE;
                } else if(player_data[player].dr_dir[fieldIndex-1] == PLAYER_DIR_EAST) {
                    drone_needs2GoEast = TRUE;
                } else if(player_data[player].dr_dir[fieldIndex-1] == PLAYER_DIR_SOUTH) {
                    drone_needs2GoSouth = TRUE;
                } else if(player_data[player].dr_dir[fieldIndex-1] == PLAYER_DIR_WEST) {
                    drone_needs2GoWest = TRUE;
                }
#endif
            }
        } else if(player_data[player].dr_dir[fieldIndex] == (PLAYER_DIR_NORTH+256) && drone_can_north) { /* plan: going north (and player can go north) */
            if(fieldIndex == 0 && player_data[player].ply_dir) { /* if player is not aligned north, do so */
                drone_set_position(player, 'n');
            }
            drone_needs2GoNorth = TRUE;
            if(deltaX == 0 && deltaY < 0) {
                if(drone_isTargetIsVisibleNorth(player, 0, 0)) { /* can we see the target? */
                    if(drone_aim2target(player)) { /* yes => aim and lock */
                        player_data[player].dr_targetLocked = TRUE;
                        /* reset motion plan */
                        player_data[player].dr_dir[0] = 0;
                        player_data[player].dr_fieldIndex = 0;
                        player_data[player].dr_upRotationCounter = 0;
                        player_data[player].dr_rotateCounter = 0;
                    } else if(player_data[player].dr_targetLocked) {
                        drone_sub_findMoveToTarget(player);
                    }
                } else if(player_data[player].dr_targetLocked) {
                    drone_sub_findMoveToTarget(player);
                }
            }
        } else if(player_data[player].dr_dir[fieldIndex] == PLAYER_DIR_EAST && drone_can_east) { /* plan: going east (and player can go east) */
            if(fieldIndex == 0 && player_data[player].ply_dir != PLAYER_DIR_EAST) { /* if player is not aligned east, do so */
                drone_set_position(player, 'e');
            }
            drone_needs2GoEast = TRUE;
            if(deltaY == 0 && deltaX > 0) {
                if(drone_isTargetIsVisibleEast(player, 0, 0)) { /* can we see the target? */
                    if(drone_aim2target(player)) { /* yes => aim and lock */
                        player_data[player].dr_targetLocked = TRUE;
                        /* reset motion plan */
                        player_data[player].dr_dir[0] = 0;
                        player_data[player].dr_fieldIndex = 0;
                        player_data[player].dr_upRotationCounter = 0;
                        player_data[player].dr_rotateCounter = 0;
                    } else if(player_data[player].dr_targetLocked) {
                        drone_sub_findMoveToTarget(player);
                    }
                } else if(player_data[player].dr_targetLocked) {
                    drone_sub_findMoveToTarget(player);
                }
            }
        } else if(player_data[player].dr_dir[fieldIndex] == PLAYER_DIR_SOUTH && drone_can_south) { /* plan: going south (and player can go south) */
            if(player_data[player].ply_dir != PLAYER_DIR_SOUTH && fieldIndex == 0) { /* if player is not aligned south, do so */
                drone_set_position(player, 's');
            }
            drone_needs2GoSouth = TRUE;
            if(deltaX == 0 && deltaY > 0) {
                if(drone_isTargetIsVisibleSouth(player, 0, 0)) { /* can we see the target? */
                    if(drone_aim2target(player)) { /* yes => aim and lock */
                        player_data[player].dr_targetLocked = TRUE;
                        /* reset motion plan */
                        player_data[player].dr_dir[0] = 0;
                        player_data[player].dr_fieldIndex = 0;
                        player_data[player].dr_upRotationCounter = 0;
                        player_data[player].dr_rotateCounter = 0;
                    } else if(player_data[player].dr_targetLocked) {
                        drone_sub_findMoveToTarget(player);
                    }
                } else if(player_data[player].dr_targetLocked) {
                    drone_sub_findMoveToTarget(player);
                }
            }
        } else if(player_data[player].dr_dir[fieldIndex] == PLAYER_DIR_WEST && drone_can_west) { /* plan: going west (and player can go west) */
            if(player_data[player].ply_dir != PLAYER_DIR_WEST && fieldIndex == 0) { /* if player is not aligned west, do so */
                drone_set_position(player, 'w');
            }
            drone_needs2GoWest = TRUE;
            if(deltaY == 0 && deltaX < 0) {
                if(drone_isTargetIsVisibleWest(player, 0, 0)) { /* can we see the target? */
                    if(drone_aim2target(player)) { /* yes => aim and lock */
                        player_data[player].dr_targetLocked = TRUE;
                        /* reset motion plan */
                        player_data[player].dr_dir[0] = 0;
                        player_data[player].dr_fieldIndex = 0;
                        player_data[player].dr_upRotationCounter = 0;
                        player_data[player].dr_rotateCounter = 0;
                    } else if(player_data[player].dr_targetLocked) {
                        drone_sub_findMoveToTarget(player);
                    }
                } else if(player_data[player].dr_targetLocked) {
                    drone_sub_findMoveToTarget(player);
                }
            }
        }
    }

    /* setup variables for the joystick movement generation code */
    if(drone_needs2GoNorth) {
        drone_can_south = drone_can_east = drone_can_west = FALSE;
        drone_can_north = TRUE;
    } else if(drone_needs2GoSouth) {
        drone_can_north = drone_can_east = drone_can_west = FALSE;
        drone_can_south = TRUE;
    } else if(drone_needs2GoEast) {
        drone_can_north = drone_can_south = drone_can_west = FALSE;
        drone_can_east = TRUE;
    } else if(drone_needs2GoWest) {
        drone_can_north = drone_can_south = drone_can_east = FALSE;
        drone_can_west = TRUE;
    }
}

/************************************************************
 *** int drone_sub_ninja_a(int player,int viewCompassDirChar)
 ************************************************************/
int drone_sub_ninja_plan(int player,int wantedDirChar) {
int target_player;
int playerFieldX;
int playerFieldY;
int targetFieldX;
int targetFieldY;
int canWest;
int canEast;
int canSouth;
int canNorth;

    target_player = player_data[player].dr_currentTarget;
    targetFieldY = (player_data[target_player].ply_y >> MAZE_FIELD_SHIFT)|1;
    targetFieldX = (player_data[target_player].ply_x >> MAZE_FIELD_SHIFT)|1;
    playerFieldY = (player_data[player].ply_y >> MAZE_FIELD_SHIFT)|1;
    playerFieldX = (player_data[player].ply_x >> MAZE_FIELD_SHIFT)|1;
    player_data[player].dr_fieldIndex = 0;
    player_data[player].dr_upRotationCounter = 0;
    player_data[player].dr_rotateCounter = 0;
    player_data[player].dr_dir[0] = 0;
    player_data[player].dr_field[0].y = 0;
    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 0, 0, 0);

    if(wantedDirChar == 'n') {
        if(canWest) { /* Move West, North (check for target), East (check for target), ... */
            player_data[player].dr_dir[0] = PLAYER_DIR_WEST;
            do {
                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                if(!canWest) break;
                playerFieldX -= 2;
                if(playerFieldX <= 0) break;
                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                if(!canSouth && !canNorth && !canWest) { /* dead end? */
                    playerFieldX = (player_data[player].ply_x >> MAZE_FIELD_SHIFT)|1; /* reset player position and exit */
                    break;
                }
                if(canNorth) {
                    player_data[player].dr_field[0].y = playerFieldY;
                    player_data[player].dr_field[0].x = playerFieldX;
                    player_data[player].dr_dir[1] = PLAYER_DIR_NORTH+256;
                    do {
                        drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                        if(!canNorth) {
                            playerFieldY = player_data[player].dr_field[0].y;
                            break;
                        }
                        playerFieldY -= 2;
                        if(playerFieldY <= 0) {
                            playerFieldY = player_data[player].dr_field[0].y;
                            break;
                        }
                        drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                        if(!canWest && !canNorth && !canEast) { /* dead end? */
                            playerFieldY = player_data[player].dr_field[0].y;
                            break;
                        }
                        if(canNorth && drone_isTargetIsVisibleNorth(player, playerFieldY, playerFieldX)) {
                            player_data[player].dr_field[1].y = playerFieldY;
                            player_data[player].dr_field[1].x = playerFieldX;
                            player_data[player].dr_field[2].y = 0;
                            player_data[player].dr_dir[2] = -1;
                            return YES;
                        }
                        if(canEast) {
                            player_data[player].dr_field[1].y = playerFieldY;
                            player_data[player].dr_field[1].x = playerFieldX;
                            player_data[player].dr_field[2].y = 0;
                            player_data[player].dr_dir[2] = PLAYER_DIR_EAST;
                            player_data[player].dr_dir[3] = -1;
                            if(drone_isTargetIsVisibleEast(player, playerFieldY, playerFieldX)) {
                                player_data[player].dr_field[2].y = playerFieldY;
                                player_data[player].dr_field[2].x = playerFieldX+2;
                                player_data[player].dr_field[3].y = 0;
                                return YES;
                            }
                            do {
                                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                if(!canEast) {
                                    playerFieldX = player_data[player].dr_field[1].x;
                                    break;
                                }
                                playerFieldX += 2;
                                if(playerFieldX > MAZE_MAX_SIZE-1) {
                                    playerFieldX = player_data[player].dr_field[1].x;
                                    break;
                                }
                                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                if(!canNorth && !canSouth && !canEast) { /* dead end? */
                                    playerFieldX = player_data[player].dr_field[1].x;
                                    break;
                                }
                                if(!canEast && targetFieldY < playerFieldY && !canNorth) {
                                    playerFieldX = player_data[player].dr_field[1].x;
                                    break;
                                }
                                if(!canEast && targetFieldY > playerFieldY && !canSouth) {
                                    playerFieldX = player_data[player].dr_field[1].x;
                                    break;
                                }
                                if(canNorth || canSouth) {
                                    player_data[player].dr_field[2].y = playerFieldY;
                                    player_data[player].dr_field[2].x = playerFieldX;
                                    player_data[player].dr_field[3].y = 0;
                                    if(targetFieldY < playerFieldY && canNorth) {
                                        player_data[player].dr_dir[3] = PLAYER_DIR_NORTH+256;
                                        player_data[player].dr_dir[4] = -1;
                                        do {
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(!canNorth) {
                                                playerFieldY = player_data[player].dr_field[2].y;
                                                break;
                                            }
                                            playerFieldY -= 2;
                                            if(playerFieldY <= 0) break;
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(drone_isTargetIsVisibleNorth(player, playerFieldY, playerFieldX)) {
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(!canWest && !canNorth && !canEast) { /* dead end? */
                                                playerFieldY = player_data[player].dr_field[2].y;
                                                break;
                                            }
                                            if(targetFieldX < playerFieldX && canWest) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_WEST;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(targetFieldX > playerFieldX && canEast) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_EAST;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                        } while(canNorth);
                                    } else if(targetFieldY > playerFieldY && canSouth) {
                                        player_data[player].dr_dir[3] = PLAYER_DIR_SOUTH;
                                        player_data[player].dr_dir[4] = -1;
                                        do {
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(!canSouth) {
                                                playerFieldY = player_data[player].dr_field[2].y;
                                                break;
                                            }
                                            playerFieldY += 2;
                                            if(playerFieldY > MAZE_MAX_SIZE-1) break;
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(drone_isTargetIsVisibleSouth(player, playerFieldY, playerFieldX)) {
                                                player_data[player].dr_field[4].y = playerFieldY;
                                                player_data[player].dr_field[4].x = playerFieldX;
                                                player_data[player].dr_field[5].y = 0;
                                                return YES;
                                            }
                                            if(!canEast && !canWest && !canSouth) { /* dead end? */
                                                playerFieldY = player_data[player].dr_field[2].x;
                                                break;
                                            }
                                            if(targetFieldX < playerFieldX && canWest) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_WEST;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(targetFieldX > playerFieldX && canEast) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_EAST;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                        } while(canSouth);
                                    }
                                }
                            } while(canEast);
                            player_data[player].dr_dir[0] = 0;
                            player_data[player].dr_fieldIndex = 0;
                            break;
                        }
                    } while(canNorth);
                    player_data[player].dr_dir[0] = 0;
                    player_data[player].dr_fieldIndex = 0;
                    break;
                }
            } while(canWest);
            player_data[player].dr_dir[0] = 0;
            player_data[player].dr_fieldIndex = 0;
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 0, 0, 0);
            playerFieldY = (player_data[player].ply_y >> MAZE_FIELD_SHIFT)|1; /* reset player position */
            playerFieldX = (player_data[player].ply_x >> MAZE_FIELD_SHIFT)|1;
        }
        if(canEast) {
            player_data[player].dr_dir[0] = PLAYER_DIR_EAST;
            do {
                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                if(!canEast) break;
                playerFieldX += 2;
                if(playerFieldX > MAZE_MAX_SIZE-1) break;
                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                if(!canNorth && !canEast && !canSouth) break; /* dead end? */
                if(canNorth) {
                    player_data[player].dr_field[0].y = playerFieldY;
                    player_data[player].dr_field[0].x = playerFieldX;
                    player_data[player].dr_dir[1] = PLAYER_DIR_NORTH+256;
                    do {
                        drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                        if(!canNorth) {
                            playerFieldY = player_data[player].dr_field[0].y;
                            break;
                        }
                        playerFieldY -= 2;
                        if(playerFieldY <= 0) {
                            playerFieldY = player_data[player].dr_field[0].y;
                            break;
                        }
                        drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                        if(!canWest && !canNorth && !canEast) { /* dead end? */
                            playerFieldY = player_data[player].dr_field[0].y;
                            break;
                        }
                        if(canNorth && drone_isTargetIsVisibleNorth(player, playerFieldY, playerFieldX)) {
                            player_data[player].dr_field[1].y = playerFieldY;
                            player_data[player].dr_field[1].x = playerFieldX;
                            player_data[player].dr_field[2].y = 0;
                            player_data[player].dr_dir[2] = -1;
                            return YES;
                        }
                        if(canWest) {
                            player_data[player].dr_field[1].y = playerFieldY;
                            player_data[player].dr_field[1].x = playerFieldX;
                            player_data[player].dr_field[2].y = 0;
                            player_data[player].dr_dir[2] = PLAYER_DIR_WEST;
                            player_data[player].dr_dir[3] = -1;
                            if(drone_isTargetIsVisibleWest(player, playerFieldY, playerFieldX)) {
                                player_data[player].dr_field[2].y = playerFieldY;
                                player_data[player].dr_field[2].x = playerFieldX-2;
                                player_data[player].dr_field[3].y = 0;
                                return YES;
                            }
                            do {
                                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                if(!canWest) {
                                    playerFieldX = player_data[player].dr_field[1].x;
                                    break;
                                }
                                playerFieldX -= 2;
                                if(playerFieldX <= 0) {
                                    playerFieldX = player_data[player].dr_field[1].x;
                                    break;
                                }
                                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                if(!canSouth && !canNorth && !canWest) { /* dead end? */
                                    playerFieldX = player_data[player].dr_field[1].x;
                                    break;
                                }
                                if(!canNorth && targetFieldX < playerFieldX && !canWest) {
                                    playerFieldX = player_data[player].dr_field[1].x;
                                    break;
                                }
                                if(!canSouth && targetFieldX > playerFieldX && !canWest) {
                                    playerFieldX = player_data[player].dr_field[1].x;
                                    break;
                                }
                                if(canNorth || canSouth) {
                                    player_data[player].dr_field[2].y = playerFieldY;
                                    player_data[player].dr_field[2].x = playerFieldX;
                                    player_data[player].dr_field[3].y = 0;
                                    if(targetFieldY < playerFieldY && canNorth) {
                                        player_data[player].dr_dir[3] = PLAYER_DIR_NORTH+256;
                                        player_data[player].dr_dir[4] = -1;
                                        do {
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(!canNorth) {
                                                playerFieldY = player_data[player].dr_field[2].y;
                                                break;
                                            }
                                            playerFieldY -= 2;
                                            if(playerFieldY <= 0) {
                                                playerFieldY = player_data[player].dr_field[2].y;
                                                break;
                                            }
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(drone_isTargetIsVisibleNorth(player, playerFieldY, playerFieldX)) {
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(!canEast && !canNorth && !canWest) { /* dead end? */
                                                playerFieldY = player_data[player].dr_field[2].y;
                                                break;
                                            }
                                            if(targetFieldX < playerFieldX && canWest) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_WEST;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(targetFieldX > playerFieldX && canEast) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_EAST;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                        } while(canNorth);
                                    } else if(targetFieldY > playerFieldY && canSouth) {
                                        player_data[player].dr_dir[3] = PLAYER_DIR_SOUTH;
                                        player_data[player].dr_dir[4] = -1;
                                        do {
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(!canSouth) {
                                                playerFieldY = player_data[player].dr_field[2].y;
                                                break;
                                            }
                                            playerFieldY += 2;
                                            if(playerFieldY > MAZE_MAX_SIZE-1) {
                                                playerFieldY = player_data[player].dr_field[2].y;
                                                break;
                                            }
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(drone_isTargetIsVisibleSouth(player, playerFieldY, playerFieldX)) {
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(!canEast && !canWest && !canSouth) { /* dead end? */
                                                playerFieldY = player_data[player].dr_field[2].y;
                                                break;
                                            }
                                            if(targetFieldX < playerFieldX && canWest) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_WEST;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(targetFieldX > playerFieldX && canEast) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_EAST;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                        } while(canSouth);
                                    }
                                }
                            } while(canEast);
                            player_data[player].dr_dir[0] = 0;
                            player_data[player].dr_fieldIndex = 0;
                            break;
                        }
                    } while(canNorth);
                    player_data[player].dr_dir[0] = 0;
                    player_data[player].dr_fieldIndex = 0;
                    return NO;
                }
            } while(canWest);
        }
        player_data[player].dr_dir[0] = 0;
        player_data[player].dr_fieldIndex = 0;
        return NO;
    }
    if(wantedDirChar == 's') {
        if(canWest) {
            player_data[player].dr_dir[0] = PLAYER_DIR_WEST;
            do {
                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                if(!canWest) break;
                playerFieldX -= 2;
                if(playerFieldX <= 0) {
                    playerFieldX = (player_data[player].ply_x >> MAZE_FIELD_SHIFT)|1; /* reset player position and exit */
                    break;
                }
                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                if(!canSouth && !canNorth && !canWest) { /* dead end? */
                    playerFieldX = (player_data[player].ply_x >> MAZE_FIELD_SHIFT)|1; /* reset player position and exit */
                    break;
                }
                if(canSouth) {
                    player_data[player].dr_field[0].y = playerFieldY;
                    player_data[player].dr_field[0].x = playerFieldX;
                    player_data[player].dr_dir[1] = PLAYER_DIR_SOUTH;
                    do {
                        drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                        if(!canSouth) {
                            playerFieldY = player_data[player].dr_field[0].y;
                            break;
                        }
                        playerFieldY += 2;
                        if(playerFieldY > MAZE_MAX_SIZE-1) {
                            playerFieldY = player_data[player].dr_field[0].y;
                            break;
                        }
                        drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                        if(!canWest && !canSouth && !canEast) { /* dead end? */
                            playerFieldY = player_data[player].dr_field[0].y;
                            break;
                        }
                        if(canSouth && drone_isTargetIsVisibleSouth(player, playerFieldY, playerFieldX)) {
                            player_data[player].dr_field[1].y = playerFieldY;
                            player_data[player].dr_field[1].x = playerFieldX;
                            player_data[player].dr_field[2].y = 0;
                            player_data[player].dr_dir[2] = -1;
                            return YES;
                        }
                        if(canEast) {
                            player_data[player].dr_field[1].y = playerFieldY;
                            player_data[player].dr_field[1].x = playerFieldX;
                            player_data[player].dr_field[2].y = 0;
                            player_data[player].dr_dir[2] = PLAYER_DIR_EAST;
                            player_data[player].dr_dir[3] = -1;
                            if(drone_isTargetIsVisibleEast(player, playerFieldY, playerFieldX)) {
                                player_data[player].dr_field[2].y = playerFieldY;
                                player_data[player].dr_field[2].x = playerFieldX+2;
                                player_data[player].dr_field[3].y = 0;
                                return YES;
                            }
                            do {
                                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                if(!canEast) {
                                    playerFieldX = player_data[player].dr_field[1].x;
                                    break;
                                }
                                playerFieldX += 2;
                                if(playerFieldX > MAZE_MAX_SIZE-1) {
                                    playerFieldX = player_data[player].dr_field[1].x;
                                    break;
                                }
                                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                if(!canNorth && !canSouth && !canEast) { /* dead end? */
                                    playerFieldX = player_data[player].dr_field[1].x;
                                    break;
                                }
                                if(!canEast && targetFieldY < playerFieldY && !canNorth) {
                                    playerFieldX = player_data[player].dr_field[1].x;
                                    break;
                                }
                                if(!canEast && targetFieldY > playerFieldY && !canSouth) {
                                    playerFieldX = player_data[player].dr_field[1].x;
                                    break;
                                }
                                if(canNorth || canSouth) {
                                    player_data[player].dr_field[2].y = playerFieldY;
                                    player_data[player].dr_field[2].x = playerFieldX;
                                    player_data[player].dr_field[3].y = 0;
                                    if(targetFieldY < playerFieldY && canNorth) {
                                        player_data[player].dr_dir[3] = PLAYER_DIR_NORTH+256;
                                        player_data[player].dr_dir[4] = -1;
                                        do {
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(!canNorth) {
                                                playerFieldY = player_data[player].dr_field[2].y;
                                                break;
                                            }
                                            playerFieldY -= 2;
                                            if(playerFieldY < 0) {
                                                playerFieldY = player_data[player].dr_field[2].y;
                                                break;
                                            }
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(drone_isTargetIsVisibleNorth(player, playerFieldY, playerFieldX)) {
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(!canWest && !canNorth && !canEast) { /* dead end? */
                                                playerFieldY = player_data[player].dr_field[2].y;
                                                break;
                                            }
                                            if(targetFieldX < playerFieldX && canWest) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_WEST;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[4].y = 0;
                                            } else {
                                                if(targetFieldX > playerFieldX && canEast) {
                                                    player_data[player].dr_dir[4] = PLAYER_DIR_EAST;
                                                    player_data[player].dr_dir[5] = -1;
                                                    player_data[player].dr_field[3].x = playerFieldX;
                                                    player_data[player].dr_field[3].y = playerFieldY;
                                                    player_data[player].dr_field[4].y = 0;
                                                    return YES;
                                                }
                                            }
                                        } while(canNorth);
                                    } else if(targetFieldY > playerFieldY && canSouth) {
                                        player_data[player].dr_dir[3] = PLAYER_DIR_SOUTH;
                                        player_data[player].dr_dir[4] = -1;
                                        do {
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(!canSouth) {
                                                playerFieldY = player_data[player].dr_field[2].y;
                                                break;
                                            }
                                            playerFieldY += 2;
                                            if(playerFieldY > MAZE_MAX_SIZE-1) {
                                                playerFieldY = player_data[player].dr_field[2].y;
                                                break;
                                            }
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(drone_isTargetIsVisibleSouth(player, playerFieldY, playerFieldX)) {
                                                player_data[player].dr_field[4].y = playerFieldY;
                                                player_data[player].dr_field[4].x = playerFieldX;
                                                player_data[player].dr_field[5].y = 0;
                                                return YES;
                                            }
                                            if(!canEast && !canWest && !canSouth) { /* dead end? */
                                                playerFieldY = player_data[player].dr_field[2].x;
                                                break;
                                            }
                                            if(targetFieldX < playerFieldX && canWest) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_WEST;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(targetFieldX > playerFieldX && canEast) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_EAST;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                        } while(canSouth);
                                    }
                                }
                            } while(canEast);
                            player_data[player].dr_dir[0] = 0;
                            player_data[player].dr_fieldIndex = 0;
                            break;
                        }
                    } while(canSouth);
                    player_data[player].dr_dir[0] = 0;
                    player_data[player].dr_fieldIndex = 0;
                    break;
                }
            } while(canWest);
            player_data[player].dr_dir[0] = 0;
            player_data[player].dr_fieldIndex = 0;
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 0, 0, 0);
            playerFieldY = (player_data[player].ply_y >> MAZE_FIELD_SHIFT)|1; /* reset player position */
            playerFieldX = (player_data[player].ply_x >> MAZE_FIELD_SHIFT)|1;
        }
        if(canEast) {
            player_data[player].dr_dir[0] = PLAYER_DIR_EAST;
            do {
                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                if(!canEast) break;
                playerFieldX += 2;
                if(playerFieldX > MAZE_MAX_SIZE-1) break;
                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                if(!canNorth && !canEast && !canSouth) break; /* dead end? */
                if(canSouth) {
                    player_data[player].dr_field[0].y = playerFieldY;
                    player_data[player].dr_field[0].x = playerFieldX;
                    player_data[player].dr_dir[1] = PLAYER_DIR_SOUTH;
                    do {
                        drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                        if(!canSouth) {
                            playerFieldY = player_data[player].dr_field[0].y;
                            break;
                        }
                        playerFieldY += 2;
                        if(playerFieldY > MAZE_MAX_SIZE-1) {
                            playerFieldY = player_data[player].dr_field[0].y;
                            break;
                        }
                        drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                        if(!canWest && !canSouth && !canEast) { /* dead end? */
                            playerFieldY = player_data[player].dr_field[0].y;
                            break;
                        }
                        if(canSouth && drone_isTargetIsVisibleSouth(player, playerFieldY, playerFieldX)) {
                            player_data[player].dr_field[1].y = playerFieldY;
                            player_data[player].dr_field[1].x = playerFieldX;
                            player_data[player].dr_field[2].y = 0;
                            player_data[player].dr_dir[2] = -1;
                            return YES;
                        }
                        if(canWest) {
                            player_data[player].dr_field[1].y = playerFieldY;
                            player_data[player].dr_field[1].x = playerFieldX;
                            player_data[player].dr_field[2].y = 0;
                            player_data[player].dr_dir[2] = PLAYER_DIR_WEST;
                            player_data[player].dr_dir[3] = -1;
                            if(drone_isTargetIsVisibleWest(player, playerFieldY, playerFieldX)) {
                                player_data[player].dr_field[2].y = playerFieldY;
                                player_data[player].dr_field[2].x = playerFieldX-2;
                                player_data[player].dr_field[3].y = 0;
                                return YES;
                            }
                            do {
                                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                if(!canWest) {
                                    playerFieldX = player_data[player].dr_field[1].x;
                                    break;
                                }
                                playerFieldX -= 2;
                                if(playerFieldX <= 0) {
                                    playerFieldX = player_data[player].dr_field[1].x;
                                    break;
                                }
                                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                if(!canSouth && !canNorth && !canWest) { /* dead end? */
                                    playerFieldX = player_data[player].dr_field[1].x;
                                    break;
                                }
                                if(!canNorth && targetFieldX < playerFieldX && !canWest) {
                                    playerFieldX = player_data[player].dr_field[1].x;
                                    break;
                                }
                                if(!canSouth && targetFieldX > playerFieldX && !canWest) {
                                    playerFieldX = player_data[player].dr_field[1].x;
                                    break;
                                }
                                if(canNorth || canSouth) {
                                    player_data[player].dr_field[2].y = playerFieldY;
                                    player_data[player].dr_field[2].x = playerFieldX;
                                    player_data[player].dr_field[3].y = 0;
                                    if(targetFieldY < playerFieldY && canNorth) {
                                        player_data[player].dr_dir[3] = PLAYER_DIR_NORTH+256;
                                        player_data[player].dr_dir[4] = -1;
                                        do {
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(!canNorth) {
                                                playerFieldY = player_data[player].dr_field[2].y;
                                                break;
                                            }
                                            playerFieldY -= 2;
                                            if(playerFieldY <= 0) {
                                                playerFieldY = player_data[player].dr_field[2].y;
                                                break;
                                            }
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(drone_isTargetIsVisibleNorth(player, playerFieldY, playerFieldX)) {
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(!canEast && !canNorth && !canWest) { /* dead end? */
                                                playerFieldY = player_data[player].dr_field[2].y;
                                                break;
                                            }
                                            if(targetFieldX < playerFieldX && canWest) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_WEST;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(targetFieldX > playerFieldX && canEast) {
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[4].y = 0;
                                                player_data[player].dr_dir[3] = PLAYER_DIR_EAST;
                                                player_data[player].dr_dir[4] = -1;
                                                return YES;
                                            }
                                        } while(canNorth);
                                    } else if(targetFieldY > playerFieldY && canSouth) {
                                        player_data[player].dr_dir[3] = PLAYER_DIR_SOUTH;
                                        player_data[player].dr_dir[4] = -1;
                                        do {
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(!canSouth) {
                                                playerFieldY = player_data[player].dr_field[2].y;
                                                break;
                                            }
                                            playerFieldY += 2;
                                            if(playerFieldY > MAZE_MAX_SIZE-1) {
                                                playerFieldY = player_data[player].dr_field[2].y;
                                                break;
                                            }
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(drone_isTargetIsVisibleSouth(player, playerFieldY, playerFieldX)) {
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(!canEast && !canWest && !canSouth) { /* dead end? */
                                                playerFieldY = player_data[player].dr_field[2].y;
                                                break;
                                            }
                                            if(targetFieldX < playerFieldX && canWest) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_WEST;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(targetFieldX > playerFieldX && canEast) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_EAST;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                        } while(canSouth);
                                    }
                                }
                            } while(canEast);
                            player_data[player].dr_dir[0] = 0;
                            player_data[player].dr_fieldIndex = 0;
                            break;
                        }
                    } while(canSouth);
                    player_data[player].dr_dir[0] = 0;
                    player_data[player].dr_fieldIndex = 0;
                    return NO;
                }
            } while(canWest);
        }
        player_data[player].dr_dir[0] = 0;
        player_data[player].dr_fieldIndex = 0;
        return NO;
    }
    if(wantedDirChar == 'w') {
        if(canSouth) {
            player_data[player].dr_dir[0] = PLAYER_DIR_SOUTH;
            do {
                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                if(!canSouth) break;
                playerFieldY += 2;
                if(playerFieldY > MAZE_MAX_SIZE-1) {
                    playerFieldY = (player_data[player].ply_y >> MAZE_FIELD_SHIFT)|1;
                    break;
                }
                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                if(!canSouth && !canEast && !canWest) { /* dead end? */
                    playerFieldY = (player_data[player].ply_y >> MAZE_FIELD_SHIFT)|1;
                    break;
                }
                if(canWest) {
                    player_data[player].dr_field[0].y = playerFieldY;
                    player_data[player].dr_field[0].x = playerFieldX;
                    player_data[player].dr_dir[1] = PLAYER_DIR_WEST;
                    do {
                        drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                        if(!canWest) {
                            playerFieldX = player_data[player].dr_field[0].x;
                            break;
                        }
                        playerFieldX -= 2;
                        if(playerFieldX <= 0) {
                            playerFieldX = player_data[player].dr_field[0].x;
                            break;
                        }
                        drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                        if(!canWest && !canNorth && !canSouth) { /* dead end? */
                            playerFieldX = player_data[player].dr_field[0].x;
                            break;
                        }
                        if(canWest && drone_isTargetIsVisibleWest(player, playerFieldY, playerFieldX)) {
                            player_data[player].dr_field[1].y = playerFieldY;
                            player_data[player].dr_field[1].x = playerFieldX;
                            player_data[player].dr_field[2].y = 0;
                            player_data[player].dr_dir[2] = -1;
                            return YES;
                        }
                        if(canNorth) {
                            player_data[player].dr_field[1].y = playerFieldY;
                            player_data[player].dr_field[1].x = playerFieldX;
                            player_data[player].dr_field[2].y = 0;
                            player_data[player].dr_dir[2] = PLAYER_DIR_NORTH+256;
                            player_data[player].dr_dir[3] = -1;
                            if(drone_isTargetIsVisibleNorth(player, playerFieldY, playerFieldX)) {
                                player_data[player].dr_field[2].y = playerFieldY-2;
                                player_data[player].dr_field[2].x = playerFieldX;
                                player_data[player].dr_field[3].y = 0;
                                return YES;
                            }
                            do {
                                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                if(!canNorth) {
                                    playerFieldY = player_data[player].dr_field[1].y;
                                    break;
                                }
                                playerFieldY -= 2;
                                if(playerFieldY < 0) {
                                    playerFieldY = player_data[player].dr_field[0].y;
                                    break;
                                }
                                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                if(!canNorth && !canWest && !canEast) { /* dead end? */
                                    playerFieldY = player_data[player].dr_field[1].y;
                                    break;
                                }
                                if(!canNorth && targetFieldX < playerFieldX && !canWest) {
                                    playerFieldY = player_data[player].dr_field[1].y;
                                    break;
                                }
                                if(!canNorth && targetFieldX > playerFieldX && !canEast) {
                                    playerFieldY = player_data[player].dr_field[1].y;
                                    break;
                                }
                                if(canWest || canEast) {
                                    player_data[player].dr_field[2].y = playerFieldY;
                                    player_data[player].dr_field[2].x = playerFieldX;
                                    player_data[player].dr_field[3].y = 0;
                                    if(targetFieldX < playerFieldX && canWest) {
                                        player_data[player].dr_dir[3] = PLAYER_DIR_WEST;
                                        player_data[player].dr_dir[4] = -1;
                                        do {
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(!canWest) {
                                                playerFieldX = player_data[player].dr_field[2].x;
                                                break;
                                            }
                                            playerFieldX -= 2;
                                            if(playerFieldX <= 0) {
                                                playerFieldX = player_data[player].dr_field[2].x;
                                                break;
                                            }
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(drone_isTargetIsVisibleWest(player, playerFieldY, playerFieldX)) {
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(!canWest && !canNorth && !canSouth) { /* dead end? */
                                                playerFieldX = player_data[player].dr_field[2].x;
                                                break;
                                            }
                                            if(targetFieldY < playerFieldY && canNorth) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_NORTH+256;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(targetFieldY > playerFieldY && canSouth) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_SOUTH;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                        } while(canWest);
                                    } else if(targetFieldX > playerFieldX && canEast) {
                                        player_data[player].dr_dir[3] = PLAYER_DIR_EAST;
                                        player_data[player].dr_dir[4] = -1;
                                        do {
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(!canEast) {
                                                playerFieldX = player_data[player].dr_field[2].x;
                                                break;
                                            }
                                            playerFieldX += 2;
                                            if(playerFieldX > MAZE_MAX_SIZE-1) {
                                                playerFieldX = player_data[player].dr_field[2].x;
                                                break;
                                            }
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(drone_isTargetIsVisibleEast(player, playerFieldY, playerFieldX)) {
                                                player_data[player].dr_field[4].y = playerFieldY;
                                                player_data[player].dr_field[4].x = playerFieldX;
                                                player_data[player].dr_field[5].y = 0;
                                                return YES;
                                            }
                                            if(!canEast && !canNorth && !canSouth) { /* dead end? */
                                                playerFieldX = player_data[player].dr_field[2].x;
                                                break;
                                            }
                                            if(targetFieldY < playerFieldY && canNorth) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_NORTH+256;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(targetFieldY > playerFieldY && canSouth) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_SOUTH;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                        } while(canEast);
                                    }
                                }
                            } while(canNorth);
                            player_data[player].dr_dir[0] = 0;
                            player_data[player].dr_fieldIndex = 0;
                            break;
                        }
                    } while(canWest);
                    player_data[player].dr_dir[0] = 0;
                    player_data[player].dr_fieldIndex = 0;
                    break;
                }
            } while(canSouth);
            player_data[player].dr_dir[0] = 0;
            player_data[player].dr_fieldIndex = 0;
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 0, 0, 0);
            playerFieldY = (player_data[player].ply_y >> MAZE_FIELD_SHIFT)|1; /* reset player position */
            playerFieldX = (player_data[player].ply_x >> MAZE_FIELD_SHIFT)|1;
        }
        if(canNorth) {
            player_data[player].dr_dir[0] = PLAYER_DIR_NORTH+256;
            do {
                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                if(!canNorth) break;
                playerFieldY -= 2;
                if(playerFieldY < 0) break;
                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                if(!canNorth && !canEast && !canWest) break; /* dead end? */
                if(canWest) {
                    player_data[player].dr_field[0].y = playerFieldY;
                    player_data[player].dr_field[0].x = playerFieldX;
                    player_data[player].dr_dir[1] = PLAYER_DIR_WEST;
                    player_data[player].dr_dir[2] = -1;
                    do {
                        drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                        if(!canWest) {
                            playerFieldX = player_data[player].dr_field[0].x;
                            break;
                        }
                        playerFieldX -= 2;
                        if(playerFieldX <= 0) {
                            playerFieldX = player_data[player].dr_field[0].x;
                            break;
                        }
                        drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                        if(!canWest && !canNorth && !canSouth) { /* dead end? */
                            playerFieldX = player_data[player].dr_field[0].x;
                            break;
                        }
                        if(canWest && drone_isTargetIsVisibleWest(player, playerFieldY, playerFieldX)) {
                            player_data[player].dr_field[1].y = playerFieldY;
                            player_data[player].dr_field[1].x = playerFieldX;
                            player_data[player].dr_field[2].y = 0;
                            player_data[player].dr_dir[2] = -1;
                            return YES;
                        }
                        if(canSouth) {
                            player_data[player].dr_field[1].y = playerFieldY;
                            player_data[player].dr_field[1].x = playerFieldX;
                            player_data[player].dr_field[2].y = 0;
                            player_data[player].dr_dir[2] = PLAYER_DIR_SOUTH;
                            player_data[player].dr_dir[3] = -1;
                            if(drone_isTargetIsVisibleSouth(player, playerFieldY, playerFieldX)) {
                                player_data[player].dr_field[2].y = playerFieldY+2;
                                player_data[player].dr_field[2].x = playerFieldX;
                                player_data[player].dr_field[3].y = 0;
                                return YES;
                            }
                            do {
                                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                if(!canSouth) {
                                    playerFieldY = player_data[player].dr_field[0].y;
                                    break;
                                }
                                playerFieldY += 2;
                                if(playerFieldY > MAZE_MAX_SIZE-1) {
                                    playerFieldY = player_data[player].dr_field[0].y;
                                    break;
                                }
                                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                if(!canSouth && !canEast && !canWest) { /* dead end? */
                                    playerFieldY = player_data[player].dr_field[1].y;
                                    break;
                                }
                                if(!canSouth && targetFieldX < playerFieldX && !canWest) {
                                    playerFieldY = player_data[player].dr_field[1].y;
                                    break;
                                }
                                if(!canSouth && targetFieldX > playerFieldX && !canEast) {
                                    playerFieldY = player_data[player].dr_field[1].y;
                                    break;
                                }
                                if(canWest || canEast) {
                                    player_data[player].dr_field[2].y = playerFieldY;
                                    player_data[player].dr_field[2].x = playerFieldX;
                                    player_data[player].dr_field[3].y = 0;
                                    if(targetFieldX < playerFieldX && canWest) {
                                        player_data[player].dr_dir[3] = PLAYER_DIR_WEST;
                                        player_data[player].dr_dir[4] = -1;
                                        do {
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(!canWest) {
                                                playerFieldX = player_data[player].dr_field[2].x;
                                                break;
                                            }
                                            playerFieldX -= 2;
                                            if(playerFieldX <= 0) {
                                                playerFieldX = player_data[player].dr_field[2].x;
                                                break;
                                            }
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(drone_isTargetIsVisibleWest(player, playerFieldY, playerFieldX)) {
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(!canWest && !canNorth && !canSouth) { /* dead end? */
                                                playerFieldX = player_data[player].dr_field[2].x;
                                                break;
                                            }
                                            if(targetFieldY < playerFieldY && canNorth) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_NORTH+256;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(targetFieldY > playerFieldY && canSouth) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_SOUTH;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                        } while(canWest);
                                    } else if(targetFieldX > playerFieldX && canEast) {
                                        player_data[player].dr_dir[3] = PLAYER_DIR_EAST;
                                        player_data[player].dr_dir[4] = -1;
                                        do {
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(!canEast) {
                                                playerFieldX = player_data[player].dr_field[2].x;
                                                break;
                                            }
                                            playerFieldX += 2;
                                            if(playerFieldX > MAZE_MAX_SIZE-1) {
                                                playerFieldX = player_data[player].dr_field[2].x;
                                                break;
                                            }
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(drone_isTargetIsVisibleEast(player, playerFieldY, playerFieldX)) {
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(!canEast && !canNorth && !canSouth) { /* dead end? */
                                                playerFieldX = player_data[player].dr_field[2].x;
                                                break;
                                            }
                                            if(targetFieldY < playerFieldY && canNorth) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_NORTH+256;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(targetFieldY > playerFieldY && canSouth) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_SOUTH;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                        } while(canEast);
                                    }
                                }
                            } while(canSouth);
                            player_data[player].dr_dir[0] = 0;
                            player_data[player].dr_fieldIndex = 0;
                            break;
                        }
                    } while(canWest);
                    player_data[player].dr_dir[0] = 0;
                    player_data[player].dr_fieldIndex = 0;
                    return NO;
                }
            } while(canNorth);
        }
        player_data[player].dr_dir[0] = 0;
        player_data[player].dr_fieldIndex = 0;
        return NO;
    }
    if(wantedDirChar == 'e') {
        if(canSouth) {
            player_data[player].dr_dir[0] = PLAYER_DIR_SOUTH;
            player_data[player].dr_dir[1] = -1;
            do {
                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                if(!canSouth) break;
                playerFieldY += 2;
                if(playerFieldY > MAZE_MAX_SIZE-1) {
                    playerFieldY = (player_data[player].ply_y >> MAZE_FIELD_SHIFT)|1;
                    break;
                }
                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                if(!canSouth && !canEast && !canWest) { /* dead end? */
                    playerFieldY = (player_data[player].ply_y >> MAZE_FIELD_SHIFT)|1;
                    break;
                }
                if(canEast) {
                    player_data[player].dr_field[0].y = playerFieldY;
                    player_data[player].dr_field[0].x = playerFieldX;
                    player_data[player].dr_dir[1] = PLAYER_DIR_EAST;
                    player_data[player].dr_dir[2] = -1;
                    do {
                        drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                        if(!canEast) {
                            playerFieldX = player_data[player].dr_field[0].x;
                            break;
                        }
                        playerFieldX += 2;
                        if(playerFieldX > MAZE_MAX_SIZE-1) {
                            playerFieldX = player_data[player].dr_field[0].x;
                            break;
                        }
                        drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                        if(!canEast && !canNorth && !canSouth) { /* dead end? */
                            playerFieldX = player_data[player].dr_field[0].x;
                            break;
                        }
                        if(canEast && drone_isTargetIsVisibleEast(player, playerFieldY, playerFieldX)) {
                            player_data[player].dr_field[1].y = playerFieldY;
                            player_data[player].dr_field[1].x = playerFieldX;
                            player_data[player].dr_field[2].y = 0;
                            player_data[player].dr_dir[2] = -1;
                            return YES;
                        }
                        if(canNorth) {
                            player_data[player].dr_field[1].y = playerFieldY;
                            player_data[player].dr_field[1].x = playerFieldX;
                            player_data[player].dr_field[2].y = 0;
                            player_data[player].dr_dir[2] = PLAYER_DIR_NORTH+256;
                            player_data[player].dr_dir[3] = -1;
                            if(drone_isTargetIsVisibleNorth(player, playerFieldY, playerFieldX)) {
                                player_data[player].dr_field[2].y = playerFieldY-2;
                                player_data[player].dr_field[2].x = playerFieldX;
                                player_data[player].dr_field[3].y = 0;
                                return YES;
                            }
                            do {
                                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                if(!canNorth) {
                                    playerFieldY = player_data[player].dr_field[1].y;
                                    break;
                                }
                                playerFieldY -= 2;
                                if(playerFieldY < 0) {
                                    playerFieldY = player_data[player].dr_field[1].y;
                                    break;
                                }
                                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                if(!canNorth && !canWest && !canEast) { /* dead end? */
                                    playerFieldY = player_data[player].dr_field[1].y;
                                    break;
                                }
                                if(!canNorth && targetFieldX < playerFieldX && !canWest) {
                                    playerFieldY = player_data[player].dr_field[1].y;
                                    break;
                                }
                                if(!canNorth && targetFieldX > playerFieldX && !canEast) {
                                    playerFieldY = player_data[player].dr_field[1].y;
                                    break;
                                }
                                if(canWest || canEast) {
                                    player_data[player].dr_field[2].y = playerFieldY;
                                    player_data[player].dr_field[2].x = playerFieldX;
                                    player_data[player].dr_field[3].y = 0;
                                    if(targetFieldX < playerFieldX && canWest) {
                                        player_data[player].dr_dir[3] = PLAYER_DIR_WEST;
                                        player_data[player].dr_dir[4] = -1;
                                        do {
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(!canWest) {
                                                playerFieldX = player_data[player].dr_field[2].x;
                                                break;
                                            }
                                            playerFieldX -= 2;
                                            if(playerFieldX <= 0) {
                                                playerFieldX = player_data[player].dr_field[2].x;
                                                break;
                                            }
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(drone_isTargetIsVisibleWest(player, playerFieldY, playerFieldX)) {
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(!canWest && !canNorth && !canSouth) { /* dead end? */
                                                playerFieldX = player_data[player].dr_field[2].x;
                                                break;
                                            }
                                            if(targetFieldY < playerFieldY && canNorth) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_NORTH+256;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(targetFieldY > playerFieldY && canSouth) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_SOUTH;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                        } while(canWest);
                                    } else if(targetFieldX > playerFieldX && canEast) {
                                        player_data[player].dr_dir[3] = PLAYER_DIR_EAST;
                                        player_data[player].dr_dir[4] = -1;
                                        do {
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(!canEast) {
                                                playerFieldX = player_data[player].dr_field[2].x;
                                                break;
                                            }
                                            playerFieldX += 2;
                                            if(playerFieldX > MAZE_MAX_SIZE-1) {
                                                playerFieldX = player_data[player].dr_field[2].x;
                                                break;
                                            }
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(drone_isTargetIsVisibleEast(player, playerFieldY, playerFieldX)) {
                                                player_data[player].dr_field[4].y = playerFieldY;
                                                player_data[player].dr_field[4].x = playerFieldX;
                                                player_data[player].dr_field[5].y = 0;
                                                return YES;
                                            }
                                            if(!canEast && !canNorth && !canSouth) { /* dead end? */
                                                playerFieldX = player_data[player].dr_field[2].x;
                                                break;
                                            }
                                            if(targetFieldY < playerFieldY && canNorth) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_NORTH+256;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(targetFieldY > playerFieldY && canSouth) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_SOUTH;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                        } while(canEast);
                                    }
                                }
                            } while(canNorth);
                            player_data[player].dr_dir[0] = 0;
                            player_data[player].dr_fieldIndex = 0;
                            break;
                        }
                    } while(canEast);
                    player_data[player].dr_dir[0] = 0;
                    player_data[player].dr_fieldIndex = 0;
                    break;
                }
            } while(canSouth);
            player_data[player].dr_dir[0] = 0;
            player_data[player].dr_fieldIndex = 0;
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 0, 0, 0);
            playerFieldY = (player_data[player].ply_y >> MAZE_FIELD_SHIFT)|1; /* reset player position */
            playerFieldX = (player_data[player].ply_x >> MAZE_FIELD_SHIFT)|1;
        }
        if(canNorth) {
            player_data[player].dr_dir[0] = PLAYER_DIR_NORTH+256;
            do {
                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                if(!canNorth) break;
                playerFieldY -= 2;
                if(playerFieldY < 0) break;
                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                if(canEast) {
                    player_data[player].dr_field[0].y = playerFieldY;
                    player_data[player].dr_field[0].x = playerFieldX;
                    player_data[player].dr_dir[1] = PLAYER_DIR_EAST;
                    do {
                        drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                        if(!canEast) {
                            playerFieldX = player_data[player].dr_field[0].x;
                            break;
                        }
                        playerFieldX += 2;
                        if(playerFieldX > MAZE_MAX_SIZE-1) {
                            playerFieldX = player_data[player].dr_field[0].x;
                            break;
                        }
                        drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                        if(!canEast && !canNorth && !canSouth) { /* dead end? */
                            playerFieldX = player_data[player].dr_field[0].x;
                            break;
                        }
                        if(canEast && drone_isTargetIsVisibleEast(player, playerFieldY, playerFieldX)) {
                            player_data[player].dr_field[1].y = playerFieldY;
                            player_data[player].dr_field[1].x = playerFieldX;
                            player_data[player].dr_field[2].y = 0;
                            player_data[player].dr_dir[2] = -1;
                            return YES;
                        }
                        if(canSouth) {
                            player_data[player].dr_field[1].y = playerFieldY;
                            player_data[player].dr_field[1].x = playerFieldX;
                            player_data[player].dr_field[2].y = 0;
                            player_data[player].dr_dir[2] = PLAYER_DIR_SOUTH;
                            player_data[player].dr_dir[3] = -1;
                            do {
                                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                if(!canSouth) {
                                    playerFieldY = player_data[player].dr_field[1].y;
                                    break;
                                }
                                playerFieldY += 2;
                                if(playerFieldY > MAZE_MAX_SIZE-1) {
                                    playerFieldY = player_data[player].dr_field[0].y;
                                    break;
                                }
                                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                if(canSouth && drone_isTargetIsVisibleSouth(player, playerFieldY, playerFieldX)) {
                                    player_data[player].dr_field[2].y = playerFieldY+2;
                                    player_data[player].dr_field[2].x = playerFieldX;
                                    player_data[player].dr_field[3].y = 0;
                                    return YES;
                                }
                                if(!canSouth && !canEast && !canWest) { /* dead end? */
                                    playerFieldY = player_data[player].dr_field[1].y;
                                    break;
                                }
                                if(!canSouth && targetFieldX < playerFieldX && !canWest) {
                                    playerFieldY = player_data[player].dr_field[1].y;
                                    break;
                                }
                                if(!canSouth && targetFieldX > playerFieldX && !canEast) {
                                    playerFieldY = player_data[player].dr_field[1].y;
                                    break;
                                }
                                if(canWest || canEast) {
                                    player_data[player].dr_field[2].y = playerFieldY;
                                    player_data[player].dr_field[2].x = playerFieldX;
                                    player_data[player].dr_field[3].y = 0;
                                    if(targetFieldX < playerFieldX && canWest) {
                                        player_data[player].dr_dir[3] = PLAYER_DIR_WEST;
                                        player_data[player].dr_dir[4] = -1;
                                        do {
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(!canWest) {
                                                playerFieldX = player_data[player].dr_field[2].x;
                                                break;
                                            }
                                            playerFieldX -= 2;
                                            if(playerFieldX <= 0) {
                                                playerFieldX = player_data[player].dr_field[2].x;
                                                break;
                                            }
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(drone_isTargetIsVisibleWest(player, playerFieldY, playerFieldX)) {
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(!canWest && !canNorth && !canSouth) { /* dead end? */
                                                playerFieldX = player_data[player].dr_field[2].x;
                                                break;
                                            }
                                            if(targetFieldY < playerFieldY && canNorth) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_NORTH+256;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(targetFieldY > playerFieldY && canSouth) {
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                player_data[player].dr_dir[3] = PLAYER_DIR_SOUTH;
                                                player_data[player].dr_dir[4] = -1;
                                                return YES;
                                            }
                                        } while(canWest);
                                    } else if(targetFieldX > playerFieldX && canEast) {
                                        player_data[player].dr_dir[3] = PLAYER_DIR_EAST;
                                        player_data[player].dr_dir[4] = -1;
                                        do {
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(!canEast) {
                                                playerFieldX = player_data[player].dr_field[2].x;
                                                break;
                                            }
                                            playerFieldX += 2;
                                            if(playerFieldX > MAZE_MAX_SIZE-1) {
                                                playerFieldX = player_data[player].dr_field[2].x;
                                                break;
                                            }
                                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                            if(drone_isTargetIsVisibleEast(player, playerFieldY, playerFieldX)) {
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(!canEast && !canNorth && !canSouth) { /* dead end? */
                                                playerFieldX = player_data[player].dr_field[2].x;
                                                break;
                                            }
                                            if(targetFieldY < playerFieldY && canNorth) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_NORTH+256;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                            if(targetFieldY > playerFieldY && canSouth) {
                                                player_data[player].dr_dir[4] = PLAYER_DIR_SOUTH;
                                                player_data[player].dr_dir[5] = -1;
                                                player_data[player].dr_field[3].y = playerFieldY;
                                                player_data[player].dr_field[3].x = playerFieldX;
                                                player_data[player].dr_field[4].y = 0;
                                                return YES;
                                            }
                                        } while(canEast);
                                    }
                                }
                            } while(canSouth);
                            player_data[player].dr_dir[0] = 0;
                            player_data[player].dr_fieldIndex = 0;
                            break;
                        }
                    } while(canEast);
                    player_data[player].dr_dir[0] = 0;
                    player_data[player].dr_fieldIndex = 0;
                    return NO;
                }
            } while(canNorth);
        }
        player_data[player].dr_dir[0] = 0;
        player_data[player].dr_fieldIndex = 0;
        return NO;
    }
    player_data[player].dr_dir[0] = 0;
    player_data[player].dr_fieldIndex = 0;
    return NO;
}

/************************************************************
 *** int drone_sub_ninja_north(int player,int viewCompassDirChar)
 ************************************************************/
int drone_sub_ninja_north(int player,int wantedDirChar) {
int target_player;
int targetPlayerFieldX;
int playerFieldX;
int playerFieldY;
int canWest;
int canEast;
int canSouth;
int canNorth;

    player_data[player].dr_fieldIndex = 0;
    player_data[player].dr_upRotationCounter = 0;
    player_data[player].dr_rotateCounter = 0;
    player_data[player].dr_dir[0] = 0;
    player_data[player].dr_field[0].y = 0;
    target_player = player_data[player].dr_currentTarget;
    playerFieldY = (player_data[player].ply_y >> MAZE_FIELD_SHIFT)|1;
    playerFieldX = (player_data[player].ply_x >> MAZE_FIELD_SHIFT)|1;
    targetPlayerFieldX = (player_data[target_player].ply_x >> MAZE_FIELD_SHIFT)|1;
    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 0, 0, 0);
    if(wantedDirChar == 'e' && !canEast && !canNorth && canWest) {
        do {
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canWest) break;
            playerFieldX -= 2;
            if(playerFieldX <= 0) break;
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(canNorth) {
                player_data[player].dr_field[0].y = playerFieldY;
                player_data[player].dr_field[0].x = playerFieldX;
                do {
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canNorth) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    playerFieldY -= 2;
                    if(playerFieldY <= 0) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canNorth && !canEast) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    if(canEast) {
                        player_data[player].dr_field[1].y = playerFieldY;
                        player_data[player].dr_field[1].x = playerFieldX;
                        do {
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canEast) {
                                playerFieldX = player_data[player].dr_field[1].x;
                                break;
                            }
                            playerFieldX += 2;
                            if(playerFieldX > MAZE_MAX_SIZE-1) {
                                playerFieldX = player_data[player].dr_field[1].x;
                                break;
                            }
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canSouth && !canEast) {
                                playerFieldX = player_data[player].dr_field[1].x;
                                break;
                            }
                            if(canSouth) {
                                player_data[player].dr_field[2].y = playerFieldY;
                                player_data[player].dr_field[2].x = playerFieldX;
                                player_data[player].dr_field[3].y = playerFieldY+2;
                                player_data[player].dr_field[3].x = playerFieldX;
                                player_data[player].dr_field[4].y = 0;
                                player_data[player].dr_dir[0] = PLAYER_DIR_WEST;
                                player_data[player].dr_dir[1] = PLAYER_DIR_NORTH+256;
                                player_data[player].dr_dir[2] = PLAYER_DIR_EAST;
                                player_data[player].dr_dir[3] = PLAYER_DIR_SOUTH;
                                player_data[player].dr_dir[4] = -1;
                                player_data[player].dr_fieldIndex = 0;
                                return YES;
                            }
                        } while(canEast);
                        player_data[player].dr_dir[0] = 0;
                        player_data[player].dr_fieldIndex = 0;
                        return NO;
                    }
                } while(canNorth);
                player_data[player].dr_dir[0] = 0;
                player_data[player].dr_fieldIndex = 0;
                return NO;
            }
        } while(canWest);
        player_data[player].dr_dir[0] = 0;
        player_data[player].dr_fieldIndex = 0;
        return NO;
    }
    if(wantedDirChar == 'w' && !canWest && !canNorth && canEast) {
        do {
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canEast) break;
            playerFieldX += 2;
            if(playerFieldX > MAZE_MAX_SIZE-1) break;
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(canNorth) {
                player_data[player].dr_field[0].y = playerFieldY;
                player_data[player].dr_field[0].x = playerFieldX;
                do {
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canNorth) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    playerFieldY -= 2;
                    if(playerFieldY <= 0) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canNorth && !canWest) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    if(canWest) {
                        player_data[player].dr_field[1].y = playerFieldY;
                        player_data[player].dr_field[1].x = playerFieldX;
                        do {
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canWest) {
                                playerFieldX = player_data[player].dr_field[1].x;
                                break;
                            }
                            playerFieldX -= 2;
                            if(playerFieldX < 0) {
                                playerFieldX = player_data[player].dr_field[1].x;
                                break;
                            }
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canWest && !canSouth) {
                                playerFieldX = player_data[player].dr_field[1].x;
                                break;
                            }
                            if(canSouth) {
                                player_data[player].dr_field[2].y = playerFieldY;
                                player_data[player].dr_field[2].x = playerFieldX;
                                player_data[player].dr_field[3].y = playerFieldY+2;
                                player_data[player].dr_field[3].x = playerFieldX;
                                player_data[player].dr_field[4].y = 0;
                                player_data[player].dr_dir[0] = PLAYER_DIR_EAST;
                                player_data[player].dr_dir[1] = PLAYER_DIR_NORTH+256;
                                player_data[player].dr_dir[2] = PLAYER_DIR_WEST;
                                player_data[player].dr_dir[3] = PLAYER_DIR_SOUTH;
                                player_data[player].dr_dir[4] = -1;
                                player_data[player].dr_fieldIndex = 0;
                                return YES;
                            }
                        } while(canWest);
                        player_data[player].dr_dir[0] = 0;
                        player_data[player].dr_fieldIndex = 0;
                        return NO;
                    }
                } while(canNorth);
                player_data[player].dr_dir[0] = 0;
                player_data[player].dr_fieldIndex = 0;
                return NO;
            }
        } while(canEast);
        player_data[player].dr_dir[0] = 0;
        player_data[player].dr_fieldIndex = 0;
        return NO;
    }
    if(canNorth) {
        do {
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canNorth) break;
            playerFieldY -= 2;
            if(playerFieldY < 0) break;
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(wantedDirChar == 'w' && canWest) {
                player_data[player].dr_field[0].y = playerFieldY;
                player_data[player].dr_field[0].x = playerFieldX;
                do {
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canWest) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    playerFieldX -= 2;
                    if(playerFieldX <= 0) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canWest && !canSouth) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    if(canSouth) {
                        player_data[player].dr_field[1].y = playerFieldY;
                        player_data[player].dr_field[1].x = playerFieldX;
                        do {
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canSouth) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            playerFieldY += 2;
                            if(playerFieldY > MAZE_MAX_SIZE-1) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canSouth && !canEast && !canWest) { /* dead end? */
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            if(playerFieldX == targetPlayerFieldX || canSouth || canEast || canWest) {
                                player_data[player].dr_field[2].y = playerFieldY;
                                player_data[player].dr_field[2].x = playerFieldX;
                                player_data[player].dr_field[3].y = 0;
                                player_data[player].dr_dir[0] = PLAYER_DIR_NORTH+256;
                                player_data[player].dr_dir[1] = PLAYER_DIR_WEST;
                                player_data[player].dr_dir[2] = PLAYER_DIR_SOUTH;
                                player_data[player].dr_dir[3] = -1;
                                player_data[player].dr_fieldIndex = 0;
                                return YES;
                            }
                        } while(canSouth);
                    }
                } while(canWest);
            } else {
                if(wantedDirChar == 'e' && canEast) {
                    player_data[player].dr_field[0].y = playerFieldY;
                    player_data[player].dr_field[0].x = playerFieldX;
                    do {
                        drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                        if(!canEast) {
                            playerFieldX = player_data[player].dr_field[0].x;
                            break;
                        }
                        playerFieldX += 2;
                        if(playerFieldX > MAZE_MAX_SIZE-1) {
                            playerFieldX = player_data[player].dr_field[0].x;
                            break;
                        }
                        drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                        if(!canEast && !canSouth) {
                            playerFieldX = player_data[player].dr_field[0].x;
                            break;
                        }
                        if(canSouth) {
                            player_data[player].dr_field[1].y = playerFieldY;
                            player_data[player].dr_field[1].x = playerFieldX;
                            do {
                                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                if(!canSouth) {
                                    playerFieldY = player_data[player].dr_field[1].y;
                                    break;
                                }
                                playerFieldY += 2;
                                if(playerFieldY > MAZE_MAX_SIZE-1) {
                                    playerFieldY = player_data[player].dr_field[1].y;
                                    break;
                                }
                                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                if(!canEast && !canSouth && !canWest) { /* dead end? */
                                    playerFieldY = player_data[player].dr_field[1].y;
                                    break;
                                }
                                if(playerFieldX == targetPlayerFieldX || canSouth || canEast || canWest) {
                                    player_data[player].dr_field[2].y = playerFieldY;
                                    player_data[player].dr_field[2].x = playerFieldX;
                                    player_data[player].dr_field[3].y = 0;
                                    player_data[player].dr_dir[0] = PLAYER_DIR_NORTH+256;
                                    player_data[player].dr_dir[1] = PLAYER_DIR_EAST;
                                    player_data[player].dr_dir[2] = PLAYER_DIR_SOUTH;
                                    player_data[player].dr_dir[3] = -1;
                                    player_data[player].dr_fieldIndex = 0;
                                    return YES;
                                }
                            } while(canSouth);
                        }
                    } while(canEast);
                }
            }
        } while(canNorth);
    }
    playerFieldY = (player_data[player].ply_y >> MAZE_FIELD_SHIFT)|1;
    playerFieldX = (player_data[player].ply_x >> MAZE_FIELD_SHIFT)|1;
    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 0, 0, 0);
    if(wantedDirChar == 'w' && canNorth) {
        do {
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canNorth) break;
            playerFieldY -= 2;
            if(playerFieldY <= 0) break;
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(canEast) {
                player_data[player].dr_field[0].y = playerFieldY;
                player_data[player].dr_field[0].x = playerFieldX;
                do {
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canEast) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    playerFieldX += 2;
                    if(playerFieldX > MAZE_MAX_SIZE-1) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canEast && !canNorth) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    if(canNorth) {
                        player_data[player].dr_field[1].y = playerFieldY;
                        player_data[player].dr_field[1].x = playerFieldX;
                        do {
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canNorth) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            playerFieldY -= 2;
                            if(playerFieldY <= 0) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canNorth && !canWest) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            if(canWest) {
                                player_data[player].dr_field[2].y = playerFieldY;
                                player_data[player].dr_field[2].x = playerFieldX;
                                player_data[player].dr_field[3].y = playerFieldY;
                                player_data[player].dr_field[3].x = playerFieldX-2;
                                player_data[player].dr_field[4].y = 0;
                                player_data[player].dr_dir[0] = PLAYER_DIR_NORTH+256;
                                player_data[player].dr_dir[1] = PLAYER_DIR_EAST;
                                player_data[player].dr_dir[2] = PLAYER_DIR_NORTH+256;
                                player_data[player].dr_dir[3] = PLAYER_DIR_WEST;
                                player_data[player].dr_dir[4] = -1;
                                player_data[player].dr_fieldIndex = 0;
                                return YES;
                            }
                        } while(canNorth);
                        player_data[player].dr_dir[0] = 0;
                        player_data[player].dr_fieldIndex = 0;
                        return NO;
                    }
                } while(canEast);
                player_data[player].dr_dir[0] = 0;
                player_data[player].dr_fieldIndex = 0;
                return NO;
            }
        } while(canNorth);
        player_data[player].dr_dir[0] = 0;
        player_data[player].dr_fieldIndex = 0;
        return NO;
    }
    if(wantedDirChar == 'e' && canNorth) {
        do {
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canNorth) break;
            playerFieldY -= 2;
            if(playerFieldY <= 0) {
                playerFieldY = player_data[player].dr_field[0].y;
                break;
            }
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(canWest) {
                player_data[player].dr_field[0].y = playerFieldY;
                player_data[player].dr_field[0].x = playerFieldX;
                do {
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canWest) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    playerFieldX -= 2;
                    if(playerFieldX <= 0) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canWest && !canNorth) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    if(canNorth) {
                        player_data[player].dr_field[1].y = playerFieldY;
                        player_data[player].dr_field[1].x = playerFieldX;
                        do {
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canNorth) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            playerFieldY -= 2;
                            if(playerFieldY <= 0) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canNorth && !canEast) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            if(canEast) {
                                player_data[player].dr_field[2].y = playerFieldY;
                                player_data[player].dr_field[2].x = playerFieldX;
                                player_data[player].dr_field[3].y = playerFieldY;
                                player_data[player].dr_field[3].x = playerFieldX+2;
                                player_data[player].dr_field[4].y = 0;
                                player_data[player].dr_dir[0] = PLAYER_DIR_NORTH+256;
                                player_data[player].dr_dir[1] = PLAYER_DIR_WEST;
                                player_data[player].dr_dir[2] = PLAYER_DIR_NORTH+256;
                                player_data[player].dr_dir[3] = PLAYER_DIR_EAST;
                                player_data[player].dr_dir[4] = -1;
                                player_data[player].dr_fieldIndex = 0;
                                return YES;
                            }
                        } while(canNorth);
                        player_data[player].dr_dir[0] = 0;
                        player_data[player].dr_fieldIndex = 0;
                        return NO;
                    }
                } while(canWest);
                player_data[player].dr_dir[0] = 0;
                player_data[player].dr_fieldIndex = 0;
                return NO;
            }
        } while(canNorth);
        player_data[player].dr_dir[0] = 0;
        player_data[player].dr_fieldIndex = 0;
        return NO;
    }
    player_data[player].dr_dir[0] = 0;
    player_data[player].dr_fieldIndex = 0;
    return NO;
}

/************************************************************
 *** int drone_sub_ninja_south(int player,int viewCompassDirChar)
 ************************************************************/
int drone_sub_ninja_south(int player,int wantedDirChar) {
int target_player;
int targetPlayerFieldX;
int playerFieldX;
int playerFieldY;
int canWest;
int canEast;
int canSouth;
int canNorth;

    player_data[player].dr_fieldIndex = 0;
    player_data[player].dr_upRotationCounter = 0;
    player_data[player].dr_rotateCounter = 0;
    player_data[player].dr_dir[0] = 0;
    player_data[player].dr_field[0].y = 0;
    target_player = player_data[player].dr_currentTarget;
    playerFieldY = (player_data[player].ply_y >> MAZE_FIELD_SHIFT)|1;
    playerFieldX = (player_data[player].ply_x >> MAZE_FIELD_SHIFT)|1;
    targetPlayerFieldX = (player_data[target_player].ply_x >> MAZE_FIELD_SHIFT)|1;
    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 0, 0, 0);
    if(wantedDirChar == 'e' && !canEast && !canSouth && canWest) {
        do {
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canWest) break;
            playerFieldX -= 2;
            if(playerFieldX <= 0) break;
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(canSouth) {
                player_data[player].dr_field[0].y = playerFieldY;
                player_data[player].dr_field[0].x = playerFieldX;
                do {
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canSouth) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    playerFieldY += 2;
                    if(playerFieldY > MAZE_MAX_SIZE-1) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canSouth && !canEast) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    if(canEast) {
                        player_data[player].dr_field[1].y = playerFieldY;
                        player_data[player].dr_field[1].x = playerFieldX;
                        player_data[player].dr_field[2].y = playerFieldY;
                        player_data[player].dr_field[2].x = playerFieldX+2;
                        player_data[player].dr_field[3].y = 0;
                        player_data[player].dr_dir[0] = PLAYER_DIR_WEST;
                        player_data[player].dr_dir[1] = PLAYER_DIR_SOUTH;
                        player_data[player].dr_dir[2] = PLAYER_DIR_EAST;
                        player_data[player].dr_dir[3] = -1;
                        player_data[player].dr_fieldIndex = 0;
                        return YES;
                    }
                } while(canSouth);
                player_data[player].dr_dir[0] = 0;
                player_data[player].dr_fieldIndex = 0;
                return NO;
            }
        } while(canWest);
        player_data[player].dr_dir[0] = 0;
        player_data[player].dr_fieldIndex = 0;
        return NO;
    }
    if(wantedDirChar == 'w' && !canWest && !canSouth && canEast) {
        do {
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canEast) break;
            playerFieldX += 2;
            if(playerFieldX > MAZE_MAX_SIZE-1) break;
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(canSouth) {
                player_data[player].dr_field[0].y = playerFieldY;
                player_data[player].dr_field[0].x = playerFieldX;
                do {
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canSouth) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    playerFieldY += 2;
                    if(playerFieldY > MAZE_MAX_SIZE-1) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canSouth && !canWest) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    if(canWest) {
                        player_data[player].dr_field[1].y = playerFieldY;
                        player_data[player].dr_field[1].x = playerFieldX;
                        player_data[player].dr_field[2].y = playerFieldY;
                        player_data[player].dr_field[2].x = playerFieldX-2;
                        player_data[player].dr_field[3].y = 0;
                        player_data[player].dr_dir[0] = PLAYER_DIR_EAST;
                        player_data[player].dr_dir[1] = PLAYER_DIR_SOUTH;
                        player_data[player].dr_dir[2] = PLAYER_DIR_WEST;
                        player_data[player].dr_dir[3] = -1;
                        player_data[player].dr_fieldIndex = 0;
                        return YES;
                    }
                } while(canSouth);
                player_data[player].dr_dir[0] = 0;
                player_data[player].dr_fieldIndex = 0;
                return NO;
            }
        } while(canEast);
        player_data[player].dr_dir[0] = 0;
        player_data[player].dr_fieldIndex = 0;
        return NO;
    }
    if(canSouth) {
        do {
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canSouth) break;
            playerFieldY += 2;
            if(playerFieldY > MAZE_MAX_SIZE-1) break;
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canSouth && !canEast && !canWest) break; /* dead end? */
            if(wantedDirChar == 'w' && canWest) {
                player_data[player].dr_field[0].y = playerFieldY;
                player_data[player].dr_field[0].x = playerFieldX;
                do {
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canWest) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    playerFieldX -= 2;
                    if(playerFieldX <= 0) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canNorth && !canWest) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    if(canNorth) {
                        player_data[player].dr_field[1].y = playerFieldY;
                        player_data[player].dr_field[1].x = playerFieldX;
                        do {
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canNorth) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            playerFieldY -= 2;
                            if(playerFieldY <= 0) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canNorth && !canEast && !canWest) { /* dead end? */
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            if(playerFieldX == targetPlayerFieldX || canNorth || canEast || canWest) {
                                player_data[player].dr_field[2].y = playerFieldY;
                                player_data[player].dr_field[2].x = playerFieldX;
                                player_data[player].dr_field[3].y = 0;
                                player_data[player].dr_dir[0] = PLAYER_DIR_SOUTH;
                                player_data[player].dr_dir[1] = PLAYER_DIR_WEST;
                                player_data[player].dr_dir[2] = PLAYER_DIR_NORTH+256;
                                player_data[player].dr_dir[3] = -1;
                                player_data[player].dr_fieldIndex = 0;
                                return YES;
                            }
                        } while(canNorth);
                    }
                } while(canWest);
            } else {
                if(wantedDirChar == 'e' && canEast) {
                    player_data[player].dr_field[0].y = playerFieldY;
                    player_data[player].dr_field[0].x = playerFieldX;
                    do {
                        drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                        if(!canEast) {
                            playerFieldX = player_data[player].dr_field[0].x;
                            break;
                        }
                        playerFieldX += 2;
                        if(playerFieldX > MAZE_MAX_SIZE-1) {
                            playerFieldX = player_data[player].dr_field[0].x;
                            break;
                        }
                        drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                        if(!canNorth && !canEast) {
                            playerFieldX = player_data[player].dr_field[0].x;
                            break;
                        }
                        if(canNorth) {
                            player_data[player].dr_field[1].y = playerFieldY;
                            player_data[player].dr_field[1].x = playerFieldX;
                            do {
                                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                if(!canNorth) {
                                    playerFieldY = player_data[player].dr_field[1].y;
                                    break;
                                }
                                playerFieldY -= 2;
                                if(playerFieldY <= 0) {
                                    playerFieldY = player_data[player].dr_field[1].y;
                                    break;
                                }
                                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                if(!canNorth && !canEast && !canWest) { /* dead end? */
                                    playerFieldY = player_data[player].dr_field[1].y;
                                    break;
                                }
                                if(playerFieldX == targetPlayerFieldX || canNorth || canEast || canWest) {
                                    player_data[player].dr_field[2].y = playerFieldY;
                                    player_data[player].dr_field[2].x = playerFieldX;
                                    player_data[player].dr_field[3].y = 0;
                                    player_data[player].dr_dir[0] = PLAYER_DIR_SOUTH;
                                    player_data[player].dr_dir[1] = PLAYER_DIR_EAST;
                                    player_data[player].dr_dir[2] = PLAYER_DIR_NORTH+256;
                                    player_data[player].dr_dir[3] = -1;
                                    player_data[player].dr_fieldIndex = 0;
                                    return YES;
                                }
                            } while(canNorth);
                        }
                    } while(canEast);
                }
            }
        } while(canSouth);
    }
    playerFieldY = (player_data[player].ply_y >> MAZE_FIELD_SHIFT)|1;
    playerFieldX = (player_data[player].ply_x >> MAZE_FIELD_SHIFT)|1;
    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 0, 0, 0);
    if(wantedDirChar == 'w' && canSouth) {
        do {
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canSouth) break;
            playerFieldY += 2;
            if(playerFieldY > MAZE_MAX_SIZE-1) break;
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(canWest) {
                player_data[player].dr_field[0].y = playerFieldY;
                player_data[player].dr_field[0].x = playerFieldX;
                do {
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canWest) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    playerFieldX -= 2;
                    if(playerFieldX <= 0) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canWest && !canSouth) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    if(canSouth) {
                        player_data[player].dr_field[1].y = playerFieldY;
                        player_data[player].dr_field[1].x = playerFieldX;
                        do {
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canSouth) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            playerFieldY += 2;
                            if(playerFieldY > MAZE_MAX_SIZE-1) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canSouth && !canEast) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            if(canEast) {
                                player_data[player].dr_field[2].y = playerFieldY;
                                player_data[player].dr_field[2].x = playerFieldX;
                                player_data[player].dr_field[3].y = playerFieldY;
                                player_data[player].dr_field[3].x = playerFieldX+2;
                                player_data[player].dr_field[4].y = 0;
                                player_data[player].dr_dir[0] = PLAYER_DIR_SOUTH;
                                player_data[player].dr_dir[1] = PLAYER_DIR_WEST;
                                player_data[player].dr_dir[2] = PLAYER_DIR_SOUTH;
                                player_data[player].dr_dir[3] = PLAYER_DIR_EAST;
                                player_data[player].dr_dir[4] = -1;
                                player_data[player].dr_fieldIndex = 0;
                                return YES;
                            }
                        } while(canSouth);
                        player_data[player].dr_dir[0] = 0;
                        player_data[player].dr_fieldIndex = 0;
                        return NO;
                    }
                } while(canWest);
                player_data[player].dr_dir[0] = 0;
                player_data[player].dr_fieldIndex = 0;
                return NO;
            }
        } while(canSouth);
        player_data[player].dr_dir[0] = 0;
        player_data[player].dr_fieldIndex = 0;
        return NO;
    }
    if(wantedDirChar == 'e' && canSouth) {
        do {
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canSouth) break;
            playerFieldY += 2;
            if(playerFieldY > MAZE_MAX_SIZE-1) break;
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(canEast) {
                player_data[player].dr_field[0].y = playerFieldY;
                player_data[player].dr_field[0].x = playerFieldX;
                do {
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canEast) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    playerFieldX += 2;
                    if(playerFieldX > MAZE_MAX_SIZE-1) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canEast && !canSouth) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    if(canSouth) {
                        player_data[player].dr_field[1].y = playerFieldY;
                        player_data[player].dr_field[1].x = playerFieldX;
                        do {
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canSouth) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            playerFieldY += 2;
                            if(playerFieldY > MAZE_MAX_SIZE-1) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canSouth && !canWest) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            if(canWest) {
                                player_data[player].dr_field[2].y = playerFieldY;
                                player_data[player].dr_field[2].x = playerFieldX;
                                player_data[player].dr_field[3].y = playerFieldY;
                                player_data[player].dr_field[3].x = playerFieldX-2;
                                player_data[player].dr_field[4].y = 0;
                                player_data[player].dr_dir[0] = PLAYER_DIR_SOUTH;
                                player_data[player].dr_dir[1] = PLAYER_DIR_EAST;
                                player_data[player].dr_dir[2] = PLAYER_DIR_SOUTH;
                                player_data[player].dr_dir[3] = PLAYER_DIR_WEST;
                                player_data[player].dr_dir[4] = -1;
                                player_data[player].dr_fieldIndex = 0;
                                return YES;
                            }
                        } while(canSouth);
                        player_data[player].dr_dir[0] = 0;
                        player_data[player].dr_fieldIndex = 0;
                        return NO;
                    }
                } while(canEast);
                player_data[player].dr_dir[0] = 0;
                player_data[player].dr_fieldIndex = 0;
                return NO;
            }
        } while(canSouth);
        player_data[player].dr_dir[0] = 0;
        player_data[player].dr_fieldIndex = 0;
        return NO;
    }
    player_data[player].dr_dir[0] = 0;
    player_data[player].dr_fieldIndex = 0;
    return NO;
}

/************************************************************
 *** int drone_sub_ninja_east(int player,int viewCompassDirChar)
 ************************************************************/
int drone_sub_ninja_east(int player,int wantedDirChar) {
int target_player;
int targetPlayerFieldY;
int playerFieldX;
int playerFieldY;
int canWest;
int canEast;
int canSouth;
int canNorth;

    player_data[player].dr_fieldIndex = 0;
    player_data[player].dr_upRotationCounter = 0;
    player_data[player].dr_rotateCounter = 0;
    player_data[player].dr_dir[0] = 0;
    player_data[player].dr_field[0].y = 0;
    target_player = player_data[player].dr_currentTarget;
    playerFieldY = (player_data[player].ply_y >> MAZE_FIELD_SHIFT)|1;
    playerFieldX = (player_data[player].ply_x >> MAZE_FIELD_SHIFT)|1;
    targetPlayerFieldY = (player_data[target_player].ply_y >> MAZE_FIELD_SHIFT)|1;
    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 0, 0, 0);
    if(wantedDirChar == 'n' && !canNorth && !canEast && canSouth) {
        do {
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canSouth) break;
            playerFieldY += 2;
            if(playerFieldY > MAZE_MAX_SIZE-1) break;
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(canEast) {
                player_data[player].dr_field[0].y = playerFieldY;
                player_data[player].dr_field[0].x = playerFieldX;
                do {
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canEast) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    playerFieldX += 2;
                    if(playerFieldX > MAZE_MAX_SIZE-1) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canEast && !canNorth) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    if(canNorth) {
                        player_data[player].dr_field[1].y = playerFieldY;
                        player_data[player].dr_field[1].x = playerFieldX;
                        do {
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canNorth) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            playerFieldY -= 2;
                            if(playerFieldY <= 0) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canNorth && !canWest) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            if(canWest) {
                                player_data[player].dr_field[2].y = playerFieldY;
                                player_data[player].dr_field[2].x = playerFieldX;
                                player_data[player].dr_field[3].y = playerFieldY;
                                player_data[player].dr_field[3].x = playerFieldX-2;
                                player_data[player].dr_field[4].y = 0;
                                player_data[player].dr_dir[0] = PLAYER_DIR_SOUTH;
                                player_data[player].dr_dir[1] = PLAYER_DIR_EAST;
                                player_data[player].dr_dir[2] = PLAYER_DIR_NORTH+256;
                                player_data[player].dr_dir[3] = PLAYER_DIR_WEST;
                                player_data[player].dr_dir[4] = -1;
                                player_data[player].dr_fieldIndex = 0;
                                return YES;
                            }
                        } while(canNorth);
                        player_data[player].dr_dir[0] = 0;
                        player_data[player].dr_fieldIndex = 0;
                        return NO;
                    }
                } while(canEast);
                player_data[player].dr_dir[0] = 0;
                player_data[player].dr_fieldIndex = 0;
                return NO;
            }
        } while(canSouth);
        player_data[player].dr_dir[0] = 0;
        player_data[player].dr_fieldIndex = 0;
        return NO;
    }
    if(wantedDirChar == 's' && !canSouth && !canEast && canNorth) {
        do {
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canNorth) break;
            playerFieldY -= 2;
            if(playerFieldY <= 0) break;
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(canEast) {
                player_data[player].dr_field[0].y = playerFieldY;
                player_data[player].dr_field[0].x = playerFieldX;
                do {
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canEast) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    playerFieldX += 2;
                    if(playerFieldX > MAZE_MAX_SIZE-1) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canEast && !canSouth) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    if(canSouth) {
                        player_data[player].dr_field[1].y = playerFieldY;
                        player_data[player].dr_field[1].x = playerFieldX;
                        do {
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canSouth) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            playerFieldY += 2;
                            if(playerFieldY > MAZE_MAX_SIZE-1) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canSouth && !canWest) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            if(canWest) {
                                player_data[player].dr_field[2].y = playerFieldY;
                                player_data[player].dr_field[2].x = playerFieldX;
                                player_data[player].dr_field[3].y = playerFieldY;
                                player_data[player].dr_field[3].x = playerFieldX-2;
                                player_data[player].dr_field[4].y = 0;
                                player_data[player].dr_dir[0] = PLAYER_DIR_NORTH+256;
                                player_data[player].dr_dir[1] = PLAYER_DIR_EAST;
                                player_data[player].dr_dir[2] = PLAYER_DIR_SOUTH;
                                player_data[player].dr_dir[3] = PLAYER_DIR_WEST;
                                player_data[player].dr_dir[4] = -1;
                                player_data[player].dr_fieldIndex = 0;
                                return YES;
                            }
                        } while(canSouth);
                        player_data[player].dr_dir[0] = 0;
                        player_data[player].dr_fieldIndex = 0;
                        return NO;
                    }
                } while(canEast);
                player_data[player].dr_dir[0] = 0;
                player_data[player].dr_fieldIndex = 0;
                return NO;
            }
        } while(canNorth);
        player_data[player].dr_dir[0] = 0;
        player_data[player].dr_fieldIndex = 0;
        return NO;
    }
    if(canEast) {
        do {
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canEast) break;
            playerFieldX += 2;
            if(playerFieldX > MAZE_MAX_SIZE-1) break;
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(wantedDirChar == 'n' && canNorth) {
                player_data[player].dr_field[0].y = playerFieldY;
                player_data[player].dr_field[0].x = playerFieldX;
                do {
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canNorth) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    playerFieldY -= 2;
                    if(playerFieldY <= 0) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canNorth && !canWest) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    if(canWest) {
                        player_data[player].dr_field[1].y = playerFieldY;
                        player_data[player].dr_field[1].x = playerFieldX;
                        do {
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canWest) {
                                playerFieldX = player_data[player].dr_field[1].x;
                                break;
                            }
                            playerFieldX -= 2;
                            if(playerFieldX <= 0) {
                                playerFieldX = player_data[player].dr_field[1].x;
                                break;
                            }
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canWest && !canNorth && !canSouth) { /* dead end? */
                                playerFieldX = player_data[player].dr_field[1].x;
                                break;
                            }
                            if(playerFieldY == targetPlayerFieldY || canWest || canNorth || canSouth) {
                                player_data[player].dr_field[2].y = playerFieldY;
                                player_data[player].dr_field[2].x = playerFieldX;
                                player_data[player].dr_field[3].y = 0;
                                player_data[player].dr_dir[0] = PLAYER_DIR_EAST;
                                player_data[player].dr_dir[1] = PLAYER_DIR_NORTH+256;
                                player_data[player].dr_dir[2] = PLAYER_DIR_WEST;
                                player_data[player].dr_dir[3] = -1;
                                player_data[player].dr_fieldIndex = 0;
                                return YES;
                            }
                        } while(canWest);
                    }
                } while(canNorth);
            } else {
                if(wantedDirChar == 's' && canSouth) {
                    player_data[player].dr_field[0].y = playerFieldY;
                    player_data[player].dr_field[0].x = playerFieldX;
                    do {
                        drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                        if(!canSouth) break;
                        playerFieldY += 2;
                        if(playerFieldY > MAZE_MAX_SIZE-1) {
                            playerFieldY = player_data[player].dr_field[0].y;
                            break;
                        }
                        drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                        if(!canSouth && !canWest) {
                            playerFieldY = player_data[player].dr_field[0].y;
                            break;
                        }
                        if(canWest) {
                            player_data[player].dr_field[1].y = playerFieldY;
                            player_data[player].dr_field[1].x = playerFieldX;
                            do {
                                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                if(!canWest) {
                                    playerFieldX = player_data[player].dr_field[1].x;
                                    break;
                                }
                                playerFieldX -= 2;
                                if(playerFieldX <= 0) {
                                    playerFieldX = player_data[player].dr_field[1].x;
                                    break;
                                }
                                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                if(!canNorth && !canWest && !canSouth) { /* dead end? */
                                    playerFieldX = player_data[player].dr_field[1].x;
                                    break;
                                }
                                if(playerFieldY == targetPlayerFieldY || canWest || canNorth || canSouth) {
                                    player_data[player].dr_field[2].y = playerFieldY;
                                    player_data[player].dr_field[2].x = playerFieldX;
                                    player_data[player].dr_field[3].y = 0;
                                    player_data[player].dr_dir[0] = PLAYER_DIR_EAST;
                                    player_data[player].dr_dir[1] = PLAYER_DIR_SOUTH;
                                    player_data[player].dr_dir[2] = PLAYER_DIR_WEST;
                                    player_data[player].dr_dir[3] = -1;
                                    player_data[player].dr_fieldIndex = 0;
                                    return YES;
                                }
                            } while(canWest);
                        }
                    } while(canSouth);
                }
            }
        } while(canEast);
    }
    playerFieldY = (player_data[player].ply_y >> MAZE_FIELD_SHIFT)|1;
    playerFieldX = (player_data[player].ply_x >> MAZE_FIELD_SHIFT)|1;
    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 0, 0, 0);
    if(wantedDirChar == 'n' && canEast) {
        do {
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canEast) break;
            playerFieldX += 2;
            if(playerFieldX > MAZE_MAX_SIZE-1) break;
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canEast && !canSouth) break;
            if(canSouth) {
                player_data[player].dr_field[0].y = playerFieldY;
                player_data[player].dr_field[0].x = playerFieldX;
                do {
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canSouth) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    playerFieldY += 2;
                    if(playerFieldY > MAZE_MAX_SIZE-1) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canSouth && !canEast) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    if(canEast) {
                        player_data[player].dr_field[1].y = playerFieldY;
                        player_data[player].dr_field[1].x = playerFieldX;
                        do {
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canEast) {
                                playerFieldX = player_data[player].dr_field[1].x;
                                break;
                            }
                            playerFieldX += 2;
                            if(playerFieldX > MAZE_MAX_SIZE-1) {
                                playerFieldX = player_data[player].dr_field[1].x;
                                break;
                            }
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canEast && !canNorth) {
                                playerFieldX = player_data[player].dr_field[1].x;
                                break;
                            }
                            if(canNorth) {
                                player_data[player].dr_field[2].y = playerFieldY;
                                player_data[player].dr_field[2].x = playerFieldX;
                                player_data[player].dr_field[3].y = playerFieldY-2;
                                player_data[player].dr_field[3].x = playerFieldX;
                                player_data[player].dr_field[4].y = 0;
                                player_data[player].dr_dir[0] = PLAYER_DIR_EAST;
                                player_data[player].dr_dir[1] = PLAYER_DIR_SOUTH;
                                player_data[player].dr_dir[2] = PLAYER_DIR_EAST;
                                player_data[player].dr_dir[3] = PLAYER_DIR_NORTH+256;
                                player_data[player].dr_dir[4] = -1;
                                player_data[player].dr_fieldIndex = 0;
                                return YES;
                            }
                        } while(canEast);
                        player_data[player].dr_dir[0] = 0;
                        player_data[player].dr_fieldIndex = 0;
                        return NO;
                    }
                } while(canSouth);
                player_data[player].dr_dir[0] = 0;
                player_data[player].dr_fieldIndex = 0;
                return NO;
            }
        } while(canEast);
        player_data[player].dr_dir[0] = 0;
        player_data[player].dr_fieldIndex = 0;
        return NO;
    }
    if(wantedDirChar == 's' && canEast) {
        do {
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canEast) break;
            playerFieldX += 2;
            if(playerFieldX > MAZE_MAX_SIZE-1) break;
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canEast && !canNorth) break;
            if(canNorth) {
                player_data[player].dr_field[0].y = playerFieldY;
                player_data[player].dr_field[0].x = playerFieldX;
                do {
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canNorth) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    playerFieldY -= 2;
                    if(playerFieldY <= 0) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canNorth && !canEast) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    if(canEast) {
                        player_data[player].dr_field[1].y = playerFieldY;
                        player_data[player].dr_field[1].x = playerFieldX;
                        do {
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canEast) {
                                playerFieldX = player_data[player].dr_field[1].x;
                                break;
                            }
                            playerFieldX += 2;
                            if(playerFieldX > MAZE_MAX_SIZE-1) {
                                playerFieldX = player_data[player].dr_field[1].y;
                                break;
                            }
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canEast && !canSouth) {
                                playerFieldX = player_data[player].dr_field[1].x;
                                break;
                            }
                            if(canSouth) {
                                player_data[player].dr_field[2].y = playerFieldY;
                                player_data[player].dr_field[2].x = playerFieldX;
                                player_data[player].dr_field[3].y = playerFieldY+2;
                                player_data[player].dr_field[3].x = playerFieldX;
                                player_data[player].dr_field[4].y = 0;
                                player_data[player].dr_dir[0] = PLAYER_DIR_EAST;
                                player_data[player].dr_dir[1] = PLAYER_DIR_NORTH+256;
                                player_data[player].dr_dir[2] = PLAYER_DIR_EAST;
                                player_data[player].dr_dir[3] = PLAYER_DIR_SOUTH;
                                player_data[player].dr_dir[4] = -1;
                                player_data[player].dr_fieldIndex = 0;
                                return YES;
                            }
                        } while(canEast);
                        player_data[player].dr_dir[0] = 0;
                        player_data[player].dr_fieldIndex = 0;
                        return NO;
                    }
                } while(canNorth);
                player_data[player].dr_dir[0] = 0;
                player_data[player].dr_fieldIndex = 0;
                return NO;
            }
        } while(canEast);
        player_data[player].dr_dir[0] = 0;
        player_data[player].dr_fieldIndex = 0;
        return NO;
    }
    player_data[player].dr_dir[0] = 0;
    player_data[player].dr_fieldIndex = 0;
    return NO;
}

/************************************************************
 *** int drone_sub_ninja_west(int player,int viewCompassDirChar)
 ************************************************************/
int drone_sub_ninja_west(int player,int wantedDirChar) {
int target_player;
int targetPlayerFieldY;
int playerFieldX;
int playerFieldY;
int canWest;
int canEast;
int canSouth;
int canNorth;

    player_data[player].dr_fieldIndex = 0;
    player_data[player].dr_upRotationCounter = 0;
    player_data[player].dr_rotateCounter = 0;
    player_data[player].dr_dir[0] = 0;
    player_data[player].dr_field[0].y = 0;
    target_player = player_data[player].dr_currentTarget;
    playerFieldY = (player_data[player].ply_y >> MAZE_FIELD_SHIFT)|1;
    playerFieldX = (player_data[player].ply_x >> MAZE_FIELD_SHIFT)|1;
    targetPlayerFieldY = (player_data[target_player].ply_y >> MAZE_FIELD_SHIFT)|1;
    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 0, 0, 0);
    if(wantedDirChar == 'n' && !canNorth && !canWest && canSouth) {
        do {
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canSouth) break;
            playerFieldY += 2;
            if(playerFieldY > MAZE_MAX_SIZE-1) break;
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canSouth && !canWest) break;
            if(canWest) {
                player_data[player].dr_field[0].y = playerFieldY;
                player_data[player].dr_field[0].x = playerFieldX;
                do {
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canWest) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    playerFieldX -= 2;
                    if(playerFieldX <= 0) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canWest && !canNorth) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    if(canNorth) {
                        player_data[player].dr_field[1].y = playerFieldY;
                        player_data[player].dr_field[1].x = playerFieldX;
                        do {
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canNorth) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            playerFieldY -= 2;
                            if(playerFieldY <= 0) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canNorth && !canEast) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            if(canEast) {
                                player_data[player].dr_field[2].y = playerFieldY;
                                player_data[player].dr_field[2].x = playerFieldX;
                                player_data[player].dr_field[3].y = playerFieldY;
                                player_data[player].dr_field[3].x = playerFieldX+2;
                                player_data[player].dr_field[4].y = 0;
                                player_data[player].dr_dir[0] = PLAYER_DIR_SOUTH;
                                player_data[player].dr_dir[1] = PLAYER_DIR_WEST;
                                player_data[player].dr_dir[2] = PLAYER_DIR_NORTH+256;
                                player_data[player].dr_dir[3] = PLAYER_DIR_EAST;
                                player_data[player].dr_dir[4] = -1;
                                player_data[player].dr_fieldIndex = 0;
                                return YES;
                            }
                        } while(canNorth);
                        player_data[player].dr_dir[0] = 0;
                        player_data[player].dr_fieldIndex = 0;
                        return NO;
                    }
                } while(canWest);
                player_data[player].dr_dir[0] = 0;
                player_data[player].dr_fieldIndex = 0;
                return NO;
            }
        } while(canSouth);
        player_data[player].dr_dir[0] = 0;
        player_data[player].dr_fieldIndex = 0;
        return NO;
    }
    if(wantedDirChar == 's' && !canSouth && !canWest && canNorth) {
        do {
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canNorth) break;
            playerFieldY -= 2;
            if(playerFieldY <= 0) break;
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canNorth && !canWest) break;
            if(canWest) {
                player_data[player].dr_field[0].y = playerFieldY;
                player_data[player].dr_field[0].x = playerFieldX;
                do {
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canWest) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    playerFieldX -= 2;
                    if(playerFieldX <= 0) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canWest && !canSouth) {
                        playerFieldX = player_data[player].dr_field[0].x;
                        break;
                    }
                    if(canSouth) {
                        player_data[player].dr_field[1].y = playerFieldY;
                        player_data[player].dr_field[1].x = playerFieldX;
                        do {
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canSouth) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            playerFieldY += 2;
                            if(playerFieldY > MAZE_MAX_SIZE-1) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canSouth && !canEast) {
                                playerFieldY = player_data[player].dr_field[1].y;
                                break;
                            }
                            if(canEast) {
                                player_data[player].dr_field[2].y = playerFieldY;
                                player_data[player].dr_field[2].x = playerFieldX;
                                player_data[player].dr_field[3].y = playerFieldY;
                                player_data[player].dr_field[3].x = playerFieldX+2;
                                player_data[player].dr_field[4].y = 0;
                                player_data[player].dr_dir[0] = PLAYER_DIR_NORTH+256;
                                player_data[player].dr_dir[1] = PLAYER_DIR_WEST;
                                player_data[player].dr_dir[2] = PLAYER_DIR_SOUTH;
                                player_data[player].dr_dir[3] = PLAYER_DIR_EAST;
                                player_data[player].dr_dir[4] = -1;
                                player_data[player].dr_fieldIndex = 0;
                                return YES;
                            }
                        } while(canSouth);
                        player_data[player].dr_dir[0] = 0;
                        player_data[player].dr_fieldIndex = 0;
                        return NO;
                    }
                } while(canWest);
                player_data[player].dr_dir[0] = 0;
                player_data[player].dr_fieldIndex = 0;
                return NO;
            }
        } while(canNorth);
        player_data[player].dr_dir[0] = 0;
        player_data[player].dr_fieldIndex = 0;
        return NO;
    }
    if(canWest) {
        do {
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canWest) break;
            playerFieldX -= 2;
            if(playerFieldX <= 0) break;
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(wantedDirChar == 'n' && canNorth) {
                player_data[player].dr_field[0].y = playerFieldY;
                player_data[player].dr_field[0].x = playerFieldX;
                do {
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canNorth) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    playerFieldY -= 2;
                    if(playerFieldY <= 0) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canNorth && !canEast) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    if(canEast) {
                        player_data[player].dr_field[1].y = playerFieldY;
                        player_data[player].dr_field[1].x = playerFieldX;
                        do {
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canEast) {
                                playerFieldX = player_data[player].dr_field[1].x;
                                break;
                            }
                            playerFieldX += 2;
                            if(playerFieldX > MAZE_MAX_SIZE-1) {
                                playerFieldX = player_data[player].dr_field[1].x;
                                break;
                            }
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canWest && !canEast && !canNorth) { /* dead end? */
                                playerFieldX = player_data[player].dr_field[1].x;
                                break;
                            }
                            if(playerFieldY == targetPlayerFieldY || canEast || canWest || canNorth) {
                                player_data[player].dr_field[2].y = playerFieldY;
                                player_data[player].dr_field[2].x = playerFieldX;
                                player_data[player].dr_field[3].y = 0;
                                player_data[player].dr_dir[0] = PLAYER_DIR_WEST;
                                player_data[player].dr_dir[1] = PLAYER_DIR_NORTH+256;
                                player_data[player].dr_dir[2] = PLAYER_DIR_EAST;
                                player_data[player].dr_dir[3] = -1;
                                player_data[player].dr_fieldIndex = 0;
                                return YES;
                            }
                        } while(canEast);
                    }
                } while(canNorth);
            } else {
                if(wantedDirChar == 's' && canSouth) {
                    player_data[player].dr_field[0].y = playerFieldY;
                    player_data[player].dr_field[0].x = playerFieldX;
                    do {
                        drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                        if(!canSouth) {
                            playerFieldY = player_data[player].dr_field[0].y;
                            break;
                        }
                        playerFieldY += 2;
                        if(playerFieldY > MAZE_MAX_SIZE-1) {
                            playerFieldY = player_data[player].dr_field[0].y;
                            break;
                        }
                        drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                        if(!canSouth && !canEast) {
                            playerFieldY = player_data[player].dr_field[0].y;
                            break;
                        }
                        if(canEast) {
                            player_data[player].dr_field[1].y = playerFieldY;
                            player_data[player].dr_field[1].x = playerFieldX;
                            do {
                                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                if(!canEast) {
                                    playerFieldX = player_data[player].dr_field[1].x;
                                    break;
                                }
                                playerFieldX += 2;
                                if(playerFieldX > MAZE_MAX_SIZE-1) {
                                    playerFieldX = player_data[player].dr_field[1].x;
                                    break;
                                }
                                drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                                if(!canWest && !canEast && !canSouth) { /* dead end? */
                                    playerFieldX = player_data[player].dr_field[1].x;
                                    break;
                                }
                                if(playerFieldY == targetPlayerFieldY || canEast || canSouth || canWest) {
                                    player_data[player].dr_field[2].y = playerFieldY;
                                    player_data[player].dr_field[2].x = playerFieldX;
                                    player_data[player].dr_field[3].y = 0;
                                    player_data[player].dr_dir[0] = PLAYER_DIR_WEST;
                                    player_data[player].dr_dir[1] = PLAYER_DIR_SOUTH;
                                    player_data[player].dr_dir[2] = PLAYER_DIR_EAST;
                                    player_data[player].dr_dir[3] = -1;
                                    player_data[player].dr_fieldIndex = 0;
                                    return YES;
                                }
                            } while(canEast);
                        }
                    } while(canSouth);
                }
            }
        } while(canWest);
    }
    playerFieldY = (player_data[player].ply_y >> MAZE_FIELD_SHIFT)|1;
    playerFieldX = (player_data[player].ply_x >> MAZE_FIELD_SHIFT)|1;
    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 0, 0, 0);
    if(wantedDirChar == 'n' && canWest) {
        do {
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canWest) break;
            playerFieldX -= 2;
            if(playerFieldX <= 0) break;
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canWest && !canSouth) break;
            if(canSouth) {
                player_data[player].dr_field[0].y = playerFieldY;
                player_data[player].dr_field[0].x = playerFieldX;
                do {
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canSouth) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    playerFieldY += 2;
                    if(playerFieldY > MAZE_MAX_SIZE-1) {
                        playerFieldY = player_data[player].dr_field[0].x;
                        break;
                    }
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canSouth && !canWest) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    if(canWest) {
                        player_data[player].dr_field[1].y = playerFieldY;
                        player_data[player].dr_field[1].x = playerFieldX;
                        do {
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canWest) {
                                playerFieldX = player_data[player].dr_field[1].x;
                                break;
                            }
                            playerFieldX -= 2;
                            if(playerFieldX <= 0) {
                                playerFieldX = player_data[player].dr_field[1].x;
                                break;
                            }
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canWest && !canNorth) {
                                playerFieldX = player_data[player].dr_field[1].x;
                                break;
                            }
                            if(canNorth) {
                                player_data[player].dr_field[2].y = playerFieldY;
                                player_data[player].dr_field[2].x = playerFieldX;
                                player_data[player].dr_field[3].y = playerFieldY-2;
                                player_data[player].dr_field[3].x = playerFieldX;
                                player_data[player].dr_field[4].y = 0;
                                player_data[player].dr_dir[0] = PLAYER_DIR_WEST;
                                player_data[player].dr_dir[1] = PLAYER_DIR_SOUTH;
                                player_data[player].dr_dir[2] = PLAYER_DIR_WEST;
                                player_data[player].dr_dir[3] = PLAYER_DIR_NORTH+256;
                                player_data[player].dr_dir[4] = -1;
                                player_data[player].dr_fieldIndex = 0;
                                return YES;
                            }
                        } while(canWest);
                        player_data[player].dr_dir[0] = 0;
                        player_data[player].dr_fieldIndex = 0;
                        return NO;
                    }
                } while(canSouth);
                player_data[player].dr_dir[0] = 0;
                player_data[player].dr_fieldIndex = 0;
                return NO;
            }
        } while(canWest);
        player_data[player].dr_dir[0] = 0;
        player_data[player].dr_fieldIndex = 0;
        return NO;
    }
    if(wantedDirChar == 's' && canWest) {
        do {
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canWest) break;
            playerFieldX -= 2;
            if(playerFieldX <= 0) break;
            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
            if(!canWest && !canNorth) break;
            if(canNorth) {
                player_data[player].dr_field[0].y = playerFieldY;
                player_data[player].dr_field[0].x = playerFieldX;
                do {
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canNorth) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    playerFieldY -= 2;
                    if(playerFieldY <= 0) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                    if(!canNorth && !canWest) {
                        playerFieldY = player_data[player].dr_field[0].y;
                        break;
                    }
                    if(canWest) {
                        player_data[player].dr_field[1].y = playerFieldY;
                        player_data[player].dr_field[1].x = playerFieldX;
                        do {
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canWest) {
                                playerFieldX = player_data[player].dr_field[1].x;
                                break;
                            }
                            playerFieldX -= 2;
                            if(playerFieldX <= 0) {
                                playerFieldX = player_data[player].dr_field[1].x;
                                break;
                            }
                            drone_check_directions(player, &canNorth, &canSouth, &canEast, &canWest, 1, playerFieldY, playerFieldX);
                            if(!canWest && !canSouth) {
                                playerFieldX = player_data[player].dr_field[1].x;
                                break;
                            }
                            if(canSouth) {
                                player_data[player].dr_field[2].y = playerFieldY;
                                player_data[player].dr_field[2].x = playerFieldX;
                                player_data[player].dr_field[3].y = playerFieldY+2;
                                player_data[player].dr_field[3].x = playerFieldX;
                                player_data[player].dr_field[4].y = 0;
                                player_data[player].dr_dir[0] = PLAYER_DIR_WEST;
                                player_data[player].dr_dir[1] = PLAYER_DIR_NORTH+256;
                                player_data[player].dr_dir[2] = PLAYER_DIR_WEST;
                                player_data[player].dr_dir[3] = PLAYER_DIR_SOUTH;
                                player_data[player].dr_dir[4] = -1;
                                player_data[player].dr_fieldIndex = 0;
                                return YES;
                            }
                        } while(canWest);
                        player_data[player].dr_dir[0] = 0;
                        player_data[player].dr_fieldIndex = 0;
                        return NO;
                    }
                } while(canNorth);
                player_data[player].dr_dir[0] = 0;
                player_data[player].dr_fieldIndex = 0;
                return NO;
            }
        } while(canWest);
        player_data[player].dr_dir[0] = 0;
        player_data[player].dr_fieldIndex = 0;
        return NO;
    }
    player_data[player].dr_dir[0] = 0;
    player_data[player].dr_fieldIndex = 0;
    return NO;
}

/* Drone-action scenario: real game-loop body (maingame.c) with drones. Each tick:
 * set_all_player, drone_action for every drone, reset hitflags, move all players
 * from a rotating index. Dumps each drone's generated joystick + full state. */
static void run_drones(const char *name, int seed, int humanPlayers, int nTarget, int nStd,
                       int nNinja, const int *humanJoy, int ticks) {
  reset_world();
  _random_seed = seed;
  team_flag = 0;
  reload_time = 8;
  regen_time = 50;
  revive_time = 50;
  revive_lives = PLAYER_MAX_LIVES;
  friendly_fire = 0;
  active_drones_by_type[0] = nTarget;
  active_drones_by_type[1] = nStd;
  active_drones_by_type[2] = nNinja;
  int total = humanPlayers + nTarget + nStd + nNinja;
  int j = humanPlayers;
  for (int i = 0; i < nTarget; i++) player_data[j++].dr_type = DRONE_TARGET;
  for (int i = 0; i < nStd; i++) player_data[j++].dr_type = DRONE_STANDARD;
  for (int i = 0; i < nNinja; i++) player_data[j++].dr_type = DRONE_NINJA;
  drone_setup(humanPlayers);
  init_all_player(total, 1);
  we_dont_have_a_winner = 1;
  int playerIndex = 0;
  printf("{\"name\":\"%s\",\"seed\":%d,\"humanPlayers\":%d,\"drones\":[%d,%d,%d],\"ticks\":%d,\"trace\":[",
         name, seed, humanPlayers, nTarget, nStd, nNinja, ticks);
  for (int t = 0; t < ticks; t++) {
    set_all_player();
    for (int i = 0; i < humanPlayers; i++) player_joy_table[i] = humanJoy ? humanJoy[t] : 0;
    for (int i = humanPlayers; i < total; i++) drone_action(i);
    for (int i = 0; i < total; i++) player_data[i].ply_hitflag = FALSE;
    int joys[PLAYER_MAX_COUNT];
    for (int i = 0; i < total; i++) joys[i] = player_joy_table[i];
    int idx = playerIndex;
    do {
      move_player(idx, player_joy_table[idx], 1);
      if (!we_dont_have_a_winner) break;
      if (--idx < 0) idx = total - 1;
    } while (idx != playerIndex);
    if (++playerIndex == total) playerIndex = 0;
    printf("%s{\"joy\":[", t ? "," : "");
    for (int i = 0; i < total; i++) printf("%s%d", i ? "," : "", joys[i]);
    printf("],\"players\":[");
    for (int i = 0; i < total; i++) {
      printf("%s{\"y\":%d,\"x\":%d,\"dir\":%d,\"lives\":%d,\"shoot\":%d,\"locked\":%d,\"rot\":%d,\"uprot\":%d,\"fi\":%d}",
             i ? "," : "", player_data[i].ply_y, player_data[i].ply_x, player_data[i].ply_dir,
             player_data[i].ply_lives, player_data[i].ply_shoot, player_data[i].dr_targetLocked,
             player_data[i].dr_rotateCounter, player_data[i].dr_upRotationCounter,
             player_data[i].dr_fieldIndex);
    }
    printf("]}");
  }
  printf("]}");
}

/* drone_setup scenario: assign drone types (maingame.c) + teams, run drone_setup,
 * dump targets + enemy lists per player. */
static void run_drone_setup(const char *name, int humanPlayers, int nTarget, int nStd,
                            int nNinja, int teamFlag, const int *teams) {
  reset_world();
  team_flag = teamFlag;
  active_drones_by_type[0] = nTarget;
  active_drones_by_type[1] = nStd;
  active_drones_by_type[2] = nNinja;
  int total = humanPlayers + nTarget + nStd + nNinja;
  int j = humanPlayers;
  for (int k = 0; k < DRONE_TYPES; k++)
    for (int i = 0; active_drones_by_type[k] > i; i++) {
      switch (k) {
      case 0: player_data[j].dr_type = DRONE_TARGET; break;
      case 1: player_data[j].dr_type = DRONE_STANDARD; break;
      case 2: player_data[j].dr_type = DRONE_NINJA; break;
      }
      j++;
    }
  for (int i = 0; i < total; i++) {
    player_data[i].ply_team = teams ? teams[i] : 0;
    player_data[i].dr_currentTarget = 0;
    player_data[i].dr_permanentTarget = 0;
  }
  drone_setup(humanPlayers);
  printf("{\"name\":\"%s\",\"humanPlayers\":%d,\"teamFlag\":%d,\"drones\":[%d,%d,%d],\"players\":[",
         name, humanPlayers, teamFlag, nTarget, nStd, nNinja);
  for (int i = 0; i < total; i++) {
    printf("%s{\"dr_type\":%d,\"ply_team\":%d,\"dr_currentTarget\":%d,\"dr_permanentTarget\":%d,\"dr_humanEnemies\":[",
           i ? "," : "", player_data[i].dr_type, player_data[i].ply_team,
           player_data[i].dr_currentTarget, player_data[i].dr_permanentTarget);
    for (int e = 0; e < PLAYER_MAX_COUNT + 2; e++)
      printf("%s%d", e ? "," : "", player_data[i].dr_humanEnemies[e]);
    printf("]}");
  }
  printf("]}");
}

static void run_scenario(const char *name, int useObjMap, PLY p0, int hasP1, PLY p1, const int *joy, int n) {
  reset_world();
  player_data[0] = p0;
  playerAndDroneCount = hasP1 ? 2 : 1;
  if (hasP1) player_data[1] = p1;
  printf("{\"name\":\"%s\",\"objmap\":%d,\"count\":%d,\"start\":", name, useObjMap, playerAndDroneCount);
  emit_state(&p0);
  printf(",\"other\":");
  if (hasP1)
    emit_state(&p1);
  else
    printf("null");
  printf(",\"joy\":[");
  for (int i = 0; i < n; i++) printf("%s%d", i ? "," : "", joy[i]);
  printf("],\"trace\":[");
  for (int t = 0; t < n; t++) {
    if (useObjMap) set_all_player();
    move_player(0, joy[t], 0);
    printf("%s", t ? "," : "");
    emit_pos(&player_data[0]);
  }
  printf("]}");
}

/* Combat scenario: player 0 acts per joy0; others stay idle. Each tick rebuilds
 * the object map then moves every player, dumping full state for both. */
static void run_combat(const char *name, int seed, int count, PLY p0, PLY p1, const int *joy0, int n) {
  reset_world();
  _random_seed = seed;
  we_dont_have_a_winner = count;
  for (int i = 0; i < PLAYER_MAX_TEAMS; i++) team_scores[i] = 0;
  player_data[0] = p0;
  if (count > 1) player_data[1] = p1;
  playerAndDroneCount = count;
  printf("{\"name\":\"%s\",\"seed\":%d,\"count\":%d,", name, seed, count);
  printf("\"config\":{\"reload\":%d,\"regen\":%d,\"revive\":%d,\"reviveLives\":%d,\"friendly\":%d,\"team\":%d},",
         reload_time, regen_time, revive_time, revive_lives, friendly_fire, team_flag);
  printf("\"start\":");
  emit_full(&p0);
  printf(",\"other\":");
  if (count > 1)
    emit_full(&p1);
  else
    printf("null");
  printf(",\"joy0\":[");
  for (int i = 0; i < n; i++) printf("%s%d", i ? "," : "", joy0[i]);
  printf("],\"trace\":[");
  for (int t = 0; t < n; t++) {
    set_all_player();
    for (int i = 0; i < count; i++) move_player(i, i == 0 ? joy0[t] : 0, 0);
    printf("%s{\"p0\":", t ? "," : "");
    emit_full(&player_data[0]);
    printf(",\"p1\":");
    if (count > 1)
      emit_full(&player_data[1]);
    else
      printf("null");
    printf("}");
  }
  printf("]}");
}

/* Full game tick (maingame.c loop body): rebuild object map, reset hit flags,
 * move every player from a rotating start index with the winner early-break. */
static void run_match(const char *name, int seed, int count, const int *joy, int ticks) {
  reset_world();
  _random_seed = seed;
  init_all_player(count, 0);
  int playerIndex = 0;
  printf("{\"name\":\"%s\",\"seed\":%d,\"count\":%d,\"ticks\":%d,", name, seed, count, ticks);
  printf("\"config\":{\"reload\":%d,\"regen\":%d,\"revive\":%d,\"reviveLives\":%d,\"friendly\":%d,\"team\":%d},",
         reload_time, regen_time, revive_time, revive_lives, friendly_fire, team_flag);
  printf("\"joy\":[");
  for (int i = 0; i < count * ticks; i++) printf("%s%d", i ? "," : "", joy[i]);
  printf("],\"trace\":[");
  for (int t = 0; t < ticks; t++) {
    set_all_player();
    for (int i = 0; i < count; i++) player_data[i].ply_hitflag = 0;
    int i = playerIndex;
    do {
      move_player(i, joy[t * count + i], 0);
      if (!we_dont_have_a_winner) break;
      if (--i < 0) i = count - 1;
    } while (i != playerIndex);
    if (++playerIndex == count) playerIndex = 0;
    printf("%s[", t ? "," : "");
    for (int i = 0; i < count; i++) {
      printf("%s", i ? "," : "");
      emit_full(&player_data[i]);
    }
    printf("]");
  }
  printf("]}");
}

/* ===== renderer render-list (draw3d.c, drawwall.c, makelist.c, makedraw.c) =====
 * Builds the wall draw-list for a viewpoint. Sprites (draw_mazes_set_object) are
 * stubbed — they belong to EPIC-07. Rasterization (draw_wall/draw_list) is EPIC-06
 * STORY-03. Viewport globals are colour-mode constants. */
short viewscreen_hcenter = 80, viewscreen_halfwidth = 80;
short viewscreen_sky_height = 50, viewscreen_floor_height = 50, viewscreen_cell_pixels = 20;

#define DRAW_TYPE_WALL 1
#define DRAW_TYPE_PLAYER 2
#define DRAW_TYPE_SHOT 3

static short draw_elem_count;
static struct {
  int type, sprite_wallcolor, x, h_shadowOffset, x2_size, h2_color;
} draw_elem_list[100];
void clear_draw_list(void) { draw_elem_count = 0; }
void to_draw_list(int type, int sprite_wallcolor, int x, int h_shadowOffset, int x2_size, int h2_color) {
  draw_elem_list[draw_elem_count].type = type;
  draw_elem_list[draw_elem_count].sprite_wallcolor = sprite_wallcolor;
  draw_elem_list[draw_elem_count].x = x;
  draw_elem_list[draw_elem_count].h_shadowOffset = h_shadowOffset;
  draw_elem_list[draw_elem_count].x2_size = x2_size;
  draw_elem_list[draw_elem_count].h2_color = h2_color;
  draw_elem_count++;
}

static short table_size;
static struct {
  short xleft, xright;
} table_list[20];
static int objecttable_search(int x1, int startIndex, int *pFoundFlag);
static void objecttable_shift_table(int lowerIndex, int upperIndex);
void objecttable_clear(void) { table_size = 0; }
int objecttable_check_if_hidden(int xleft, int xright) {
  int fullWidth = viewscreen_hcenter + viewscreen_halfwidth - 1, ret, i;
  if (xright < 0) return TRUE;
  if (xleft > fullWidth) return TRUE;
  if (xleft < 0) xleft = 0;
  if (xright > fullWidth) xright = fullWidth;
  ret = FALSE;
  for (i = 0; i < table_size; i++)
    if (table_list[i].xleft <= xleft && table_list[i].xright >= xright) {
      ret = TRUE;
      break;
    }
  return ret;
}
int objecttable_check_view_fully_covered(void) {
  return table_size == 1 && table_list[0].xleft == 0 &&
         viewscreen_hcenter + viewscreen_halfwidth == table_list[0].xright;
}
void objecttable_add(int xleft, int xright) {
  int newxright, newxleft, foundxrightFlag, foundxleftFlag, xrightIndex, xleftIndex;
  xleftIndex = objecttable_search(xleft, 0, &foundxleftFlag);
  xrightIndex = objecttable_search(xright, xleftIndex, &foundxrightFlag);
  newxleft = foundxleftFlag ? table_list[xleftIndex].xleft : xleft;
  if (foundxrightFlag) {
    newxright = table_list[xrightIndex].xright;
    objecttable_shift_table(xleftIndex, xrightIndex - 1);
  } else {
    newxright = xright;
    objecttable_shift_table(xleftIndex + 1, xrightIndex - 1);
  }
  table_list[xleftIndex].xleft = newxleft;
  table_list[xleftIndex].xright = newxright;
}
int objecttable_search(int x1, int startIndex, int *pFoundFlag) {
  int i;
  *pFoundFlag = FALSE;
  for (i = startIndex; i < table_size; i++) {
    if (table_list[i].xleft > x1) break;
    if (table_list[i].xright >= x1) {
      *pFoundFlag = TRUE;
      break;
    }
  }
  return i;
}
void objecttable_shift_table(int lowerIndex, int upperIndex) {
  int width = upperIndex - lowerIndex + 1;
  if (width > 0) {
    upperIndex++;
    while (upperIndex < table_size) {
      table_list[lowerIndex].xleft = table_list[upperIndex].xleft;
      table_list[lowerIndex++].xright = table_list[upperIndex++].xright;
    }
    table_size = lowerIndex;
  } else {
    if (width >= 0) return;
    for (upperIndex = table_size; upperIndex >= lowerIndex; upperIndex--) {
      table_list[upperIndex].xleft = table_list[upperIndex - 1].xleft;
      table_list[upperIndex].xright = table_list[upperIndex - 1].xright;
    }
    table_size++;
  }
}
int objecttable_set_wall(int x1, int h1, int x2, int h2, int color, int leftRightFlag) {
  int xright, xleft;
  if (x1 <= x2) {
    xleft = x1;
    xright = x2;
  } else {
    xleft = x2;
    xright = x1;
  }
  if (leftRightFlag) {
    if (objecttable_check_if_hidden(0, xright)) return YES;
  } else {
    if (objecttable_check_if_hidden(xleft, viewscreen_hcenter + viewscreen_halfwidth)) return YES;
  }
  if (!objecttable_check_if_hidden(xleft, xright)) {
    objecttable_add(xleft, xright);
    to_draw_list(DRAW_TYPE_WALL, color, x1, h1, x2, h2);
  }
  return NO;
}

static int draw_mazes_wall_intersection(int y1, int x1, int y2, int x2, int slope, int *py, int *px) {
  register int divisor, diff, deltaY, deltaX;
  deltaY = y1 - y2;
  deltaX = x2 - x1;
  divisor = y1 * deltaX + x1 * deltaY;
  if (slope == 1) {
    diff = deltaX;
    if (diff += deltaY) {
      *py = *px = divisor / diff;
      return YES;
    }
  } else if (slope == -1) {
    diff = deltaY;
    if (diff -= deltaX) {
      *py = -(*px = divisor / diff);
      return YES;
    }
  } else {
    if (deltaX) {
      *py = divisor / deltaX;
      return YES;
    }
  }
  return NO;
}
static int draw_mazes_check_order(int y1, int x1, int y2, int x2, int y3, int x3) {
  int xCoordOkFlag, yCoordOkFlag;
  yCoordOkFlag = (y1 <= y3) ? (y1 <= y2 && y2 <= y3) : (y3 <= y2 && y2 <= y1);
  xCoordOkFlag = (x1 <= x3) ? (x1 <= x2 && x2 <= x3) : (x3 <= x2 && x2 <= x1);
  return yCoordOkFlag && xCoordOkFlag;
}
int draw_mazes_clip_wall(int *py1, int *px1, int *py2, int *px2) {
  int tmp, x, y, xy2InViewFlag, xy1InViewFlag;
  xy1InViewFlag = (*px1 >= 0) ? *py1 < -(*px1) : *py1 < *px1;
  xy2InViewFlag = (*px2 >= 0) ? *py2 < -(*px2) : *py2 < *px2;
  if (xy1InViewFlag && xy2InViewFlag) return YES;
  if (!xy1InViewFlag && !xy2InViewFlag) {
    if (*px1 * *px2 >= 0) return NO;
    if (draw_mazes_wall_intersection(*py1, *px1, *py2, *px2, 0, &y, &x)) {
      if (y >= 0) return NO;
      if (*px1 > *px2) {
        tmp = *py1; *py1 = *py2; *py2 = tmp;
        tmp = *px1; *px1 = *px2; *px2 = tmp;
      }
      if (draw_mazes_wall_intersection(*py1, *px1, *py2, *px2, 1, &y, &x)) {
        *py1 = y;
        *px1 = x;
      }
      if (draw_mazes_wall_intersection(*py1, *px1, *py2, *px2, -1, &y, &x)) {
        *py2 = y;
        *px2 = x;
      }
      return YES;
    }
    return NO;
  }
  if (xy2InViewFlag) {
    tmp = *py1; *py1 = *py2; *py2 = tmp;
    tmp = *px1; *px1 = *px2; *px2 = tmp;
  }
  if (draw_mazes_wall_intersection(*py1, *px1, *py2, *px2, 1, &y, &x) &&
      draw_mazes_check_order(*py1, *px1, y, x, *py2, *px2)) {
    *py2 = y;
    *px2 = x;
  }
  if (draw_mazes_wall_intersection(*py1, *px1, *py2, *px2, -1, &y, &x) &&
      draw_mazes_check_order(*py1, *px1, y, x, *py2, *px2)) {
    *py2 = y;
    *px2 = x;
  }
  return YES;
}

static XY_SPEED_TABLE viewmatrix_delta[9][17];
void draw_maze_calc_viewmatrix(int microY, int microX, int minYOffset, int minXOffset, int maxYOffset,
                               int maxXOffset, int isFlipped, int dir) {
  register int i, j, j2, k;
  int maxXDelta, maxYDelta, minXDelta, minYDelta;
  viewmatrix_delta[0][0].deltaY = minYDelta = minYOffset - microY;
  viewmatrix_delta[0][0].deltaX = minXDelta = minXOffset - microX;
  viewmatrix_delta[8][16].deltaY = maxYDelta = maxYOffset - microY;
  viewmatrix_delta[8][16].deltaX = maxXDelta = maxXOffset - microX;
  if (!isFlipped) {
    viewmatrix_delta[8][0].deltaY = maxYDelta;
    viewmatrix_delta[8][0].deltaX = minXDelta;
    viewmatrix_delta[0][16].deltaY = minYDelta;
    viewmatrix_delta[0][16].deltaX = maxXDelta;
  } else {
    viewmatrix_delta[8][0].deltaY = minYDelta;
    viewmatrix_delta[8][0].deltaX = maxXDelta;
    viewmatrix_delta[0][16].deltaY = maxYDelta;
    viewmatrix_delta[0][16].deltaX = minXDelta;
  }
  rotate2d(&viewmatrix_delta[0][0].deltaY, &viewmatrix_delta[0][0].deltaX, dir);
  rotate2d(&viewmatrix_delta[8][0].deltaY, &viewmatrix_delta[8][0].deltaX, dir);
  rotate2d(&viewmatrix_delta[0][16].deltaY, &viewmatrix_delta[0][16].deltaX, dir);
  rotate2d(&viewmatrix_delta[8][16].deltaY, &viewmatrix_delta[8][16].deltaX, dir);
  for (i = 8; i; i >>= 1)
    for (j = i; j < 16; j += i + i) {
      viewmatrix_delta[0][j].deltaY = (viewmatrix_delta[0][j - i].deltaY + viewmatrix_delta[0][j + i].deltaY) >> 1;
      viewmatrix_delta[0][j].deltaX = (viewmatrix_delta[0][j - i].deltaX + viewmatrix_delta[0][j + i].deltaX) >> 1;
      viewmatrix_delta[8][j].deltaY = (viewmatrix_delta[8][j - i].deltaY + viewmatrix_delta[8][j + i].deltaY) >> 1;
      viewmatrix_delta[8][j].deltaX = (viewmatrix_delta[8][j - i].deltaX + viewmatrix_delta[8][j + i].deltaX) >> 1;
    }
  for (j = 0; j <= 16; j++)
    for (j2 = 4; j2; j2 >>= 1)
      for (k = j2; k < 8; k += j2 + j2) {
        viewmatrix_delta[k][j].deltaY = (viewmatrix_delta[k - j2][j].deltaY + viewmatrix_delta[k + j2][j].deltaY) >> 1;
        viewmatrix_delta[k][j].deltaX = (viewmatrix_delta[k - j2][j].deltaX + viewmatrix_delta[k + j2][j].deltaX) >> 1;
      }
}
int draw_mazes_set_wall(int y1p, int x1p, int y2p, int x2p, int color, int leftRightFlag) {
  int x2, y2, x1, y1;
  y1 = viewmatrix_delta[y1p][x1p].deltaY;
  x1 = viewmatrix_delta[y1p][x1p].deltaX;
  y2 = viewmatrix_delta[y2p][x2p].deltaY;
  x2 = viewmatrix_delta[y2p][x2p].deltaX;
  if (draw_mazes_clip_wall(&y1, &x1, &y2, &x2)) {
    calc_yx_to_xh(&y1, &x1);
    calc_yx_to_xh(&y2, &x2);
    return objecttable_set_wall(y1, x1, y2, x2, color, leftRightFlag);
  }
  return YES;
}
/* maze_set.c: add player/shot sprites in a cell to the draw list */
short screen_rez = 0; /* colour mode */
short viewposition_direction, viewposition_y, viewposition_x;
void draw_mazes_set_object(int cellFY, int cellFX, int flip) {
  struct {
    int distance, xOffset, player;
  } objects[10];
  int j, i, nextObject, objCount, player, spriteID, x, y, size, xOffset, distance;
  objCount = 0;
  for (player = get_maze_data(cellFY, cellFX, flip); player != MAZE_FIELD_EMPTY; player = nextObject) {
    if (player < PLAYER_MAX_COUNT) {
      y = player_data[player].ply_y;
      x = player_data[player].ply_x;
      nextObject = player_data[player].ply_plist;
    } else {
      nextObject = player - PLAYER_MAX_COUNT;
      y = player_data[nextObject].ply_shooty;
      x = player_data[nextObject].ply_shootx;
      nextObject = player_data[nextObject].ply_slist;
    }
    distance = y - viewposition_y;
    xOffset = x - viewposition_x;
    rotate2d(&distance, &xOffset, viewposition_direction);
    objects[objCount].distance = distance;
    objects[objCount].xOffset = xOffset;
    objects[objCount].player = player;
    if (++objCount >= (int)(sizeof(objects) / sizeof(objects[0]))) break;
  }
  for (i = objCount - 1; i > 0; i--)
    for (j = 0; j < i; j++) {
      if (objects[j].distance <= objects[j + 1].distance) continue;
      nextObject = objects[j].distance; objects[j].distance = objects[j + 1].distance; objects[j + 1].distance = nextObject;
      nextObject = objects[j].xOffset; objects[j].xOffset = objects[j + 1].xOffset; objects[j + 1].xOffset = nextObject;
      nextObject = objects[j].player; objects[j].player = objects[j + 1].player; objects[j + 1].player = nextObject;
    }
  while (objCount > 0) {
    objCount--;
    player = objects[objCount].player;
    distance = objects[objCount].distance;
    xOffset = objects[objCount].xOffset;
    if (player < PLAYER_MAX_COUNT) {
      if (player != own_number && distance < 0) {
        if ((size = -4000 / distance) < 1) size = 1;
        if (size > 32) size = 32;
        if (screen_rez) size <<= 1;
        y = viewscreen_hcenter - muls_divs(xOffset, viewscreen_halfwidth, distance);
        if (!objecttable_check_if_hidden(y - size, y + size - 1)) {
          static const short face_shape_tab[32] = {0,  19, 18, 17, 16, 15, 14, 13, 12, 11, 10,
                                                   10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10,
                                                   9,  8,  7,  6,  5,  4,  3,  2,  1,  0};
          spriteID = (player_data[player].ply_dir - 128 - viewposition_direction) + (xOffset * 32) / distance;
          spriteID = face_shape_tab[(spriteID >> 3) & 0x1f];
          x = viewscreen_sky_height + 1 - (viewscreen_cell_pixels * MAZE_CELL_SIZE) / distance;
          to_draw_list(DRAW_TYPE_PLAYER, spriteID, y - size, x, size,
                       player_data[player].ply_hitflag ? player_data[player].ply_gunman : player);
        }
      }
    } else {
      player -= PLAYER_MAX_COUNT;
      distance = player_data[player].ply_shooty - viewposition_y;
      xOffset = player_data[player].ply_shootx - viewposition_x;
      rotate2d(&distance, &xOffset, viewposition_direction);
      if (distance < 0 && ((xOffset >= 0 && -distance >= xOffset) || (xOffset < 0 && distance <= xOffset))) {
        if ((size = -1000 / distance) == 0) size = 1;
        if (size > 32) size = 32;
        if (screen_rez) size <<= 1;
        y = viewscreen_hcenter - muls_divs(xOffset, viewscreen_halfwidth, distance);
        x = viewscreen_sky_height + 1 - (viewscreen_cell_pixels * MAZE_CELL_SIZE) / distance;
        if (!objecttable_check_if_hidden(y - size, y + size - 1)) {
          to_draw_list(DRAW_TYPE_SHOT, 0, y - size, x, size, player);
        }
      }
    }
  }
}

static struct {
  int minY, minX, maxY, maxX, fieldOffsetY, fieldOffsetX, flipped;
} dir_table[8] = {
    {-7, -7, 1, 9, -1, 1, 0},  {8, 8, -8, 0, 1, -1, 1}, {-7, 8, 9, 0, 1, 1, 1},  {8, -7, 0, 9, 1, 1, 0},
    {8, 8, 0, -8, 1, -1, 0},   {-7, -7, 9, 1, -1, 1, 1}, {8, -7, -8, 1, -1, -1, 1}, {-7, 8, 1, -8, -1, -1, 0},
};
void init_dirtable(void) {
  for (int i = 0; i < 8; i++) {
    dir_table[i].minY *= MAZE_CELL_SIZE;
    dir_table[i].minX *= MAZE_CELL_SIZE;
    dir_table[i].maxY *= MAZE_CELL_SIZE;
    dir_table[i].maxX *= MAZE_CELL_SIZE;
  }
}
void draw_maze_generate_renderlist(int y, int x, int fieldOffsetY, int fieldOffsetX, int flip, int leftRightFlag) {
  register int viewingWidth, viewingDistance, fieldFX, fieldFY;
  int fieldX, fieldY, _fieldX, _fieldY;
  objecttable_clear();
  clear_draw_list();
  _fieldY = (y >> MAZE_FIELD_SHIFT) | 1;
  _fieldX = (x >> MAZE_FIELD_SHIFT) | 1;
  if (!flip) {
    fieldY = _fieldY;
    fieldX = _fieldX;
  } else {
    fieldY = _fieldX;
    fieldX = _fieldY;
  }
  fieldFY = fieldY;
  for (viewingDistance = 7; viewingDistance >= 0; viewingDistance--) {
    viewingWidth = 7;
    fieldFX = fieldX;
    do {
      draw_mazes_set_object(fieldFY, fieldFX, flip);
      fieldFX -= fieldOffsetX;
      if (get_maze_data(fieldFY, fieldFX, flip) == MAZE_FIELD_WALL)
        if (draw_mazes_set_wall(viewingDistance, viewingWidth, viewingDistance + 1, viewingWidth, flip, leftRightFlag ^ 1))
          break;
      if (objecttable_check_view_fully_covered()) break;
      fieldFX -= fieldOffsetX;
    } while (--viewingWidth >= 0);
    viewingWidth = 8;
    fieldFX = fieldX;
    fieldFX += fieldOffsetX;
    do {
      if (get_maze_data(fieldFY, fieldFX, flip) == MAZE_FIELD_WALL)
        if (draw_mazes_set_wall(viewingDistance, viewingWidth, viewingDistance + 1, viewingWidth, flip, leftRightFlag))
          break;
      if (objecttable_check_view_fully_covered()) break;
      if (viewingWidth == 16) break;
      fieldFX += fieldOffsetX;
      draw_mazes_set_object(fieldFY, fieldFX, flip);
      fieldFX += fieldOffsetX;
      viewingWidth++;
    } while (1);
    fieldFY += fieldOffsetY;
    fieldFX = fieldX;
    for (viewingWidth = 7; viewingWidth >= 0; viewingWidth--) {
      if (get_maze_data(fieldFY, fieldFX, flip) == MAZE_FIELD_WALL)
        if (draw_mazes_set_wall(viewingDistance, viewingWidth, viewingDistance, viewingWidth + 1, flip ^ 1, leftRightFlag ^ 1))
          break;
      if (objecttable_check_view_fully_covered()) break;
      fieldFX -= fieldOffsetX + fieldOffsetX;
    }
    fieldFX = fieldX;
    fieldFX += fieldOffsetX;
    fieldFX += fieldOffsetX;
    for (viewingWidth = 8; viewingWidth < 16; viewingWidth++) {
      if (get_maze_data(fieldFY, fieldFX, flip) == MAZE_FIELD_WALL)
        if (draw_mazes_set_wall(viewingDistance, viewingWidth, viewingDistance, viewingWidth + 1, flip ^ 1, leftRightFlag))
          break;
      if (objecttable_check_view_fully_covered()) break;
      fieldFX += fieldOffsetX + fieldOffsetX;
    }
    fieldFY += fieldOffsetY;
    if (objecttable_check_view_fully_covered()) break;
  }
}
void make_draw_list(int y, int x, int dir) {
  int compassDir;
  viewposition_y = y;
  viewposition_x = x;
  viewposition_direction = dir;
  compassDir = (dir >> 5) & 7;
  draw_maze_calc_viewmatrix(y & (MAZE_CELL_SIZE - 1), x & (MAZE_CELL_SIZE - 1), dir_table[compassDir].minY,
                            dir_table[compassDir].minX, dir_table[compassDir].maxY, dir_table[compassDir].maxX,
                            dir_table[compassDir].flipped, dir);
  set_all_player();
  draw_maze_generate_renderlist(y, x, dir_table[compassDir].fieldOffsetY, dir_table[compassDir].fieldOffsetX,
                                dir_table[compassDir].flipped, compassDir & 1);
}
static void run_view(const char *name, int y, int x, int dir, int ownNum, int count, const PLY *players) {
  reset_world();
  own_number = ownNum;
  playerAndDroneCount = count;
  for (int i = 0; i < count; i++) player_data[i] = players[i];
  make_draw_list(y, x, dir);
  own_number = -1;
  printf("{\"name\":\"%s\",\"y\":%d,\"x\":%d,\"dir\":%d,\"own\":%d,\"count\":%d,\"players\":[", name, y, x,
         dir, ownNum, count);
  for (int i = 0; i < count; i++)
    printf("%s{\"y\":%d,\"x\":%d,\"dir\":%d,\"lives\":%d}", i ? "," : "", players[i].ply_y,
           players[i].ply_x, players[i].ply_dir, players[i].ply_lives);
  printf("],\"elems\":[");
  for (int i = 0; i < draw_elem_count; i++)
    printf("%s{\"t\":%d,\"a\":%d,\"b\":%d,\"c\":%d,\"d\":%d,\"e\":%d}", i ? "," : "",
           draw_elem_list[i].type, draw_elem_list[i].sprite_wallcolor, draw_elem_list[i].x,
           draw_elem_list[i].h_shadowOffset, draw_elem_list[i].x2_size, draw_elem_list[i].h2_color);
  printf("]}");
}

int main(void) {
  init_dirtable();
  for (int i = 0; i < 65; i++) sine_table[i] = (short)(sin((double)i / 256.0 * 2.0 * M_PI) * 256.0);
  calc_sin_table();
  calc_drone_angle_table();

  printf("{\n");
  printf("  \"playerMotionSpeed\": %d,\n", PLAYER_MOTION_SPEED);

  printf("  \"droneAngleTable\": [");
  for (int i = 0; i <= 32; i++) printf("%s%d", i ? "," : "", drone_angle_table[i]);
  printf("],\n");

  printf("  \"sine\": [");
  for (int i = 0; i < 65; i++) printf("%s%d", i ? "," : "", sine_table[i]);
  printf("],\n");

  short A[] = {7, -7, 7, -7, 255, 256, 32767, -32768, 5, 100, -100, 181};
  short B[] = {3, 3, -3, -3, 255, 181, 2, 1, 5, 100, 100, 256};
  short C[] = {2, 2, 2, 2, 256, 256, 3, 1, 256, 256, 256, 256};
  int n = sizeof(A) / sizeof(A[0]);
  printf("  \"mulsDivs\": [");
  for (int i = 0; i < n; i++)
    printf("%s{\"a\":%d,\"b\":%d,\"c\":%d,\"r\":%d}", i ? "," : "", A[i], B[i], C[i],
           muls_divs(A[i], B[i], C[i]));
  printf(",{\"a\":123,\"b\":7,\"c\":0,\"r\":%d}", muls_divs(123, 7, 0));
  printf("],\n");

  printf("  \"fastSin256\": [");
  for (int a = 0; a < 256; a++) printf("%s%d", a ? "," : "", fast_sin(256, a));
  printf("],\n");
  printf("  \"fastCos256\": [");
  for (int a = 0; a < 256; a++) printf("%s%d", a ? "," : "", fast_cos(256, a));
  printf("],\n");

  int factors[] = {32, 100, -100, 1000, -32};
  printf("  \"fastSinFactors\": [");
  int first = 1;
  for (int fi = 0; fi < 5; fi++)
    for (int a = 0; a < 256; a += 17) {
      printf("%s{\"factor\":%d,\"angle\":%d,\"v\":%d}", first ? "" : ",", factors[fi], a,
             fast_sin(factors[fi], a));
      first = 0;
    }
  printf("],\n");

  int rx[] = {100, 200, -150, 32, 0, 16384};
  int ry[] = {0, 50, 75, -32, 100, 16384};
  int rang[] = {0, 32, 64, 96, 128, 200};
  printf("  \"rotate\": [");
  for (int i = 0; i < 6; i++) {
    int x = rx[i], y = ry[i];
    rotate2d(&x, &y, rang[i]);
    printf("%s{\"x\":%d,\"y\":%d,\"angle\":%d,\"rx\":%d,\"ry\":%d}", i ? "," : "", rx[i], ry[i],
           rang[i], x, y);
  }
  printf("],\n");

  int projY[] = {-256, -256, -256, -512, -1024, -128, -2048, -200, -50};
  int projX[] = {0, 128, -128, 256, -512, 64, 1024, 50, 10};
  printf("  \"projection\": [");
  for (int i = 0; i < 9; i++) {
    int yy = projY[i], xx = projX[i];
    calc_yx_to_xh(&yy, &xx);
    printf("%s{\"y\":%d,\"x\":%d,\"sx\":%d,\"h\":%d}", i ? "," : "", projY[i], projX[i], yy, xx);
  }
  printf("],\n");

  printf("  \"speedTable\": [");
  for (int angle = 0; angle < 256; angle++)
    printf("%s{\"deltaY\":%d,\"deltaX\":%d}", angle ? "," : "", xy_speed_table[angle].deltaY,
           xy_speed_table[angle].deltaX);
  printf("],\n");

  for (int i = 0; i < MAZE_MAX_SIZE * MAZE_MAX_SIZE; i++) maze_datas[i] = maze_fixture[i];
  maze_size = MAZE_FIXTURE_SIZE;
  _random_seed = PLACEMENT_SEED;
  init_all_player(PLACEMENT_COUNT, 0);
  printf("  \"placement\": {\"seed\":%d,\"count\":%d,\"maze\":\"%s\",\"players\":[", PLACEMENT_SEED,
         PLACEMENT_COUNT, MAZE_FIXTURE_NAME);
  for (int i = 0; i < PLACEMENT_COUNT; i++)
    printf("%s{\"y\":%d,\"x\":%d,\"dir\":%d}", i ? "," : "", player_data[i].ply_y,
           player_data[i].ply_x, player_data[i].ply_dir);
  printf("]},\n");

  /* movement scenarios on the shared maze (top corridor row 1 is fully open) */
  int joySpin[] = {JOYSTICK_LEFT, JOYSTICK_LEFT, JOYSTICK_RIGHT, JOYSTICK_RIGHT, JOYSTICK_RIGHT, 0, 0, 0};
  int joyFwd[] = {JOYSTICK_UP, JOYSTICK_UP, JOYSTICK_UP, JOYSTICK_UP, JOYSTICK_UP, JOYSTICK_UP, JOYSTICK_UP, JOYSTICK_UP};
  int joyColl[] = {JOYSTICK_UP, JOYSTICK_UP, JOYSTICK_UP, JOYSTICK_UP, JOYSTICK_UP, JOYSTICK_UP};
  PLY none = mk(0, 0, 0, 0);
  printf("  \"movement\": [");
  run_scenario("spin", 0, mk(128, 896, PLAYER_DIR_NORTH, 3), 0, none, joySpin, 8);
  printf(",");
  run_scenario("forward-east", 0, mk(128, 896, PLAYER_DIR_EAST, 3), 0, none, joyFwd, 8);
  printf(",");
  run_scenario("wall-north", 0, mk(128, 896, PLAYER_DIR_NORTH, 3), 0, none, joyFwd, 8);
  printf(",");
  run_scenario("collision-west", 1, mk(128, 384, PLAYER_DIR_WEST, 3), 1, mk(128, 128, PLAYER_DIR_EAST, 3), joyColl, 6);
  printf("],\n");

  /* combat scenarios (shot motion, hit/kill/score, respawn) on the shared maze */
  reload_time = 30;
  regen_time = 100;
  revive_time = 5;
  revive_lives = 2;
  friendly_fire = 0;
  team_flag = 0;
  int joyFire[24];
  joyFire[0] = JOYSTICK_BUTTON;
  for (int i = 1; i < 24; i++) joyFire[i] = 0;
  PLY noP1 = mk(0, 0, 0, 0);
  printf("  \"combat\": [");
  run_combat("shoot-wall", 0, 1, mk(128, 128, PLAYER_DIR_EAST, 3), noP1, joyFire, 20);
  printf(",");
  run_combat("shoot-hit", 0, 2, mk(128, 128, PLAYER_DIR_EAST, 3), mk(128, 1152, PLAYER_DIR_EAST, 3), joyFire, 16);
  printf(",");
  run_combat("kill-respawn", 777, 2, mk(128, 128, PLAYER_DIR_EAST, 3), mk(128, 1152, PLAYER_DIR_EAST, 1), joyFire, 24);
  printf("],\n");

  /* full-tick match: 3 players, placed by init_all_player, driven for 16 ticks */
  const int MN = 16, MC = 3;
  int matchJoy[16 * 3];
  for (int t = 0; t < MN; t++) {
    matchJoy[t * MC + 0] = (t == 0) ? (JOYSTICK_UP | JOYSTICK_BUTTON) : JOYSTICK_UP;
    matchJoy[t * MC + 1] = (t < 3) ? JOYSTICK_RIGHT : JOYSTICK_UP;
    matchJoy[t * MC + 2] = (t < 3) ? JOYSTICK_LEFT : JOYSTICK_UP;
  }
  printf("  \"match\": [");
  run_match("three-players", 4242, MC, matchJoy, MN);

  /* Fuzz: many randomized full-tick matches, replayed bit-for-bit by step.test.ts
   * (EPIC-17, C-02). A standalone LCG drives the joysticks so it never perturbs the
   * sim's _random_seed (placement + respawn); the bytes are emitted, so the TS side
   * just replays them. Seeds are fixed, so regeneration is byte-stable. Counts/seeds
   * are varied to exercise movement, collision, shooting, hit/kill/score and the
   * RNG-driven respawn across many random paths. */
  static const struct {
    int seed;
    int count;
    int ticks;
    int fireRate;
  } fuzz[] = {
    {1, 1, 48, 6},    {7, 2, 48, 5},     {13, 2, 60, 3},   {101, 3, 48, 4},
    {202, 3, 60, 8},  {303, 4, 48, 4},   {404, 4, 60, 6},  {555, 5, 48, 5},
    {616, 6, 48, 4},  {727, 6, 60, 7},   {838, 8, 40, 4},  {949, 8, 56, 8},
    {1234, 2, 64, 2}, {4321, 4, 64, 10}, {2718, 5, 56, 5}, {3142, 7, 48, 6},
  };
  /* direction choices, weighted toward forward motion so players travel and collide */
  static const int dirChoice[] = {
    JOYSTICK_UP,
    JOYSTICK_UP,
    JOYSTICK_UP,
    JOYSTICK_UP | JOYSTICK_LEFT,
    JOYSTICK_UP | JOYSTICK_RIGHT,
    JOYSTICK_LEFT,
    JOYSTICK_RIGHT,
    JOYSTICK_DOWN,
  };
  static int fuzzJoy[16 * 64];
  for (size_t f = 0; f < sizeof(fuzz) / sizeof(fuzz[0]); f++) {
    unsigned long lcg = (unsigned long)(fuzz[f].seed * 2654435761u) + 12345u;
    int c = fuzz[f].count, n = fuzz[f].ticks;
    for (int k = 0; k < c * n; k++) {
      lcg = lcg * 1103515245u + 12345u;
      int dir = dirChoice[(lcg >> 16) % (sizeof(dirChoice) / sizeof(dirChoice[0]))];
      lcg = lcg * 1103515245u + 12345u;
      int fire = ((int)((lcg >> 16) % 10) < fuzz[f].fireRate) ? JOYSTICK_BUTTON : 0;
      fuzzJoy[k] = dir | fire;
    }
    char nm[32];
    snprintf(nm, sizeof(nm), "fuzz-%02d-p%d", (int)f, c);
    printf(",");
    run_match(nm, fuzz[f].seed, c, fuzzJoy, n);
  }
  printf("],\n");

  /* render-list for sample viewpoints (walls only) + sprite scenes on the shared maze */
  PLY sv[3];
  printf("  \"renderlist\": [");
  run_view("north@1,7", 128, 896, PLAYER_DIR_NORTH, -1, 0, NULL);
  printf(",");
  run_view("north@7,7", 896, 896, PLAYER_DIR_NORTH, -1, 0, NULL);
  printf(",");
  run_view("east@1,7", 128, 896, PLAYER_DIR_EAST, -1, 0, NULL);
  printf(",");
  run_view("south@7,7", 896, 896, PLAYER_DIR_SOUTH, -1, 0, NULL);
  printf(",");
  run_view("ne@7,7", 896, 896, PLAYER_DIR_NORTHEAST, -1, 0, NULL);
  printf(",");
  run_view("sw@5,5", 640, 640, PLAYER_DIR_SOUTHWEST, -1, 0, NULL);
  printf(",");
  sv[0] = mk(128, 896, PLAYER_DIR_EAST, 3);
  sv[1] = mk(128, 1408, PLAYER_DIR_WEST, 3);
  run_view("sprite-ahead", 128, 896, PLAYER_DIR_EAST, 0, 2, sv);
  printf(",");
  sv[0] = mk(128, 384, PLAYER_DIR_EAST, 3);
  sv[1] = mk(128, 896, PLAYER_DIR_NORTH, 3);
  sv[2] = mk(128, 1408, PLAYER_DIR_WEST, 3);
  run_view("sprite-three", 128, 384, PLAYER_DIR_EAST, 0, 3, sv);
  printf("],\n");

  printf("  \"droneSetup\": [");
  {
    /* solo (non-team): 2 humans, 1 target + 2 standard + 1 ninja drone */
    run_drone_setup("solo-mixed", 2, 1, 2, 1, 0, NULL);
    printf(",");
    /* solo: 1 human, only target drones (no targets assigned) */
    run_drone_setup("solo-targets-only", 1, 3, 0, 0, 0, NULL);
    printf(",");
    /* solo: 3 humans, 2 standard drones (rotating target assignment) */
    run_drone_setup("solo-three-humans", 3, 0, 2, 0, 0, NULL);
    printf(",");
    /* team mode, two teams: humans on 0/1, drones split across teams */
    static const int t2[] = {0, 1, 0, 1, 0, 1};
    run_drone_setup("team-two", 2, 0, 2, 2, 1, t2);
    printf(",");
    /* team mode, single team: nobody has a target */
    static const int t1[] = {0, 0, 0, 0};
    run_drone_setup("team-single", 1, 1, 1, 1, 1, t1);
    printf(",");
    /* team mode, four teams with standard + ninja drones */
    static const int t4[] = {0, 1, 2, 3, 0, 1, 2, 3};
    run_drone_setup("team-four", 4, 0, 2, 2, 1, t4);
  }
  printf("],\n");

  printf("  \"droneTrace\": [");
  {
    /* 1 stationary human + 2 target drones — pure wander */
    run_drones("target-wander", 4242, 1, 2, 0, 0, NULL, 40);
    printf(",");
    /* 1 stationary human + 2 standard drones — search/lock/fire */
    run_drones("standard-hunt", 4242, 1, 0, 2, 0, NULL, 40);
    printf(",");
    /* 1 forward-moving human + 1 standard + 1 target drone */
    static int fwd[40];
    for (int i = 0; i < 40; i++) fwd[i] = JOYSTICK_UP;
    run_drones("standard-chase", 777, 1, 1, 1, 0, fwd, 40);
    printf(",");
    /* 2 stationary humans + 2 standard drones (different seed) */
    run_drones("standard-two-humans", 13, 2, 0, 2, 0, NULL, 40);
  }
  printf("],\n");

  printf("  \"ninjaTrace\": [");
  {
    /* 1 stationary human + 1 ninja — pathfinds toward the player (long run) */
    run_drones("ninja-hunt", 4242, 1, 0, 0, 1, NULL, 120);
    printf(",");
    /* 1 forward-moving human + 1 ninja — moving target, plan churn */
    static int nfwd[120];
    for (int i = 0; i < 120; i++) nfwd[i] = JOYSTICK_UP;
    run_drones("ninja-chase", 777, 1, 0, 0, 1, nfwd, 120);
    printf(",");
    /* 2 ninjas hunting 1 stationary human (different seed) */
    run_drones("ninja-pair", 31337, 1, 0, 0, 2, NULL, 120);
    printf(",");
    /* mixed: 1 target + 1 standard + 1 ninja vs 1 human turning in place */
    static int spin[120];
    for (int i = 0; i < 120; i++) spin[i] = (i % 8 < 4) ? JOYSTICK_RIGHT : 0;
    run_drones("ninja-mixed", 99, 1, 1, 1, 1, spin, 120);
  }
  printf("],\n");

  printf("  \"rng\": {\n    \"seed\": 12345,\n");
  _random_seed = 12345;
  printf("    \"random\": [");
  for (int i = 0; i < 32; i++) printf("%s%d", i ? "," : "", _random());
  printf("],\n");
  _random_seed = 12345;
  printf("    \"rnd14\": [");
  for (int i = 0; i < 32; i++) printf("%s%d", i ? "," : "", _rnd(14));
  printf("],\n");
  _random_seed = 12345;
  printf("    \"rnd256\": [");
  for (int i = 0; i < 8; i++) printf("%s%d", i ? "," : "", _rnd(256));
  printf("]\n  }\n}\n");
  return 0;
}
