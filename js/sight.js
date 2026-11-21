(function (root) {
  'use strict';
  const { TILE, COLS, ROWS, isOpaque } = typeof module !== 'undefined' ? require('./tiles.js') : root.Tiles;

  const SAMPLE_STEP = 2;

  function hasLineOfSight(tiles, x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.ceil(Math.hypot(dx, dy) / SAMPLE_STEP);
    for (let i = 1; i < steps; i++) {
      const c = Math.floor((x0 + (dx * i) / steps) / TILE);
      const r = Math.floor((y0 + (dy * i) / steps) / TILE);
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
      if (isOpaque(tiles[r * COLS + c])) return false;
    }
    return true;
  }

  // (fx, fy) is a unit facing vector; fovDeg is the full cone width.
  function inCone(fx, fy, dx, dy, fovDeg) {
    const len = Math.hypot(dx, dy);
    if (len === 0) return true;
    return (fx * dx + fy * dy) / len >= Math.cos((fovDeg * Math.PI) / 360);
  }

  const api = { hasLineOfSight, inCone };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Sight = api;
})(this);
