const test = require('node:test');
const assert = require('node:assert/strict');
const { hash, makeRng } = require('../js/rng.js');

test('the same seed gives the same sequence', () => {
  const a = makeRng(42);
  const b = makeRng(42);
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
});

test('different seeds diverge', () => {
  const a = makeRng(1);
  const b = makeRng(2);
  const same = Array.from({ length: 20 }, () => a.next() === b.next()).filter(Boolean);
  assert.ok(same.length < 2);
});

test('int stays within its inclusive bounds and hits both ends', () => {
  const rng = makeRng(7);
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    const v = rng.int(3, 6);
    assert.ok(v >= 3 && v <= 6);
    seen.add(v);
  }
  assert.deepEqual([...seen].sort(), [3, 4, 5, 6]);
});

test('weighted never picks a zero-weight key', () => {
  const rng = makeRng(9);
  for (let i = 0; i < 200; i++) assert.notEqual(rng.weighted({ a: 1, b: 0, c: 2 }), 'b');
});

test('hash is deterministic and order-sensitive', () => {
  assert.equal(hash(1, 2, 3), hash(1, 2, 3));
  assert.notEqual(hash(1, 2), hash(2, 1));
});
