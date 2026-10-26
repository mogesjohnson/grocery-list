'use strict';

// Storage schema. Bump SCHEMA_VERSION and extend migrate() when the shape changes.
const SCHEMA_VERSION = 1;
const STORAGE_KEY = 'grocery-list';
const CATEGORIES = ['Produce', 'Dairy', 'Meat', 'Pantry', 'Frozen', 'Household', 'Other'];
const DAY_MS = 24 * 60 * 60 * 1000;

const $ = (sel) => document.querySelector(sel);
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

function loadData() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return text ? migrate(JSON.parse(text)) : blankData();
  } catch (err) {
    console.warn('Could not read saved data, starting fresh', err);
    return blankData();
  }
}

const App = {
  data: loadData(),
  renderHooks: [],
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (err) {
      toast('Could not save: storage is full or blocked');
    }
  },
  onListChange() {
    this.save();
    render();
  },
  isOnList(name) {
    const key = norm(name);
    return this.data.items.some((it) => norm(it.name) === key);
  },
  addItem(name, category = '') {
    name = String(name).trim();
    if (!name) return false;
    if (this.isOnList(name)) {
      toast(`${name} is already on the list`);
      return false;
    }
    this.data.items.push({ id: uid(), name, category, addedAt: Date.now() });
    this.onListChange();
    return true;
  },
  markBought(id) {
    const idx = this.data.items.findIndex((it) => it.id === id);
    if (idx < 0) return;
    const [item] = this.data.items.splice(idx, 1);
    const entry = { id: uid(), name: item.name, category: item.category, boughtAt: Date.now() };
    this.data.history.push(entry);
    this.onListChange();
    toast(`Bought ${item.name}`, 'Undo', () => {
      this.data.history = this.data.history.filter((h) => h.id !== entry.id);
      this.data.items.splice(idx, 0, item);
      this.onListChange();
    });
  },
  deleteItem(id) {
    const idx = this.data.items.findIndex((it) => it.id === id);
    if (idx < 0) return;
    const [item] = this.data.items.splice(idx, 1);
    this.onListChange();
    toast(`Deleted ${item.name}`, 'Undo', () => {
      this.data.items.splice(idx, 0, item);
      this.onListChange();
    });
  },
};
window.App = App;

// ---- Toast with optional action ----
let toastTimer;
function toast(message, actionLabel, action) {
  const el = $('#toast');
  el.replaceChildren(Object.assign(document.createElement('span'), { textContent: message }));
  if (actionLabel) {
    const btn = Object.assign(document.createElement('button'), { textContent: actionLabel, type: 'button' });
    btn.addEventListener('click', () => { el.hidden = true; action(); });
    el.append(btn);
  }
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
}
App.toast = toast;

// ---- List rendering ----
function itemRow(item) {
  const li = document.createElement('li');
  li.className = 'item';
  li.dataset.id = item.id;

  const check = Object.assign(document.createElement('button'), { className: 'check', type: 'button' });
  check.setAttribute('aria-label', `Mark ${item.name} bought`);
  check.addEventListener('click', () => App.markBought(item.id));

  const name = Object.assign(document.createElement('span'), { className: 'name', textContent: item.name });

  const del = Object.assign(document.createElement('button'), { className: 'del', type: 'button', textContent: '×' });
  del.setAttribute('aria-label', `Delete ${item.name}`);
  del.addEventListener('click', () => App.deleteItem(item.id));

  li.append(check, name, del);
  attachGestures(li, item);
  return li;
}

function renderList() {
  const root = $('#list');
  const items = App.data.items;
  root.replaceChildren();
  $('#list-empty').hidden = items.length > 0;
  if (!items.length) return;

  const useGroups = items.some((it) => it.category);
  if (!useGroups) {
    const ul = Object.assign(document.createElement('ul'), { className: 'items' });
    items.forEach((it) => ul.append(itemRow(it)));
    root.append(ul);
    return;
  }
  const order = [...CATEGORIES, ''];
  for (const cat of order) {
    const group = items.filter((it) => (it.category || '') === cat);
    if (!group.length) continue;
    const h = Object.assign(document.createElement('h2'), { textContent: cat || 'Uncategorized' });
    const ul = Object.assign(document.createElement('ul'), { className: 'items' });
    group.forEach((it) => ul.append(itemRow(it)));
    root.append(h, ul);
  }
}

// ---- Gestures: swipe right to mark bought, long-press to delete ----
function attachGestures(li, item) {
  let startX = 0, startY = 0, dx = 0, active = false, pressTimer = null, pointerId = null;
  const SWIPE = 90, LONG_PRESS_MS = 550;

  const reset = () => {
    clearTimeout(pressTimer);
    li.classList.remove('dragging', 'swiped');
    li.style.transform = '';
    active = false;
  };

  li.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('.del')) return;
    active = true; dx = 0; pointerId = e.pointerId;
    startX = e.clientX; startY = e.clientY;
    pressTimer = setTimeout(() => {
      active = false;
      if (navigator.vibrate) navigator.vibrate(20);
      if (confirm(`Delete "${item.name}"?`)) App.deleteItem(item.id);
      reset();
    }, LONG_PRESS_MS);
  });

  li.addEventListener('pointermove', (e) => {
    if (!active || e.pointerId !== pointerId) return;
    dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearTimeout(pressTimer);
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) { reset(); return; }
    if (dx > 8) {
      li.setPointerCapture(pointerId);
      li.classList.add('dragging');
      li.style.transform = `translateX(${Math.min(dx, 200)}px)`;
      li.classList.toggle('swiped', dx > SWIPE);
    }
  });

  const end = () => {
    if (!active) return;
    const done = dx > SWIPE;
    reset();
    if (done) {
      li.classList.add('leaving');
      setTimeout(() => App.markBought(item.id), 150);
    }
  };
  li.addEventListener('pointerup', end);
  li.addEventListener('pointercancel', reset);
  li.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ---- Tabs ----
function showTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
  document.querySelectorAll('.panel').forEach((p) => { p.hidden = p.id !== `tab-${name}`; });
}

function render() {
  renderList();
  App.renderHooks.forEach((fn) => fn());
}
App.render = render;

function init() {
  const sel = $('#add-cat');
  CATEGORIES.forEach((c) => sel.append(new Option(c, c)));

  $('#add-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#add-name');
    if (App.addItem(input.value, sel.value)) { input.value = ''; sel.value = ''; }
    input.focus();
  });
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));

  // Keep tabs in sync if the list is edited in another tab or window.
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) { App.data = loadData(); render(); }
  });
}

document.addEventListener('DOMContentLoaded', () => { init(); render(); });

Object.assign(App, { SCHEMA_VERSION, STORAGE_KEY, CATEGORIES, DAY_MS, norm, uid, validateData, blankData });
