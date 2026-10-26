'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeSuggestions, median, DAY_MS } = require('../core.js');

const NOW = Date.UTC(2026, 9, 25, 12);
const daysAgo = (d) => NOW - d * DAY_MS;
const buy = (name, d, category = '') => ({ id: `${name}-${d}`, name, category, boughtAt: daysAgo(d) });

test('median: odd, even and unsorted input', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([7]), 7);
});

test('no history gives no suggestions', () => {
  assert.deepEqual(computeSuggestions([], NOW), []);
});

test('a single purchase is never suggested', () => {
  assert.deepEqual(computeSuggestions([buy('Milk', 400)], NOW), []);
});

test('interval is the median gap between purchases', () => {
  // Gaps of 7, 7 and 21 days: median 7, mean would be ~11.7.
  const history = [buy('Milk', 43), buy('Milk', 22), buy('Milk', 15), buy('Milk', 8)];
  const [s] = computeSuggestions(history, NOW);
  assert.equal(s.intervalDays, 7);
  assert.equal(s.daysSince, 8);
  assert.equal(s.purchases, 4);
});

test('even number of gaps uses the mean of the middle two, rounded', () => {
  // Gaps 4, 5, 6, 20 days: median 5.5, rounds to 6.
  const history = [buy('Eggs', 41), buy('Eggs', 21), buy('Eggs', 15), buy('Eggs', 10), buy('Eggs', 6)];
  const [s] = computeSuggestions(history, NOW);
  assert.equal(s.intervalDays, 6);
});

test('item becomes due exactly when days since last purchase reaches the interval', () => {
  const history = [buy('Bread', 14), buy('Bread', 7)];
  // Bought 7 days ago with a 7 day interval: due.
  assert.equal(computeSuggestions(history, NOW).length, 1);
  // One hour earlier it is only 6 whole days since: not due yet.
  assert.deepEqual(computeSuggestions(history, NOW - 60 * 60 * 1000), []);
});

test('items bought recently are not suggested', () => {
  const history = [buy('Coffee', 30), buy('Coffee', 16), buy('Coffee', 2)];
  assert.deepEqual(computeSuggestions(history, NOW), []);
});

test('bought today with a short interval is not suggested', () => {
  const history = [buy('Bananas', 2), buy('Bananas', 1), buy('Bananas', 0)];
  assert.deepEqual(computeSuggestions(history, NOW), []);
});

test('interval is at least one day', () => {
  // Purchases about 13 hours apart (separate trips) round to 1 day, not 0.
  const t = daysAgo(3);
  const history = [
    { id: 'a', name: 'Ice', boughtAt: t },
    { id: 'b', name: 'Ice', boughtAt: t + 13 * 60 * 60 * 1000 },
  ];
  const [s] = computeSuggestions(history, NOW);
  assert.equal(s.intervalDays, 1);
});

test('repeats within 12 hours count as one trip', () => {
  const sameDay = daysAgo(10) + 2 * 60 * 60 * 1000;
  const history = [buy('Milk', 10), { id: 'x', name: 'Milk', boughtAt: sameDay }];
  // Two entries but one trip: not enough purchases to suggest.
  assert.deepEqual(computeSuggestions(history, NOW), []);
});

test('names are grouped case- and whitespace-insensitively', () => {
  const history = [buy('  Greek   Yogurt ', 21), buy('greek yogurt', 14), buy('GREEK YOGURT', 7)];
  const out = computeSuggestions(history, NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].key, 'greek yogurt');
  assert.equal(out[0].purchases, 3);
  assert.equal(out[0].intervalDays, 7);
});

test('blank names are ignored', () => {
  const history = [buy('   ', 20), buy('', 10)];
  assert.deepEqual(computeSuggestions(history, NOW), []);
});

test('history order does not matter', () => {
  const history = [buy('Rice', 15), buy('Rice', 45), buy('Rice', 30)];
  const [s] = computeSuggestions(history, NOW);
  assert.equal(s.intervalDays, 15);
  assert.equal(s.daysSince, 15);
  assert.equal(s.purchases, 3);
});

test('category comes from the latest purchase', () => {
  const history = [buy('Cheese', 20, 'Other'), buy('Cheese', 10, 'Dairy')];
  const [s] = computeSuggestions(history, NOW);
  assert.equal(s.category, 'Dairy');
});

test('most overdue first', () => {
  const history = [
    buy('Milk', 14), buy('Milk', 7), // 7 of 7 days: ratio 1
    buy('Soap', 90), buy('Soap', 60), // 60 of 30 days: ratio 2
    buy('Tea', 30), buy('Tea', 15), // 15 of 15 days: ratio 1
  ];
  const out = computeSuggestions(history, NOW);
  assert.equal(out[0].key, 'soap');
  assert.deepEqual(out.map((s) => s.key).sort(), ['milk', 'soap', 'tea']);
});

test('a purchase in the future (clock skew) is not suggested', () => {
  const history = [buy('Milk', 10), buy('Milk', -2)];
  assert.deepEqual(computeSuggestions(history, NOW), []);
});

test('does not mutate the input history', () => {
  const history = [buy('Milk', 5), buy('Milk', 20)];
  const copy = structuredClone(history);
  computeSuggestions(history, NOW);
  assert.deepEqual(history, copy);
});
