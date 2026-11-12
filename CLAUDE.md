# Fiala Trainings (webapp)

A single-page PWA: a personal trainer (the coach) plans workouts, and clients log them on their phones. Plain HTML, CSS and ES modules, with no build step, no npm dependencies and no CI.

## Where it lives

- This folder, `webapp/`, is the git repo and the root of the public GitHub repo `fialafitness/fiala-trainings`. `main` is the only branch, and GitHub Pages publishes it at app.fialafitness.com (`CNAME`). A push to `main` is a release. Every committed file is public on GitHub and on the site, this one included.
- Sessions usually start in the parent folder. It is not a repo, and it holds the owner's source material (program PDFs, spreadsheets, brand files). Never copy a file from it into the repo. What the tools extract from it (`templates.json`, the catalog sources, `tools/*.json`) is committed, and so public.
- Never commit a person's name, email, phone number, client data, keys or tokens. Some are already in the repo; never copy them anywhere else.
  - There by design: the coach's own first name in the app's wording (there is only one coach), and the Supabase URL and publishable key in `app/main.js` (row-level security guards the data).
  - Not by design: the coach's sign-in email in `supabase/cloud.sql`, the coach's full name in `tests/photos.test.js` and `tools/import_bodytype.py`, and a home-folder path in `tools/clean_names.py` and `tools/match_videos.py`.
- There is one live Supabase project and no staging copy. A local copy of the app that signs in reads and writes real client data, so prove data changes with the tests.
- The owner is a personal trainer, not a developer. When working with them:
  - write in plain language;
  - agree on any design change before building it;
  - show changes early, in small steps;
  - say which view a change is in. They work in the coach's view on a Mac, where client-only features look missing.

## Files

- `index.html`: the fixed markup (views, bars, sheet shells) and all the CSS (one `<style>` block, mostly one rule per line). It also holds a pre-paint script that applies the saved theme and, at the end, the module script that imports `./app/main.js?v=N` and registers `sw.js`. `main.js` builds the lists, rows, cards and menus.
- `app/main.js`: every screen and gesture, sign-in and boot, in about 4,900 lines, many of them over 300 characters.
  - Sections open with `  // ---------- name ----------`.
  - Top-level code is indented two spaces, and most helpers are arrow `const`s. Find one with `grep -nE '^  ((async )?function|const|let) NAME\b' app/main.js`.
  - `internals()` at the end serves the tests.
- `app/state.js`: `S` (the values the modules share), most of the shared Maps and Sets, `resetState()`, and `ui`, the screen hooks that `main.js` fills in for `sync.js`. Other state lives where it is used:
  - a screen's or a gesture's own state is a private `let` in `main.js`;
  - `sync.js` keeps `seenDoc` and `moveOut`;
  - `photos.js` keeps its own queue.
- `app/sync.js`: the device copy (`fiala.trainings.v1`), the unsent queue (`fiala.pending.v1`), `scheduleSave`, the coach's `cloudBackend`, the client's `clientBackend`, `syncDownNow`/`mergeDown` and the paged `fetchAll`.
- `app/photos.js`: profile photos in the private Storage bucket `photos`, with their own cache and offline queue.
- Smaller modules:
  - `app/model.js`: the workout model (no app state);
  - `app/notes.js`: client notes and their merge;
  - `app/util.js`: local dates `today()`/`localIso()`, and `lsGet`/`lsSet`;
  - `app/pdf.js` and `app/report.js`: the monthly report PDF, set in `fonts/Inter-*.ttf`.
- `app/catalog.js`: the generated exercise names, videos and aliases. Never edit it by hand.
- `sw.js`: the offline shell (see Releasing).
- `templates.json`: the 426 built-in workout templates (see Saving and syncing). Never edit it by hand: the tools rebuild it.
- `exercises.txt`, `exercise-videos.json` and `exercise-aliases.json`: the catalog sources. The app never loads them; `python3 tools/embed.py` writes them into `app/catalog.js`.
- Other files:
  - `manifest.webmanifest` and the icons;
  - `fonts/`: Inter for the PDF only (on screen, Inter comes from Google Fonts);
  - `brand/`: `mark-*.svg` is the header logo, and `lockup-*.svg` is unused;
  - `CNAME`;
  - `package.json` (`"type": "module"`, `npm test`).
