(function (root) {
  'use strict';
  const { TILE, COLS, ROWS, isSolid } = typeof module !== 'undefined' ? require('./tiles.js') : root.Tiles;

  // Outside the grid counts as open: that is how bodies walk out through door openings.
  const solidAt = (tiles, c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && isSolid(tiles[r * COLS + c]);

  function overlapsSolid(tiles, x, y, half) {
    const c0 = Math.floor((x - half) / TILE);
    const c1 = Math.floor((x + half - 1e-6) / TILE);
    const r0 = Math.floor((y - half) / TILE);
    const r1 = Math.floor((y + half - 1e-6) / TILE);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) if (solidAt(tiles, c, r)) return true;
    }
    return false;
  }

  // Moves an axis-aligned box ({x, y, half}) one axis at a time so it slides along walls.
  function moveBody(body, dx, dy, tiles) {
    if (dx) {
      body.x += dx;
      if (overlapsSolid(tiles, body.x, body.y, body.half)) {
        body.x = dx > 0
          ? Math.floor((body.x + body.half) / TILE) * TILE - body.half
          : (Math.floor((body.x - body.half) / TILE) + 1) * TILE + body.half;
      }
    }
    if (dy) {
      body.y += dy;
      if (overlapsSolid(tiles, body.x, body.y, body.half)) {
        body.y = dy > 0
          ? Math.floor((body.y + body.half) / TILE) * TILE - body.half
          : (Math.floor((body.y - body.half) / TILE) + 1) * TILE + body.half;
      }
    }
  }

  const api = { overlapsSolid, moveBody };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Physics = api;
})(this);
