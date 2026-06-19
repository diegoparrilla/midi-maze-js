---
id: STORY-01
epic: EPIC-03
title: Extract .D8A assets (sine table, ball & face shapes, title screens)
status: todo
---

## Goal

The original sine table, ball/body shapes (24), and face images (20 rotations)
extracted from `MIDIMAZE.PD/MIDIMAZE.D8A` into committed, web-loadable asset files.

## Tasks

- [ ] Read `README/D8AFileFormat.md` and `read_d8a.py`; document the offsets used
- [ ] Export the sine table (first quarter, 65 words, `sin*256`) to a data file
- [ ] Export the 24 ball/body shapes (used for players *and* shots — no face)
- [ ] Export the 20 face images and the 32-entry direction→face index
- [ ] (Bonus) Export the colour title screen (needs `decomp.c` decompression)
- [ ] Place assets under `src/assets/` and record provenance/licence note

## Acceptance

**Automated:** a spec loads each asset and checks counts (65 sine words, 24 ball
shapes, 20 face images) and that the sine values match `round(sin(i/256*2π)*256)`.
**Manual (user):** open the extracted shapes and confirm the eyeball faces look
like the original.

## Notes

`.D8A` layout (`D8AFileFormat.md`): colour screen, mono screen, sine (65 words),
ball images (24 shapes, 1586 words), faces (20 × 1586 words). Sprite selection per
`drawshap.c`/`maze_set.c`: `face_shape_tab[32]`, body index 10 = back view (also
the shot). **No sounds live here** — see EPIC-21. Vendoring original data is
accepted (D-06); keep it isolated under `src/assets/`.
