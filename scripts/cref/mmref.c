/*
 * MIDI Maze reference harness (EPIC-04 STORY-01).
 *
 * Self-contained copy of the small, fully-specified integer primitives from the
 * original source (mulsdivs.c, fastmath.c, rnd.c, gamelogi.c:calc_sin_table),
 * compiled with the system cc so REAL C short/int/long semantics produce the
 * golden vectors our TypeScript must match bit-for-bit (C-02).
 *
 * The sine table is computed via libm `(short)(sin*256)` — proven equal to the
 * value extracted from MIDIMAZE.D8A (see src/assets.test.ts).
 *
 * Emits a JSON document on stdout. Regenerate with: npm run cref
 */
#include <stdio.h>
#include <math.h>

#define PLAYER_MOTION_SPEED 32

short sine_table[65];

/* mulsdivs.c: (a*b)/c with a 32-bit intermediate, 16-bit args + result. */
short muls_divs(short a, short b, short c) {
  if (c == 0) return a; /* BUGFIX_DIVISION_BY_ZERO */
  return (a * b) / c;
}

/* fastmath.c */
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

/* rnd.c */
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
