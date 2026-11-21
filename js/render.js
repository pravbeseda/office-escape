(function (root) {
  'use strict';
  const { GRID_W, GRID_H } = root.FloorPlan;
  const { FIELD_W, FIELD_H, EDGE } = root.WorldModel;
  const { LOOKS, OUTLINE, FONT, buildCharacter, frameFor, makeCanvas } = root.Sprites;
  const { paintScreen } = root.TileArt;
  const { hash } = root.Rng;

  const VIEW_W = 320;
  const VIEW_H = 240;
  const HUD_H = VIEW_H - FIELD_H;
  const SPRITE_OFFSET_Y = 10;

  function createRenderer(canvas) {
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    const backgrounds = new WeakMap();
    const characters = {};
    for (const [type, look] of Object.entries(LOOKS)) characters[type] = buildCharacter(look);
    const skyline = paintSkyline();

    const rect = (x, y, w, h, color) => { g.fillStyle = color; g.fillRect(x, y, w, h); };

    function text(str, x, y, color, { size = 8, align = 'left', shadow = true } = {}) {
      g.font = `${size}px ${FONT}`;
      g.textBaseline = 'top';
      g.textAlign = align;
      if (shadow) {
        g.fillStyle = OUTLINE;
        g.fillText(str, Math.round(x) + 1, Math.round(y) + 1);
      }
      g.fillStyle = color;
      g.fillText(str, Math.round(x), Math.round(y));
    }

    function wrap(str, width) {
      g.font = `8px ${FONT}`;
      const lines = [];
      let line = '';
      for (const word of str.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (g.measureText(next).width > width && line) {
          lines.push(line);
          line = word;
        } else {
          line = next;
        }
      }
      if (line) lines.push(line);
      return lines;
    }

    function background(screen) {
      if (!backgrounds.has(screen)) backgrounds.set(screen, paintScreen(screen));
      return backgrounds.get(screen);
    }

    function drawField(screen, ox, oy, time) {
      const bg = background(screen);
      g.drawImage(bg.canvas, ox, oy);
      for (const led of bg.leds) {
        if ((time * 1.7 + led.phase) % 1 < 0.55) rect(ox + led.x, oy + led.y, 1, 1, led.amber ? '#ffb02e' : '#4cff6a');
      }
    }

    function drawCharacter(type, body, ox, oy) {
      const x = Math.round(ox + body.x);
      const y = Math.round(oy + body.y);
      g.fillStyle = 'rgba(10, 8, 20, 0.35)';
      g.fillRect(x - 5, y + 4, 10, 2);
      g.fillRect(x - 4, y + 3, 8, 4);
      g.drawImage(frameFor(characters[type], body.dir, body.moving, body.anim), x - 8, y - SPRITE_OFFSET_Y);
    }

    function newspaper(e, x, y) {
      const lowered = e.gazeTimer < 0.7 ? 3 : 0;
      const top = y - 7 + lowered;
      rect(x - 7, top, 14, 9, OUTLINE);
      rect(x - 6, top + 1, 12, 7, '#efece2');
      rect(x - 5, top + 2, 5, 1, '#8a857a');
      rect(x + 1, top + 2, 4, 1, '#8a857a');
      rect(x - 5, top + 4, 10, 1, '#b5b0a4');
      rect(x - 5, top + 6, 10, 1, '#b5b0a4');
    }

    function bubble(x, y, mark, color) {
      rect(x - 4, y - 5, 9, 11, OUTLINE);
      rect(x - 3, y - 4, 7, 9, '#ffffff');
      if (mark === '!') {
        rect(x - 1, y - 3, 3, 5, color);
        rect(x - 1, y + 3, 3, 1, color);
      } else {
        rect(x - 2, y - 3, 5, 1, color);
        rect(x + 2, y - 2, 1, 2, color);
        rect(x, y, 2, 1, color);
        rect(x, y + 3, 2, 1, color);
      }
    }

    function drawActors(world, ox, oy, time) {
      const actors = world.enemies.map((e) => ({ type: e.type, body: e, enemy: e }));
      actors.push({ type: 'hero', body: world.hero });
      actors.sort((a, b) => a.body.y - b.body.y);
      for (const { type, body, enemy } of actors) {
        drawCharacter(type, body, ox, oy);
        if (!enemy) continue;
        const x = Math.round(ox + enemy.x);
        const y = Math.round(oy + enemy.y);
        if (enemy.state === 'post' && enemy.gaze === 'read') newspaper(enemy, x, y);
        if (enemy.state === 'alert' || (enemy.state === 'chase' && Math.floor(time * 4) % 2 === 0)) bubble(x, y - 18, '!', '#e02828');
        if (enemy.state === 'search') bubble(x, y - 18, '?', '#c89400');
      }
    }

    function drawHud(world) {
      rect(0, 0, VIEW_W, HUD_H, '#11141f');
      rect(0, HUD_H - 1, VIEW_W, 1, '#2c3350');
      text(`ЭТАЖ ${world.floor}`, 6, 4, '#ffd84a');
      text(`ПОЙМАН:${world.caughtCount}`, 92, 4, '#e8ecf4');
      text(formatTime(world.elapsed), 210, 4, '#9aa3c0');
      const mx = VIEW_W - 4 - (GRID_W * 8 - 1);
      for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
          const key = `${world.floor}:${x}:${y}`;
          const here = x === world.cx && y === world.cy;
          let color = '#252b3a';
          if (world.visited.has(key)) {
            const screen = world.screens.get(key);
            color = '#56607c';
            if (screen.stairs) color = screen.stairs.dir === 'down' ? '#3fbf5f' : '#4f9fd8';
            if (screen.exit) color = '#ffd84a';
          }
          if (here && Math.floor(performance.now() / 300) % 2 === 0) color = '#ffffff';
          rect(mx + x * 8, y * 4, 7, 3, color);
        }
      }
    }

    function drawWorld(world, time) {
      drawField(world.screen, 0, HUD_H, time);
      drawActors(world, 0, HUD_H, time);
      drawHud(world);
    }

    // The old page slides out as the new one slides in, as on 16-bit consoles.
    function drawSlide(world, event, progress, time) {
      const [dx, dy] = EDGE[event.dir];
      const ox = Math.round(-dx * FIELD_W * progress);
      const oy = Math.round(-dy * FIELD_H * progress);
      g.save();
      g.beginPath();
      g.rect(0, HUD_H, FIELD_W, FIELD_H);
      g.clip();
      drawField(event.from, ox, HUD_H + oy, time);
      const nx = ox + dx * FIELD_W;
      const ny = HUD_H + oy + dy * FIELD_H;
      drawField(event.to, nx, ny, time);
      drawActors(world, nx, ny, time);
      g.restore();
      drawHud(world);
    }

    function drawDialog(speaker, message, shown, time) {
      const x = 8;
      const w = VIEW_W - 16;
      const h = 60;
      const y = VIEW_H - h - 6;
      rect(x, y, w, h, '#ffffff');
      rect(x + 1, y + 1, w - 2, h - 2, OUTLINE);
      rect(x + 2, y + 2, w - 4, h - 4, '#20308a');
      rect(x + 2, y + 2, w - 4, 1, '#3c50b8');
      text(speaker, x + 8, y + 7, '#ffd84a');
      let left = shown;
      wrap(message, w - 16).forEach((line, i) => {
        const part = line.slice(0, Math.max(0, left));
        left -= line.length + 1;
        text(part, x + 8, y + 21 + i * 11, '#ffffff');
      });
      if (shown >= message.length && Math.floor(time * 3) % 2 === 0) {
        const ax = x + w - 14;
        const ay = y + h - 10;
        for (let i = 0; i < 3; i++) rect(ax + i, ay + i, 6 - 2 * i, 1, '#ffffff');
      }
    }

    function drawShade(alpha) {
      g.fillStyle = `rgba(0, 0, 0, ${alpha})`;
      g.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    function drawCard(lines, alpha = 1) {
      drawShade(alpha);
      lines.forEach((line, i) => text(line, VIEW_W / 2, VIEW_H / 2 - lines.length * 8 + i * 16, '#ffffff', { align: 'center' }));
    }

    function drawPause(world, time) {
      drawWorld(world, time);
      drawShade(0.55);
      text('ПАУЗА', VIEW_W / 2, VIEW_H / 2 - 12, '#ffd84a', { size: 16, align: 'center' });
      text('ESC - ПРОДОЛЖИТЬ', VIEW_W / 2, VIEW_H / 2 + 14, '#ffffff', { align: 'center' });
    }

    function paintSkyline() {
      const sky = makeCanvas(VIEW_W, VIEW_H);
      const s = sky.getContext('2d');
      const grad = s.createLinearGradient(0, 0, 0, VIEW_H);
      grad.addColorStop(0, '#0b0e2a');
      grad.addColorStop(1, '#3a2456');
      s.fillStyle = grad;
      s.fillRect(0, 0, VIEW_W, VIEW_H);
      for (let i = 0; i < 60; i++) {
        s.fillStyle = i % 4 ? '#8a90c0' : '#ffffff';
        s.fillRect(hash(i, 1) % VIEW_W, hash(i, 2) % 130, 1, 1);
      }
      const towers = [[0, 150, 40], [36, 120, 34], [246, 132, 30], [280, 160, 40]];
      for (const [x, top, w] of towers) {
        s.fillStyle = '#151a33';
        s.fillRect(x, top, w, VIEW_H - top);
      }
      const bx = 96;
      const bw = 128;
      const btop = 70;
      s.fillStyle = '#1d2342';
      s.fillRect(bx, btop, bw, VIEW_H - btop);
      s.fillStyle = '#2a3158';
      s.fillRect(bx, btop, bw, 3);
      for (let fy = 0; fy < 9; fy++) {
        for (let fx = 0; fx < 10; fx++) {
          s.fillStyle = hash(fx, fy, 7) % 3 ? '#ffd56b' : '#2b3157';
          s.fillRect(bx + 6 + fx * 12, btop + 10 + fy * 18, 7, 9);
        }
      }
      s.fillStyle = '#0c0f1f';
      s.fillRect(0, 202, VIEW_W, VIEW_H - 202);
      s.fillStyle = '#2a3158';
      s.fillRect(0, 202, VIEW_W, 1);
      return sky;
    }

    function drawTitle(time) {
      g.drawImage(skyline, 0, 0);
      drawShade(0.25);
      text('ПОБЕГ ИЗ', VIEW_W / 2, 26, '#ffd84a', { size: 16, align: 'center' });
      text('ОПЕНСПЕЙСА', VIEW_W / 2, 48, '#ffd84a', { size: 16, align: 'center' });
      const run = ((time * 40) % (VIEW_W + 80)) - 40;
      const runner = { x: run, y: 196, dir: 'right', moving: true, anim: time };
      const chaser = { x: run - 30, y: 196, dir: 'right', moving: true, anim: time + 0.1 };
      drawCharacter('pm', chaser, 0, 0);
      drawCharacter('hero', runner, 0, 0);
      if (Math.floor(time * 2) % 2 === 0) text('НАЖМИ ENTER', VIEW_W / 2, 140, '#ffffff', { align: 'center' });
      text('СТРЕЛКИ/WASD - ИДТИ', VIEW_W / 2, 216, '#b8c0e0', { align: 'center' });
      text('ESC - ПАУЗА', VIEW_W / 2, 228, '#b8c0e0', { align: 'center' });
    }

    function drawWin(world, time) {
      g.drawImage(skyline, 0, 0);
      drawShade(0.35);
      text('СВОБОДА!', VIEW_W / 2, 40, '#5dff8f', { size: 16, align: 'center' });
      text(`ВРЕМЯ ПОБЕГА: ${formatTime(world.elapsed)}`, VIEW_W / 2, 90, '#ffffff', { align: 'center' });
      text(`ПОЙМАН: ${world.caughtCount}`, VIEW_W / 2, 106, '#ffffff', { align: 'center' });
      drawCharacter('hero', { x: VIEW_W / 2, y: 196 - Math.abs(Math.sin(time * 6)) * 8, dir: 'down', moving: false, anim: 0 }, 0, 0);
      if (Math.floor(time * 2) % 2 === 0) text('ENTER - НОВОЕ ЗДАНИЕ', VIEW_W / 2, 218, '#ffd84a', { align: 'center' });
    }

    return { drawWorld, drawSlide, drawDialog, drawCard, drawShade, drawPause, drawTitle, drawWin };
  }

  function formatTime(seconds) {
    const s = Math.floor(seconds);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  root.Render = { createRenderer };
})(this);
