(function (root) {
  'use strict';
  const node = typeof module !== 'undefined';
  const { COLS, ROWS } = node ? require('./tiles.js') : root.Tiles;
  const { hash, makeRng } = node ? require('./rng.js') : root.Rng;

  const FLOORS = 5;
  const GRID_W = 4;
  const GRID_H = 4;
  // A door is two tiles wide; these bounds keep it off the corners, where stairwells go.
  const DOOR_MIN = 4;
  const DOOR_MAX_COL = COLS - 6;
  const DOOR_MAX_ROW = ROWS - 6;
  const LOBBY_DOOR_MAX_ROW = 5;
  const EXTRA_DOOR_CHANCE = 0.3;

  const DIRS = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };
  const STAIR_CORNERS = [
    { c: 1, r: 1 }, { c: COLS - 3, r: 1 }, { c: 1, r: ROWS - 3 }, { c: COLS - 3, r: ROWS - 3 },
  ];

  const allCells = () => {
    const list = [];
    for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) list.push({ x, y });
    return list;
  };
  const sameCell = (a, b) => a.x === b.x && a.y === b.y;

  // doorsE[i] joins (x, y) with (x+1, y) and holds a row; doorsS[i] joins (x, y) with (x, y+1) and holds a column.
  function edgeRef(plan, x, y, dir) {
    if (dir === 'n') return y > 0 ? [plan.doorsS, (y - 1) * GRID_W + x] : null;
    if (dir === 's') return y < GRID_H - 1 ? [plan.doorsS, y * GRID_W + x] : null;
    if (dir === 'w') return x > 0 ? [plan.doorsE, y * (GRID_W - 1) + x - 1] : null;
    return x < GRID_W - 1 ? [plan.doorsE, y * (GRID_W - 1) + x] : null;
  }

  function getDoor(plan, x, y, dir) {
    const ref = edgeRef(plan, x, y, dir);
    return ref ? ref[0][ref[1]] : null;
  }

  function setDoor(plan, x, y, dir, offset) {
    const [list, i] = edgeRef(plan, x, y, dir);
    list[i] = offset;
  }

  const cellDoors = (plan, x, y) => ({
    n: getDoor(plan, x, y, 'n'), s: getDoor(plan, x, y, 's'), w: getDoor(plan, x, y, 'w'), e: getDoor(plan, x, y, 'e'),
  });

  function neighbor(cell, dir) {
    const x = cell.x + DIRS[dir][0];
    const y = cell.y + DIRS[dir][1];
    return x >= 0 && y >= 0 && x < GRID_W && y < GRID_H ? { x, y } : null;
  }

  const randomOffset = (rng, dir) => (dir === 'n' || dir === 's' ? rng.int(DOOR_MIN, DOOR_MAX_COL) : rng.int(DOOR_MIN, DOOR_MAX_ROW));

  function carveMaze(plan, rng) {
    const visited = new Set([`${plan.start.x},${plan.start.y}`]);
    const stack = [plan.start];
    while (stack.length) {
      const cell = stack[stack.length - 1];
      const open = Object.keys(DIRS).filter((d) => {
        const n = neighbor(cell, d);
        return n && !visited.has(`${n.x},${n.y}`);
      });
      if (!open.length) {
        stack.pop();
        continue;
      }
      const dir = rng.pick(open);
      const next = neighbor(cell, dir);
      setDoor(plan, cell.x, cell.y, dir, randomOffset(rng, dir));
      visited.add(`${next.x},${next.y}`);
      stack.push(next);
    }
  }

  // Extra doors make loops, so a chase can be shaken off by running in a circle.
  function addLoops(plan, rng) {
    for (const cell of allCells()) {
      for (const dir of ['e', 's']) {
        if (neighbor(cell, dir) && getDoor(plan, cell.x, cell.y, dir) === null && rng.chance(EXTRA_DOOR_CHANCE)) {
          setDoor(plan, cell.x, cell.y, dir, randomOffset(rng, dir));
        }
      }
    }
  }

  function cellDistances(plan, from) {
    const dist = new Array(GRID_W * GRID_H).fill(-1);
    dist[from.y * GRID_W + from.x] = 0;
    const queue = [from];
    for (let head = 0; head < queue.length; head++) {
      const cell = queue[head];
      const doors = cellDoors(plan, cell.x, cell.y);
      for (const dir of Object.keys(DIRS)) {
        const next = doors[dir] !== null && neighbor(cell, dir);
        if (!next || dist[next.y * GRID_W + next.x] !== -1) continue;
        dist[next.y * GRID_W + next.x] = dist[cell.y * GRID_W + cell.x] + 1;
        queue.push(next);
      }
    }
    return dist;
  }

  function generateFloorPlan(seed, floor, arrival) {
    const rng = makeRng(hash(seed, floor, 0xf1));
    const start = arrival ? { ...arrival } : { x: rng.int(0, GRID_W - 1), y: rng.int(0, GRID_H - 1) };
    const plan = {
      floor,
      start,
      target: null,
      bossCell: null,
      doorsE: new Array((GRID_W - 1) * GRID_H).fill(null),
      doorsS: new Array(GRID_W * (GRID_H - 1)).fill(null),
    };
    carveMaze(plan, rng);
    addLoops(plan, rng);

    const dist = cellDistances(plan, start);
    const candidates = allCells().filter((c) => floor > 1 || c.y === GRID_H - 1);
    const far = Math.max(...candidates.map((c) => dist[c.y * GRID_W + c.x]));
    plan.target = rng.pick(candidates.filter((c) => dist[c.y * GRID_W + c.x] === far));

    if (floor === 1) {
      for (const dir of ['w', 'e']) {
        const row = getDoor(plan, plan.target.x, plan.target.y, dir);
        if (row !== null && row > LOBBY_DOOR_MAX_ROW) setDoor(plan, plan.target.x, plan.target.y, dir, rng.int(DOOR_MIN, LOBBY_DOOR_MAX_ROW));
      }
    }
    plan.bossCell = rng.pick(allCells().filter((c) => !sameCell(c, start) && !sameCell(c, plan.target)));
    return plan;
  }

  function generateBuildingPlan(seed) {
    const floors = {};
    let arrival = null;
    for (let floor = FLOORS; floor >= 1; floor--) {
      floors[floor] = generateFloorPlan(seed, floor, arrival);
      arrival = floors[floor].target;
    }
    return { seed, floors };
  }

  // The stairwell keeps its corner on every floor, as in a real building.
  const stairCorner = (seed, x, y) => STAIR_CORNERS[hash(seed, x, y, 0x57a1) % STAIR_CORNERS.length];

  const api = {
    FLOORS, GRID_W, GRID_H, DOOR_MIN, DOOR_MAX_COL, DOOR_MAX_ROW, LOBBY_DOOR_MAX_ROW,
    generateBuildingPlan, cellDoors, cellDistances, stairCorner,
  };
  if (node) module.exports = api;
  else root.FloorPlan = api;
})(this);
