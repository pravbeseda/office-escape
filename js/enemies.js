(function (root) {
  'use strict';
  const node = typeof module !== 'undefined';
  const { TILE } = node ? require('./tiles.js') : root.Tiles;
  const { findPath } = node ? require('./grid.js') : root.Grid;
  const { moveBody } = node ? require('./physics.js') : root.Physics;
  const { hasLineOfSight, inCone } = node ? require('./sight.js') : root.Sight;

  const FOV_DEG = 110;
  const REACTION_TIME = 0.4;
  const NEAR_SENSE = 18;
  const SEARCH_TIME = 2.4;
  const LOOK_INTERVAL = 0.6;
  const PATROL_SPEED_FACTOR = 0.5;
  const STUCK_LIMIT = 0.8;
  const GIVE_UP_AFTER = 6;
  const ARRIVE_DISTANCE = 2;
  const BODY_HALF = 5;

  // speed in px/s (the hero runs at 72), sight in tiles, memory in seconds of tracking after losing sight.
  const ENEMY_TYPES = {
    pm: {
      name: 'PM', speed: 50, sight: 7, memory: 1.2,
      lines: [
        'Есть минутка? Давай быстренько созвонимся, буквально на час.',
        'А что по срокам? Мне нужен статус к обеду. Вчерашнему.',
        'Тут клиент попросил одну маленькую правку. Совсем крошечную.',
      ],
    },
    lead: {
      name: 'Тимлид', speed: 57, sight: 8, memory: 1.8,
      lines: [
        'Код-ревью само себя не сделает.',
        'Прод упал. Ты же не домой собрался?',
        'Давай-ка возьмёшь ещё один тикет до вечера.',
      ],
    },
    director: {
      name: 'Директор', speed: 63, sight: 9, memory: 2.4,
      lines: [
        'Зайди ко мне. Обсудим твою мотивацию.',
        'Мы же одна семья! Куда ты собрался?',
        'Овертайм — это инвестиция в себя.',
      ],
    },
    ceo: {
      name: 'CEO', speed: 68, sight: 10, memory: 3.2,
      lines: [
        'У нас стратегическая сессия до полуночи. Ты нам нужен.',
        'Мы меняем мир! Без тебя никак.',
        'Опционы получишь... когда-нибудь. Садись.',
      ],
    },
    guard: {
      name: 'Вахтёр', speed: 82, sight: 9, memory: 0.6, stationary: true,
      lines: [
        'Куда без отметки? Рабочий день ещё не кончился.',
        'Пропуск забыли? Возвращайтесь на рабочее место.',
      ],
    },
  };

  const FLOOR_ROSTER = {
    5: { count: [0, 1], weights: { pm: 1 } },
    4: { count: [1, 1], weights: { pm: 2, lead: 1 } },
    3: { count: [1, 2], weights: { pm: 1, lead: 2 }, boss: 'director' },
    2: { count: [1, 2], weights: { lead: 2, director: 1 }, boss: 'ceo' },
    1: { count: [1, 2], weights: { pm: 1, lead: 1, director: 1 } },
  };

  const DIR_VECTORS = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
  const CLOCKWISE = ['up', 'right', 'down', 'left'];

  const tileOf = (p) => ({ c: Math.floor(p.x / TILE), r: Math.floor(p.y / TILE) });
  const centerOf = (t) => ({ x: t.c * TILE + TILE / 2, y: t.r * TILE + TILE / 2 });

  function createEnemy(spawn) {
    const dir = spawn.dir || 'down';
    const { x, y } = centerOf(spawn);
    return {
      type: spawn.type, x, y, half: BODY_HALF,
      dir, fx: DIR_VECTORS[dir][0], fy: DIR_VECTORS[dir][1],
      home: { x, y },
      state: ENEMY_TYPES[spawn.type].stationary ? 'post' : 'patrol',
      timer: 0, wait: 0, stuck: 0, lookTimer: LOOK_INTERVAL,
      goal: null, path: null, pathKey: '',
      lastSeen: null, lostTime: 0,
      gaze: 'look', gazeTimer: 2,
      moving: false, anim: 0,
    };
  }

  function setDir(e, dir) {
    e.dir = dir;
    [e.fx, e.fy] = DIR_VECTORS[dir];
  }

  function face(e, dx, dy) {
    const len = Math.hypot(dx, dy);
    if (!len) return;
    e.fx = dx / len;
    e.fy = dy / len;
    e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }

  function canSee(e, hero, tiles) {
    if (e.state === 'post' && e.gaze !== 'look') return false;
    const dx = hero.x - e.x;
    const dy = hero.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist > ENEMY_TYPES[e.type].sight * TILE) return false;
    const aware = e.state === 'chase' || dist < NEAR_SENSE;
    if (!aware && !inCone(e.fx, e.fy, dx, dy, FOV_DEG)) return false;
    return hasLineOfSight(tiles, e.x, e.y, hero.x, hero.y);
  }

  // Steps along the shortest tile path; returns true once the target is reached.
  function moveToward(e, target, speed, ctx) {
    if (Math.hypot(target.x - e.x, target.y - e.y) <= ARRIVE_DISTANCE) return true;
    const here = tileOf(e);
    const goal = tileOf(target);
    let next = target;
    if (here.c !== goal.c || here.r !== goal.r) {
      const key = `${here.c},${here.r}>${goal.c},${goal.r}`;
      if (e.pathKey !== key) {
        e.path = findPath(ctx.tiles, here, goal);
        e.pathKey = key;
      }
      if (e.path && e.path.length > 2) next = centerOf(e.path[1]);
    }
    const dx = next.x - e.x;
    const dy = next.y - e.y;
    const len = Math.hypot(dx, dy) || 1;
    const step = Math.min(speed * ctx.dt, len);
    const bx = e.x;
    const by = e.y;
    moveBody(e, (dx / len) * step, (dy / len) * step, ctx.tiles);
    const moved = Math.hypot(e.x - bx, e.y - by);
    e.stuck = moved < step * 0.25 ? e.stuck + ctx.dt : 0;
    e.moving = moved > 0;
    face(e, dx, dy);
    return false;
  }

  function lookAround(e, dt) {
    e.lookTimer -= dt;
    if (e.lookTimer > 0) return;
    e.lookTimer = LOOK_INTERVAL;
    setDir(e, CLOCKWISE[(CLOCKWISE.indexOf(e.dir) + 1) % CLOCKWISE.length]);
  }

  function spot(e, hero) {
    e.state = 'alert';
    e.timer = REACTION_TIME;
    face(e, hero.x - e.x, hero.y - e.y);
    return 'spotted';
  }

  function startSearch(e) {
    e.state = 'search';
    e.timer = SEARCH_TIME;
    e.lookTimer = LOOK_INTERVAL;
  }

  function patrol(e, type, ctx) {
    if (e.wait > 0) {
      e.wait -= ctx.dt;
      lookAround(e, ctx.dt);
      return;
    }
    if (!e.goal) {
      e.goal = centerOf(ctx.rng.pick(ctx.walkable));
      e.stuck = 0;
    }
    if (moveToward(e, e.goal, type.speed * PATROL_SPEED_FACTOR, ctx) || e.stuck > STUCK_LIMIT) {
      e.goal = null;
      e.wait = 0.6 + ctx.rng.next() * 1.4;
    }
  }

  // The guard alternates between watching the hall and hiding behind a newspaper.
  function watchPost(e, ctx) {
    e.gazeTimer -= ctx.dt;
    if (e.gaze === 'read') {
      if (e.gazeTimer <= 0) {
        e.gaze = 'look';
        e.gazeTimer = 2 + ctx.rng.next();
        e.lookTimer = 0;
      }
      return;
    }
    e.lookTimer -= ctx.dt;
    if (e.lookTimer <= 0) {
      setDir(e, e.dir === 'up' ? 'left' : 'up');
      e.lookTimer = 1;
    }
    if (e.gazeTimer <= 0) {
      e.gaze = 'read';
      e.gazeTimer = 2.5 + ctx.rng.next() * 1.5;
      setDir(e, 'down');
    }
  }

  function chase(e, type, sees, ctx) {
    e.lostTime = sees ? 0 : e.lostTime + ctx.dt;
    if (e.lostTime <= type.memory) e.lastSeen = { x: ctx.hero.x, y: ctx.hero.y };
    const arrived = moveToward(e, e.lastSeen, type.speed, ctx);
    if (e.lostTime > type.memory && (arrived || e.lostTime > type.memory + GIVE_UP_AFTER)) startSearch(e);
  }

  // ctx: { tiles, hero, dt, rng, walkable }. Returns 'spotted' on the frame the hero gets noticed.
  function updateEnemy(e, ctx) {
    const type = ENEMY_TYPES[e.type];
    const sees = canSee(e, ctx.hero, ctx.tiles);
    e.moving = false;
    e.anim += ctx.dt;
    switch (e.state) {
      case 'patrol':
        if (sees) return spot(e, ctx.hero);
        patrol(e, type, ctx);
        return null;
      case 'post':
        if (sees) return spot(e, ctx.hero);
        watchPost(e, ctx);
        return null;
      case 'alert':
        face(e, ctx.hero.x - e.x, ctx.hero.y - e.y);
        e.timer -= ctx.dt;
        if (e.timer <= 0) {
          e.state = 'chase';
          e.lostTime = 0;
          e.lastSeen = { x: ctx.hero.x, y: ctx.hero.y };
        }
        return null;
      case 'chase':
        chase(e, type, sees, ctx);
        return null;
      case 'search':
        if (sees) {
          e.state = 'chase';
          e.lostTime = 0;
          return null;
        }
        lookAround(e, ctx.dt);
        e.timer -= ctx.dt;
        if (e.timer <= 0) e.state = type.stationary ? 'return' : 'patrol';
        return null;
      case 'return':
        if (sees) return spot(e, ctx.hero);
        if (moveToward(e, e.home, type.speed * PATROL_SPEED_FACTOR, ctx)) {
          e.state = 'post';
          e.gaze = 'look';
          e.gazeTimer = 2;
          setDir(e, 'up');
        }
        return null;
      default:
        return null;
    }
  }

  const isChasing = (e) => e.state === 'chase' || e.state === 'alert';

  const api = {
    ENEMY_TYPES, FLOOR_ROSTER, SEARCH_TIME,
    createEnemy, updateEnemy, canSee, isChasing, tileOf,
  };
  if (node) module.exports = api;
  else root.Enemies = api;
})(this);
