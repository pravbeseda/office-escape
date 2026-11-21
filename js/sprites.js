(function (root) {
  'use strict';

  const SIZE = 16;
  const OUTLINE = '#1a1220';
  const FONT = '"Press Start 2P", monospace';

  // Letters are palette slots: H hair, S skin, E eyes, G glasses, M mouth, T top, A sleeve,
  // W collar, K tie, P pants, B shoes, C cap, V visor, X headphones, L laptop.
  const BODY = {
    down: [
      '................',
      '.....HHHHHH.....',
      '....HHHHHHHH....',
      '....HHHHHHHH....',
      '....HSSSSSSH....',
      '....SGEGGEGS....',
      '....SSSSSSSS....',
      '.....SSMMSS.....',
      '....TTWKKWTT....',
      '...ATTTKKTTTA...',
      '...ATTTKKTTTA...',
      '...STTTTTTTTS...',
    ],
    up: [
      '................',
      '.....HHHHHH.....',
      '....HHHHHHHH....',
      '....HHHHHHHH....',
      '....HHHHHHHH....',
      '....HHHHHHHH....',
      '....SHHHHHHS....',
      '.....SSSSSS.....',
      '....TTTTTTTT....',
      '...ATTTTTTTTA...',
      '...ATTTTTTTTA...',
      '...STTTTTTTTS...',
    ],
    right: [
      '................',
      '.....HHHHHH.....',
      '....HHHHHHHH....',
      '....HHHHHHHH....',
      '....HHHSSSSS....',
      '....HHSSSGES....',
      '....HHSSSSSS....',
      '.....SSSSSMS....',
      '.....TTTTTT.....',
      '.....TTAATT.....',
      '.....TTAATT.....',
      '.....TTSSTT.....',
    ],
  };

  const FRONT_LEGS = [
    ['....PPPPPPPP....', '....PPP..PPP....', '....BBB..BBB....'],
    ['....PPPPPPPP....', '....BBB..PPP....', '.........BBB....'],
    ['....PPPPPPPP....', '....PPP..BBB....', '....BBB.........'],
  ];
  const SIDE_LEGS = [
    ['.....PPPPPP.....', '......PPPP......', '......BBBBB.....'],
    ['.....PPPPPP.....', '.....PP..PPP....', '....BBB...BBBB..'],
    ['.....PPPPPP.....', '....PPP..PP.....', '...BBBB...BBB...'],
  ];

  // Walk cycle: neutral, one leg, neutral, the other leg.
  const WALK_CYCLE = [0, 1, 0, 2];

  const LOOKS = {
    hero: { hair: '#3a2618', skin: '#f2c79a', top: '#3f7f4b', pants: '#33416e', shoes: '#262626', glasses: '#111111' },
    pm: { hair: '#d9a441', skin: '#f5d0a9', top: '#7fb2e5', pants: '#4a4f5e', shoes: '#3a2a1e', laptop: '#b8bcc6' },
    lead: { hair: '#2b2b2b', skin: '#e0b088', top: '#b5413a', pants: '#2f3a52', shoes: '#202020', headphones: '#26262e' },
    director: { hair: '#8a8a8a', skin: '#f0c090', top: '#4a4f5a', collar: '#f4f4f4', tie: '#c0282d', pants: '#3a3e48', shoes: '#141414', bald: true },
    ceo: { hair: '#161616', skin: '#e8b888', top: '#1f2b52', collar: '#f4f4f4', tie: '#f0c030', pants: '#1a2244', shoes: '#0e0e0e', shades: '#0a0a0a' },
    guard: { hair: '#4a3a2a', skin: '#e9b98f', top: '#34497a', pants: '#26314f', shoes: '#111111', cap: '#2c3e66', visor: '#151c30', mustache: '#4a3020' },
  };

  function shade(hex, factor) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (shift) => Math.min(255, Math.round(((n >> shift) & 255) * factor));
    return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
  }

  function makeCanvas(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return canvas;
  }

  // Renders rows of palette letters ('.' is transparent), optionally with a 1px outline.
  function pixelCanvas(rows, palette, outline) {
    const h = rows.length;
    const w = rows[0].length;
    const canvas = makeCanvas(w, h);
    const g = canvas.getContext('2d');
    const filled = (c, r) => r >= 0 && r < h && c >= 0 && c < w && rows[r][c] !== '.';
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (filled(c, r)) {
          g.fillStyle = palette[rows[r][c]];
          g.fillRect(c, r, 1, 1);
        } else if (outline && (filled(c - 1, r) || filled(c + 1, r) || filled(c, r - 1) || filled(c, r + 1))) {
          g.fillStyle = outline;
          g.fillRect(c, r, 1, 1);
        }
      }
    }
    return canvas;
  }

  function mirror(canvas) {
    const out = makeCanvas(canvas.width, canvas.height);
    const g = out.getContext('2d');
    g.scale(-1, 1);
    g.drawImage(canvas, -canvas.width, 0);
    return out;
  }

  function applyFeatures(grid, view, look) {
    const set = (c, r, ch) => { grid[r][c] = ch; };
    const swap = (r, from, to, c0 = 0, c1 = SIZE - 1) => {
      for (let c = c0; c <= c1; c++) if (grid[r][c] === from) grid[r][c] = to;
    };
    if (look.bald) {
      swap(1, 'H', 'S');
      swap(2, 'H', 'S');
      if (view !== 'up') swap(3, 'H', 'S', 5, 10);
    }
    if (look.cap) {
      for (const r of [1, 2, 3]) swap(r, 'H', 'C');
      if (view === 'up') swap(4, 'H', 'C');
      if (view === 'down') for (let c = 3; c <= 12; c++) set(c, 4, 'V');
      if (view === 'right') for (let c = 8; c <= 12; c++) set(c, 4, 'V');
    }
    if (look.headphones) {
      for (let c = 5; c <= 10; c++) set(c, 1, 'X');
      const cups = view === 'right' ? [[6, 4], [7, 4], [6, 5], [7, 5]] : [[3, 4], [3, 5], [12, 4], [12, 5]];
      for (const [c, r] of cups) set(c, r, 'X');
    }
    if (look.laptop) {
      const area = { down: [12, 14, 9, 11], up: [1, 3, 9, 11], right: [8, 11, 9, 10] }[view];
      for (let r = area[2]; r <= area[3]; r++) for (let c = area[0]; c <= area[1]; c++) set(c, r, 'L');
    }
  }

  // Returns {down, up, left, right}: arrays of frames [neutral, step A, step B].
  function buildCharacter(look) {
    const palette = {
      H: look.hair, S: look.skin, E: look.shades || '#1a1a1a', G: look.shades || look.glasses || look.skin,
      M: look.mustache || look.skin, T: look.top, A: shade(look.top, 0.78), W: look.collar || look.top,
      K: look.tie || look.top, P: look.pants, B: look.shoes, C: look.cap, V: look.visor, X: look.headphones, L: look.laptop,
    };
    const frames = {};
    for (const view of ['down', 'up', 'right']) {
      const legs = view === 'right' ? SIDE_LEGS : FRONT_LEGS;
      frames[view] = legs.map((legRows) => {
        const grid = [...BODY[view], ...legRows, '.'.repeat(SIZE)].map((row) => row.split(''));
        applyFeatures(grid, view, look);
        return pixelCanvas(grid.map((row) => row.join('')), palette, OUTLINE);
      });
    }
    frames.left = frames.right.map(mirror);
    return frames;
  }

  function frameFor(frames, dir, moving, anim) {
    const step = moving ? WALK_CYCLE[Math.floor(anim * 8) % WALK_CYCLE.length] : 0;
    return frames[dir][step];
  }

  root.Sprites = { LOOKS, OUTLINE, FONT, makeCanvas, pixelCanvas, buildCharacter, frameFor };
})(this);
