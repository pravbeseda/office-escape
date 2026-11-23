const test = require('node:test');
const assert = require('node:assert/strict');
const { World } = require('../js/world.js');
const { TILE, COLS, ROWS, T } = require('../js/tiles.js');
const { FLOORS } = require('../js/floorplan.js');
const { createEnemy, tileOf, ENEMY_TYPES, SEARCH_TIME } = require('../js/enemies.js');
const { index, distanceMap } = require('../js/grid.js');
const { doorOpenings } = require('../js/rooms.js');

const STEP = 1 / 60;
const STILL = { x: 0, y: 0 };
const SEEDS = [123, 456, 789, 1011, 31337];

function run(world, seconds, move, stopOn) {
  const events = [];
  for (let t = 0; t < seconds; t += STEP) {
    events.push(...world.update(STEP, move));
    if (events.some((e) => e.type === stopOn)) break;
  }
  return events;
}

// Places the hero just inside one of the start screen's doors, facing out.
function nearDoor(world) {
  const d = world.screen.doors;
  if (d.e !== null) return { dir: 'e', hero: { x: (COLS - 2) * TILE + 8, y: (d.e + 1) * TILE }, move: { x: 1, y: 0 }, behind: { c: COLS - 3, r: d.e } };
  if (d.w !== null) return { dir: 'w', hero: { x: TILE + 8, y: (d.w + 1) * TILE }, move: { x: -1, y: 0 }, behind: { c: 2, r: d.w } };
  if (d.s !== null) return { dir: 's', hero: { x: (d.s + 1) * TILE, y: (ROWS - 2) * TILE + 8 }, move: { x: 0, y: 1 }, behind: { c: d.s, r: ROWS - 3 } };
  return { dir: 'n', hero: { x: (d.n + 1) * TILE, y: TILE + 8 }, move: { x: 0, y: -1 }, behind: { c: d.n, r: 2 } };
}

// Centre of the floor tile of the current screen farthest from a point, as the crow flies.
function farthestFloor(world, from) {
  let best = null;
  world.screen.tiles.forEach((tile, i) => {
    if (tile !== T.FLOOR) return;
    const p = { x: (i % COLS) * TILE + TILE / 2, y: Math.floor(i / COLS) * TILE + TILE / 2 };
    if (!best || Math.hypot(p.x - from.x, p.y - from.y) > Math.hypot(best.x - from.x, best.y - from.y)) best = p;
  });
  return best;
}

const tileUnder = (world) => world.screen.tiles[Math.floor(world.hero.y / TILE) * COLS + Math.floor(world.hero.x / TILE)];

test('a new world starts at the hero desk on the top floor', () => {
  for (const seed of SEEDS) {
    const world = new World(seed);
    assert.equal(world.floor, FLOORS);
    assert.deepEqual({ x: world.cx, y: world.cy }, world.building.floors[FLOORS].start);
    assert.equal(world.screen.role, 'start');
    assert.equal(world.enemies.length, 0);
  }
});

test('walking out through a door opens the neighbouring screen', () => {
  for (const seed of SEEDS) {
    const world = new World(seed);
    const setup = nearDoor(world);
    Object.assign(world.hero, setup.hero);
    const before = { x: world.cx, y: world.cy };
    const event = run(world, 2, setup.move, 'screen').find((e) => e.type === 'screen');
    assert.ok(event, `seed ${seed}: no screen change`);
    assert.equal(event.dir, setup.dir);
    assert.notDeepEqual({ x: world.cx, y: world.cy }, before);
    assert.ok(world.hero.x >= 0 && world.hero.x < COLS * TILE);
    assert.ok(world.hero.y >= 0 && world.hero.y < ROWS * TILE);
    assert.notEqual(tileUnder(world), T.WALL);
  }
});

test('a touch by an enemy is a catch, and the reset restores the desk in the same building', () => {
  const world = new World(123);
  const tilesBefore = world.screen.tiles.slice();
  const start = { ...world.hero };
  world.enemies.push(createEnemy({ type: 'pm', c: Math.floor(world.hero.x / TILE), r: Math.floor(world.hero.y / TILE) }));
  assert.ok(world.update(STEP, STILL).some((e) => e.type === 'caught'));
  world.resetAfterCatch();
  assert.equal(world.caughtCount, 1);
  assert.equal(world.floor, FLOORS);
  assert.equal(world.enemies.length, 0);
  assert.equal(world.hero.x, start.x);
  assert.equal(world.hero.y, start.y);
  assert.deepEqual(world.screen.tiles, tilesBefore);
});

test('the reset puts enemies of visited screens back on their spawns', () => {
  const world = new World(456);
  const plan = world.building.floors[FLOORS];
  world.cx = plan.target.x;
  world.cy = plan.target.y;
  for (let i = 0; i < 3; i++) world.enemies.push(createEnemy({ type: 'pm', c: 5, r: 5 }));
  const spawned = world.screen.spawns.length;
  world.resetAfterCatch();
  world.cx = plan.target.x;
  world.cy = plan.target.y;
  assert.equal(world.enemies.length, spawned);
});

