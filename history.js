'use strict';

// History: every bought item with its timestamp, newest first, grouped by day.
(function () {
  const App = window.App;
  const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

  function dayLabel(ts) {
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date(Date.now() - App.DAY_MS);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return dayFmt.format(d);
  }

  function renderHistory() {
    const ul = document.getElementById('history');
    const entries = [...App.data.history].sort((a, b) => b.boughtAt - a.boughtAt);
    ul.replaceChildren();
    document.getElementById('history-empty').hidden = entries.length > 0;

    let lastDay = '';
    for (const h of entries) {
      const label = dayLabel(h.boughtAt);
      if (label !== lastDay) {
        ul.append(Object.assign(document.createElement('li'), { className: 'day', textContent: label }));
        lastDay = label;
      }
      const li = document.createElement('li');
      const name = Object.assign(document.createElement('span'), { textContent: h.name });
      const time = document.createElement('time');
      time.dateTime = new Date(h.boughtAt).toISOString();
      time.textContent = `${dayFmt.format(h.boughtAt)}, ${timeFmt.format(h.boughtAt)}`;
      time.title = new Date(h.boughtAt).toLocaleString();
      li.append(name, time);
      ul.append(li);
    }
  }

  App.renderHooks.push(renderHistory);
})();
