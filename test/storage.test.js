'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../core.js');

const { loadData, saveData, blankData, STORAGE_KEY, SCHEMA_VERSION } = core;

// Minimal in-memory stand-in for window.localStorage.
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    map,
  };
}

const quiet = (t) => t.mock.method(console, 'warn', () => {});

test('blankData has the current schema and empty arrays', () => {
  assert.deepEqual(blankData(), { version: SCHEMA_VERSION, items: [], history: [] });
  assert.notEqual(blankData().items, blankData().items, 'fresh arrays each call');
});

test('load with nothing saved returns blank data', () => {
  assert.deepEqual(loadData(() => fakeStorage()), blankData());
});

test('save then load round-trips the data', () => {
  const store = fakeStorage();
  const data = {
    version: 1,
    items: [{ id: 'i1', name: 'Milk', category: 'Dairy', addedAt: 1761436800000 }],
    history: [{ id: 'h1', name: 'Eggs', category: '', boughtAt: 1761436800000 }],
  };
  assert.equal(saveData(() => store, data), true);
  assert.equal(JSON.parse(store.map.get(STORAGE_KEY)).items[0].name, 'Milk');
  assert.deepEqual(loadData(() => store), data);
});

test('corrupted JSON falls back to blank data and warns', (t) => {
  const warn = quiet(t);
  const store = fakeStorage({ [STORAGE_KEY]: '{"version":1,"items":[' });
  assert.deepEqual(loadData(() => store), blankData());
  assert.equal(warn.mock.callCount(), 1);
});

test('valid JSON with the wrong shape falls back to blank data', (t) => {
  quiet(t);
  for (const text of ['null', '42', '"text"', '[]', '{}', '{"version":1}', '{"version":1,"items":{},"history":[]}']) {
    assert.deepEqual(loadData(() => fakeStorage({ [STORAGE_KEY]: text })), blankData(), text);
  }
});

test('data from a newer schema version is not loaded', (t) => {
  quiet(t);
  const text = JSON.stringify({ version: SCHEMA_VERSION + 1, items: [], history: [] });
  assert.deepEqual(loadData(() => fakeStorage({ [STORAGE_KEY]: text })), blankData());
});

test('storage that throws on access falls back to blank data', (t) => {
  quiet(t);
  const blocked = () => { throw new Error('SecurityError'); };
  assert.deepEqual(loadData(blocked), blankData());
});

test('missing fields get schema defaults on load', () => {
  const before = Date.now();
  const text = JSON.stringify({
    version: 1,
    items: [{ name: ' Bread ' }],
    history: [{ name: 'Jam', boughtAt: 1761436800000, category: 'Not a category' }],
  });
  const data = loadData(() => fakeStorage({ [STORAGE_KEY]: text }));
  const [item] = data.items;
  assert.equal(item.name, 'Bread');
  assert.equal(item.category, '');
  assert.equal(typeof item.id, 'string');
  assert.ok(item.id.length > 0);
  assert.ok(item.addedAt >= before);
  assert.equal(data.history[0].category, '');
  assert.equal(typeof data.history[0].id, 'string');
});

test('unknown top-level fields are dropped', () => {
  const text = JSON.stringify({ version: 1, app: 'grocery-list', exportedAt: 'x', items: [], history: [] });
  assert.deepEqual(loadData(() => fakeStorage({ [STORAGE_KEY]: text })), blankData());
});

test('saveData reports failure when storage is full or blocked', () => {
  const full = { setItem() { throw new Error('QuotaExceededError'); } };
  assert.equal(saveData(() => full, blankData()), false);
  assert.equal(saveData(() => { throw new Error('SecurityError'); }, blankData()), false);
});
