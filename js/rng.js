(function (root) {
  'use strict';

  function hash(...values) {
    let h = 0x811c9dc5;
    for (const value of values) {
      h = Math.imul(h ^ (value | 0), 0x01000193);
      h ^= h >>> 15;
      h = Math.imul(h, 0x2c1b3c6d);
      h ^= h >>> 12;
    }
    return h >>> 0;
  }

  // mulberry32
  function makeRng(seed) {
    let state = seed >>> 0;
    const next = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      int: (min, max) => min + Math.floor(next() * (max - min + 1)),
      pick: (list) => list[Math.floor(next() * list.length)],
      chance: (p) => next() < p,
      weighted(weights) {
        const entries = Object.entries(weights).filter(([, w]) => w > 0);
        let roll = next() * entries.reduce((sum, [, w]) => sum + w, 0);
        for (const [key, w] of entries) {
          roll -= w;
          if (roll < 0) return key;
        }
        return entries[entries.length - 1][0];
      },
    };
  }

  const api = { hash, makeRng };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Rng = api;
})(this);