test('stairs down lead to the floor below, next to the stairs up', () => {
  for (const seed of SEEDS) {
    const world = new World(seed);
    const plan = world.building.floors[FLOORS];
    world.cx = plan.target.x;
    world.cy = plan.target.y;
    const { stairs } = world.screen;
    assert.equal(stairs.dir, 'down');
    world.hero.x = stairs.c * TILE + 8;
    world.hero.y = stairs.r * TILE + 8;
    const event = world.update(STEP, STILL).find((e) => e.type === 'floor');
    assert.equal(event.to, FLOORS - 1);
    assert.equal(world.screen.stairs.dir, 'up');
    assert.equal(tileUnder(world), T.FLOOR);
  }
});

test('the lobby exit wins the game', () => {
  const world = new World(789);
  world.floor = 1;
  world.cx = world.building.floors[1].target.x;
  world.cy = world.building.floors[1].target.y;
  const exitCol = world.screen.tiles.slice((ROWS - 1) * COLS).indexOf(T.EXIT);
  world.hero.x = exitCol * TILE + 8;
  world.hero.y = (ROWS - 1) * TILE + 8;
  assert.ok(world.update(STEP, STILL).some((e) => e.type === 'win'));
});

test('a chasing enemy follows the hero through the door and catches up', () => {
  for (const seed of SEEDS) {
    const world = new World(seed);
    const setup = nearDoor(world);
    Object.assign(world.hero, setup.hero);
    const chaser = createEnemy({ type: 'pm', ...setup.behind });
    chaser.state = 'chase';
    chaser.lastSeen = { x: world.hero.x, y: world.hero.y };
    world.enemies.push(chaser);
    run(world, 2, setup.move, 'screen');
    assert.equal(world.enemies.includes(chaser), false, `seed ${seed}: chaser arrived instantly`);
    const events = run(world, 4, STILL, 'caught');
    assert.ok(events.some((e) => e.type === 'caught' && e.enemy === chaser), `seed ${seed}: chaser never arrived`);
  }
});

test('a follower still on its way stays in its room, part of the way to the door, when the hero turns back', () => {
  for (const seed of SEEDS) {
    const world = new World(seed);
    const room = world.screen.key;
    const setup = nearDoor(world);
    Object.assign(world.hero, setup.hero);
    const toDoor = distanceMap(world.screen.tiles, [setup.behind]);
    const far = world.screen.tiles.reduce((best, tile, i) => (tile === T.FLOOR && toDoor[i] > toDoor[best] ? i : best), 0);
    const chaser = createEnemy({ type: 'pm', c: far % COLS, r: Math.floor(far / COLS) });
    chaser.state = 'chase';
    chaser.lastSeen = { x: world.hero.x, y: world.hero.y };
    world.enemies.push(chaser);
    run(world, 2, setup.move, 'screen');
    const stepsLeft = () => toDoor[index(tileOf(chaser).c, tileOf(chaser).r)];
    const atDeparture = stepsLeft();
    assert.ok(atDeparture >= 8, `seed ${seed}: chaser starts too close to the door`);
    run(world, 1, STILL);
    run(world, 1, { x: -setup.move.x, y: -setup.move.y }, 'screen');
    assert.equal(world.screen.key, room);
    assert.ok(world.enemies.includes(chaser), `seed ${seed}: chaser left its room`);
    const onReturn = stepsLeft();
    assert.ok(onReturn < atDeparture, `seed ${seed}: chaser did not walk on`);
    assert.ok(onReturn >= atDeparture - 4, `seed ${seed}: chaser jumped toward the door`);
  }
});

test('a follower due on the frame the hero leaves has come through and follows again', () => {
  for (const seed of SEEDS) {
    const world = new World(seed);
    const setup = nearDoor(world);
    Object.assign(world.hero, setup.hero);
    const chaser = createEnemy({ type: 'pm', ...setup.behind });
    chaser.state = 'chase';
    chaser.lastSeen = { x: world.hero.x, y: world.hero.y };
    world.enemies.push(chaser);
    run(world, 2, setup.move, 'screen');
    const pending = world.stateOf(world.screen).incoming.find((p) => p.enemy === chaser);
    while (world.elapsed + STEP < pending.arrives) world.update(STEP, STILL);
    const back = world.update(STEP, { x: -setup.move.x, y: -setup.move.y });
    assert.ok(back.some((e) => e.type === 'screen'), `seed ${seed}: hero did not turn back on the arrival frame`);
    assert.equal(world.enemies.includes(chaser), false, `seed ${seed}: chaser was sent back instead of coming through`);
    const events = run(world, 3, STILL, 'caught');
    assert.ok(events.some((e) => e.type === 'caught' && e.enemy === chaser), `seed ${seed}: chaser stopped following`);
  }
});

