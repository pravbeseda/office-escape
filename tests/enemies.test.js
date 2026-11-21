const test = require('node:test');
const assert = require('node:assert/strict');
const { createEnemy, updateEnemy, canSee, ENEMY_TYPES, SEARCH_TIME } = require('../js/enemies.js');
const { TILE, COLS, ROWS, T } = require('../js/tiles.js');
const { makeRng } = require('../js/rng.js');

const STEP = 1 / 60;
const at = (c, r) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2, half: 5 });

function room(walls = []) {
  const tiles = new Uint8Array(COLS * ROWS).fill(T.FLOOR);
  for (let c = 0; c < COLS; c++) { tiles[c] = T.WALL; tiles[(ROWS - 1) * COLS + c] = T.WALL; }
  for (let r = 0; r < ROWS; r++) { tiles[r * COLS] = T.WALL; tiles[r * COLS + COLS - 1] = T.WALL; }
  for (const [c, r] of walls) tiles[r * COLS + c] = T.WALL;
  return tiles;
}

function walkableOf(tiles) {
  const list = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (tiles[r * COLS + c] === T.FLOOR) list.push({ c, r });
  return list;
}

function advance(enemy, tiles, hero, seconds) {
  const ctx = { tiles, hero, dt: STEP, rng: makeRng(3), walkable: walkableOf(tiles) };
  const results = [];
  for (let t = 0; t < seconds; t += STEP) results.push(updateEnemy(enemy, ctx));
  return results;
}

const column = (c, r0, r1) => Array.from({ length: r1 - r0 + 1 }, (_, i) => [c, r0 + i]);

test('an enemy spots the hero ahead, hesitates, then chases', () => {
  const tiles = room();
  const enemy = createEnemy({ type: 'pm', c: 3, r: 7, dir: 'right' });
  const hero = at(10, 7);
  assert.equal(advance(enemy, tiles, hero, STEP)[0], 'spotted');
  assert.equal(enemy.state, 'alert');
  const x0 = enemy.x;
  advance(enemy, tiles, hero, 0.2);
  assert.equal(enemy.x, x0, 'stands still while reacting');
  advance(enemy, tiles, hero, 0.6);
  assert.equal(enemy.state, 'chase');
  assert.ok(enemy.x > x0);
});

test('a wall hides the hero', () => {
  const tiles = room(column(7, 1, 12));
  const enemy = createEnemy({ type: 'pm', c: 3, r: 7, dir: 'right' });
  assert.equal(canSee(enemy, at(10, 7), tiles), false);
});

test('the hero behind the enemy back stays unnoticed', () => {
  const enemy = createEnemy({ type: 'pm', c: 10, r: 7, dir: 'right' });
  assert.equal(canSee(enemy, at(5, 7), room()), false);
});

test('the hero beyond sight range stays unnoticed', () => {
  const enemy = createEnemy({ type: 'pm', c: 1, r: 7, dir: 'right' });
  const far = ENEMY_TYPES.pm.sight + 2;
  assert.equal(canSee(enemy, at(1 + far, 7), room()), false);
});

test('a chase routes around walls and reaches the hero', () => {
  const tiles = room(column(8, 1, 10));
  const enemy = createEnemy({ type: 'pm', c: 4, r: 5, dir: 'right' });
  const hero = at(12, 5);
  enemy.state = 'chase';
  enemy.lastSeen = { x: hero.x, y: hero.y };
  advance(enemy, tiles, hero, 9);
  assert.ok(Math.hypot(enemy.x - hero.x, enemy.y - hero.y) < 10);
});

test('a lost hero turns the chase into a search and then a patrol', () => {
  const tiles = room(column(10, 1, 12));
  const enemy = createEnemy({ type: 'pm', c: 4, r: 7, dir: 'right' });
  enemy.state = 'chase';
  enemy.lostTime = ENEMY_TYPES.pm.memory + 0.1;
  enemy.lastSeen = { x: enemy.x + TILE, y: enemy.y };
  const hidden = at(15, 7);
  advance(enemy, tiles, hidden, 1);
  assert.equal(enemy.state, 'search');
  advance(enemy, tiles, hidden, SEARCH_TIME + 0.2);
  assert.equal(enemy.state, 'patrol');
});

test('a reading guard is blind, a watching guard is not', () => {
  const tiles = room();
  const guard = createEnemy({ type: 'guard', c: 10, r: 11, dir: 'up' });
  const hero = at(10, 5);
  guard.gaze = 'read';
  assert.equal(canSee(guard, hero, tiles), false);
  guard.gaze = 'look';
  assert.ok(canSee(guard, hero, tiles));
});

test('the guard goes back to his post after losing the hero', () => {
  const tiles = room();
  const guard = createEnemy({ type: 'guard', c: 10, r: 11, dir: 'up' });
  guard.state = 'search';
  guard.timer = 0.1;
  guard.x += 3 * TILE;
  advance(guard, tiles, at(2, 2), 4);
  assert.equal(guard.state, 'post');
  assert.ok(Math.abs(guard.x - guard.home.x) < 3);
});
