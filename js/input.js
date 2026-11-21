(function (root) {
  'use strict';

  const KEYS = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    Enter: 'confirm', Space: 'confirm', Escape: 'pause', KeyP: 'pause',
  };

  function createInput(target) {
    const held = new Set();
    const pressed = new Set();
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
    target.addEventListener('blur', () => held.clear());

    const axis = (minus, plus) => (held.has(plus) ? 1 : 0) - (held.has(minus) ? 1 : 0);
    return {
      move: () => ({ x: axis('left', 'right'), y: axis('up', 'down') }),
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