test('a follower that comes in and does not see the hero loses the trail', () => {
  const sight = ENEMY_TYPES.pm.sight * TILE;
  for (const seed of SEEDS) {
    const world = new World(seed);
    const setup = nearDoor(world);
    Object.assign(world.hero, setup.hero);
    const chaser = createEnemy({ type: 'pm', ...setup.behind });
    chaser.state = 'chase';
    chaser.lastSeen = { x: world.hero.x, y: world.hero.y };
    world.enemies.push(chaser);
    run(world, 2, setup.move, 'screen');
    Object.assign(world.hero, farthestFloor(world, world.hero));
    for (let t = 0; t < 3 && !world.enemies.includes(chaser); t += STEP) world.update(STEP, STILL);
    assert.ok(world.enemies.includes(chaser), `seed ${seed}: chaser never came through`);
    assert.ok(Math.hypot(chaser.x - world.hero.x, chaser.y - world.hero.y) > sight, `seed ${seed}: hero is within sight`);
    const landed = { x: chaser.x, y: chaser.y };
    run(world, 1, STILL);
    assert.equal(chaser.state, 'search', `seed ${seed}: chaser kept the trail`);
    assert.deepEqual({ x: chaser.x, y: chaser.y }, landed, `seed ${seed}: chaser went after the hero`);
  }
});

test('a follower the hero leaves behind does not wait for him by the door', () => {
  // Searching in the doorway, then on patrol with a pause left over from before the chase.
  for (const lingers of [0, SEARCH_TIME + 0.1]) {
    for (const seed of SEEDS) {
      const world = new World(seed);
      const setup = nearDoor(world);
      Object.assign(world.hero, setup.hero);
      const chaser = createEnemy({ type: 'pm', ...setup.behind });
      chaser.state = 'chase';
      chaser.wait = 1.5;
      chaser.lastSeen = { x: world.hero.x, y: world.hero.y };
      world.enemies.push(chaser);
      run(world, 2, setup.move, 'screen');
      const room = world.screen;
      const entry = { x: world.hero.x, y: world.hero.y };
      Object.assign(world.hero, farthestFloor(world, world.hero));
      for (let t = 0; t < 3 && !world.enemies.includes(chaser); t += STEP) world.update(STEP, STILL);
      assert.equal(chaser.state, 'search', `seed ${seed}: chaser did not lose the trail`);
      run(world, lingers, STILL);
      Object.assign(world.hero, { x: entry.x - setup.move.x * TILE, y: entry.y - setup.move.y * TILE });
      assert.ok(world.update(STEP, STILL).some((e) => e.type === 'screen'), `seed ${seed}: hero did not leave`);
      assert.equal(chaser.state, 'patrol', `seed ${seed}, ${lingers}s: chaser is not on patrol`);
      const fromDoors = distanceMap(room.tiles, doorOpenings(room.doors));
      assert.ok(fromDoors[index(tileOf(chaser).c, tileOf(chaser).r)] >= 4, `seed ${seed}, ${lingers}s: chaser waits by a door`);
    }
  }
});

test('nobody is left on the stairs landing the hero leaves by', () => {
  for (const seed of SEEDS) {
    const world = new World(seed);
    const plan = world.building.floors[FLOORS];
    world.cx = plan.target.x;
    world.cy = plan.target.y;
    const room = world.screen;
    const { stairs } = room;
    const idler = createEnemy({ type: 'pm', ...stairs.landing });
    world.enemies.push(idler);
    world.hero.x = stairs.c * TILE + 8;
    world.hero.y = stairs.r * TILE + 8;
    assert.ok(world.update(STEP, STILL).some((e) => e.type === 'floor'), `seed ${seed}: hero did not take the stairs`);
    const fromLanding = distanceMap(room.tiles, [stairs.landing]);
    assert.ok(fromLanding[index(tileOf(idler).c, tileOf(idler).r)] >= 4, `seed ${seed}: enemy waits on the landing`);
  }
});

test('a chaser that has lost the trail does not follow the hero through the door', () => {
  const sight = ENEMY_TYPES.pm.sight * TILE;
  for (const seed of SEEDS) {
    const world = new World(seed);
    const room = world.screen;
    const setup = nearDoor(world);
    Object.assign(world.hero, setup.hero);
    const chaser = createEnemy({ type: 'pm', ...tileOf(farthestFloor(world, world.hero)) });
    assert.ok(Math.hypot(chaser.x - world.hero.x, chaser.y - world.hero.y) > sight + 3 * TILE, `seed ${seed}: chaser starts within sight`);
    chaser.state = 'chase';
    chaser.lostTime = ENEMY_TYPES.pm.memory + 0.5;
    chaser.lastSeen = { x: world.hero.x, y: world.hero.y };
    world.enemies.push(chaser);
    run(world, 2, setup.move, 'screen');
    assert.ok(world.stateOf(room).enemies.includes(chaser), `seed ${seed}: chaser followed without knowing where the hero went`);
  }
});

test('the guard does not leave the lobby', () => {
  const world = new World(1011);
  world.floor = 1;
  world.cx = world.building.floors[1].target.x;
  world.cy = world.building.floors[1].target.y;
  const guard = world.enemies[0];
  assert.equal(guard.type, 'guard');
  const setup = nearDoor(world);
  Object.assign(world.hero, setup.hero);
  guard.state = 'chase';
  guard.lastSeen = { x: world.hero.x, y: world.hero.y };
  run(world, 2, setup.move, 'screen');
  run(world, 3, STILL);
  assert.equal(world.enemies.includes(guard), false);
});
