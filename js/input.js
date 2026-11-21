(function (root) {
  'use strict';

  const KEYS = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    Enter: 'confirm', Space: 'confirm', Escape: 'pause', KeyP: 'pause',
  };

  // Touch stick, in CSS pixels; the radius matches the drawn base in index.html.
  const DEAD_ZONE = 10;
  const STICK_RADIUS = 40;
  // Drags within ~17° of an axis go straight, so the corner assist in World still applies.
  const AXIS_SNAP = 0.3;

  function stickDirection(dx, dy) {
    const len = Math.hypot(dx, dy);
    if (len < DEAD_ZONE) return { x: 0, y: 0 };
    if (Math.abs(dy) < AXIS_SNAP * Math.abs(dx)) return { x: Math.sign(dx), y: 0 };
    if (Math.abs(dx) < AXIS_SNAP * Math.abs(dy)) return { x: 0, y: Math.sign(dy) };
    return { x: dx / len, y: dy / len };
  }

  // A touch anywhere confirms and starts a floating stick; elements with data-action press that action.
  function createInput(target, stickView) {
    const held = new Set();
    const pressed = new Set();
    let stick = null;

    function drawStick() {
      stickView.hidden = !stick;
      if (!stick) return;
      stickView.style.transform = `translate(${stick.ox}px, ${stick.oy}px)`;
      stickView.firstElementChild.style.transform = `translate(${stick.x - stick.ox}px, ${stick.y - stick.oy}px)`;
    }

    function releaseStick() {
      stick = null;
      drawStick();
    }

    target.addEventListener('keydown', (event) => {
      const action = KEYS[event.code];
      if (!action) return;
      event.preventDefault();
      if (!event.repeat) pressed.add(action);
      held.add(action);
    });
    target.addEventListener('keyup', (event) => {
      const action = KEYS[event.code];
      if (action) held.delete(action);
    });
    target.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const button = event.target.closest?.('[data-action]');
      if (button) {
        pressed.add(button.dataset.action);
        return;
      }
      pressed.add('confirm');
      if (stick) return;
      stick = { id: event.pointerId, ox: event.clientX, oy: event.clientY, x: event.clientX, y: event.clientY };
      drawStick();
    });
    target.addEventListener('pointermove', (event) => {
      if (!stick || event.pointerId !== stick.id) return;
      stick.x = event.clientX;
      stick.y = event.clientY;
      // The base trails the finger, so reversing direction never needs a long drag back.
      const dx = stick.x - stick.ox;
      const dy = stick.y - stick.oy;
      const len = Math.hypot(dx, dy);
      if (len > STICK_RADIUS) {
        stick.ox = stick.x - (dx * STICK_RADIUS) / len;
        stick.oy = stick.y - (dy * STICK_RADIUS) / len;
      }
      drawStick();
    });
    const lift = (event) => {
      if (stick && event.pointerId === stick.id) releaseStick();
    };
    target.addEventListener('pointerup', lift);
    target.addEventListener('pointercancel', lift);
    target.addEventListener('contextmenu', (event) => event.preventDefault());
    target.addEventListener('blur', () => {
      held.clear();
      releaseStick();
    });

    const axis = (minus, plus) => (held.has(plus) ? 1 : 0) - (held.has(minus) ? 1 : 0);
    return {
      move() {
        const pushed = stick ? stickDirection(stick.x - stick.ox, stick.y - stick.oy) : null;
        if (pushed && (pushed.x || pushed.y)) return pushed;
        return { x: axis('left', 'right'), y: axis('up', 'down') };
      },
      consume(action) {
        const had = pressed.has(action);
        pressed.delete(action);
        return had;
      },
      endStep: () => pressed.clear(),
    };
  }

  root.Input = { createInput };
})(this);
