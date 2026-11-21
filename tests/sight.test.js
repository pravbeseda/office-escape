const test = require('node:test');
const assert = require('node:assert/strict');
const { hasLineOfSight, inCone } = require('../js/sight.js');
const { TILE, COLS, ROWS, T } = require('../js/tiles.js');

const center = (c) => c * TILE + TILE / 2;

function roomWith(id) {
  const tiles = new Uint8Array(COLS * ROWS).fill(T.FLOOR);
  if (id !== undefined) tiles[7 * COLS + 10] = id;
  return tiles;
}

test('an empty room has a clear line of sight', () => {
  assert.ok(hasLineOfSight(roomWith(), center(3), center(7), center(16), center(7)));
});

test('walls, partitions, plants and racks block sight', () => {
  for (const id of [T.WALL, T.PARTITION, T.PLANT, T.RACK]) {
    assert.equal(hasLineOfSight(roomWith(id), center(3), center(7), center(16), center(7)), false);
  }
});

test('glass and desks do not block sight', () => {
  for (const id of [T.GLASS, T.DESK, T.TABLE]) {
    assert.ok(hasLineOfSight(roomWith(id), center(3), center(7), center(16), center(7)));
  }
});

test('the view cone sees ahead and misses behind', () => {
  assert.ok(inCone(1, 0, 10, 2, 110));
  assert.equal(inCone(1, 0, -10, 0, 110), false);
  assert.equal(inCone(1, 0, 0, 10, 110), false);
});
