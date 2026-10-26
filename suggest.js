'use strict';

// Suggestions: items you buy regularly that are due again.
// For each normalized name with at least 2 purchases, take the median gap
// between purchases. Suggest it when days since the last purchase >= that
// median and it is not already on the list.
(function () {
  const App = window.App;
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
      const key = App.norm(h.name);
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
      for (let i = 1; i < trips.length; i++) gaps.push((trips[i].boughtAt - trips[i - 1].boughtAt) / App.DAY_MS);
      const intervalDays = Math.max(1, Math.round(median(gaps)));
      const last = trips[trips.length - 1];
      const daysSince = Math.floor((now - last.boughtAt) / App.DAY_MS);
      if (daysSince >= intervalDays) {
        out.push({ key, name: key, category: last.category || '', intervalDays, daysSince, purchases: trips.length });
      }
    }
    // Most overdue first.
    return out.sort((a, b) => b.daysSince / b.intervalDays - a.daysSince / a.intervalDays);
  }

  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  function renderSuggestions() {
    const box = document.getElementById('suggestions');
    const ul = document.getElementById('suggestion-list');
    const list = computeSuggestions(App.data.history).filter((s) => !App.isOnList(s.name));
    ul.replaceChildren();
    box.hidden = list.length === 0;
    for (const s of list) {
      const li = document.createElement('li');
      const text = document.createElement('span');
      const strong = Object.assign(document.createElement('strong'), { textContent: s.name });
      const ago = s.daysSince === 0 ? 'today' : `${plural(s.daysSince, 'day')} ago`;
      text.append(strong, `, usually every ${plural(s.intervalDays, 'day')}, last bought ${ago}`);
      const btn = Object.assign(document.createElement('button'), { type: 'button', className: 'btn small primary', textContent: '+ Add' });
      btn.setAttribute('aria-label', `Re-add ${s.name}`);
      btn.addEventListener('click', () => App.addItem(s.name, s.category));
      li.append(text, btn);
      ul.append(li);
    }
  }

  App.computeSuggestions = computeSuggestions;
  App.renderHooks.push(renderSuggestions);
})();
