const test = require('node:test');
const assert = require('node:assert/strict');
const { FLOORS, GRID_W, GRID_H, generateBuildingPlan } = require('../js/floorplan.js');
const { generateScreen, doorOpenings } = require('../js/rooms.js');
const { COLS, ROWS, T } = require('../js/tiles.js');
const { distanceMap, index } = require('../js/grid.js');
const { FLOOR_ROSTER } = require('../js/enemies.js');

const SEEDS = Array.from({ length: 30 }, (_, i) => i * 104729 + 3);

function forEachScreen(fn) {
  for (const seed of SEEDS) {
    const building = generateBuildingPlan(seed);
    for (let floor = 1; floor <= FLOORS; floor++) {
      for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) fn(generateScreen(building, floor, x, y), building);
      }
    }
  }
}

const tileAt = (screen, c, r) => screen.tiles[index(c, r)];

function keyPoints(screen) {
  const points = doorOpenings(screen.doors);
  if (screen.stairs) points.push(screen.stairs.landing, { c: screen.stairs.c, r: screen.stairs.r });
  if (screen.heroStart) points.push(screen.heroStart.tile);
  for (let c = 0; c < COLS; c++) if (tileAt(screen, c, ROWS - 1) === T.EXIT) points.push({ c, r: ROWS - 1 });
  return points;
}

test('door openings, stairs, the desk and the exit are connected in every screen', () => {
  forEachScreen((screen) => {
    const points = keyPoints(screen);
    const dist = distanceMap(screen.tiles, [points[0]]);
    for (const p of points) {
      assert.ok(dist[index(p.c, p.r)] >= 0, `floor ${screen.floor} cell ${screen.x},${screen.y}: ${p.c},${p.r} cut off`);
    }
  });
});

test('the border is wall except for door openings and the lobby exit', () => {
  forEachScreen((screen) => {
    const open = new Set(doorOpenings(screen.doors).map((p) => `${p.c},${p.r}`));
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (r > 0 && r < ROWS - 1 && c > 0 && c < COLS - 1) continue;
        const id = tileAt(screen, c, r);
        if (open.has(`${c},${r}`)) assert.equal(id, T.FLOOR);
        else assert.ok(id === T.WALL || (id === T.EXIT && screen.role === 'lobby'), `${c},${r} is ${id}`);
      }
    }
  });
});

test('screens are generated deterministically', () => {
  const building = generateBuildingPlan(77);
  for (let floor = 1; floor <= FLOORS; floor++) {
    assert.deepEqual(generateScreen(building, floor, 1, 2), generateScreen(building, floor, 1, 2));
  }
});

test('stairs down on the target cell, stairs up on the arrival cell', () => {
  forEachScreen((screen, building) => {
    const plan = building.floors[screen.floor];
    const is = (cell) => cell.x === screen.x && cell.y === screen.y;
    if (screen.floor > 1 && is(plan.target)) assert.equal(screen.stairs.dir, 'down');
    else if (screen.floor < FLOORS && is(plan.start)) assert.equal(screen.stairs.dir, 'up');
    else assert.equal(screen.stairs, null);
  });
});

test('the start screen has the hero desk and nobody else', () => {
  forEachScreen((screen) => {
    if (screen.role !== 'start') return;
    assert.ok(screen.tiles.includes(T.HERO_DESK));
    assert.ok(screen.heroStart);
    assert.equal(screen.spawns.length, 0);
  });
});

test('the lobby has the exit and only the guard', () => {
  let lobbies = 0;
  forEachScreen((screen) => {
    if (screen.role !== 'lobby') return;
    lobbies++;
    assert.ok(screen.exit);
    assert.ok(screen.tiles.includes(T.EXIT));
    assert.ok(screen.tiles.includes(T.TURNSTILE));
    assert.deepEqual(screen.spawns.map((s) => s.type), ['guard']);
  });
  assert.equal(lobbies, SEEDS.length);
});

test('boss cells host their floor boss', () => {
  forEachScreen((screen, building) => {
    const boss = FLOOR_ROSTER[screen.floor].boss;
    const cell = building.floors[screen.floor].bossCell;
    if (!boss || cell.x !== screen.x || cell.y !== screen.y) return;
    assert.equal(screen.role, 'boss');
    assert.ok(screen.spawns.some((s) => s.type === boss));
  });
});

test('regular enemies spawn on reachable floor away from the doors', () => {
  forEachScreen((screen) => {
    const fromDoors = distanceMap(screen.tiles, doorOpenings(screen.doors));
    for (const spawn of screen.spawns) {
      assert.equal(tileAt(screen, spawn.c, spawn.r), T.FLOOR);
      if (spawn.type === 'guard' || spawn.type === FLOOR_ROSTER[screen.floor].boss) continue;
      assert.ok(fromDoors[index(spawn.c, spawn.r)] >= 6, `spawn too close to a door on floor ${screen.floor}`);
    }
  });
});
