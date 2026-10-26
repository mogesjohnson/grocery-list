'use strict';

const { SCHEMA_VERSION, STORAGE_KEY, CATEGORIES, DAY_MS, norm, uid, blankData, validateData } = window.GroceryCore;

const $ = (sel) => document.querySelector(sel);
const getStorage = () => window.localStorage;
const loadData = () => window.GroceryCore.loadData(getStorage);

const App = {
  data: loadData(),
  renderHooks: [],
  save() {
    if (!window.GroceryCore.saveData(getStorage, this.data)) {
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
