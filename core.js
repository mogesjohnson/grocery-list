'use strict';

// Pure app logic with no DOM access: schema, storage, suggestions and import.
// Loaded as a classic script before app.js (window.GroceryCore) and required
// by the Node unit tests in test/ (module.exports). Keep it free of DOM calls.
(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else root.GroceryCore = core;
})(typeof self !== 'undefined' ? self : this, function () {
  // Storage schema. Bump SCHEMA_VERSION and extend migrate() when the shape changes.
  const SCHEMA_VERSION = 1;
  const STORAGE_KEY = 'grocery-list';
  const CATEGORIES = ['Produce', 'Dairy', 'Meat', 'Pantry', 'Frozen', 'Household', 'Other'];
  const DAY_MS = 24 * 60 * 60 * 1000;

  const norm = (name) => String(name).trim().toLowerCase().replace(/\s+/g, ' ');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  function blankData() {
    return { version: SCHEMA_VERSION, items: [], history: [] };
  }

  // Validate and clean data from storage or an import. Throws on bad input.
  function validateData(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('Not a JSON object');
    if (typeof raw.version !== 'number') throw new Error('Missing schema version');
    if (raw.version > SCHEMA_VERSION) throw new Error('File is from a newer version of the app');
    if (!Array.isArray(raw.items) || !Array.isArray(raw.history)) throw new Error('Missing items or history');
    const cat = (c) => (CATEGORIES.includes(c) ? c : '');
    const items = raw.items.map((it, i) => {
      if (!it || typeof it.name !== 'string' || !it.name.trim()) throw new Error(`Item ${i + 1} has no name`);
      return { id: String(it.id || uid()), name: it.name.trim(), category: cat(it.category), addedAt: Number(it.addedAt) || Date.now() };
    });
    const history = raw.history.map((h, i) => {
      if (!h || typeof h.name !== 'string' || !h.name.trim()) throw new Error(`History entry ${i + 1} has no name`);
      const t = Number(h.boughtAt);
      if (!Number.isFinite(t) || t <= 0) throw new Error(`History entry ${i + 1} has a bad date`);
      return { id: String(h.id || uid()), name: h.name.trim(), category: cat(h.category), boughtAt: t };
    });
    return { version: SCHEMA_VERSION, items, history };
  }

  function migrate(raw) {
    // v1 is the first schema; future versions upgrade older data here, step by step.
    return validateData(raw);
  }

  // getStorage returns a Storage-like object ({ getItem, setItem }). It is a
  // function so a browser that throws on localStorage access is caught here.
  function loadData(getStorage) {
    try {
      const text = getStorage().getItem(STORAGE_KEY);
      return text ? migrate(JSON.parse(text)) : blankData();
    } catch (err) {
      console.warn('Could not read saved data, starting fresh', err);
      return blankData();
    }
  }

  // Returns false when storage is full or blocked.
  function saveData(getStorage, data) {
    try {
      getStorage().setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      return false;
    }
  }

  // Parse and validate the text of an import file. Throws with a readable message.
  function parseImport(text) {
    return validateData(JSON.parse(text));
  }

  function mergeData(current, incoming) {
    const histIds = new Set(current.history.map((h) => h.id));
    const histKeys = new Set(current.history.map((h) => `${norm(h.name)}|${h.boughtAt}`));
    const history = [...current.history];
    for (const h of incoming.history) {
      if (histIds.has(h.id) || histKeys.has(`${norm(h.name)}|${h.boughtAt}`)) continue;
      history.push(h);
    }
    const names = new Set(current.items.map((it) => norm(it.name)));
    const items = [...current.items];
    for (const it of incoming.items) {
      if (names.has(norm(it.name))) continue;
      names.add(norm(it.name));
      items.push(it);
    }
    return { version: SCHEMA_VERSION, items, history };
  }

  // Suggestions: items you buy regularly that are due again.
  // For each normalized name with at least 2 purchases, take the median gap
  // between purchases. Suggest it when days since the last purchase >= that
  // median. Callers filter out names already on the list.
  const MIN_PURCHASES = 2;
  // Purchases of the same item within this window count as one trip.
  const SAME_TRIP_MS = 12 * 60 * 60 * 1000;

  function median(nums) {
    const s = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }

  function computeSuggestions(history, now = Date.now()) {
    const byName = new Map();
    for (const h of history) {
      const key = norm(h.name);
      if (!key) continue;
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(h);
    }
    const out = [];
    for (const [key, entries] of byName) {
      entries.sort((a, b) => a.boughtAt - b.boughtAt);
      const trips = [];
      for (const e of entries) {
        const prev = trips[trips.length - 1];
        if (prev && e.boughtAt - prev.boughtAt < SAME_TRIP_MS) trips[trips.length - 1] = e;
        else trips.push(e);
      }
      if (trips.length < MIN_PURCHASES) continue;
      const gaps = [];
      for (let i = 1; i < trips.length; i++) gaps.push((trips[i].boughtAt - trips[i - 1].boughtAt) / DAY_MS);
      const intervalDays = Math.max(1, Math.round(median(gaps)));
      const last = trips[trips.length - 1];
      const daysSince = Math.floor((now - last.boughtAt) / DAY_MS);
      if (daysSince >= intervalDays) {
        out.push({ key, name: key, category: last.category || '', intervalDays, daysSince, purchases: trips.length });
      }
    }
    // Most overdue first.
    return out.sort((a, b) => b.daysSince / b.intervalDays - a.daysSince / a.intervalDays);
  }

  return {
    SCHEMA_VERSION, STORAGE_KEY, CATEGORIES, DAY_MS, MIN_PURCHASES, SAME_TRIP_MS,
    norm, uid, blankData, validateData, migrate, loadData, saveData, parseImport, mergeData,
    median, computeSuggestions,
  };
});
