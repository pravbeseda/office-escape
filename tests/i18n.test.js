const test = require('node:test');
const assert = require('node:assert/strict');
const { STRINGS, pickLanguage } = require('../js/i18n.js');
const { ENEMY_TYPES } = require('../js/enemies.js');

test('the first browser language the game knows wins', () => {
  assert.equal(pickLanguage(['ru-RU', 'en-US']), 'ru');
  assert.equal(pickLanguage(['en-GB', 'ru']), 'en');
  assert.equal(pickLanguage(['uk', 'ru', 'en']), 'ru');
  assert.equal(pickLanguage(['de', 'en', 'ru']), 'en');
  assert.equal(pickLanguage(['RU']), 'ru');
});

test('English is the fallback', () => {
  assert.equal(pickLanguage(['de', 'fr']), 'en');
  assert.equal(pickLanguage([]), 'en');
  assert.equal(pickLanguage(undefined), 'en');
  assert.equal(pickLanguage(['constructor']), 'en');
});

// Arrays may differ in length between languages, objects must have the same keys.
function shape(value) {
  if (Array.isArray(value)) {
    assert.ok(value.length > 0 && value.every((s) => typeof s === 'string' && s), 'a non-empty list of strings');
    return 'list';
  }
  if (typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, shape(value[key])]));
  }
  assert.ok(typeof value === 'string' && value, 'a non-empty string');
  return 'text';
}

test('every language defines the same strings', () => {
  for (const lang of Object.keys(STRINGS)) assert.deepEqual(shape(STRINGS[lang]), shape(STRINGS.en), lang);
});

test('every enemy type has a name and lines in every language', () => {
  for (const [lang, strings] of Object.entries(STRINGS)) {
    assert.deepEqual(Object.keys(strings.enemies).sort(), Object.keys(ENEMY_TYPES).sort(), lang);
  }
});
