# Fiala Trainings (webapp)

Single-page PWA deployed by GitHub Pages at app.fialafitness.com. `index.html` holds the markup and CSS and boots the app with a module script; the app itself is `app/main.js` (state, sync, views) plus `app/catalog.js` (exercise data, built by `tools/embed.py`), `app/util.js`, `app/model.js`, `app/notes.js`, `app/pdf.js` and `app/report.js`. Supabase rules live in `supabase/*.sql` and are applied by hand in the SQL Editor.

When `app/main.js` changes, bump the `?v=` on its import in `index.html`. When a file is added under `app/`, add it to the SHELL list in `sw.js` and bump its VERSION.

## Before every commit

```bash
node tests/run.js
```

The tests import the real `app/main.js` into Node (see `tests/load.js`) with a small browser stand-in (`tests/env.js`) and an in-memory Supabase (`tests/fake-supabase.js`). They cover syncing and merging, save conflicts, the client-side flush order, the workout model, notes, backups and the report PDF. No dependencies to install.

When you add a function the tests should reach, add it to the `fns` list in `internals()` at the end of `app/main.js`.
