(function (root) {
  'use strict';

  const TILE = 16;
  const COLS = 20;
  const ROWS = 14;

  const T = Object.freeze({
    FLOOR: 0, WALL: 1, DESK: 2, PARTITION: 3, PLANT: 4, TABLE: 5, GLASS: 6,
    RACK: 7, COUNTER: 8, COFFEE: 9, COOLER: 10, PRINTER: 11, SOFA: 12,
    FRIDGE: 13, BOSS_DESK: 14, HERO_DESK: 15, GUARD_DESK: 16, TURNSTILE: 17,
    STAIRS_DOWN: 18, STAIRS_UP: 19, EXIT: 20, PILLAR: 21,
  });

  const FLOOR_STYLE = Object.freeze({ CARPET: 0, CARPET_RED: 1, TILES: 2, RAISED: 3, MARBLE: 4, WOOD: 5 });

  const WALKABLE = new Set([T.FLOOR, T.STAIRS_DOWN, T.STAIRS_UP, T.EXIT]);
  // Low furniture and glass stop people but not their eyes.
  const OPAQUE = new Set([T.WALL, T.PARTITION, T.PLANT, T.RACK, T.FRIDGE, T.PILLAR]);

  const isSolid = (id) => !WALKABLE.has(id);
  const isOpaque = (id) => OPAQUE.has(id);

  const api = { TILE, COLS, ROWS, T, FLOOR_STYLE, isSolid, isOpaque };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Tiles = api;
})(this);
