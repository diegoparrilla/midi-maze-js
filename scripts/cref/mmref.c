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
} PLY;
PLY player_data[PLAYER_MAX_COUNT];
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
/* sprites are EPIC-07 */
static void draw_mazes_set_object(int fieldY, int fieldX, int flip) {
  (void)fieldY;
  (void)fieldX;
  (void)flip;
}

static struct {
  int minY, minX, maxY, maxX, fieldOffsetY, fieldOffsetX, flipped;
} dir_table[8] = {
    {-7, -7, 1, 9, -1, 1, 0},  {8, 8, -8, 0, 1, -1, 1}, {-7, 8, 9, 0, 1, 1, 1},  {8, -7, 0, 9, 1, 1, 0},
    {8, 8, 0, -8, 1, -1, 0},   {-7, -7, 9, 1, -1, 1, 1}, {8, -7, -8, 1, -1, -1, 1}, {-7, 8, 1, -8, -1, -1, 0},
};
short viewposition_direction, viewposition_y, viewposition_x;
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
static void run_view(const char *name, int y, int x, int dir) {
  reset_world();
  playerAndDroneCount = 0;
  make_draw_list(y, x, dir);
  printf("{\"name\":\"%s\",\"y\":%d,\"x\":%d,\"dir\":%d,\"walls\":[", name, y, x, dir);
  int first = 1;
  for (int i = 0; i < draw_elem_count; i++) {
    if (draw_elem_list[i].type != DRAW_TYPE_WALL) continue;
    printf("%s{\"color\":%d,\"x1\":%d,\"h1\":%d,\"x2\":%d,\"h2\":%d}", first ? "" : ",",
           draw_elem_list[i].sprite_wallcolor, draw_elem_list[i].x, draw_elem_list[i].h_shadowOffset,
           draw_elem_list[i].x2_size, draw_elem_list[i].h2_color);
    first = 0;
  }
  printf("]}");
}

int main(void) {
  init_dirtable();
  for (int i = 0; i < 65; i++) sine_table[i] = (short)(sin((double)i / 256.0 * 2.0 * M_PI) * 256.0);
  calc_sin_table();

  printf("{\n");
  printf("  \"playerMotionSpeed\": %d,\n", PLAYER_MOTION_SPEED);

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
  printf("],\n");

  /* render-list (wall draw-list) for sample viewpoints on the shared maze */
  printf("  \"renderlist\": [");
  run_view("north@1,7", 128, 896, PLAYER_DIR_NORTH);
  printf(",");
  run_view("north@7,7", 896, 896, PLAYER_DIR_NORTH);
  printf(",");
  run_view("east@1,7", 128, 896, PLAYER_DIR_EAST);
  printf(",");
  run_view("south@7,7", 896, 896, PLAYER_DIR_SOUTH);
  printf(",");
  run_view("ne@7,7", 896, 896, PLAYER_DIR_NORTHEAST);
  printf(",");
  run_view("sw@5,5", 640, 640, PLAYER_DIR_SOUTHWEST);
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
