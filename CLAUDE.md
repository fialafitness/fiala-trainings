# Fiala Trainings (webapp)

Single-page PWA in `index.html` (markup, CSS and app script in one file), deployed by GitHub Pages at app.fialafitness.com. Supabase rules live in `supabase/*.sql` and are applied by hand in the SQL Editor.

## Before every commit

```bash
node tests/run.js
```

The tests load the real app script from `index.html` into Node (see `tests/load.js`) with a small browser stand-in (`tests/env.js`) and an in-memory Supabase (`tests/fake-supabase.js`). They cover syncing and merging, save conflicts, the client-side flush order, the workout model, notes, backups and the report PDF. No dependencies to install.

When you add a function the tests should reach, add its name to the `fns` list in `tests/load.js`.
