'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseImport, mergeData, validateData, SCHEMA_VERSION } = require('../core.js');

const T = 1761436800000;
const file = (over = {}) => JSON.stringify({
  app: 'grocery-list',
  exportedAt: '2026-10-25T12:00:00.000Z',
  version: 1,
  items: [{ id: 'i1', name: 'Milk', category: 'Dairy', addedAt: T }],
  history: [{ id: 'h1', name: 'Eggs', category: 'Dairy', boughtAt: T }],
  ...over,
});

test('a valid export file imports', () => {
  const data = parseImport(file());
  assert.deepEqual(data, {
    version: SCHEMA_VERSION,
    items: [{ id: 'i1', name: 'Milk', category: 'Dairy', addedAt: T }],
    history: [{ id: 'h1', name: 'Eggs', category: 'Dairy', boughtAt: T }],
  });
});

test('malformed JSON is rejected', () => {
  assert.throws(() => parseImport('{"version": 1, "items": ['), SyntaxError);
  assert.throws(() => parseImport(''), SyntaxError);
  assert.throws(() => parseImport('not json'), SyntaxError);
});

test('non-object JSON is rejected', () => {
  for (const text of ['null', '0', 'true', '"x"']) {
    assert.throws(() => parseImport(text), /Not a JSON object/, text);
  }
});

test('missing or non-numeric version is rejected', () => {
  assert.throws(() => parseImport(file({ version: undefined })), /Missing schema version/);
  assert.throws(() => parseImport(file({ version: '1' })), /Missing schema version/);
  assert.throws(() => parseImport('[]'), /Missing schema version/);
});

test('a file from a newer version is rejected', () => {
  assert.throws(() => parseImport(file({ version: SCHEMA_VERSION + 1 })), /newer version/);
});

test('items and history must both be arrays', () => {
  assert.throws(() => parseImport(file({ items: undefined })), /Missing items or history/);
  assert.throws(() => parseImport(file({ history: undefined })), /Missing items or history/);
  assert.throws(() => parseImport(file({ items: { 0: 'Milk' } })), /Missing items or history/);
  assert.throws(() => parseImport(file({ history: 'Eggs' })), /Missing items or history/);
});

test('items need a non-blank string name', () => {
  assert.throws(() => parseImport(file({ items: [{ name: 'A' }, {}] })), /Item 2 has no name/);
  assert.throws(() => parseImport(file({ items: [{ name: '   ' }] })), /Item 1 has no name/);
  assert.throws(() => parseImport(file({ items: [{ name: 42 }] })), /Item 1 has no name/);
  assert.throws(() => parseImport(file({ items: [null] })), /Item 1 has no name/);
  assert.throws(() => parseImport(file({ items: ['Milk'] })), /Item 1 has no name/);
});

test('history entries need a name and a positive date', () => {
  assert.throws(() => parseImport(file({ history: [{ boughtAt: T }] })), /History entry 1 has no name/);
  assert.throws(() => parseImport(file({ history: [{ name: 'Eggs' }] })), /History entry 1 has a bad date/);
  assert.throws(() => parseImport(file({ history: [{ name: 'Eggs', boughtAt: 'soon' }] })), /bad date/);
  assert.throws(() => parseImport(file({ history: [{ name: 'Eggs', boughtAt: -5 }] })), /bad date/);
  assert.throws(() => parseImport(file({ history: [{ name: 'Eggs', boughtAt: 0 }] })), /bad date/);
});

test('names are trimmed and unknown categories cleared', () => {
  const data = parseImport(file({
    items: [{ id: 'a', name: '  Apples ', category: 'Fruit', addedAt: T }],
    history: [{ id: 'b', name: ' Pears', category: 42, boughtAt: String(T) }],
  }));
  assert.equal(data.items[0].name, 'Apples');
  assert.equal(data.items[0].category, '');
  assert.equal(data.history[0].name, 'Pears');
  assert.equal(data.history[0].category, '');
  assert.equal(data.history[0].boughtAt, T);
});

test('an empty file with the right shape imports as empty', () => {
  assert.deepEqual(parseImport(file({ items: [], history: [] })), { version: 1, items: [], history: [] });
});

test('validateData does not mutate its input', () => {
  const raw = JSON.parse(file({ items: [{ name: ' Milk ' }] }));
  const copy = structuredClone(raw);
  validateData(raw);
  assert.deepEqual(raw, copy);
});

