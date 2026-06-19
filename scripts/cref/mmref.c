/*
 * MIDI Maze reference harness (EPIC-04 STORY-01/02).
 *
 * Self-contained copy of the small, fully-specified integer logic from the
 * original source (mulsdivs.c, fastmath.c, rnd.c, gamelogi.c:calc_sin_table,
 * maze_obj.c, setup.c), compiled with the system cc so REAL C short/int/long
 * semantics produce the golden vectors our TypeScript must match bit-for-bit
 * (C-02). The maze fixture + seed/count come from a generated header so the C
 * and TS share the exact same grid. Emits JSON on stdout. Run: npm run cref
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include "maze_fixture.h" /* generated: maze_fixture[4096], MAZE_FIXTURE_SIZE, PLACEMENT_SEED, PLACEMENT_COUNT */

#define MAZE_MAX_SIZE 64
#define MAZE_CELL_SIZE 256
#define MAZE_FIELD_SHIFT 7
#define MAZE_FIELD_EMPTY -1
#define MAZE_FIELD_WALL 1
#define PLAYER_MAX_COUNT 16
#define PLAYER_MAX_LIVES 3
#define PLAYER_MOTION_SPEED 32
#define PLAYER_DIR_NORTH 0x00
#define PLAYER_DIR_EAST 0x40
#define PLAYER_DIR_SOUTH 0x80
#define PLAYER_DIR_WEST 0xc0
#define TRUE 1
#define FALSE 0
#define YES 1
#define NO 0

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
  int ply_plist, ply_slist, dr_type;
} PLY;
PLY player_data[PLAYER_MAX_COUNT];
signed char maze_datas[MAZE_MAX_SIZE * MAZE_MAX_SIZE];
short maze_size;
int playerAndDroneCount, we_dont_have_a_winner, objekt_anz;
struct {
  short y, x, index;
} object_table[PLAYER_MAX_COUNT * 2];

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
    player_data[i].ply_reload = 0;
    player_data[i].ply_score = 0;
    player_data[i].ply_hitflag = FALSE;
  }
  return YES;
}

int main(void) {
  for (int i = 0; i < 65; i++) sine_table[i] = (short)(sin((double)i / 256.0 * 2.0 * M_PI) * 256.0);

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
  for (int angle = 0; angle < 256; angle++) {
    int y = -PLAYER_MOTION_SPEED, x = 0;
    rotate2d(&y, &x, -angle);
    printf("%s{\"deltaY\":%d,\"deltaX\":%d}", angle ? "," : "", y, x);
  }
  printf("],\n");

  /* --- placement: load the shared maze fixture, seed, and place players --- */
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
