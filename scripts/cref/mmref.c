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
#define PLAYER_DIR_EAST 0x40
#define PLAYER_DIR_SOUTH 0x80
#define PLAYER_DIR_WEST 0xc0
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

int main(void) {
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
