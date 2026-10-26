'use strict';

// Data tab: persistent storage request, JSON export and import.
(function () {
  const App = window.App;
  const $ = (id) => document.getElementById(id);

  async function requestPersist() {
    const out = $('persist-status');
    if (!navigator.storage || !navigator.storage.persist) {
      out.textContent = 'Persistent storage is not supported in this browser.';
      return;
    }
    try {
      const already = navigator.storage.persisted ? await navigator.storage.persisted() : false;
      const granted = already || (await navigator.storage.persist());
      out.textContent = granted
        ? 'Persistent storage: granted. The browser will not clear your list to free space.'
        : 'Persistent storage: not granted. Installing the app to your home screen usually helps. Export a backup now and then.';
      out.dataset.state = granted ? 'ok' : 'warn';
    } catch (err) {
      out.textContent = `Persistent storage: error (${err.message}).`;
      out.dataset.state = 'warn';
    }
  }

  function exportData() {
    const payload = { app: 'grocery-list', exportedAt: new Date().toISOString(), ...App.data };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `grocery-list-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    App.toast('Exported a JSON backup');
  }

  function mergeData(current, incoming) {
    const histIds = new Set(current.history.map((h) => h.id));
    const histKeys = new Set(current.history.map((h) => `${App.norm(h.name)}|${h.boughtAt}`));
    const history = [...current.history];
    for (const h of incoming.history) {
      if (histIds.has(h.id) || histKeys.has(`${App.norm(h.name)}|${h.boughtAt}`)) continue;
      history.push(h);
    }
    const names = new Set(current.items.map((it) => App.norm(it.name)));
    const items = [...current.items];
    for (const it of incoming.items) {
      if (names.has(App.norm(it.name))) continue;
      names.add(App.norm(it.name));
      items.push(it);
    }
    return { version: App.SCHEMA_VERSION, items, history };
  }

  async function importFile(file) {
    let incoming;
    try {
      incoming = App.validateData(JSON.parse(await file.text()));
    } catch (err) {
      alert(`Import failed: ${err.message}`);
      return;
    }
    const summary = `${incoming.items.length} list items and ${incoming.history.length} history entries`;
    if (confirm(`File has ${summary}.\n\nOK: merge into your current data.\nCancel: choose replace instead.`)) {
      App.data = mergeData(App.data, incoming);
    } else if (confirm(`Replace ALL current data with ${summary}? This cannot be undone.`)) {
      App.data = incoming;
    } else {
      return;
    }
    App.onListChange();
    App.toast('Import complete');
  }

  function renderStats() {
    $('data-stats').textContent =
      `${App.data.items.length} on the list, ${App.data.history.length} in history. Schema v${App.SCHEMA_VERSION}.`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('export-btn').addEventListener('click', exportData);
    $('import-btn').addEventListener('click', () => $('import-file').click());
    $('import-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (file) importFile(file);
    });
    $('persist-btn').addEventListener('click', requestPersist);
    requestPersist();
  });

  App.renderHooks.push(renderStats);
})();
