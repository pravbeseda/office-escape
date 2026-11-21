(function (root) {
  'use strict';
  const { World } = root.WorldModel;
  const { ENEMY_TYPES } = root.Enemies;

  const STEP = 1 / 60;
  const TYPE_SPEED = 40;
  const SLIDE_TIME = 0.45;
  const INTRO = [
    'Пятница, 18:57. Шестой созвон за день наконец закончился.',
    'Хватит. Я ухожу домой. Прямо сейчас.',
    'Выход в лобби на 1-м этаже. Главное — не попасться начальству на глаза.',
  ];

  const canvas = document.getElementById('screen');
  const view = root.Render.createRenderer(canvas, matchMedia('(pointer: coarse)').matches);
  const input = root.Input.createInput(window, document.getElementById('stick'));
  let scene = null;
  let time = 0;

  function go(next) { scene = next; }

  function titleScene() {
    return {
      update() {
        if (input.consume('confirm')) {
          const world = new World((Math.random() * 2 ** 32) >>> 0);
          go(dialogScene(world, 'Я', INTRO, () => playScene(world)));
        }
      },
      draw() { view.drawTitle(time); },
    };
  }

  function dialogScene(world, speaker, lines, next) {
    let line = 0;
    let shown = 0;
    return {
      update(dt) {
        shown += TYPE_SPEED * dt;
        if (!input.consume('confirm')) return;
        if (shown < lines[line].length) shown = lines[line].length;
        else if (++line < lines.length) shown = 0;
        else go(next());
      },
      draw() {
        view.drawWorld(world, time);
        view.drawDialog(speaker, lines[line], Math.floor(shown), time);
      },
    };
  }

  function playScene(world) {
    return {
      update(dt) {
        if (input.consume('pause')) return go(pauseScene(world, this));
        for (const event of world.update(dt, input.move())) {
          if (event.type === 'screen') return go(slideScene(world, event, this));
          if (event.type === 'floor') return go(cardScene(world, [`ЭТАЖ ${event.to}`], () => playScene(world)));
          if (event.type === 'caught') return go(caughtScene(world, event.enemy));
          if (event.type === 'win') return go(winScene(world));
        }
      },
      draw() { view.drawWorld(world, time); },
    };
  }

  function slideScene(world, event, back) {
    let t = 0;
    return {
      update(dt) {
        t += dt;
        if (t >= SLIDE_TIME) go(back);
      },
      draw() { view.drawSlide(world, event, Math.min(1, t / SLIDE_TIME), time); },
    };
  }

  // Black card, then the world fades in; `before` runs while the screen is black.
  function cardScene(world, lines, next, before) {
    const HOLD = 0.9;
    const FADE = 0.4;
    let t = 0;
    if (before) before();
    return {
      update(dt) {
        t += dt;
        if (t >= HOLD + FADE) go(next());
      },
      draw() {
        view.drawWorld(world, time);
        if (t < HOLD) view.drawCard(lines);
        else view.drawShade(1 - (t - HOLD) / FADE);
      },
    };
  }

  function caughtScene(world, enemy) {
    const type = ENEMY_TYPES[enemy.type];
    const line = type.lines[Math.floor(Math.random() * type.lines.length)];
    return dialogScene(world, type.name, [line], () =>
      cardScene(world, ['...И СНОВА', 'ЗА КОМПОМ'], () => playScene(world), () => world.resetAfterCatch()));
  }

  function pauseScene(world, back) {
    return {
      update() {
        if (input.consume('pause') || input.consume('confirm')) go(back);
      },
      draw() { view.drawPause(world, time); },
    };
  }

  function winScene(world) {
    return {
      update() {
        if (input.consume('confirm')) go(titleScene());
      },
      draw() { view.drawWin(world, time); },
    };
  }

  function fit() {
    const fill = Math.min(innerWidth / canvas.width, innerHeight / canvas.height);
    // Whole multiples keep pixels even; below 2x rounding down would waste most of a phone screen.
    const scale = fill >= 2 ? Math.floor(fill) : fill;
    canvas.style.width = `${canvas.width * scale}px`;
    canvas.style.height = `${canvas.height * scale}px`;
  }

  function start() {
    fit();
    addEventListener('resize', fit);
    go(titleScene());
    let last = performance.now();
    let acc = 0;
    const frame = (now) => {
      acc += Math.min(0.25, (now - last) / 1000);
      last = now;
      while (acc >= STEP) {
        time += STEP;
        scene.update(STEP);
        input.endStep();
        acc -= STEP;
      }
      scene.draw();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  // The pixel font comes from Google Fonts; offline, the game falls back to monospace.
  const fontReady = document.fonts
    ? Promise.race([document.fonts.load('8px "Press Start 2P"', 'ПОБЕГ Escape'), new Promise((r) => setTimeout(r, 2500))])
    : Promise.resolve();
  fontReady.catch(() => {}).then(start);
})(this);