- `tools/`: python3 scripts. The spreadsheet and PDF ones need `openpyxl`, and `import_odboj.py` also needs `pypdf`.
  - `embed.py` rebuilds `app/catalog.js` from the three catalog sources.
  - `catalog_edit.py [old=new ...] [--dry]` renames words in the three sources and in `templates.json`, merges duplicate names in the sources, then re-embeds. With `--dry` it only prints.
  - `singularize.py [--write]` puts exercise names in the singular, in the sources only. Run `embed.py` after it.
  - `import_odboj.py`, `import_bodytype.py` (with `pdfstr.swift`) and `merge_templates.py` rebuild `templates.json` from program PDFs in the parent folder. Two of the `tools/*.json` files are hand-made inputs: `bodytype-manual.json` (name mappings) and `bodytype-cues-en.json` (a translation). The others are the scripts' outputs.
  - `clean_names.py` and `match_videos.py` are one-offs over the parent folder's spreadsheets.
- `supabase/*.sql`: the server's tables and rules, run by hand (see Database).
- `tests/`: `run.js`, the helpers `assert.js`, `env.js`, `fake-supabase.js` and `load.js`, 33 `*.test.js` files and 15 `*-probe.mjs` scripts (see Tests).

## Releasing

### The release number

- N is the number in `import { boot } from "./app/main.js?v=N"` in `index.html` (272 at the time of writing).
- Any change to `index.html`, an `app/*.js` file or `templates.json` raises N by one. No test checks the bump.
- Never reuse or lower N:
  - A phone that holds release N never stores it again, so it keeps serving N's old scripts, even online.
  - With a reused N, the fresh page runs on the old scripts.
- Other files need no bump: tests, tools, SQL, this file, `sw.js` itself, icons, fonts and the manifest.
- `sw.js` reads the release from the first `main.js?v=<digits>` anywhere in the page text. Never write that string anywhere else in `index.html`, comments included. (`pageRelease()` in `main.js` reads it from the module script.)

### The service worker

- `sw.js` has no VERSION constant. On every open it fetches its BUNDLE (the page, the 10 `app/*.js` and `templates.json`) whole, with `no-cache`. It keeps each release whole in a cache `fiala-rel-N`, so a phone never mixes two deploys.
- A new `app/X.js` goes into three places:
  - BUNDLE in `sw.js`;
  - the FILES list in `tests/sw.test.js`, before `/templates.json`;
  - the count 12 in `tests/sw.test.js`, which becomes 13 (`slice(0, 12)`, `slice(12)`, `device.writes, 12`).
- `LIB` must equal the Supabase `<script src>` in `index.html`; change its `integrity` too. A test checks this.
- `FONTS` must equal the Google Fonts link. No test checks it.
- The service worker registers only on https and on localhost/127.0.0.1. A phone that opens the Mac's server by its network address runs without it: no release pinning and no offline.

### Commit and push

- Run `node --check app/main.js` and the tests. Gate the commit on the tests' exit code, never on a piped `tail`.
- Add only the files you changed, never `git add -A`.
- Commit on `main` and push:

```bash
node tests/run.js > "$OUT" 2>&1; rc=$?; tail -1 "$OUT"   # $OUT: a scratch file
if [ $rc -eq 0 ]; then git add <changed files> && git commit -q -F <message file> && git push -q origin main; else echo "TESTS FAILED"; fi
```

- The subject is `vN: what the owner sees, in plain words`. A commit that is not a release has no `vN:`.
- The body gives:
  - what the owner asked for or picked, with the date;
  - what changed, and the measurements;
  - a `Tests:` line;
  - what was checked on the simulator or the test iPhone;
  - the Co-Authored-By trailer.

