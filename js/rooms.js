(function (root) {
  'use strict';
  const node = typeof module !== 'undefined';
  const { TILE, COLS, ROWS, T, FLOOR_STYLE } = node ? require('./tiles.js') : root.Tiles;
  const { hash, makeRng } = node ? require('./rng.js') : root.Rng;
  const { FLOORS, cellDoors, stairCorner } = node ? require('./floorplan.js') : root.FloorPlan;
  const { index, distanceMap } = node ? require('./grid.js') : root.Grid;
  const { FLOOR_ROSTER } = node ? require('./enemies.js') : root.Enemies;

  const MAX_ATTEMPTS = 12;
  const SPAWN_DOOR_DISTANCE = 6;
  const SPAWN_GAP = 3;
  const KIND_WEIGHTS = { openspace: 4, meeting: 2, kitchen: 1.5, servers: 1.5, hallway: 2 };
  const DIRECTIONS = ['up', 'right', 'down', 'left'];

  const LOBBY = { turnstileRow: 8, passages: [6, 10, 14], exitCols: [8, 9, 10, 11], guardPost: { c: 16, r: 11 } };
  const HERO_DESK = { c: 9, r: 5 };

  // Tile-editing helper; fillRect is clipped to the interior so the outer wall stays intact.
  function makeRoom(rng) {
    const tiles = new Uint8Array(COLS * ROWS).fill(T.FLOOR);
    const style = new Uint8Array(COLS * ROWS).fill(FLOOR_STYLE.CARPET);
    const room = {
      rng, tiles, style,
      get: (c, r) => tiles[index(c, r)],
      set: (c, r, id) => { tiles[index(c, r)] = id; },
      fillRect(c0, r0, w, h, id) {
        for (let r = Math.max(1, r0); r < Math.min(ROWS - 1, r0 + h); r++) {
          for (let c = Math.max(1, c0); c < Math.min(COLS - 1, c0 + w); c++) tiles[index(c, r)] = id;
        }
      },
      styleRect(c0, r0, w, h, s) {
        for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) style[index(c, r)] = s;
      },
      outline(c0, r0, w, h, id) {
        for (let c = c0; c < c0 + w; c++) { room.set(c, r0, id); room.set(c, r0 + h - 1, id); }
        for (let r = r0; r < r0 + h; r++) { room.set(c0, r, id); room.set(c0 + w - 1, r, id); }
      },
      // A two-tile gap in the middle of one side of an outlined box.
      openSide(c0, r0, w, h, side) {
        const mc = c0 + Math.floor(w / 2) - 1;
        const mr = r0 + Math.floor(h / 2) - 1;
        const gap = {
          n: [[mc, r0], [mc + 1, r0]], s: [[mc, r0 + h - 1], [mc + 1, r0 + h - 1]],
          w: [[c0, mr], [c0, mr + 1]], e: [[c0 + w - 1, mr], [c0 + w - 1, mr + 1]],
        }[side];
        for (const [c, r] of gap) room.set(c, r, T.FLOOR);
      },
      // Puts items on free floor along the outer walls.
      scatter(items) {
        const spots = [];
        for (let r = 1; r < ROWS - 1; r++) {
          for (let c = 1; c < COLS - 1; c++) {
            const edge = c === 1 || c === COLS - 2 || r === 1 || r === ROWS - 2;
            if (edge && room.get(c, r) === T.FLOOR) spots.push({ c, r });
          }
        }
        for (const item of items) {
          if (!spots.length) return;
          const { c, r } = spots.splice(Math.floor(rng.next() * spots.length), 1)[0];
          room.set(c, r, item);
        }
      },
    };
    for (let c = 0; c < COLS; c++) { room.set(c, 0, T.WALL); room.set(c, ROWS - 1, T.WALL); }
    for (let r = 0; r < ROWS; r++) { room.set(0, r, T.WALL); room.set(COLS - 1, r, T.WALL); }
    return room;
  }

  function doorOpenings(doors) {
    const points = [];
    if (doors.n !== null) points.push({ c: doors.n, r: 0 }, { c: doors.n + 1, r: 0 });
    if (doors.s !== null) points.push({ c: doors.s, r: ROWS - 1 }, { c: doors.s + 1, r: ROWS - 1 });
    if (doors.w !== null) points.push({ c: 0, r: doors.w }, { c: 0, r: doors.w + 1 });
    if (doors.e !== null) points.push({ c: COLS - 1, r: doors.e }, { c: COLS - 1, r: doors.e + 1 });
    return points;
  }

  // The ways into a room: its door openings and its stairs landing.
  function entrances(screen) {
    const points = doorOpenings(screen.doors);
    if (screen.stairs) points.push(screen.stairs.landing);
    return points;
  }

  function clearDoorZones(room, doors) {
    for (const { c, r } of doorOpenings(doors)) room.set(c, r, T.FLOOR);
    if (doors.n !== null) room.fillRect(doors.n - 1, 1, 4, 2, T.FLOOR);
    if (doors.s !== null) room.fillRect(doors.s - 1, ROWS - 3, 4, 2, T.FLOOR);
    if (doors.w !== null) room.fillRect(1, doors.w - 1, 2, 4, T.FLOOR);
    if (doors.e !== null) room.fillRect(COLS - 3, doors.e - 1, 2, 4, T.FLOOR);
  }

  // --- room fillers -------------------------------------------------------

  function fillOpenspace(room) {
    const { rng } = room;
    const len = rng.int(2, 4);
    const gap = rng.int(2, 3);
    const cubicles = rng.chance(0.5);
    const bandHeight = cubicles ? 3 : 2;
    const bands = cubicles ? [2, 8] : [3, 8];
    for (const top of bands) {
      for (let c = rng.int(2, 3); c + len <= COLS - 2; c += len + gap) {
        if (rng.chance(0.15)) continue;
        room.fillRect(c, top, len, 1, T.DESK);
        if (cubicles) room.fillRect(c, top + 1, len, 1, T.PARTITION);
        room.fillRect(c, top + bandHeight - 1, len, 1, T.DESK);
        if (c + len <= COLS - 4 && rng.chance(0.4)) room.fillRect(c + len, top, 1, bandHeight, T.PARTITION);
      }
    }
    room.scatter([T.PLANT, rng.pick([T.PLANT, T.PRINTER, T.COOLER])]);
  }

  function fillStart(room, decorate) {
    if (decorate) fillOpenspace(room);
    room.fillRect(HERO_DESK.c - 2, HERO_DESK.r, 6, 3, T.FLOOR);
    room.set(HERO_DESK.c, HERO_DESK.r, T.HERO_DESK);
    room.set(HERO_DESK.c + 1, HERO_DESK.r, T.HERO_DESK);
    const tile = { c: HERO_DESK.c, r: HERO_DESK.r + 1 };
    return { heroStart: { x: (HERO_DESK.c + 1) * TILE, y: tile.r * TILE + TILE / 2, tile } };
  }

  function fillMeeting(room) {
    const { rng } = room;
    const w = rng.int(8, 11);
    const h = rng.int(6, 8);
    const c0 = rng.int(2, COLS - 2 - w);
    const r0 = rng.int(2, ROWS - 2 - h);
    room.styleRect(c0 + 1, r0 + 1, w - 2, h - 2, FLOOR_STYLE.WOOD);
    room.outline(c0, r0, w, h, T.GLASS);
    room.openSide(c0, r0, w, h, rng.pick(['n', 's', 'w', 'e']));
    room.fillRect(c0 + 2, r0 + 2, w - 4, h - 4, T.TABLE);
    room.scatter([T.PLANT, T.PLANT, rng.pick([T.COOLER, T.SOFA])]);
  }

  function fillKitchen(room) {
    const { rng } = room;
    room.style.fill(FLOOR_STYLE.TILES);
    const len = rng.int(6, 10);
    const c0 = rng.int(2, COLS - 2 - len);
    room.fillRect(c0, 1, len, 1, T.COUNTER);
    room.set(c0 + 1, 1, T.COFFEE);
    room.set(c0 + len - 1, 1, T.FRIDGE);
    for (let i = rng.int(2, 4); i > 0; i--) {
      const c = rng.int(3, COLS - 6);
      const r = rng.int(4, ROWS - 4);
      let free = true;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 2; dc++) if (room.get(c + dc, r + dr) !== T.FLOOR) free = false;
      if (free) room.fillRect(c, r, 2, 1, T.TABLE);
    }
    room.scatter([T.COOLER, T.PLANT]);
  }

  function fillServers(room) {
    const { rng } = room;
    room.style.fill(FLOOR_STYLE.RAISED);
    for (let c = rng.int(3, 4); c <= COLS - 4; c += 3) {
      room.fillRect(c, 2, 1, ROWS - 4, T.RACK);
      for (let gaps = rng.int(1, 2); gaps > 0; gaps--) room.fillRect(c, rng.int(3, ROWS - 6), 1, 2, T.FLOOR);
    }
  }

  function fillHallway(room) {
    const { rng } = room;
    const vx = rng.int(6, 13);
    room.fillRect(vx, 1, 1, ROWS - 2, T.WALL);
    const g1 = rng.int(2, 5);
    const g2 = rng.int(7, 10);
    room.fillRect(vx, g1, 1, 2, T.FLOOR);
    room.fillRect(vx, g2, 1, 2, T.FLOOR);
    const hy = rng.int(4, 9);
    const left = rng.chance(0.5);
    const from = left ? 1 : vx + 1;
    const to = left ? vx - 1 : COLS - 2;
    room.fillRect(from, hy, to - from + 1, 1, T.WALL);
    room.fillRect(rng.int(from, to - 1), hy, 2, 1, T.FLOOR);
    room.scatter([T.PLANT, T.PLANT, T.PRINTER, T.COOLER]);
  }

  function fillBossOffice(room) {
    const { rng } = room;
    const w = 9;
    const h = 7;
    const c0 = rng.int(2, COLS - 2 - w);
    const r0 = rng.int(2, ROWS - 2 - h);
    room.styleRect(c0 + 1, r0 + 1, w - 2, h - 2, FLOOR_STYLE.CARPET_RED);
    room.outline(c0, r0, w, h, T.WALL);
    room.openSide(c0, r0, w, h, rng.pick(['s', 'w', 'e']));
    room.fillRect(c0 + 3, r0 + 2, 3, 1, T.BOSS_DESK);
    room.fillRect(c0 + 2, r0 + h - 2, 2, 1, T.SOFA);
    room.set(c0 + 1, r0 + 1, T.PLANT);
    room.set(c0 + w - 2, r0 + 1, T.PLANT);
    room.scatter([T.PLANT, T.COOLER]);
    return { bossPost: { c: c0 + 4, r: r0 + 1 } };
  }

  function fillLobby(room, decorate) {
    room.style.fill(FLOOR_STYLE.MARBLE);
    room.fillRect(1, LOBBY.turnstileRow, COLS - 2, 1, T.TURNSTILE);
    for (const c of LOBBY.passages) room.set(c, LOBBY.turnstileRow, T.FLOOR);
    for (const c of LOBBY.exitCols) room.set(c, ROWS - 1, T.EXIT);
    room.fillRect(LOBBY.exitCols[0] - 1, ROWS - 3, LOBBY.exitCols.length + 2, 2, T.FLOOR);
    room.fillRect(LOBBY.guardPost.c - 1, LOBBY.guardPost.r - 1, 3, 1, T.GUARD_DESK);
    if (decorate) {
      const { rng } = room;
      room.set(4, 4, T.PILLAR);
      room.set(COLS - 5, 4, T.PILLAR);
      const cover = [[7, 3], [12, 3], [3, 6], [16, 6], [9, 5], [10, 5], [5, 2], [14, 2]];
      for (let i = rng.int(3, 4); i > 0; i--) {
        const [c, r] = cover.splice(Math.floor(rng.next() * cover.length), 1)[0];
        room.set(c, r, T.PLANT);
      }
      room.fillRect(2, 2, 2, 1, T.SOFA);
      room.set(1, ROWS - 2, T.PLANT);
    }
    return { guardPost: LOBBY.guardPost, exit: true };
  }

  const FILLERS = {
    openspace: fillOpenspace, meeting: fillMeeting, kitchen: fillKitchen, servers: fillServers, hallway: fillHallway,
  };

  // --- assembly -----------------------------------------------------------

  function describeCell(building, floor, x, y) {
    const plan = building.floors[floor];
    const at = (cell) => cell.x === x && cell.y === y;
    const roster = FLOOR_ROSTER[floor];
    let role = 'normal';
    if (floor === FLOORS && at(plan.start)) role = 'start';
    else if (floor === 1 && at(plan.target)) role = 'lobby';
    else if (roster.boss && at(plan.bossCell)) role = 'boss';
    let stairs = null;
    if (floor > 1 && at(plan.target)) stairs = 'down';
    else if (floor < FLOORS && at(plan.start)) stairs = 'up';
    return { floor, x, y, role, stairs, roster, doors: cellDoors(plan, x, y), corner: stairCorner(building.seed, x, y) };
  }

  function placeStairs(room, corner, dir) {
    const { c, r } = corner;
    room.fillRect(c - 1, r - 1, 4, 4, T.FLOOR);
    room.fillRect(c, r, 2, 2, dir === 'down' ? T.STAIRS_DOWN : T.STAIRS_UP);
    const landing = { c: c === 1 ? c + 2 : c - 1, r: r === 1 ? r + 1 : r };
    return { dir, c, r, landing };
  }

  function requiredPoints(screen, extras) {
    const points = doorOpenings(screen.doors);
    if (screen.stairs) points.push(screen.stairs.landing, { c: screen.stairs.c, r: screen.stairs.r });
    if (screen.heroStart) points.push(screen.heroStart.tile);
    if (extras.guardPost) points.push(extras.guardPost);
    if (extras.bossPost) points.push(extras.bossPost);
    if (screen.exit) for (const c of LOBBY.exitCols) points.push({ c, r: ROWS - 1 });
    return points;
  }

  function chooseSpawns(screen, cell, room, extras, reachable) {
    const { rng } = room;
    if (screen.role === 'start') return [];
    if (screen.role === 'lobby') return [{ type: 'guard', ...extras.guardPost, dir: 'up' }];
    const spawns = [];
    if (extras.bossPost) spawns.push({ type: cell.roster.boss, ...extras.bossPost, dir: 'down' });
    const count = screen.role === 'boss' ? 0 : rng.int(cell.roster.count[0], cell.roster.count[1]);
    const fromDoors = distanceMap(screen.tiles, entrances(screen));
    let candidates = [];
    for (let r = 1; r < ROWS - 1; r++) {
      for (let c = 1; c < COLS - 1; c++) {
        const i = index(c, r);
        if (screen.tiles[i] === T.FLOOR && reachable[i] >= 0 && fromDoors[i] >= SPAWN_DOOR_DISTANCE) candidates.push({ c, r });
      }
    }
    for (let n = 0; n < count && candidates.length; n++) {
      const spot = rng.pick(candidates);
      spawns.push({ type: rng.weighted(cell.roster.weights), ...spot, dir: rng.pick(DIRECTIONS) });
      candidates = candidates.filter((p) => Math.max(Math.abs(p.c - spot.c), Math.abs(p.r - spot.r)) >= SPAWN_GAP);
    }
    return spawns;
  }

  function buildScreen(cell, rng, decorate) {
    const room = makeRoom(rng);
    let kind = cell.role;
    let extras = {};
    if (cell.role === 'start') extras = fillStart(room, decorate);
    else if (cell.role === 'lobby') extras = fillLobby(room, decorate);
    else if (cell.role === 'boss') extras = decorate ? fillBossOffice(room) : {};
    else if (decorate) {
      kind = rng.weighted(KIND_WEIGHTS);
      FILLERS[kind](room);
    }
    clearDoorZones(room, cell.doors);
    const screen = {
      floor: cell.floor, x: cell.x, y: cell.y, role: cell.role, kind,
      tiles: room.tiles, style: room.style, doors: cell.doors,
      stairs: cell.stairs ? placeStairs(room, cell.corner, cell.stairs) : null,
      heroStart: extras.heroStart || null,
      exit: !!extras.exit,
      spawns: [],
    };
    if (cell.role === 'boss' && !extras.bossPost) extras.bossPost = { c: Math.floor(COLS / 2), r: Math.floor(ROWS / 2) };

    const points = requiredPoints(screen, extras);
    const reachable = distanceMap(screen.tiles, [points[0]]);
    if (!points.every((p) => reachable[index(p.c, p.r)] >= 0)) return null;
    screen.spawns = chooseSpawns(screen, cell, room, extras, reachable);
    return screen;
  }

  // Interiors are built lazily, but always the same way for the same building seed and cell.
  function generateScreen(building, floor, x, y) {
    const cell = describeCell(building, floor, x, y);
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const screen = buildScreen(cell, makeRng(hash(building.seed, floor, x, y, attempt)), true);
      if (screen) return screen;
    }
    return buildScreen(cell, makeRng(hash(building.seed, floor, x, y, MAX_ATTEMPTS)), false);
  }

  const api = { generateScreen, doorOpenings, entrances };
  if (node) module.exports = api;
  else root.Rooms = api;
})(this);
