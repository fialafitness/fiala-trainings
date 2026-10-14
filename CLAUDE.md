# Fiala Trainings (webapp)

Single-page PWA deployed by GitHub Pages at app.fialafitness.com. `index.html` holds the markup and CSS and boots the app with a module script; the app itself is `app/main.js` (sign-in, templates, every screen, boot), `app/state.js` (the shared state object `S`, the shared collections and the `ui` hooks), `app/sync.js` (the device copy, the save queue, the cloud and client backends, the paged read and merge), plus `app/catalog.js` (exercise data, built by `tools/embed.py`), `app/util.js`, `app/model.js`, `app/notes.js`, `app/pdf.js` and `app/report.js`. Shared mutable values are always read and written as `S.name`; `tests/state.test.js` fails on a bare name. Supabase rules live in `supabase/*.sql` and are applied by hand in the SQL Editor.

When `app/main.js` changes, bump the `?v=` on its import in `index.html`. When a file is added under `app/`, add it to the BUNDLE list in `sw.js` (the tests check it); a `sw.js` change with the same VERSION is safe (install only adds what is missing), bump VERSION when a shell file is removed or every phone should rebuild its shell. The service worker fetches the page, every `app/*.js` and `templates.json` as one bundle on each open and serves them from one source, so a phone never mixes two deploys; `tests/sw.test.js` drives it through fast, slow, half-deployed and offline opens. Pane test copies (`_test.html`) get their scripts straight from the network.

## Before every commit

```bash
node tests/run.js
```

The tests import the real `app/main.js` into Node (see `tests/load.js`) with a small browser stand-in (`tests/env.js`) and an in-memory Supabase (`tests/fake-supabase.js`). They cover syncing and merging, save conflicts, the client-side flush order, the workout model, notes, backups and the report PDF. No dependencies to install.

When you add a function the tests should reach, add it to the `fns` list in `internals()` at the end of `app/main.js`.