const current = () => ({
  version: 1,
  items: [{ id: 'i1', name: 'Milk', category: 'Dairy', addedAt: T }],
  history: [{ id: 'h1', name: 'Eggs', category: '', boughtAt: T }],
});

test('merge adds new items and history', () => {
  const incoming = parseImport(file({
    items: [{ id: 'i2', name: 'Bread', addedAt: T }],
    history: [{ id: 'h2', name: 'Jam', boughtAt: T + 1 }],
  }));
  const out = mergeData(current(), incoming);
  assert.deepEqual(out.items.map((i) => i.name), ['Milk', 'Bread']);
  assert.deepEqual(out.history.map((h) => h.name), ['Eggs', 'Jam']);
});

test('merge skips list items already on the list, ignoring case and spaces', () => {
  const incoming = parseImport(file({ items: [{ id: 'x', name: '  MILK ' }], history: [] }));
  assert.deepEqual(mergeData(current(), incoming).items.map((i) => i.id), ['i1']);
});

test('merge skips history with the same id or the same name and time', () => {
  const incoming = parseImport(file({
    items: [],
    history: [
      { id: 'h1', name: 'Something else', boughtAt: T + 5 },
      { id: 'other', name: ' eggs ', boughtAt: T },
    ],
  }));
  assert.equal(mergeData(current(), incoming).history.length, 1);
});

test('merging the same file twice changes nothing the second time', () => {
  const incoming = parseImport(file({
    items: [{ id: 'i2', name: 'Bread' }],
    history: [{ id: 'h2', name: 'Jam', boughtAt: T + 1 }],
  }));
  const once = mergeData(current(), incoming);
  const twice = mergeData(once, incoming);
  assert.deepEqual(twice, once);
});

test('merge does not mutate current data', () => {
  const cur = current();
  const copy = structuredClone(cur);
  mergeData(cur, parseImport(file()));
  assert.deepEqual(cur, copy);
});

test('duplicate list items in a file are dropped, keeping the first', () => {
  const data = parseImport(file({
    items: [{ id: 'a', name: 'Milk' }, { id: 'b', name: ' MILK ' }, { id: 'c', name: 'Bread' }],
    history: [],
  }));
  assert.deepEqual(data.items.map((i) => `${i.id}:${i.name}`), ['a:Milk', 'c:Bread']);
});

test('repeated ids in a file get fresh unique ids', () => {
  const data = parseImport(file({
    items: [{ id: 'a', name: 'Milk' }, { id: 'a', name: 'Bread' }],
    history: [{ id: 'h', name: 'Jam', boughtAt: T }, { id: 'h', name: 'Jam', boughtAt: T + 7 * 864e5 }],
  }));
  assert.equal(data.items[0].id, 'a');
  assert.equal(new Set(data.items.map((i) => i.id)).size, 2);
  assert.equal(data.history.length, 2);
  assert.equal(new Set(data.history.map((h) => h.id)).size, 2);
});

test('repeated history entries (same name and time) in a file are dropped', () => {
  const data = parseImport(file({
    items: [],
    history: [{ id: 'h1', name: 'Jam', boughtAt: T }, { id: 'h2', name: ' jam', boughtAt: T }],
  }));
  assert.deepEqual(data.history.map((h) => h.id), ['h1']);
});

test('merging a file with internal duplicates adds each entry once', () => {
  const incoming = parseImport(file({
    items: [],
    history: [{ id: 'h9', name: 'Tea', boughtAt: T }, { id: 'h9', name: 'Tea', boughtAt: T }],
  }));
  assert.equal(mergeData(current(), incoming).history.length, 2);
});

test('merge gives an incoming item a fresh id when current data already uses it', () => {
  const incoming = parseImport(file({ items: [{ id: 'i1', name: 'Bread' }], history: [] }));
  const out = mergeData(current(), incoming);
  assert.deepEqual(out.items.map((i) => i.name), ['Milk', 'Bread']);
  assert.equal(new Set(out.items.map((i) => i.id)).size, 2);
  assert.equal(out.items[0].id, 'i1');
});

test('merge does not mutate the incoming data', () => {
  const incoming = parseImport(file({ items: [{ id: 'i1', name: 'Bread' }], history: [] }));
  const copy = structuredClone(incoming);
  mergeData(current(), incoming);
  assert.deepEqual(incoming, copy);
});
