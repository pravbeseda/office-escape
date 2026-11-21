(function (root) {
  'use strict';
  const { COLS, ROWS, isSolid } = typeof module !== 'undefined' ? require('./tiles.js') : root.Tiles;

  const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  const index = (c, r) => r * COLS + c;
  const inBounds = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS;
  const isWalkable = (tiles, c, r) => inBounds(c, r) && !isSolid(tiles[index(c, r)]);

  // Breadth-first step counts from the sources; -1 marks unreachable tiles.
  function distanceMap(tiles, sources) {
    const dist = new Int16Array(COLS * ROWS).fill(-1);
    const queue = [];
    for (const { c, r } of sources) {
      if (!isWalkable(tiles, c, r) || dist[index(c, r)] === 0) continue;
      dist[index(c, r)] = 0;
      queue.push(index(c, r));
    }
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head];
      const c = i % COLS;
      const r = (i - c) / COLS;
      for (const [dc, dr] of STEPS) {
        const nc = c + dc;
        const nr = r + dr;
        if (!isWalkable(tiles, nc, nr) || dist[index(nc, nr)] !== -1) continue;
        dist[index(nc, nr)] = dist[i] + 1;
        queue.push(index(nc, nr));
      }
    }
    return dist;
  }

  // Shortest tile path from `from` to `to`, both ends included, or null.
  function findPath(tiles, from, to) {
    const dist = distanceMap(tiles, [to]);
    if (!inBounds(from.c, from.r) || dist[index(from.c, from.r)] < 0) return null;
    const path = [{ c: from.c, r: from.r }];
    let { c, r } = from;
    while (dist[index(c, r)] > 0) {
      const want = dist[index(c, r)] - 1;
      const step = STEPS.find(([dc, dr]) => inBounds(c + dc, r + dr) && dist[index(c + dc, r + dr)] === want);
      c += step[0];
      r += step[1];
      path.push({ c, r });
    }
    return path;
  }

  const api = { index, distanceMap, findPath };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Grid = api;
})(this);