### Check that it is live

- Pages and its edge cache can serve a file 10 minutes stale, so bypass both:
  1. Every 10 s, run `curl -s -H 'Cache-Control: no-cache' "https://app.fialafitness.com/?nc=$RANDOM"` until the page contains `main.js?v=N`. This usually takes 40–70 s.
  2. Fetch `app/main.js?v=N&nc=$RANDOM` the same way.
  3. `cmp` both with the local files.
- If it stalls, watch `gh run list` or `gh api repos/fialafitness/fiala-trainings/pages/builds/latest`. Never POST `pages/builds` while a build runs: that cancels it.
- Then tell the owner to:
  1. wait a minute;
  2. open the app twice (the first open after a deploy can still run the old release);
  3. read "Version N" at the bottom of Settings.
- A page left open reloads into a new release by itself: when it comes back on screen (if the worker answers within 0.8 s), or else when it is next left. An open sheet, typing or an unsaved draft puts the reload off until the next leave or return.

## Database (Supabase)

- A push never deploys `supabase/*.sql`. The owner runs each file: Supabase → SQL Editor → New query → paste → Run.
- When a change needs that, your message opens with this step, in bold and plain words. It says:
  - which file to run (put it on the clipboard with `pbcopy`);
  - the result line it should show (each file ends with a `select '…'` line);
  - that `drop` lines bring up a "destructive operation" confirm, which they must accept.
- Nothing records which files the live project has run: ask the owner.
- On a fresh project, run the files in this order. Every file is safe to run again.
  1. `cloud.sql`: trainers, `is_trainer()`, `ft_clients`, `ft_trainings` and row-level security.
  2. `client-access.sql`: `my_email()`, the unique email index, the `ft_touch` stamps and `client_my_data`.
  3. The rest:
     - the `client-*.sql` files are the client's RPCs;
     - `client-photos.sql` adds the private `photos` bucket and `client_set_photo`;
     - the `exercise*.sql` files hold the coach's own exercise names, videos, hidden built-ins and subtitles.
- `client_my_data` is in four files that must stay identical: `client-access`, `client-instructions`, `client-pause` and `client-plan.sql`. `tests/deploy.test.js` checks this. It sends the client everything on their workouts, except:
  - it strips the client record's private `notes`;
  - a paused client, or one whose monthly plan is past its `until` day (Los Angeles date), gets no workouts at all. The app then keeps its queues (`syncDownNow`).
- The app must work before the owner runs a new rule. On PGRST202 it either falls back to the older shape, or sets an `S.*Missing` flag and keeps the change queued on the phone.
  - The flags clear only on a reload, except `S.photoMissing`, which also clears when the phone comes back online.
  - Only swap, done, finish and skip turn the status red when no version is installed.
- Write a new rule like the existing ones:
  - `security definer set search_path = public`;
  - refuse when `my_email() = ''`;
  - check that the workout belongs to the caller;
  - `for update` before rewriting rows;
  - `drop function if exists` for every older signature;
  - revoke from `public, anon` and grant to `authenticated`;
  - write the whole value, so a resend is harmless;
  - `raise exception` (P0001) only for a final refusal: the app then drops the item without telling anyone.
- Keep the app's limits equal to the rule's checks, or a refusal silently drops the change:
  - set values up to 16 characters, and up to 20 sets (`client-log-set.sql`);
  - a note up to 500 characters (`client-row-note.sql`);
  - an early-finish reason up to 40 characters (`client-finish-early.sql`).
- Keep Supabase's email confirmation on, and never suggest loosening sign-up.

## Saving and syncing

