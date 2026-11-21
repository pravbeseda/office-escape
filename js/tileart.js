(function (root) {
  'use strict';
  const { TILE, COLS, ROWS, T, FLOOR_STYLE } = root.Tiles;
  const { hash } = root.Rng;
  const { FONT, makeCanvas, pixelCanvas } = root.Sprites;

  // Small objects drawn from letter maps over the floor.
  const ITEM_ART = {
    [T.PLANT]: {
      rows: [
        '................',
        '......gg........',
        '....gGGgg.gg....',
        '...gGGGgggGGg...',
        '..gGGlGGgGGGGg..',
        '..gGlGGGGGlGGg..',
        '...gGGGgGGGGg...',
        '..gGGGGGGlGGGg..',
        '..gGlGGGGGGGg...',
        '...ggGGgGGgg....',
        '....oOOOOOOo....',
        '.....oOOOOo.....',
        '.....oOOOOo.....',
        '.....oOOOOo.....',
        '......oooo......',
        '................',
      ],
      palette: { g: '#2a6a35', G: '#3f9a4c', l: '#7fd07a', o: '#8a4428', O: '#c0683f' },
    },
    [T.COOLER]: {
      rows: [
        '................',
        '.....bbbbbb.....',
        '....bBBBBBBb....',
        '....bBwBBBBb....',
        '....bBwBBBBb....',
        '....bBBBBBBb....',
        '.....bbbbbb.....',
        '....kkkkkkkk....',
        '....kWWWWWWk....',
        '....kWrWWbWk....',
        '....kWWWWWWk....',
        '....kWWWWWWk....',
        '....kWWWWWWk....',
        '....kSSSSSSk....',
        '....kkkkkkkk....',
        '................',
      ],
      palette: { b: '#3b86b8', B: '#7cc6ef', w: '#e6f7ff', k: '#6d717a', W: '#e9ebee', S: '#c4c8ce', r: '#e04848' },
    },
    [T.PRINTER]: {
      rows: [
        '................',
        '................',
        '.....wwwwww.....',
        '...kkkkkkkkkk...',
        '...kGGGGGGGGk...',
        '...kGddddddGk...',
        '...kGGGGGGgGk...',
        '...kGGGGGGGGk...',
        '...kHHHHHHHHk...',
        '...kGGwwwwGGk...',
        '...kGGGGGGGGk...',
        '...kSSSSSSSSk...',
        '...kkkkkkkkkk...',
        '....k......k....',
        '................',
        '................',
      ],
      palette: { G: '#d9dce2', S: '#b4b8c0', d: '#3a3d44', g: '#4cd964', H: '#a8acb5', k: '#5a5e66', w: '#ffffff' },
    },
    [T.FRIDGE]: {
      rows: [
        '..kkkkkkkkkkkk..',
        '..kWWWWWWWWWWk..',
        '..kWWWWWWWWhWk..',
        '..kWWWWWWWWhWk..',
        '..kWWWWWWWWWWk..',
        '..kkkkkkkkkkkk..',
        '..kWWWWWWWWWWk..',
        '..kWWWWWWWWhWk..',
        '..kWWWWWWWWhWk..',
        '..kWWWWWWWWhWk..',
        '..kWWWWWWWWWWk..',
        '..kWWWWWWWWWWk..',
        '..kSSSSSSSSSSk..',
        '..kSSSSSSSSSSk..',
        '..kkkkkkkkkkkk..',
        '................',
      ],
      palette: { W: '#eef1f4', S: '#c9ced6', h: '#9aa0a8', k: '#6a707a' },
    },
    [T.PILLAR]: {
      rows: [
        '..kkkkkkkkkkkk..',
        '..kHHHHHHHHHHk..',
        '..kkkkkkkkkkkk..',
        '...kMMlMMMMsk...',
        '...kMMlMMMMsk...',
        '...kMMlMMMMsk...',
        '...kMMlMMMMsk...',
        '...kMMlMMMMsk...',
        '...kMMlMMMMsk...',
        '...kMMlMMMMsk...',
        '...kMMlMMMMsk...',
        '...kMMlMMMMsk...',
        '..kkkkkkkkkkkk..',
        '..kHHHHHHHHHHk..',
        '..kSSSSSSSSSSk..',
        '..kkkkkkkkkkkk..',
      ],
      palette: { k: '#8c8272', H: '#f1ece2', M: '#e2dccf', l: '#f8f5ee', s: '#c3baa9', S: '#b3a998' },
    },
    [T.COFFEE]: {
      rows: [
        '................',
        '...kkkkkkkkkk...',
        '...kDDDDDDDDk...',
        '...kDrDDDgDDk...',
        '...kDDDDDDDDk...',
        '...kDkkkkkkDk...',
        '...kDk....kDk...',
        '...kDk.cc.kDk...',
        '...kDk.cc.kDk...',
        '...kDkkkkkkDk...',
        '...kkkkkkkkkk...',
      ],
      palette: { k: '#16161a', D: '#34343c', r: '#e04848', g: '#4cd964', c: '#f4f4f4' },
    },
  };

  const itemCache = new Map();
  function itemCanvas(id) {
    if (!itemCache.has(id)) itemCache.set(id, pixelCanvas(ITEM_ART[id].rows, ITEM_ART[id].palette, null));
    return itemCache.get(id);
  }

  const MONITOR_COLORS = ['#5fb8e8', '#4fd1c5', '#7a8fd6', '#334058'];

  function paintScreen(screen) {
    const canvas = makeCanvas(COLS * TILE, ROWS * TILE);
    const g = canvas.getContext('2d');
    const leds = [];
    const at = (c, r) => (c < 0 || r < 0 || c >= COLS || r >= ROWS ? T.WALL : screen.tiles[r * COLS + c]);
    const rect = (x, y, w, h, color) => { g.fillStyle = color; g.fillRect(x, y, w, h); };
    const noise = (c, r, i) => hash(screen.floor, screen.x * 31 + c, screen.y * 31 + r, i);

    function floor(c, r) {
      const x = c * TILE;
      const y = r * TILE;
      const style = screen.style[r * COLS + c];
      if (style === FLOOR_STYLE.CARPET || style === FLOOR_STYLE.CARPET_RED) {
        const red = style === FLOOR_STYLE.CARPET_RED;
        rect(x, y, TILE, TILE, (c + r) % 2 ? (red ? '#7b3b3f' : '#56657f') : (red ? '#824240' : '#5b6a85'));
        for (let i = 0; i < 6; i++) {
          rect(x + (noise(c, r, i) % TILE), y + (noise(c, r, i + 9) % TILE), 1, 1, i % 2 ? (red ? '#6c3236' : '#4d5b74') : (red ? '#8f4d4a' : '#66758f'));
        }
      } else if (style === FLOOR_STYLE.TILES) {
        for (let q = 0; q < 4; q++) rect(x + (q % 2) * 8, y + (q >> 1) * 8, 8, 8, (q === 0 || q === 3) ? '#e4ddcc' : '#cfc5b0');
        rect(x, y + 15, TILE, 1, '#b8ad97');
        rect(x + 15, y, 1, TILE, '#b8ad97');
      } else if (style === FLOOR_STYLE.RAISED) {
        rect(x, y, TILE, TILE, '#7b818d');
        rect(x, y, TILE, 1, '#959ba7');
        rect(x, y, 1, TILE, '#959ba7');
        rect(x, y + 15, TILE, 1, '#5d636f');
        rect(x + 15, y, 1, TILE, '#5d636f');
        for (let i = 3; i < TILE; i += 4) for (let j = 3; j < TILE; j += 4) rect(x + i, y + j, 1, 1, '#6b717d');
      } else if (style === FLOOR_STYLE.MARBLE) {
        rect(x, y, TILE, TILE, '#d7cfc0');
        rect(x, y + 15, TILE, 1, '#c0b6a4');
        rect(x + 15, y, 1, TILE, '#c0b6a4');
        if (noise(c, r, 1) % 3 === 0) {
          const sx = noise(c, r, 2) % 8;
          for (let i = 0; i < 7; i++) rect(x + sx + i, y + 3 + i + (i >> 2), 1, 1, '#c6bcaa');
        }
      } else {
        for (let py = 0; py < TILE; py += 4) {
          rect(x, y + py, TILE, 4, (py / 4 + r) % 2 ? '#9a6a41' : '#a47448');
          rect(x, y + py + 3, TILE, 1, '#7d5434');
          rect(x + (noise(c, r, py) % 12) + 2, y + py, 1, 3, '#7d5434');
        }
      }
    }

    function wall(c, r, x, y) {
      const below = at(c, r + 1);
      const face = below !== T.WALL && below !== T.EXIT;
      rect(x, y, TILE, TILE, '#8c7f6a');
      if (at(c, r - 1) !== T.WALL) rect(x, y, TILE, 1, '#b2a58c');
      if (face) {
        rect(x, y + 6, TILE, 10, '#d1c3a5');
        rect(x, y + 6, TILE, 1, '#a89a7e');
        rect(x, y + 13, TILE, 3, '#6a5d4a');
      }
      if (at(c - 1, r) !== T.WALL) rect(x, y, 1, face ? 6 : TILE, '#5c503e');
      if (at(c + 1, r) !== T.WALL) rect(x + 15, y, 1, face ? 6 : TILE, '#5c503e');
    }

    // Surfaces (desks, tables, counters) merge with same-kind neighbours into one top.
    function surface(c, r, x, y, top, edge, light, kinds) {
      const same = (dc, dr) => kinds.includes(at(c + dc, r + dr));
      rect(x, y, TILE, TILE, top);
      if (!same(0, -1)) rect(x, y, TILE, 1, light);
      if (!same(0, 1)) rect(x, y + 12, TILE, 4, edge);
      if (!same(-1, 0)) rect(x, y, 1, TILE, edge);
      if (!same(1, 0)) rect(x + 15, y, 1, TILE, edge);
    }

    function chairBelow(c, r, x, y) {
      if (at(c, r + 1) !== T.FLOOR) return;
      rect(x + 4, y + 16, 8, 5, '#2f333e');
      rect(x + 4, y + 16, 8, 1, '#4a5060');
    }

    function monitor(x, y, screenColor) {
      rect(x + 3, y + 1, 10, 7, '#262a35');
      rect(x + 4, y + 2, 8, 5, screenColor);
      rect(x + 5, y + 3, 2, 1, '#ffffff');
      rect(x + 7, y + 8, 2, 1, '#262a35');
      rect(x + 4, y + 9, 8, 2, '#d9d9de');
      rect(x + 4, y + 10, 8, 1, '#a9a9b0');
    }

    const DESKS = [T.DESK, T.HERO_DESK];

    function tile(c, r) {
      const id = at(c, r);
      const x = c * TILE;
      const y = r * TILE;
      switch (id) {
        case T.WALL: wall(c, r, x, y); break;
        case T.DESK:
          surface(c, r, x, y, '#b7834f', '#7a522e', '#d39d66', DESKS);
          monitor(x, y, MONITOR_COLORS[noise(c, r, 5) % MONITOR_COLORS.length]);
          chairBelow(c, r, x, y);
          break;
        case T.HERO_DESK:
          surface(c, r, x, y, '#b7834f', '#7a522e', '#d39d66', DESKS);
          monitor(x, y, '#10301c');
          rect(x + 5, y + 3, 4, 1, '#4cd964');
          rect(x + 6, y + 4, 5, 1, '#4cd964');
          rect(x + 5, y + 5, 3, 1, '#a0f0b0');
          if (at(c - 1, r) === T.HERO_DESK) {
            rect(x + 12, y + 8, 3, 4, '#f4f4f4');
            rect(x + 15, y + 9, 1, 2, '#f4f4f4');
            rect(x + 12, y + 8, 3, 1, '#6b3b1e');
          } else {
            rect(x + 2, y + 1, 3, 3, '#ffe14d');
          }
          chairBelow(c, r, x, y);
          break;
        case T.PARTITION: {
          rect(x, y, TILE, TILE, '#6c798d');
          for (let i = 0; i < 8; i++) rect(x + (noise(c, r, i) % TILE), y + 3 + (noise(c, r, i + 20) % 10), 1, 1, '#627084');
          if (at(c, r - 1) !== T.PARTITION) rect(x, y, TILE, 3, '#aab5c4');
          if (at(c, r + 1) !== T.PARTITION) rect(x, y + 13, TILE, 3, '#525d6f');
          if (at(c - 1, r) !== T.PARTITION) rect(x, y, 1, TILE, '#454f60');
          if (at(c + 1, r) !== T.PARTITION) rect(x + 15, y, 1, TILE, '#454f60');
          break;
        }
        case T.TABLE:
          surface(c, r, x, y, '#a06a42', '#6a4226', '#bf8456', [T.TABLE]);
          if (noise(c, r, 3) % 3 === 0) { rect(x + 4, y + 3, 6, 5, '#f2f2f2'); rect(x + 5, y + 4, 4, 1, '#9aa0aa'); }
          else if (noise(c, r, 3) % 3 === 1) { rect(x + 9, y + 5, 3, 3, '#e8e8e8'); rect(x + 9, y + 5, 3, 1, '#6b3b1e'); }
          break;
        case T.GLASS: {
          const horizontal = at(c - 1, r) === T.GLASS || at(c + 1, r) === T.GLASS;
          g.fillStyle = 'rgba(165, 222, 248, 0.38)';
          g.fillRect(x, y, TILE, TILE);
          if (horizontal) {
            rect(x, y + 5, TILE, 1, '#e6f8ff');
            rect(x, y + 11, TILE, 2, '#6e9fb5');
            if ((c + r) % 3 === 0) { rect(x + 4, y + 7, 1, 1, '#ffffff'); rect(x + 5, y + 8, 1, 1, '#ffffff'); }
          } else {
            rect(x + 6, y, 1, TILE, '#e6f8ff');
            rect(x + 9, y, 2, TILE, '#6e9fb5');
          }
          break;
        }
        case T.RACK: {
          rect(x, y, TILE, TILE, '#1f232c');
          rect(x, y, 1, TILE, '#12151b');
          rect(x + 15, y, 1, TILE, '#12151b');
          if (at(c, r - 1) !== T.RACK) rect(x, y, TILE, 2, '#3d4350');
          for (const sy of [4, 9, 14]) rect(x + 2, y + sy, 12, 1, '#2c313c');
          for (const ly of [2, 7, 12]) {
            for (const lx of [3, 5, 7]) {
              rect(x + lx, y + ly, 1, 1, '#1e5a2e');
              leds.push({ x: x + lx, y: y + ly, phase: noise(c, r, lx * 16 + ly) % 1000 / 1000, amber: noise(c, r, lx + ly) % 5 === 0 });
            }
          }
          break;
        }
        case T.COUNTER:
        case T.COFFEE:
          surface(c, r, x, y, '#c8ccd3', '#8a8f99', '#e1e4e8', [T.COUNTER, T.COFFEE, T.FRIDGE]);
          rect(x + 7, y + 13, 1, 3, '#70757f');
          if (id === T.COFFEE) g.drawImage(itemCanvas(T.COFFEE), x, y);
          break;
        case T.SOFA: {
          const left = at(c - 1, r) === T.SOFA;
          const right = at(c + 1, r) === T.SOFA;
          rect(x, y + 2, TILE, 13, '#4f63a8');
          rect(x, y + 2, TILE, 4, '#3c4d86');
          rect(x + 1, y + 7, 14, 6, '#5f75c0');
          if (!left) rect(x, y + 2, 3, 13, '#3c4d86');
          if (!right) rect(x + 13, y + 2, 3, 13, '#3c4d86');
          if (left) rect(x, y + 7, 1, 6, '#3c4d86');
          break;
        }
        case T.BOSS_DESK:
          surface(c, r, x, y, '#6b3f22', '#4a2a14', '#87532f', [T.BOSS_DESK]);
          if (at(c - 1, r) === T.BOSS_DESK && at(c + 1, r) === T.BOSS_DESK) {
            rect(x + 6, y + 2, 4, 2, '#f0c030');
            rect(x + 7, y + 4, 2, 4, '#c99a20');
            rect(x + 5, y + 8, 6, 1, '#c99a20');
          } else {
            rect(x + 3, y + 3, 8, 6, '#f2f2f2');
            rect(x + 4, y + 5, 6, 1, '#9aa0aa');
          }
          break;
        case T.GUARD_DESK:
          surface(c, r, x, y, '#8e6a44', '#5e4428', '#a8825a', [T.GUARD_DESK]);
          if (at(c - 1, r) !== T.GUARD_DESK) { rect(x + 4, y + 2, 9, 7, '#262a35'); rect(x + 5, y + 3, 7, 5, '#7d8a8f'); rect(x + 6, y + 4, 2, 1, '#c9d3d6'); }
          else if (at(c + 1, r) !== T.GUARD_DESK) { rect(x + 4, y + 4, 6, 4, '#c0282d'); rect(x + 5, y + 3, 4, 1, '#8a1c20'); }
          else { rect(x + 3, y + 3, 10, 6, '#ece6d6'); rect(x + 4, y + 5, 8, 1, '#8a857a'); }
          break;
        case T.TURNSTILE:
          rect(x + 6, y + 3, 4, 11, '#8d96a1');
          rect(x + 6, y + 3, 4, 2, '#d5dbe2');
          rect(x + 6, y + 13, 4, 1, '#5e666f');
          g.fillStyle = 'rgba(165, 222, 248, 0.6)';
          g.fillRect(x, y + 6, 6, 4);
          g.fillRect(x + 10, y + 6, 6, 4);
          rect(x, y + 6, 6, 1, '#e6f8ff');
          rect(x + 10, y + 6, 6, 1, '#e6f8ff');
          rect(x + 7, y + 7, 2, 1, '#e04848');
          break;
        case T.STAIRS_DOWN:
        case T.STAIRS_UP: {
          const s = screen.stairs;
          const down = id === T.STAIRS_DOWN;
          for (let py = 0; py < TILE; py += 4) {
            const step = ((r - s.r) * TILE + py) / 4;
            const light = down ? 0.95 - step * 0.08 : 0.4 + step * 0.08;
            const v = Math.round(160 * light);
            rect(x, y + py, TILE, 4, `rgb(${v}, ${v}, ${v + 8})`);
            rect(x, y + py, TILE, 1, `rgb(${v + 30}, ${v + 30}, ${v + 38})`);
          }
          if (c === s.c) for (let py = 0; py < TILE; py += 4) rect(x, y + py, 2, 2, (py / 4) % 2 ? '#1a1a1a' : '#f0c030');
          if (c === s.c + 1) for (let py = 0; py < TILE; py += 4) rect(x + 14, y + py, 2, 2, (py / 4) % 2 ? '#1a1a1a' : '#f0c030');
          if (c === s.c + 1 && r === s.r) {
            const ax = x - 4;
            const ay = y + 9;
            g.fillStyle = '#4cd964';
            for (let i = 0; i < 4; i++) g.fillRect(ax - 3 + i, down ? ay + i : ay + 3 - i, 8 - 2 * i, 1);
            g.fillRect(ax - 1, down ? ay - 4 : ay + 4, 4, 4);
          }
          break;
        }
        case T.EXIT:
          rect(x, y, TILE, TILE, '#2f3b44');
          rect(x + 1, y + 1, 14, 15, '#86cde0');
          rect(x + 2, y + 2, 3, 6, '#c9f0fa');
          rect(x, y, TILE, 1, '#3d4f59');
          break;
        default:
          if (ITEM_ART[id]) g.drawImage(itemCanvas(id), x, y);
      }
    }

    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) floor(c, r);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) tile(c, r);

    if (screen.exit) {
      const cols = [];
      for (let c = 0; c < COLS; c++) if (at(c, ROWS - 1) === T.EXIT) cols.push(c);
      const x = cols[0] * TILE;
      const w = cols.length * TILE;
      const y = (ROWS - 1) * TILE + 4;
      rect(x + 6, y - 1, w - 12, 10, '#0d4022');
      g.font = `8px ${FONT}`;
      g.textBaseline = 'top';
      g.textAlign = 'center';
      g.fillStyle = '#5dff8f';
      g.fillText('ВЫХОД', x + w / 2, y);
    }
    return { canvas, leds };
  }

  root.TileArt = { paintScreen };
})(this);
