(function (root) {
  'use strict';
  const node = typeof module !== 'undefined';
  const { TILE, COLS, ROWS, T } = node ? require('./tiles.js') : root.Tiles;
  const { hash, makeRng } = node ? require('./rng.js') : root.Rng;
  const { FLOORS, generateBuildingPlan } = node ? require('./floorplan.js') : root.FloorPlan;
  const { generateScreen, doorOpenings } = node ? require('./rooms.js') : root.Rooms;
  const { index, distanceMap, findPath } = node ? require('./grid.js') : root.Grid;
  const { moveBody, overlapsSolid } = node ? require('./physics.js') : root.Physics;
  const { ENEMY_TYPES, createEnemy, updateEnemy, canSee, startSearch, onTrail, tileOf } = node ? require('./enemies.js') : root.Enemies;

  const HERO_SPEED = 72;
  const HERO_HALF = 5;
  const CATCH_RANGE = 10;
  const CORNER_ASSIST = 6;
  const FOLLOW_DELAY = 0.3;
  const FIELD_W = COLS * TILE;
  const FIELD_H = ROWS * TILE;
  const EDGE = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };

  const clampTile = (x, y) => ({
    c: Math.min(COLS - 1, Math.max(0, Math.floor(x / TILE))),
    r: Math.min(ROWS - 1, Math.max(0, Math.floor(y / TILE))),
  });

  // When a straight move is blocked by a corner, slide sideways toward the opening.
  function nudge(body, axis, forward, step, tiles) {
    for (let d = 1; d <= CORNER_ASSIST; d++) {
      for (const side of [-1, 1]) {
        const x = axis === 'x' ? body.x + side * d : body.x + forward;
        const y = axis === 'y' ? body.y + side * d : body.y + forward;
        if (overlapsSolid(tiles, x, y, body.half)) continue;
        const shift = side * Math.min(step, d);
        moveBody(body, axis === 'x' ? shift : 0, axis === 'y' ? shift : 0, tiles);
        return;
      }
    }
  }

  function placeOn(e, tile) {
    e.x = tile.c * TILE + TILE / 2;
    e.y = tile.r * TILE + TILE / 2;
    e.goal = null;
    e.pathKey = '';
  }

  // Floor reachable from the doors, each tile with its step count from the nearest one.
  function patrolTiles(screen) {
    const reach = distanceMap(screen.tiles, doorOpenings(screen.doors));
    const list = [];
    for (let r = 1; r < ROWS - 1; r++) {
      for (let c = 1; c < COLS - 1; c++) if (screen.tiles[index(c, r)] === T.FLOOR && reach[index(c, r)] >= 0) list.push({ c, r, fromDoor: reach[index(c, r)] });
    }
    return list;
  }

  class World {
    constructor(seed) {
      this.seed = seed >>> 0;
      this.building = generateBuildingPlan(this.seed);
      this.screens = new Map();
      this.states = new Map();
      this.visited = new Set();
      this.caughtCount = 0;
      this.elapsed = 0;
      this.rng = makeRng(hash(this.seed, 0xa1));
      this.hero = { x: 0, y: 0, half: HERO_HALF, dir: 'up', moving: false, anim: 0 };
      this.placeAtDesk();
    }

    get plan() { return this.building.floors[this.floor]; }
    get screen() { return this.screenAt(this.floor, this.cx, this.cy); }
    get enemies() { return this.stateOf(this.screen).enemies; }

    screenAt(floor, x, y) {
      const key = `${floor}:${x}:${y}`;
      let screen = this.screens.get(key);
      if (!screen) {
        screen = { key, ...generateScreen(this.building, floor, x, y) };
        this.screens.set(key, screen);
      }
      return screen;
    }

    // Enemy positions live apart from the layout: a catch resets them, the building stays.
    stateOf(screen) {
      let state = this.states.get(screen.key);
      if (!state) {
        state = { enemies: screen.spawns.map(createEnemy), incoming: [], walkable: patrolTiles(screen) };
        this.states.set(screen.key, state);
      }
      return state;
    }

    placeAtDesk() {
      this.floor = FLOORS;
      this.cx = this.plan.start.x;
      this.cy = this.plan.start.y;
      const { x, y } = this.screen.heroStart;
      Object.assign(this.hero, { x, y, dir: 'up', moving: false });
      this.visited.add(this.screen.key);
    }

    resetAfterCatch() {
      this.caughtCount++;
      this.states.clear();
      this.placeAtDesk();
    }

    // move: {x, y} in -1..1. Returns events: screen, floor, spotted, caught, win.
    update(dt, move) {
      this.elapsed += dt;
      this.landArrivals(this.stateOf(this.screen));
      this.moveHero(dt, move);
      const edge = this.edgeCrossed();
      if (edge) return [this.crossEdge(edge)];
      const { c, r } = clampTile(this.hero.x, this.hero.y);
      const under = this.screen.tiles[index(c, r)];
      if (under === T.STAIRS_DOWN) return [this.takeStairs(-1)];
      if (under === T.STAIRS_UP) return [this.takeStairs(1)];
      if (under === T.EXIT) return [{ type: 'win' }];
      return this.updateEnemies(dt);
    }

    moveHero(dt, move) {
      const hero = this.hero;
      const len = Math.hypot(move.x, move.y);
      hero.moving = len > 0;
      if (!len) return;
      const mx = move.x / len;
      const my = move.y / len;
      const step = HERO_SPEED * dt;
      const { tiles } = this.screen;
      const bx = hero.x;
      const by = hero.y;
      moveBody(hero, mx * step, my * step, tiles);
      if (mx && !my && hero.x === bx) nudge(hero, 'y', Math.sign(mx), step, tiles);
      if (my && !mx && hero.y === by) nudge(hero, 'x', Math.sign(my), step, tiles);
      hero.dir = Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 'right' : 'left') : (my > 0 ? 'down' : 'up');
      hero.anim += dt;
    }

    edgeCrossed() {
      const { x, y } = this.hero;
      if (x < 0) return 'w';
      if (x >= FIELD_W) return 'e';
      if (y < 0) return 'n';
      if (y >= FIELD_H) return 's';
      return null;
    }

    crossEdge(dir) {
      const [dx, dy] = EDGE[dir];
      const from = this.screen;
      const fromState = this.stateOf(from);
      const exitTile = clampTile(this.hero.x, this.hero.y);
      this.cx += dx;
      this.cy += dy;
      this.hero.x -= dx * FIELD_W;
      this.hero.y -= dy * FIELD_H;
      const to = this.screen;
      this.recallIncoming(fromState);
      this.sendFollowers(from, fromState, exitTile, this.stateOf(to), clampTile(this.hero.x, this.hero.y));
      this.endSearches(fromState);
      this.visited.add(to.key);
      return { type: 'screen', dir, from, to };
    }

    // Chasers reach the door after walking there, so the arrival depends on how far behind they were.
    sendFollowers(from, fromState, exitTile, toState, entryTile) {
      fromState.enemies = fromState.enemies.filter((e) => {
        if (!onTrail(e) || ENEMY_TYPES[e.type].stationary) return true;
        const path = findPath(from.tiles, tileOf(e), exitTile);
        if (!path) return true;
        const arrives = this.elapsed + (path.length * TILE) / ENEMY_TYPES[e.type].speed + FOLLOW_DELAY;
        toState.incoming.push({ enemy: e, origin: fromState, path, departed: this.elapsed, arrives, tile: entryTile });
        return false;
      });
    }

    // A follower that has not come through yet when the hero leaves is still in its own room, part of the way to the door.
    recallIncoming(state) {
      for (const { enemy, origin, path, departed } of state.incoming) {
        const walked = Math.floor(((this.elapsed - departed) * ENEMY_TYPES[enemy.type].speed) / TILE);
        placeOn(enemy, path[Math.min(path.length - 1, walked)]);
        origin.enemies.push(enemy);
      }
      state.incoming = [];
    }

    // Rooms freeze while the hero is away, so a search he leaves would wait by its door; it ends on patrol away from the doors.
    endSearches(state) {
      const deepest = Math.max(...state.walkable.map((t) => t.fromDoor));
      const away = state.walkable.filter((t) => t.fromDoor * 2 >= deepest);
      for (const e of state.enemies) {
        if (e.state !== 'search' || ENEMY_TYPES[e.type].stationary) continue;
        placeOn(e, this.rng.pick(away));
        e.state = 'patrol';
      }
    }

    // Runs before the hero can leave, so a follower due this frame comes through instead of being recalled.
    landArrivals(state) {
      for (const pending of state.incoming.filter((p) => p.arrives <= this.elapsed)) this.land(pending, state);
      state.incoming = state.incoming.filter((p) => p.arrives > this.elapsed);
    }

    // Coming in, a follower looks all around; it keeps the trail only if the hero is in sight.
    land(pending, state) {
      const e = pending.enemy;
      placeOn(e, pending.tile);
      e.state = 'chase';
      if (canSee(e, this.hero, this.screen.tiles)) {
        e.lostTime = 0;
        e.lastSeen = { x: this.hero.x, y: this.hero.y };
      } else {
        startSearch(e);
      }
      state.enemies.push(e);
    }

    takeStairs(delta) {
      const from = this.floor;
      this.recallIncoming(this.stateOf(this.screen));
      this.endSearches(this.stateOf(this.screen));
      this.floor += delta;
      const { stairs, key } = this.screen;
      this.hero.x = stairs.landing.c * TILE + TILE / 2;
      this.hero.y = stairs.landing.r * TILE + TILE / 2;
      this.hero.dir = stairs.landing.c > stairs.c ? 'right' : 'left';
      this.visited.add(key);
      return { type: 'floor', from, to: this.floor };
    }

    updateEnemies(dt) {
      const events = [];
      const screen = this.screen;
      const state = this.stateOf(screen);
      const ctx = { tiles: screen.tiles, hero: this.hero, dt, rng: this.rng, walkable: state.walkable };
      for (const e of state.enemies) {
        if (updateEnemy(e, ctx) === 'spotted') events.push({ type: 'spotted', enemy: e });
      }
      const catcher = state.enemies.find((e) => Math.abs(e.x - this.hero.x) < CATCH_RANGE && Math.abs(e.y - this.hero.y) < CATCH_RANGE);
      if (catcher) events.push({ type: 'caught', enemy: catcher });
      return events;
    }
  }

  const api = { World, FIELD_W, FIELD_H, EDGE };
  if (node) module.exports = api;
  else root.WorldModel = api;
})(this);
