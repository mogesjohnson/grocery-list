'use strict';

// Suggestions UI: items you buy regularly that are due again.
// The interval logic lives in core.js (computeSuggestions); this file renders
// it and hides names already on the list.
(function () {
  const App = window.App;
  const computeSuggestions = window.GroceryCore.computeSuggestions;

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
