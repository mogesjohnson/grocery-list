# grocery-list

A small, mobile-first grocery list PWA. Plain HTML, CSS and JavaScript: no build step,
no dependencies, no backend, no login. Your data stays in your browser.

**Live app:** https://mogesjohnson.github.io/grocery-list/

## Features

- **List:** type an item and press Enter. Pick a category (Produce, Dairy, Meat, Pantry,
  Frozen, Household, Other) if you like; the list groups by category when any item has one.
- **Mark bought:** tap the circle, or swipe the row to the right. An Undo toast appears.
- **Delete:** long-press a row, or tap the × button.
- **History:** every bought item with its date and time, newest first.
- **Suggestions ("Due again"):** for each item (name lowercased and trimmed) bought at least
  twice, the app takes the median number of days between purchases. When the days since you
  last bought it reach that median and it is not already on the list, it shows up as, for
  example, "milk, usually every 7 days, last bought 8 days ago" with a one-tap **+ Add**.
  Repeat purchases within 12 hours count as one trip.
- **Data tab:** requests persistent storage (`navigator.storage.persist()`) and shows whether
  the browser granted it; exports a JSON backup; imports a backup after validating it, then
  asks whether to merge it into your data or replace everything.
- **Offline:** a service worker caches the app shell, so it opens with no connection.
- Light and dark themes follow your system setting.

## Add it to your Android home screen

1. Open https://mogesjohnson.github.io/grocery-list/ in **Chrome** on your phone.
2. Tap the **⋮** menu (top right), then **Add to home screen** (or **Install app**).
3. Tap **Install** / **Add**. The Groceries icon appears on your home screen and opens
   full screen, like a normal app, and works offline.
4. Optional: open the **Data** tab once. Installed apps are usually granted persistent storage,
   so Android will not clear your list to free space.

Your list lives only on that device and browser. Use **Export JSON** now and then as a backup,
and **Import JSON** to move it to another device.

## Data format

Stored in `localStorage` under the key `grocery-list`:

```json
{ "version": 1,
  "items":   [{ "id": "…", "name": "Milk", "category": "Dairy", "addedAt": 1761436800000 }],
  "history": [{ "id": "…", "name": "Milk", "category": "Dairy", "boughtAt": 1761436800000 }] }
```

Exports use the same shape plus `app` and `exportedAt`. Schema changes bump `version` and
migrate older data on load.

## Develop

```sh
python3 -m http.server 8000      # then open http://localhost:8000/
for f in *.js tools/*.mjs; do node --check "$f"; done
node -e "JSON.parse(require('fs').readFileSync('manifest.webmanifest','utf8'))"
node tools/make-icons.mjs        # regenerate PNG icons from the shapes in icons/icon.svg
```

All paths are relative so the app works under `/grocery-list/` on GitHub Pages. Bump `CACHE`
in `sw.js` when you change a cached file. See `AGENTS.md` for the commit and PR rules.

## License

MIT © 2026 Moges Johnson. See [LICENSE](LICENSE).