- `S.clientMode` picks the save path.
- The coach writes whole documents. Each update is guarded by the `updated_at` it last saw; on a conflict it reads again, merges and retries.
- A client never writes the `ft_*` tables. Its one direct write is its own photo file in Storage (`photos.js`).
  - Each kind of change goes into a `pending*` queue.
  - `clientBackend.set` sends one workout's queues by RPC, in a fixed order: weights, swaps, order, finish, skip, move, miss, done, notes, early. Two workouts can be sending at once. `tests/sync.test.js` checks only that finish, skip, move and miss go in that order.
  - A P0001 refusal drops that one item, and a missing rule sets its flag; both carry on to the next queue. Any other error stops the later queues for that workout until the retry.
  - A client edit that is in no queue is replaced at the next sync.
- `clientBackend.set` sends workouts only. A client's change to their own profile needs its own RPC and queue, as `photos.js` has for `client_set_photo`.
- `previewClient` (the coach's Coach|Client switch) gives the coach the client's look, actions and limits; for one, Reschedule works only from today. Every save is still the coach's. A new client-only control needs a decision about what it does in the coach's Client view.
- Coach code marks what it changed, or a merge hands the field back to the server's value:
  - `touchState(id, field)` for `completedAt`, `completedBy`, `skippedAt`, `skipReason`, `missed`, `date` and `inPerson`;
  - `trainerTouched`/`trainerNamed`/`trainerNoted` for a row's log, name or note;
  - `planTouched`, `deletedNotes` and `deletedPackages` on a client.
- A new row field that clients write must also be copied in `mergeServerRows` (`sync.js`), or the coach's next save puts the old value back.
- A new shared Map or Set (a new client queue, say) also goes into:
  - `resetState`;
  - `persistPending`/`restorePending`;
  - the `mergeDown` guards;
  - `internals().maps`;
  - every hand-written clear list: the deleted-workout cleanup in `syncDownNow`, the account switch in `enterCloudNow`, `signOutClient` and `signOutTrainer`. These lists already differ (`pendingNoteRows` is missing from the account switch and `signOutClient`), so check each one rather than copying a neighbour.
- A new per-account `lsSet` key is cleared in both sign-outs, or the next person on that phone sees it.
- Records change under running code:
  - `renderClient` files workouts missed for more than 7 days, once this device has synced with the server that day;
  - on the coach's side, `renderClient` deletes empty workouts;
  - a sync can replace a record.

  After every `await` or sheet, read `trainings.get(id)` again and check that it still applies.
- Templates are the workouts of the pseudo-client `TEMPLATES_ID`, whose record also holds the packages. A template edit stays a draft until Save template.
- `templates.json` reaches an existing coach account only when its Templates record's `templatesVersion` is below `TEMPLATES_VERSION` in `main.js`: after a raise, or after restoring an older backup. Ask the owner before raising it. Each time, the app:
  - adds every built-in template the account lacks, so templates the coach deleted come back;
  - never replaces a template the account already holds. It only re-runs the old version-3 repair on them (reps saved as the built-in's plus " sec" get the built-in's reps back).

## Tests

### Running them

- `node tests/run.js` (or `npm test`) runs every `tests/*.test.js` and exits 1 on any failure. It needs Node 20 or later, and nothing to install.
- At v272 it ends "433 passed, 0 failed" after about 40 s.
- `node tests/x.test.js` on its own runs no test and exits 0 (a file with a probe still runs the probe): only `run.js` runs the registered tests.

### In-process tests

- They import the real `app/main.js` once (`load.js`), under `env.js` and `fake-supabase.js`.
- `env.js` hands back a permissive stub for any element id or selector, drops event listeners, and has no layout or CSS. A mistyped id, missing markup or a wrong CSS rule therefore still passes. Check visual and gesture work on the simulator or the test iPhone.
- `fake-supabase.js` keeps the tables in memory. An rpc that a test has not put in `sb.rpcs` answers PGRST202 ("rule not installed").
- All in-process files share that one `main.js`, and `app.reset()` neither clears its private state nor cancels pending saves. So:
  - sync tests end with `await settle()` (`sync.test.js`);
  - UI tests call `quiet()` (`preview.test.js`);
  - any patched global (`Date.now`, `document.createElement`) is restored in `finally`.

### Probes

- `*-probe.mjs` scripts test what in-process tests cannot: gestures, document and window listeners, and import-time variants (the home-screen app, phone or Mac).
- Each probe runs in its own Node process (`execFileSync` from its test file). It sets up its stand-ins before it imports `main.js`, then prints one JSON line that the test parses.
- Eight probes run every timer and `performance.now` on their own clock: row-swipe, hold-menu, month-menu, preview-swipe, preview-pager, cal-drag, cal-fold and cal-fold-reload. The others use real timers.
- Most probes record whether a document listener is capture. hold-menu and cal-drag also record whether it is passive.
- All probes start from `env.js`. One that needs `held()` to be false hides `#whenBg` (an `env.js` stub starts visible), and makes `document.querySelector` return null for `.sheet-bg` and `.crop-view`.
- Start a new probe from the nearest existing one.

### Writing tests

- Dates: build days with `fns.localIso(d)` and `fns.today()`, or with a pinned fake `Date`. Never use `toISOString()` for "today": after 4 pm in Los Angeles in winter (5 pm in summer) UTC is already tomorrow, so such tests fail only in the evening.
- Pinned text:
  - about 70 checks pin a whole CSS rule of `index.html` as exact text;
  - about 25 match rules by regex;
  - about 20 pin `main.js` source text;
  - the rule finders in the `set-slider`, `preview-pager` and `cal-chips` tests rely on the two-space indent.
- Don't reformat, re-indent or reorder a pinned rule. When one changes on purpose, update the test's string in the same commit.
- A source-text check also matches text inside a comment, so it cannot prove that code runs.
- Anything a test must reach goes into the `fns` list of `internals()` at the end of `main.js`, with a getter arrow for private `let` state. That list is one line of about 3,500 characters.

### Guard tests

- `deploy.test.js`: the `client_my_data` copies, BUNDLE, every `./file` named in `sw.js` on disk, and LIB.
- `sw.test.js`: the real `sw.js` through fast, slow, half-deployed, offline and pruning opens.
- `state.test.js`: no bare `S` names.
- `preview.test.js`: Preview teal `#006072` is used once, and Steel blue `#5e8ca7` nowhere yet.

## Conventions and pitfalls

### Code

- Shared values are always `S.name`. `tests/state.test.js` fails on any bare word in `main.js` or `sync.js` equal to a key of `S`, locals and parameters included. Give a new key a name not already used on its own there.
- Lines in `main.js` and `sync.js` often hold several statements and end in one long `// why` comment.
  - Never insert `//` mid-line: the rest of the line silently becomes comment. This has disabled code twice (v260, v263), and `node --check` does not catch it.
  - Print the whole line (`sed -n 'Np'`) before editing it.
  - Add code before the old comment, and words at its end.
  - Then compare with HEAD (`git diff -U0`).
- Comments say why, in plain British English. A feature's comment names what the owner asked for or picked, with the date, and the measured Apple numbers.
- Keep cross-file pointers (CSS, JS, tests) true when you rename something.
- A day is a local `YYYY-MM-DD` string from `today()`/`localIso()`. A `Date` for a day is built at noon.

### Design

- To match Apple, measure: the iOS Simulator, Apple's documentation, or the owner's screenshots sampled pixel by pixel. Never guess.
- Colours are tokens on `:root` in `index.html`.
  - Every value that differs in dark goes in BOTH dark blocks: `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` and `:root[data-theme="dark"]`.
  - Components use `var(--token)` and never write their own dark rules. Only the `--kb-*` keyboard tokens follow the phone alone.
  - Some selectors have rules in two places, so grep the whole file.
- Check four theme states, each in the coach's look and in the client's:
  1. light;
  2. Auto on a dark phone;
  3. Dark chosen;
  4. Light chosen on a dark phone.
- One colour, one place, one reason, one use.
  - A new colour is an addition, on the owner's OK. The brand purple and Apple's greys stay.
  - The page colour is also set in `themeColours` (`main.js`) and the `theme-color` meta tags, and the dark one (`#000000`) in `manifest.webmanifest`. It must stay a pure grey, or iOS draws a line under the clock.
- Inter is loaded at 400, 500, 600, 700 and italic 400 only.
- `main.js` sets transitions, transforms, heights and opacity inline on anything that moves (sheets, rows, the month, the preview). Those override a CSS-only change, so grep `main.js` for the element's id and class too.
- `body.client` is the client's look (client mode, or the coach previewing as the client). `body:not(.client)` is the coach's.
- Anything that deletes or discards asks first through `askFirst()`, a sheet whose red button does it. There are two exceptions, both inline Delete/Keep confirms: Delete client, and a note in the coach's notes list.
- Menu rows never end in "…".
- New icons are our own filled paths, traced from the reference the owner sends, never copied from an icon set. Stroke sketches read as cheaper. About half of the existing icons are still strokes, and the Settings gear and the Data cylinder are Feather's.

### Gestures

- Gestures, by prefix in `main.js`:
  - `sw`: swipe back;
  - `rs*`: row swipe;
  - `wg`: the trackpad's sideways two-finger swipe, which `wheelKind()` hands to a row, the swipe back or a pager;
  - `cd*`: calendar drag;
  - `lp*`: touch-and-hold menus;
  - `pv*`: the workout preview sheet.
- `calWheel` (the client page's month) and `dpWheel` (the day picker) page months, and `pvWheel` pages the preview's workouts. `monthWheel()` picks one by what is under the fingers.
- `held()` is true while a question, menu or sheet owns the touch.
- A new gesture also needs its Mac form (click-and-hold or the trackpad), since the coach works on a Mac.
- Redraw deferral: syncs redraw through `ui.render`, which is `renderUnlessSwiping`. It waits while the pages slide or `rowHolds()` is true. A new gesture:
  - adds its own `*Holds()` to `rowHolds`, and calls `rsFlush()` when it ends, or a sync rebuilds the element under the finger;
  - listens on the element it started on (AbortController);
  - eats the click after its release, like `rsEat`, `cdEatUntil`, `lpEatUntil` and `pvEatUntil`.
- iPhone WebKit:
  - The first `touchmove` decides scroll or gesture, so claim it within the slop in a `passive: false` listener.
  - Selection and the callout are decided at touch start, so `user-select: none` and `-webkit-touch-callout: none` must already be in the CSS.
  - A web page gets no haptics in a drag. `haptic()` is Android's vibrate; the iPhone ticks only when a real tap clicks the hidden `#hapticSwitch` label.
  - Animate with `cubic-bezier` or `springEase`, never `linear()`.
  - Honour `calmMotion()` and `prefers-reduced-motion`.
- Accessibility: SVG icons are `aria-hidden`, icon-only buttons get an `aria-label`, and `e.detail === 0` means keyboard or VoiceOver.

## Local only: never commit

- `_test*.html`: local scratch pages, mostly frozen copies of the page with a test harness, for the browser pane and the simulator.
  - A change to `index.html` shows in them only once the copy is rebuilt from it.
  - Only their name pattern keeps them out of git, so a renamed copy would be published.
  - The service worker gives them their scripts straight from the network.
- `.claude/` (git-ignored) holds design mockups and `launch.json`, which defines two preview servers:
  - `fiala-webapp`, a plain file server;
  - `fiala-sim`, which runs `nostore_server.py`. It turns caching off for the iOS Simulator, and appends `POST /log` bodies to `$FIALA_SIM_LOG`, or by default to `.claude/sim-logs/`.
- The parent folder's `.claude/launch.json` defines the same two servers. The test iPhone can open `fiala-webapp` by the Mac's network address; it then runs without the service worker.
