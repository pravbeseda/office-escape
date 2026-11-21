const test = require('node:test');
const assert = require('node:assert/strict');
const {
  FLOORS, GRID_W, GRID_H, DOOR_MIN, DOOR_MAX_COL, DOOR_MAX_ROW, LOBBY_DOOR_MAX_ROW,
  generateBuildingPlan, cellDoors, cellDistances,
} = require('../js/floorplan.js');

const SEEDS = Array.from({ length: 100 }, (_, i) => i * 7919 + 1);
const cells = () => {
  const list = [];
  for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) list.push({ x, y });
  return list;
};

function forEachFloor(fn) {
  for (const seed of SEEDS) {
    const building = generateBuildingPlan(seed);
    for (let floor = 1; floor <= FLOORS; floor++) fn(building.floors[floor], floor, building);
  }
}

test('every cell of every floor is reachable from the arrival cell', () => {
  forEachFloor((plan) => {
    const dist = cellDistances(plan, plan.start);
    for (const { x, y } of cells()) assert.ok(dist[y * GRID_W + x] >= 0, `cell ${x},${y} unreachable`);
  });
});

test('both sides of a shared wall agree on the door', () => {
  forEachFloor((plan) => {
    for (const { x, y } of cells()) {
      const d = cellDoors(plan, x, y);
      if (x < GRID_W - 1) assert.equal(d.e, cellDoors(plan, x + 1, y).w);
      if (y < GRID_H - 1) assert.equal(d.s, cellDoors(plan, x, y + 1).n);
      if (x === 0) assert.equal(d.w, null);
      if (y === 0) assert.equal(d.n, null);
      if (x === GRID_W - 1) assert.equal(d.e, null);
      if (y === GRID_H - 1) assert.equal(d.s, null);
    }
  });
});

test('door offsets keep clear of the corners where stairwells go', () => {
  forEachFloor((plan) => {
    for (const { x, y } of cells()) {
      const d = cellDoors(plan, x, y);
      for (const col of [d.n, d.s]) if (col !== null) assert.ok(col >= DOOR_MIN && col <= DOOR_MAX_COL);
      for (const row of [d.w, d.e]) if (row !== null) assert.ok(row >= DOOR_MIN && row <= DOOR_MAX_ROW);
    }
  });
});

test('each floor is entered where the floor above has its stairs down', () => {
  for (const seed of SEEDS) {
    const { floors } = generateBuildingPlan(seed);
    for (let floor = FLOORS; floor > 1; floor--) assert.deepEqual(floors[floor - 1].start, floors[floor].target);
  }
});

test('the target is one of the farthest cells from the start', () => {
  forEachFloor((plan, floor) => {
    const dist = cellDistances(plan, plan.start);
    const candidates = cells().filter((c) => floor > 1 || c.y === GRID_H - 1);
    const far = Math.max(...candidates.map((c) => dist[c.y * GRID_W + c.x]));
    assert.equal(dist[plan.target.y * GRID_W + plan.target.x], far);
    assert.ok(far > 0);
  });
});

test('the lobby sits on the bottom row with its side doors above the turnstiles', () => {
  forEachFloor((plan, floor) => {
    if (floor !== 1) return;
    assert.equal(plan.target.y, GRID_H - 1);
    const d = cellDoors(plan, plan.target.x, plan.target.y);
    for (const row of [d.w, d.e]) if (row !== null) assert.ok(row <= LOBBY_DOOR_MAX_ROW);
  });
});

test('the boss cell is neither the start nor the target', () => {
  forEachFloor((plan) => {
    const same = (a, b) => a.x === b.x && a.y === b.y;
    assert.ok(!same(plan.bossCell, plan.start));
    assert.ok(!same(plan.bossCell, plan.target));
  });
});

test('the building plan is deterministic', () => {
  assert.deepEqual(generateBuildingPlan(555), generateBuildingPlan(555));
  assert.notDeepEqual(generateBuildingPlan(555), generateBuildingPlan(556));
});
