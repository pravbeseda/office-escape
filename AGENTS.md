# Office Escape

16-bit style browser game: a programmer escapes a five-floor office whose rooms are generated as the player enters them.

## Run and check

- Play: open `index.html` directly (`file://`). There is no build step and no dependency to install.
- Test: `npm test` (built-in `node:test`). Write logic changes test-first.
- Browser-only modules have no unit tests; verify them in a real browser and watch the console.

## Module boundary

- Logic modules are DOM-free and run under Node: `rng`, `tiles`, `grid`, `physics`, `sight`, `floorplan`, `enemies`, `rooms`, `world`.
- Presentation modules touch the DOM: `sprites`, `tileart`, `render`, `input`, `game`. `game.js` holds the scene state machine and drives `World`.
- Every module is a classic-script IIFE: it exports via `module.exports` under Node and a `window` global in the browser. ES modules are off the table because browsers block them on `file://`.
- The `<script>` order in `index.html` is the dependency order; a new module goes after everything it uses.

## Invariants

- Generation is deterministic: layouts come from `hash(seed, floor, x, y, attempt)` via `rng.js`. Logic code takes randomness from a seeded rng; `Math.random` belongs to presentation only.
- A catch resets enemy positions (`World.states`) but keeps the building (`World.screens`), so the player can learn the layout. A new building comes only from a new game.
- In-game text is Russian; code, comments and docs are English.
