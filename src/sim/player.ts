// Player/shot state (PLAYER_DATA, globals.h). Drone-AI-only fields (ninja path
// planning etc.) are added in EPIC-08; these are the gameplay fields the sim core
// reads and writes. All default to 0, matching the C global zero-initialisation.

export interface Player {
  ply_y: number; // Y coordinate, in 1/256-cell units
  ply_x: number; // X coordinate
  ply_dir: number; // facing 0..255
  ply_lives: number; // lives (negative when dead)
  ply_refresh: number; // revive/regenerate timer
  ply_hitflag: number; // hit by a shot this tick
  ply_reload: number; // reload timer
  ply_score: number; // kills (GAME_WIN_SCORE wins)
  ply_gunman: number; // index of who shot this player
  ply_looser: number; // index of the player this one last killed
  ply_team: number; // team 0..3
  dr_type: number; // 0 = human; DRONE_* for drones
  ply_plist: number; // next object in this cell's player list (-1 = end)
  ply_shooty: number; // shot Y
  ply_shootx: number; // shot X
  ply_shootr: number; // shot direction 0..255
  ply_shoot: number; // shot active (!= 0)
  ply_slist: number; // next object in this cell's shot list (-1 = end)
}

export function createPlayer(): Player {
  return {
    ply_y: 0,
    ply_x: 0,
    ply_dir: 0,
    ply_lives: 0,
    ply_refresh: 0,
    ply_hitflag: 0,
    ply_reload: 0,
    ply_score: 0,
    ply_gunman: 0,
    ply_looser: 0,
    ply_team: 0,
    dr_type: 0,
    ply_plist: 0,
    ply_shooty: 0,
    ply_shootx: 0,
    ply_shootr: 0,
    ply_shoot: 0,
    ply_slist: 0,
  };
}
