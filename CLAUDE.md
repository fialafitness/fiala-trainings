# Fiala Trainings (webapp)

A single-page PWA: a personal trainer (the coach) plans workouts, and clients log them on their phones. Plain HTML, CSS and ES modules, with no build step, no npm dependencies and no CI.

## Where it lives

- This folder, `webapp/`, is the git repo and the root of the public GitHub repo `fialafitness/fiala-trainings`. `main` is the only branch, and GitHub Pages publishes it at app.fialafitness.com (`CNAME`). A push to `main` is a release. Every committed file is public on GitHub and on the site, this one included.
- Sessions usually start in the parent folder. It is not a repo, and it holds the owner's source material (program PDFs, spreadsheets, brand files). Never copy a file from it into the repo. What the tools extract from it for the exercise catalogue (the catalog sources) is committed, and so public. The 426 built-in workout templates came from purchased programs: since 15 Nov 2026 (the owner's ask) they are not in the repo. They live in the coach's account (Templates records) and his backups; `templates.json` and the scripts that built it sit in the parent folder's `Templates_source_private/`. Never put them back: `.gitignore` and `tests/deploy.test.js` guard this.
- Never commit a person's name, email, phone number, client data, keys or tokens. Some are already in the repo; never copy them anywhere else.
  - There by design: the coach's own first name in the app's wording (there is only one coach), and the Supabase URL and publishable key in `app/main.js` (row-level security guards the data).
  - Not by design: the coach's sign-in email in `supabase/cloud.sql`, the coach's full name in `tests/photos.test.js`, and a home-folder path in `tools/clean_names.py` and `tools/match_videos.py`.
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
- No `templates.json` (see Where it lives): the built-in workout templates are records in the coach's account (see Saving and syncing).
- `exercises.txt`, `exercise-videos.json` and `exercise-aliases.json`: the catalog sources. The app never loads them; `python3 tools/embed.py` writes them into `app/catalog.js`.
- Other files:
  - `manifest.webmanifest` and the icons;
  - `fonts/`: Inter for the PDF only (on screen, Inter comes from Google Fonts);
  - `brand/`: `mark-*.svg` is the header logo, and `lockup-*.svg` is unused;
  - `CNAME`;
  - `package.json` (`"type": "module"`, `npm test`).
- `tools/`: python3 scripts. The spreadsheet ones need `openpyxl`.
  - `embed.py` rebuilds `app/catalog.js` from the three catalog sources.
  - `catalog_edit.py [old=new ...] [--dry]` renames words in the three sources, merges duplicate names in them, then re-embeds. With `--dry` it only prints. (It renamed words in `templates.json` too while that was in the repo; with none there it skips it.)
  - `singularize.py [--write]` puts exercise names in the singular, in the sources only. Run `embed.py` after it.
  - The scripts that built `templates.json` from the program PDFs, with their inputs and outputs, moved to the parent folder's `Templates_source_private/tools/` (15 Nov 2026).
  - `clean_names.py` and `match_videos.py` are one-offs over the parent folder's spreadsheets.
- `supabase/*.sql`: the server's tables and rules, run by hand (see Database).
- `tests/`: `run.js`, the helpers `assert.js`, `env.js`, `fake-supabase.js` and `load.js`, 56 `*.test.js` files and 30 `*-probe.mjs` scripts (see Tests).

## Releasing

### The release number

- N is the number in `import { boot } from "./app/main.js?v=N"` in `index.html` (305 at the time of writing).
- Any change to `index.html` or an `app/*.js` file raises N by one. No test checks the bump.
- Never reuse or lower N:
  - A phone that holds release N never stores it again, so it keeps serving N's old scripts, even online.
  - With a reused N, the fresh page runs on the old scripts.
- Other files need no bump: tests, tools, SQL, this file, `sw.js` itself, icons, fonts and the manifest.
- `sw.js` reads the release from the first `main.js?v=<digits>` anywhere in the page text. Never write that string anywhere else in `index.html`, comments included. (`pageRelease()` in `main.js` reads it from the module script.)

### The service worker

- `sw.js` has no VERSION constant. On every open it fetches its BUNDLE (the page and the 10 `app/*.js`) whole, with `no-cache`. It keeps each release whole in a cache `fiala-rel-N`, so a phone never mixes two deploys.
- A new `app/X.js` goes into three places:
  - BUNDLE in `sw.js`;
  - the FILES list in `tests/sw.test.js`, before `/manifest.webmanifest`;
  - the count 11 in `tests/sw.test.js`, which becomes 12 (`slice(0, 11)`, `slice(11)`, `device.writes, 11`).
- `LIB` must equal the Supabase `<script src>` in `index.html`; change its `integrity` too. A test checks this.
- `FONTS` must equal the Google Fonts link. No test checks it.
- The service worker registers only on https and on localhost/127.0.0.1. A phone that opens the Mac's server by its network address runs without it: no release pinning and no offline.

### Commit and push

- Run `node --check app/main.js` and the tests. Gate the commit on the tests' exit code, never on a piped `tail`.
- Add only the files you changed, never `git add -A`.
- Commits carry GitHub's private address for the account (`<id>+fialafitness@users.noreply.github.com`), set in this repo's git config at the owner's choice (12 Nov 2026). Keep it, and in a fresh clone set it again (`gh api user --jq .id` gives the id).
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
     - `client-profile.sql` adds `client_set_profile` (v299): the client's own Health details, Health & safety and units, one field per call;
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
  - an early-finish reason up to 40 characters (`client-finish-early.sql`);
  - a profile text up to 500 characters, and the measures in whole numbers, 1-120 in, 1-300 cm, 1-1500 lb, 1-700 kg (`client-profile.sql`; the wheels' own ranges are inside these).
- Keep Supabase's email confirmation on, and never suggest loosening sign-up.

## Saving and syncing

- `S.clientMode` picks the save path.
- The coach writes whole documents. Each update is guarded by the `updated_at` it last saw; on a conflict it reads again, merges and retries.
- A client never writes the `ft_*` tables. Its one direct write is its own photo file in Storage (`photos.js`).
  - Each kind of change goes into a `pending*` queue.
  - `clientBackend.set` sends one workout's queues by RPC, in a fixed order: weights, swaps, order, finish, skip, move, miss, done, notes, early. Two workouts can be sending at once. `tests/sync.test.js` checks only that finish, skip, move and miss go in that order.
  - A P0001 refusal drops that one item, and a missing rule sets its flag; both carry on to the next queue. Any other error stops the later queues for that workout until the retry.
  - A client edit that is in no queue is replaced at the next sync.
- `clientBackend.set` sends workouts, and (v299) the client's own profile fields: `setProfile(cid, key, value)` writes the field (`profilePut`, by the rule's key: `sex`, `height`, `unit`, `health.limits`, …), adds the key to `pendingProfile` (clientId → Set of keys) and calls `scheduleSave("clients")`; the "clients" branch sends each key through `client_set_profile` (null clears; P0001 drops the key; PGRST202 sets `S.profileMissing` and keeps it), sets `confirmedAt` and clears a key only while the record still holds what was sent. `mergeDown` lays the client's queued fields onto the server's copy of the client's record, and while the client's `unit` is queued `syncDownNow` stamps the client's workouts with the server's unit (as the rule will). The client's photo has its own queue in `photos.js`. The coach's saves of the same fields are whole-document saves as before.
- `previewClient` (the coach's Coach|Client switch) gives the coach the client's look, actions and limits; for one, Reschedule works only from today. Every save is still the coach's. A new client-only control needs a decision about what it does in the coach's Client view.
- A workout the coach opens comes up in the view set in the coach's Settings, "Open workouts in: Coach | Client" (v284, `openAs`, kept per device in `fiala.openAs`): `go()` sets `previewClient` when a workout page opens, except for a brand-new one (`freshWorkout`, set by `addTraining` and `fillFromTemplate`, and a return from choosing a template for it) and for templates; the same workout drawn again keeps what the coach switched to. A workout page opened anew takes this tab's own view from `sessionStorage` (`fiala.preview`, "1" or "0"), else the setting (`firstPreview`, in `boot`). The swipe back shows a page's picture only in the look Back lands in (`lookBack`, keep it in step with `go()`): a workout shown as the client goes back over its client's page in the coach's look.
- Copy workout (a workout's `…`, the preview's `…`) asks the client, then the day in that client's calendar ("Copy to <name>", `copyDay`); the copy goes on that day and opens.
- Coach code marks what it changed, or a merge hands the field back to the server's value:
  - `touchState(id, field)` for `completedAt`, `completedBy`, `skippedAt`, `skipReason`, `missed`, `date` and `inPerson`;
  - `trainerTouched`/`trainerNamed`/`trainerNoted` for a row's log, name or note;
  - `planTouched`, `deletedNotes` and `deletedPackages` on a client;
  - `folderTouched` and `deletedFolders` on the Templates record (the coach's own template folders); `folderTouched` also holds the key `":rootOrder"` when this device reordered the Programs list.
- A new row field that clients write must also be copied in `mergeServerRows` (`sync.js`), or the coach's next save puts the old value back.
- Since v303 (the audit of 15 Nov 2026):
  - The unsent queue (`fiala.pending.v1`) also holds each dirty record as it is now (`recs`) and each one deleted here (`gone`). `restorePending` puts the queued records over the device copy, which may have stopped saving (a full device); it keeps a deletion only when `gone` says so; a queued key whose record the device lost is dropped, so the server's copy comes back and nothing is deleted there (#1). Only within the session that deleted it does a dirty key with no record mean "delete".
  - A row the coach touched merges set by set against the copy last read (`mergeSets`): his value where he changed that set, the server's (the client's sets) everywhere else. With no copy read his row stands whole (#2).
  - A client workout's exercise list merges three ways by row id: removed there and unchanged here goes, added there comes in, removed or added here stays (#4). Notes (`mergeNotes`' `base`) and packages do the same for deletions made on the other device (#9).
  - `mergeDown` compares with `sameRec`: key order, empty sets at the end, and an old exercise name for its alias's new one are not changes (#11). A changed sibling of the workout on screen bumps `S.histVer` (part of `paintSigOf`); it never clears `S.renderedTraining`, which lifted the typing guard. `renderTraining` also rebuilds when the record object itself was replaced (`paintedObj`, #3).
  - Sign-out is `signOut({ scope: "local" })`, and a SIGNED_OUT from elsewhere keeps `S.pendingOwner` (#7).
- Since v304 (the audit's hidden fixes):
  - A switch between session packages carries only the open package (`carryOver` in model.js, #10): a finished 10 moved to a 20 starts at 0 of 20.
  - A Health details wheel keeps a value only once it moved half a row, another row was tapped, or a key was pressed (`moved`/`picked` in `wheelCol`, #17).
  - `renameInWorkouts` marks each renamed row in `trainerNamed` and saves through `tidySave` (#18).
  - Two pages of the app on one device (a second tab, Safari beside the Dock app) never drop each other's unsent work (v305, #19): the queue carries the page's `tab` id and `fiala.pending.tab` names the last writer; `persistPending` first takes on (`adoptQueue`) what another page's queue still has to send and this page has no edit of (its record from `recs`, its queues, stamps and the coach's marks; never another account's), and so does a `storage` event from another page.
  - #22: the card's safety summary (`clause`) cuts at the first point, never inside a number or after "Dr."; `phoneIn` drops a trunk "(0)"; History files a workout skipped ahead of its day under today (`hday`); a workout made less than a week ago is never filed as missed; the client's sync judges a lapsed monthly plan by the phone's day and Los Angeles's (`laToday` in sync.js), as the server does.
- A template's `rows` merge in `takeFields` as a plain field (no client logs on a template): rows this copy did not change since it last read take the other device's. A client workout's rows keep their own rules (`mergeServerRows`).
- `takeFields` merges `health` (Health & safety, v299) field by field: the client writes one of its fields with the client's rule while the coach edits another on the client's card.
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
- The coach's own template folders (v278) are a flat list `folders: [{ id, name, parent, kind: "folder" | "slide", at }]` on that record:
  - a folder sits at the top or inside a top folder, never deeper (`tplNodes()` puts a deeper one, or one in a ring, at the top);
  - a slide (a "week" the coach names) belongs to a folder;
  - a template is in one by its `template.folder` id. A built-in program's template with none (or a gone one) is in its week's slide `b:<program>/<phase>/<stage>` once that exists (`tplHome`), else it shows loose or on its program's old page;
  - the built-in programs become folders once per account (v281): `adoptBuiltins`, run from `seedTemplates` after a sync and only on a Templates record with nothing of this device's waiting, makes `b:<program>`, `b:<program>/<phase>` ("Phase N · name") and the week slides with fixed `at` times, claims none of them (no `folderTouched`) and marks `builtinsAdopted`. After that only a reseed's new templates or a restore make nodes (`adoptBuiltins(Set)` or `("all")`). `takeNotes` drops an untouched `b:` node that a server copy holding `b:` nodes lacks (deleted there). A built-in program's page keeps the word Phases;
  - `takeNotes` in `sync.js` merges the list by id, and a folder this device changed field by field (its `sort` from Reorder folders, its name), judged against the copy last read;
  - change a template's place with `placeTemplate()`, which saves through `tidySave` (never into an open template draft);
  - the Templates page's Programs list (the coach's top folders and the built-in programs) keeps its Reorder as `rootOrder` on that record: keys, a folder's id or `"p:" + program` (read as `"b:" + program` once that is a folder); `tplRootList()` reads it, and anything not in it comes after. With no `rootOrder`, the coach's own folders come first, then the programs. `takeNotes` takes the server's order unless this device changed it (`folderTouched` key `":rootOrder"`);
  - the Templates pages' top bar has a `+` (`#tAdd`, `tplAddItems`) and the `…` (`tplMoreItems`) in one capsule (CSS on `#tAdd`);
  - a folder page's templates (`tplHere`: the slide shown, or the folder's own) go into a client's calendar at once, one a day in their order from the day picked (v282, `useWeek`): "Use all" above the list while a template is chosen for a client's empty workout (`pickFor`/`fillFor`; while that workout is still empty and to do (`canFill`), it takes the first where it is and moves to the first day; one skipped or finished, or changed by a sync meanwhile, stays as it is and the week goes in beside it), and "Use for a client" in the folder's `…`. Both end on the client's page;
  - on the Templates pages (not while choosing for a client, nor in Reorder), template rows and folder rows swipe like the client page's workout rows (`tplSwipe`): red Delete (asks first) and, outermost, purple Move to (the full swipe's), the same two in the touch-and-hold and right-click menu (v283). A folder that has folders inside can only stay at the top, so its row has Delete alone (`folderPlaces`). A folder's row is as tall as a template's two-line row, 72.5 points (v298, the owner's pick A: `.list li[data-fid] > button`, the template row's padding and two lines summed in `rem`), so its sliding buttons fit with their words. Move to for a template goes step by step through `sheetList`, whose `up` option shows a step back over the title (`moveTemplate`); `placeTemplate` numbers it next in its new place. A template's page has Move to in its `…` too (not while its draft has unsaved changes), and a folder page's `…` has Move folder.
  - a template row's tap opens the workout preview (v288), as does the tap on its lifted card after a touch and hold. A template's preview has Edit (`#pvEdit`, left of the arrows as a workout's `…` is; its own page in the coach's view; none while choosing for a client) and no `…` (`pvItems` gives a template none), and its purple button says Use for client (`useForClient`: which client, the last one used first, then the day in their calendar, then the new workout opens). While choosing for a client (From template on their empty workout) the button says Use, and a row has its own Use button (`.tpl-use`), not a chevron; both run `tplUse`, which asks the day first (`useOne`: the client's days opened on the empty workout's day, it outlined, as Use all's), then `fillFromTemplate` fills it on the day picked (the date claimed with `touchState`) and opens it as the coach, on the workout's own step (`nav.pickDepth`); one finished, skipped or filled meanwhile (`canFill`) stays as it is and the template goes in beside it. The arrows and the finger walk only what the page under the preview lists (`tplWalk`, keep it in step with `drawTemplates`); the line under its name says where (`tplPlace`, "Phase 1 · Week 1"). A redraw repaints the preview, or closes it with its template or once another device has moved it off that page (`renderTemplates`, as `renderClient` does for a client's).
- The built-in templates once came from `templates.json`, which is no longer published (15 Nov 2026, the owner's ask). `seedTemplates` still asks for it when an account's `templatesVersion` is below `TEMPLATES_VERSION` (a new account, or a restore of a backup from before version 3), gets no file and changes nothing. Never raise `TEMPLATES_VERSION`. A built-in template the coach deletes comes back only from his backup file (Settings → Data → Restore).

## Tests

### Running them

- `node tests/run.js` (or `npm test`) runs every `tests/*.test.js` and exits 1 on any failure. It needs Node 20 or later, and nothing to install.
- At v305 it ends "699 passed, 0 failed" after about 95 s.
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
- Twenty probes run every timer and `performance.now` on their own clock: row-swipe, hold-menu, month-menu, preview-swipe, preview-pager, template-preview, turn, cal-drag, cal-fold, cal-fold-reload, week-pager, alternatives, ramp, instructions, sets-count, show-in-history, browser-pictures, row-delete, units, detached and wheel. The others use real timers.
- `alternatives-probe.mjs` has the fullest stand-in elements: children with their parent, listeners with bubbling and `composedPath`, one class list behind `className` and `classList`, and the markup's parts looked up by selector (the same part each time). Its walks up stop at its own stand-ins, because any other `env.js` lookup answers a new element without end.
- `ramp-probe.mjs` starts from those stand-ins and also keeps written text as a node among an element's children (`nodes`; `children` is the elements alone, as on a page), so a test can tell whether something sits before or after the words. `instructions-probe.mjs` starts from those. So does `sets-count-probe.mjs`, which also lays a menu's rows out 42 tall (`offsetTop`), gives `#whenPop` the height a page would (its rows, the long list's 528, a cap written on it, and no scrolling while hidden), keeps the window's listeners with their phase, and records any unhandled rejection. `units-probe.mjs` starts from ramp-probe's and gives each box one chip of its own (`chipEl`: `closest(".chip")` answers the same element each time), so a test can read the number and the unit word a box shows.
- Most probes record whether a document listener is capture. hold-menu, cal-drag and week-pager also record whether it is passive.
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
- Anything a test must reach goes into the `fns` list of `internals()` at the end of `main.js`, with a getter arrow for private `let` state. That list is one line of about 4,200 characters.

### Guard tests

- `deploy.test.js`: the `client_my_data` copies, BUNDLE, every `./file` named in `sw.js` on disk, LIB, and that the purchased programs' files (`templates.json` and the old import tools' files) stay out of the repo.
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
  - Every value that differs in dark goes in BOTH dark blocks: `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` and `:root[data-theme="dark"]`. `alternatives.test.js` checks that the two define the same tokens with the same values (v291: a script matched the first block's indented line twice and put both copies there).
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
- Every caption in capitals is Inter 600, with Apple's spacing for its size (v292, the owner's ask beside his Calendar widget). The values were measured, not chosen. Apple's capitals are SF semibold (stroke 18.1% of the capital height), and Inter 600 matches at 17.9%. Inter's letter gaps were fitted to SF's at each size, sub-pixel, on the simulator: 0.035em at 11 px, 0.025em at 12, 0.02em at 13 and 14, 0.015em at 15. Since v293 (his pick B) the captions are two sizes bigger than they were: 13, 14 and 15 px. The client count beside Reorder (`.listbar .muted`) stays at 13 px. `caps.test.js` holds every `text-transform: uppercase` rule to these values; a new caption in capitals takes the values for its size.
- `main.js` sets transitions, transforms, heights and opacity inline on anything that moves (sheets, rows, the month, the preview). Those override a CSS-only change, so grep `main.js` for the element's id and class too.
- `body.client` is the client's look (client mode, or the coach previewing as the client). `body:not(.client)` is the coach's.
- Anything that deletes or discards asks first through `askFirst()`, a sheet whose red button does it. There are two exceptions, both inline Delete/Keep confirms: Delete client, and a note in the coach's notes list.
- A question (and the Skip sheet) answered by a person's press, a trusted click with a count, eats the next click for 350 ms (`askEat`, v298): a double press's second would land on the page behind, where a list that closed up had put another workout (measured in Chrome and WebKit). A key's click and a script's arm nothing. The Finish early / Skip exercise sheet (`openFinishEarly`) has the same guards since v303 (the audit's #13): `esSettled` (350 ms), `askEat`, the page behind inert, Cancel focused with `keysLast`, the focus back on close. Its first button takes the keyboard's ring only after a key (`keysLast`, given to `focus()` as `focusVisible`): after a right-click's or a hold's menu, whose presses are all cancelled, WebKit drew the ring round Cancel for a finger in a page not yet clicked (measured on the simulator).
- A workout row's touch and hold and right-click on the client page (Today, Up next, and the Missed card, whose "…" too) ends, in the coach's own app, in a red Delete after a line (v298, the owner's ask, 14 Nov: "press and hold will have one more option and that is to delete ... only coach"; the Missed card's too, the owner's pick): `rowDeleteItem`. `rowDelete` reads the workout before and after the workout page's question: still to do (`canSwipeRow`), as the menu's Skip and Reschedule (a menu left open, or the question, while a sync took it away or brought in the client's finish or skip: nothing is deleted). Then it deletes and redraws, the page staying where it is (no step). A keyboard's or VoiceOver's place comes back off the closed question. That place is a row's button or its "…" where the menu's close puts it: not always this workout's row (a right-click or a hold moves no focus), and still the menu's own row when a sync drew the lists anew while the menu was up (then this workout's row). It goes to that row wherever it is drawn now (by `data-tid`, in the Missed, Today and Up next lists: a sync may have moved it), else to the row now in its slot (as a list closes up: the next one, or one that came up from under Show more or the Missed card's fold), else off the sheet; a pointer's is left alone. The client's app never has it, and the calendar's hold is its drag, not a menu.
- The floating bar buttons wear Apple's glass, measured pixel by pixel on iOS 27.2 (v290, the owner's pick A): the back, Messages, "…" and the Templates pages' + … at the top of a page (`--disc-fill`/`--disc-edge`: #f8f8f8 with a grey ring and a faint shadow in light; #1f1f1f with a bright top and bottom line on the black page, fitted to the owner's Mail screenshot), and the preview's ×, "…", ‹ › and Edit (`--glass-sheet-fill`/`--glass-sheet-edge`, remapped onto `--disc-*` by `.sheet.pv-sheet`: in dark #3a3a3c on the #1c1c1e sheet, Calendar's). The edges are stacks of box-shadows in whole iPhone pixels (WebKit snaps them): keep their order. The + … pair draws one glass on `#tAdd::after` (its `::before` is the wider tap area). Buttons inside the page stay plain, as Apple's are (Fitness, Reminders: measured flat); round ones inside a card use Apple's card grey `--card-disc` (system fill).
- Menu rows never end in "…".
- `showMenu` items can take `checked` (a choice of one: every row keeps a tick column, the ticked row has `aria-current`) and `sep` (Apple's 1-point line before that row, 8% black or 8% white). These follow Calendar's Repeat menu and Files, measured: the tick 23 points from the menu's edge, the words 45. `onPick` receives the click; `byKeys(e)` (trusted, detail 0) tells a keyboard's pick from a touch-and-hold slide's script click. `opts.over` with `opts.rect` opens a pop-up button's menu over its button from its top (Calendar's), or up from its foot when there is no room. It stays within what shows: the keyboard's top (`visualViewport`) and the status bar. A pop-up's list takes no pointer tap in its first 350 ms (`openedAt`): it opens over its button, so a double tap's second tap would land on a row (v296: it picked "1 set"). `opts.long` (v296, the sets' 1 to 20) shows twelve rows and scrolls inside, opening with the ticked row in its middle; its rim is drawn by inset shadows on the bubble, because the `::after` ring scrolled away with the rows; on a short screen it is capped to what shows. Opened from the keyboard, the focus goes to the ticked row (else the first); ↑ ↓ move between rows in every menu. A scroll inside the bubble keeps it (`onScroll`); the page scrolling closes it.
- An exercise's alternatives (v291, the owner's pick "Pop-up on the name"):
  - The client's name is the pop-up button (`.name-pop`), with the chevrons `POP_CHEV` after its last word. They were traced off Calendar's "None" (9 by 13 at 17 points, on the baseline, in Apple's secondary label `--pop-chev`). `popLive` makes it a menu button only where its chevrons show; on a card still to come, folded or finished, the name belongs to the card.
  - The coach's chevrons are `.alt-pop` at the end of the name field. Their menu ends in Edit alternatives.
  - The Alternatives sheet is `editAlts`: Apple's red minus on each alternative (a tap shows Delete, in place), Add alternative with the catalogue's names, two at most. Done and the dim keep a typed name. It never redraws the page: it updates the exercise's chevrons in place.
- How many sets (v296, the owner's asks, 13-14 Nov: the − / + "when it's below ... doesn't fit Apple's aesthetics"; after pictures, his pick A, then "circled button .. probably white .. matching the height of the set bar", then A again, keeping "Set 1 of 5"):
  - In the coach's view (workouts and templates) a disc at the end of the set bar shows the count (`.tr-count`): 48 points, as tall as the bar, in the play disc's ink (white on a dark phone, black in light), the number alone in Inter 600 at 17 (99 fits). It is a menu button for VoiceOver ("5 sets"). `.tracker:has(> .tr-count)` keeps the row on one line. The client's view and the coach's Client view have no count.
  - With "Set 1 of 5" kept (his pick), the fifth set of five goes under the track's fade on a 402-point phone (18 over, measured): the bar scrolls, as it already did past five.
  - A tap opens Apple's list (`showMenu`, `long`, `over`): "1 set" to "20 sets" (the app's limit, as the server's), the count ticked. A pick sets every exercise in the card (`setCount`), as the − / + did.
  - Fewer sets with something logged on any set that goes (weights or reps past the new count, or `setsDone` above it) ask first, naming them all: "Drop set 5?", "Drop sets 4 and 5?", "Drop sets 4 to 7?". After the question the change goes into the workout as it is then (a sync can replace it): the card's rows found again by id.
  - A pick from the keyboard puts the focus back on the count drawn anew, or on the card's chevron when the pick finished the card and folded it.
- An exercise's instructions (v295, the owner's ask, 13 Nov: "make it coherent with the way all app work with adding things"; his pick after pictures):
  - The exercise's "…" row Add instructions / Edit instructions opens `editNote`, a sheet built as New folder's and Rename's (`#noteSheet`, next to `#altSheet`): the title, "Your client sees these under <name>.", a five-line box (`.note-input`, 500 characters), a purple Add (Save when there are some) over Cancel.
  - Nothing changes until Add or Save. Add waits for words; Save with the box empty takes the instructions off (his pick: there is no Clear). Cancel, a tap on the dim (after 350 ms) and Escape keep what was there. The dim closes only for a press that began on it: words selected with the mouse and let go past the sheet's edge make a click on the dim (measured in WebKit and Chrome).
  - Return writes a new line (the client's `.cnote-text` keeps it); Command-Return on the Mac adds or saves.
  - While it is up, `S.asking` holds off a sync's redraw of the workout and the page behind is inert. It reads the row again on Save (a template's Discard replaces the template); on a template the change waits in the draft.
  - It replaced a panel that floated over the card (the last of the old inline panels), with its hidden `.note-btn`, `closeOpenAlt` and the `.alt-menu` styles. The client's read-only "Instructions" line is unchanged.
- An exercise's sign (v294 and v296, the owner's asks and picks, 13-14 Nov): add weight each set (the row's `ramp`), or fewer reps, more weight (the row's `pyramid`, for a range such as 12-4). Each is true or no key; an exercise wears one at a time (`signOf`; both show the arrow: only a device still on v295, which knows no pyramid, can add the arrow to an exercise that has one, so the arrow is the newer choice).
  - The coach's two round buttons sit together left of play, the arrow's `.ramp-btn` then the pyramid's `.pyr-btn` (`trainer-only`, his ask: "keep both buttons ... next to each other ... it makes adding those symbols faster"): an outline when off, the ink disc when on, `aria-pressed`. A tap (`signTap`) turns its sign on and the other off, or the one on off, and saves. The client and the coach's Client view cannot change them.
  - The glyphs: Apple's arrow up and to the right (`RAMP_ICON`), and "Tiers" (`PYR_ICON`, his pick A of five): three solid blocks stacked into a pyramid, our own path on the arrow's 16 grid. `SIGNS` holds each one's glyph and words (`RAMP_TIP`, `PYR_TIP`).
  - In the client's line under the name, the sign follows the reps' words, and the whole phrase is one button (`.ramp-tip` inside `.sum-reps`, the words then `.sign`; his ask: "make the whole rep touchable not just the sign"). Its VoiceOver name is the words and the sign's ("12-4 reps, fewer reps, more weight"). A tap opens Last and Best's bubble (`showWhen`) with the sign's words. It is no taller than its words: the name ends where the line begins and Instructions begins where it ends.
  - That line wraps with no bullet first (his screenshot, 13 Nov): the bullets sit in a 22-point `column-gap`, each pulled back into the gap before its words by its own width (on the words' baseline, measured), and `clip-path` cuts away one at a line's start (its dot is 8 or more points out; the clip leaves 6, for the phrase's focus ring). Cards still to come keep their own dots.
  - The preview shows the sign after the reps too (`.ramp-mark`), with `.vh` words for VoiceOver.
  - The coach's reps box shows no sign (his pick "button only"): in the box the arrow pushed a long pyramid's last numbers out on a phone (13 of the templates' 144 reps at 402 points). Five of the longest pyramids are cut by a hair even without it.
  - On a touch screen the buttons never keep the tap's hover dim (`@media (hover: none)`): an iPhone kept it at 0.7 after the tap.
  - Server rules keep both keys (they write with `jsonb_set`), `freshRow` copies them, `mergeServerRows` never takes them from the server, and a backup accepts only booleans. A client's phone on a release before v296 shows no sign for `pyramid` until it updates.
- Settings, a client's Health details and Health & safety (v299, the owner's asks, 15 Nov 2026: "more professional .. Apple like", "asking more health data from client", lb/kg and cm; the owner's picks after the pictures: the photo kept on top with Add photo under it, the rest Apple's way):
  - Settings and the client card are rounded cards 20 apart (Fitness's Account page, measured: 52-point rows). The client's Settings: the client's photo, then Health details and Health & safety, then Weights in and Appearance, then Email and Change password. The card: Name, Sign-in email and Phone as fields at the row's end; Health details and Health & safety with a summary ("36 · 5′ 7″ · 142 lb", "Left knee"); Weights in, Messages via, Access; the Plan as a native select drawn as Apple's pop-up button. The Birthday lives in Health details. A US phone number reads "(310) 555-0142" (`fmtPhone`; the record keeps what was typed).
  - Back from any sub-page (these two, My number, Change password, Exercises, Packages) lands its list page where it was scrolled when the sub-page opened (`subY`, v300, the owner's report "swiping back doesnt work smooth": the swipe's picture showed the list where it was, then it jumped to the top as the finger let go; measured on the simulator). The card's email and phone are grey while not typed in (v300, the owner's ask: "slightly gray" as Apple's).
  - The two pages are settings sub-pages (`settingsOpen` "health" / "safety", sections `#vHealth` / `#vSafety`, `showSub(page, from)`): the client's from the client's Settings (`from` "settings"), the coach's from the card ("card": `parentLabel`, `showParent` and `backKey` know it) or from the note on the client's workout (false: Back returns to the workout). `healthId()` says whose; a page whose client is gone leaves itself at the next `render()`.
  - Health details is Fitness's page: Date of birth, Sex, Height, Weight, grey values, no chevrons; a tap opens Apple's inline wheel under the row (`openWheel`/`fillWheel`/`wheelCol`), one at a time. Measured on iOS 27.2 (the owner's screenshots and a native probe): the cell 230, the band a 32-point capsule centred 108 down and 29 in (two columns: two pills 18 apart; the date: one band), rows on a cylinder (87.3·sin(k·20°), height ·cos), the ink off the band at `--wheel-dim` (0.39 light, 0.355 dark) fading by `WH_FADE`. Each column is a native scroller (snapping, momentum, a trackpad) drawn on the cylinder as it turns; keys move it; `.hd-col` is in `NO_SWIPE`. A value is kept only once a person turns the wheel (an accidental tap saves nothing; the row shows the wheel while open). Height and weight each have their own unit switch on top of the open wheel (the owner's ask: "switch to cm and feet as they are adding the height and lbs and kg as they are adding body weight"): the values are kept as entered, `{ v, u }`, and shown in `heightUnit` / `bodyUnit` (`heightAs`, `weightAs` in `model.js`), so a switch never drifts a value. Starts when nothing is set, as Fitness's: 30 years ago, 5′ 3″ or 162 cm, 158 lb or 72 kg.
  - Health & safety is Apple's Medical ID made calm (no red titles): Training (Injuries and limits, with the line that the coach sees them at the top of the client's workouts), Medical (Conditions, Medications, Allergies, a Pregnant switch: iOS 27's, measured, on in the brand purple), In an emergency (Emergency contact, Doctor). Each text opens `editText`, the instructions' own sheet (`#textSheet`, 500 characters); the coach's view puts a call button on the emergency contact when its text holds a number (`phoneIn`).
  - "Weights in" lb | kg (`UNIT_LABEL`, the owner's naming question: one word to change) is the unit the client's workout weights are logged in, apart from the client's body weight: on the card (`#unitSeg`), in the client's own Settings (`#meUnitSeg`), and as two ticked rows after a line in the client's workout's "…" (`unitRows`, the approved picture A; also in the coach's Client view, where the save is the coach's). All go through `setLiftUnit`: logged exercises with no unit keep the old one (`stampUnit`, plain numbers only, exactly as the client's rule stamps the server's copy on the client's phone: a wider test on one side gave word rows such as "2x20" the wrong unit after a later switch, the v301 review).
  - Every workout, past and future, reads in the client's unit (v301, the owner's ask, 15 Nov 2026: "every workout past and future converts to that unit ... they come back and they can see what they lifted in unit they know"; their picks: one switch for the client and the coach, one decimal). A weight is never rewritten: each exercise keeps `row.unit`, and the screens show it through `weightIn(v, rowUnit, clientUnit)` (model.js) at one decimal with no ".0" (135 lb reads 61.2 kg, 60 kg reads 132.3 lb; in its own unit as typed, a kept conversion such as "61.23" at one decimal; words as written, and in the other unit words ending in a weight say their unit, "2x20 lb", "BW+10 lb", never a numbered thing that is not a weight, "Band 3", "Level 8", "#3", "1:30" (`NOT_WEIGHT`); `weightNumber` reads "1,000" as a thousand and "60." as 60, for the ranking too (`topSet`)). Covered: today's set box and its grey number, the set before, Last time / Best and their bubble, NEW BEST, the finished card's sets, the Progress tab's Best (`fmtSetFor`), the monthly PDF. "lb" for one or many (`weightWord`).
  - A number typed in the client's unit into an exercise logged in the other unit is kept in the exercise's unit by `weightStored` (the shortest number that reads back as typed and as the same weight there: 60 kg into a pound exercise is "132.3"; up to six decimals a hair from a rounding edge, never past 16 characters). Words typed in the other unit are kept with that unit written ("2x10 kg" in a pound exercise). A fresh exercise takes the client's unit. The number shown typed back keeps what was stored (`wShown`/`wiShown` taken at focus, compared as numbers by `sameWeightText`, so a comma keypad's "61,2" is the "61.2" shown: retyping 61.2 over 135 lb never writes 134.9), and the grey number typed into an empty box writes what Complete set would (`greyKept`). Complete set with the grey number left writes the set before as it is, else last time's set through `weightStored` (135 lb into a kilo exercise is "61.23", which reads 61.2 kg and 135 lb again), and gives the exercise the client's unit when any weight holds a digit; `lastWeights` returns last time's weights as logged with their `unit`.
  - Sets rank in kilograms (`betterSet`, `sameSet`; a set carries `u`, the unit its weight was logged in), within 0.06 kg the same weight (exactly 0.06 too: a float's hair over is not heavier), as a weight shown at one decimal in the other unit is never more than 0.05 kg off: 61.2 kg for 5 is not a best over 135 lb for 5, for 8 it is. Of two sets the same, the heavier keeps the Best (`kgOf`), in the card's Best, the Progress tab's and the PDF's, so Best never reads lower than a session that tied it (135 lb, not the 134.9 lb of a 61.2 kg). The PDF uses the same ranking; its set cells are 87 points wide for one decimal ("20.4 kg × 120 sec" bold). The Last time / Best bubble adds a grey line under a set logged in the other unit, "Logged as 135 lb × 5" (`row.o`, `.wo`). VoiceOver names the unit: "Weight in kg", "Weight in kg, set 2".
  - The client's injuries and limits sit at the top of the client's workout in the coach's own look (`#limitsNote`, `paintLimits`, a `.notice` with our own filled bandage): never in the client's look, the coach's Client view or a template; drawn as text. It opens the client's Health & safety.
- New icons are our own filled paths, traced from the reference the owner sends, never copied from an icon set. Stroke sketches read as cheaper. About half of the existing icons are still strokes, and the Settings gear and the Data cylinder are Feather's.

### Gestures

- Gestures, by prefix in `main.js`:
  - `sw`: swipe back (it never starts on a Health details wheel, `.hd-col`). Its picture of the page underneath (`captureScreen`) is drawn under a `<body>` of its own carrying the classes it was taken under (`dataset.body`, less passing states such as `typing`), in a layer beside the live body, so the live page's `body.client` restyles nothing in it;
  - `rs*`: row swipe;
  - `wg`: the trackpad's sideways two-finger swipe, which `wheelKind()` hands to a row, the swipe back or a pager;
  - `cd*`: calendar drag;
  - `lp*`: touch-and-hold menus;
  - `pv*`: the workout preview sheet.
- `calWheel` (the client page's month) and `dpWheel` (the day picker) page months, `weekWheel` pages the client page's week strip, and `pvWheel` pages the preview's workouts. `monthWheel()` picks one by what is under the fingers.
- The week strip pages week by week (v285), as the month does: `#weekView` > `#weekTrack` > `#weekPrev`, `#week`, `#weekNext`.
  - `weekOff` is the week shown. It survives redraws; `calFold()` (every way off the client's page), `render()` off the client's Workouts tab, and Today (`#weekToday`, beside Month) bring this week back. A workout dropped on another week leaves the strip on that week.
  - `#weekPrev`/`#weekNext` are pictures, drawn by `wkSide` as a finger or two fingers take the strip: no listeners, `inert`, `aria-hidden`.
  - While the weeks slide (`wkSliding`), `renderClient` leaves `#week` as it is; the strip is drawn anew as they land. Month opens on the shown week's month (its Thursday's, `wkMonth`).
  - `calFold()` lands a slide quietly (`weekLand(true)`) and draws the strip alone (`wkDraw`). A whole `renderClient()` there would sweep away the empty workout being opened (`isEmptyWorkout`), and `render()` would then drop the coach on Clients.
  - `wkRoll()` keeps the week shown when a new week begins (Sunday's midnight) before a redraw; at a redraw (`wkRoll(true)`) this week shown stays this week.
  - Both pagers (`#weekView`, `#calView`) end a press only for its own pointer (`cpid`), settle back 150 ms after a Mac's lost release (a move with `buttons` 0 and no pointerup), let a press that never ended go at the next press, and land at once when nothing is left to move (`at`). A transitionend from a day inside the track is not the slide's end.
- `held()` is true while a question, menu or sheet owns the touch.
- Two page changes in one go are one step and one picture: `navWillChange` keeps the first change pending until its microtask (`navDidChange`), and folds the second into it. Show in History (the preview's foot on one of History's workouts; v297, the owner's ask, 14 Nov: "I want it to show the actual workout in the history") opens History and then the workout from it in one tap, so `showInHistory` calls `navDidChange()` between the two: History is a step of its own, and the app's own swipe back from the workout (the home-screen app, the Mac) shows History at the workout's row. Back is History there, Back again the client's page where it was.
- A phone's browser tab (Safari, or Chrome on Android; `browserShots()`: steps kept, not the home-screen app, not a computer, a coarse pointer) swipes back with the browser's own pictures: WebKit takes the picture of the page being left as the next step is added, from the screen as last drawn (measured on the simulator, v297: after Start workout the swipe showed the preview over the client's page). So every forward move made from a sheet, a menu or a picker goes through `leaveClean(fn)`: there it folds the client's month (`calFold`) and waits two frames (`whenDrawn`: never after the page changed or under a question or menu), so the page is drawn as Back brings it before it is left; elsewhere `fn` runs at once, as before. A new such move needs it too. The sites: the preview's Start workout, Edit and Save as template; Show in History (the client's page drawn first, then History drawn with its row lit for `HIST_BEAT`, 250 ms, taking no tap meanwhile (`inert`: a double tap's second lands on nothing), its light taken off and drawn so before the workout opens: the swipe back from it shows History as Back lands on it, measured); a day's list (Add a workout, a row); the Templates + menu's New template; Use for client (a preview, a folder's "…", a template's own page); Copy workout; the workout's "…" Save as template; a touch and hold's lifted row; a template's unsaved changes holding a move (`leaveDraft`: a Back at once). New workouts and templates are made after the wait, never before (an empty one would be swept away, or left behind). Anything the page shows differently from how Back brings it back (a sheet, a menu, a lit row, a list left open, the month, where it is scrolled) is put right before the wait, and only in a phone's tab: elsewhere nothing changes. Not covered: a plain tap with the month open (Safari's picture shows the month, Back lands on the week), a keyboard tabbing out of a menu, and a Back that is refused or held (`backOnce` and `popstate` push the step again, which files the current screen as the previous page's picture).
- The bar at the foot (`#dock`) gives a phone's keyboard the bottom (`body.typing`, and `body.kb` for the bar of number keys) by `visibility: hidden`, never `display: none`: made anew while the keyboard still moved, an iPhone could pin it mid-screen. `typingCheck` takes the typing look off only once no field has the keyboard and the keyboard has gone (`visualViewport.height` back to `innerHeight`, 0.7 s at most). `typingWatch` (after every `render()`, on a `visualViewport` resize, on `visibilitychange`) takes off a look whose field has gone with no blur. `typingIn` skips read-only boxes, which an iPhone focuses with no keyboard. Never move the bar by `visualViewport.offsetTop`: an iPhone reports it at every bounce at a page's foot (v287).
- After the phone turns (the width changed), once the sizes have stopped for 400 ms and the page is still, the page scrolls a point and back (`turnSettle`, v289): WebKit could leave the sticky header and the fixed bar where the page had been before the turn moved it (the owner's screenshot: both 361 points up). A home-screen app cannot be kept upright: iOS 27.2 turns it whatever the manifest's `orientation` says (measured).
- The body clips sideways on every device (`body { overflow-x: clip }`), and the viewport has `minimum-scale=1` and `shrink-to-fit=no`. On the iPhone's home-screen app the page sliding off under the swipe back widened the page from 402 to 804 points, and WebKit could zoom out to fit: the two pages side by side at half size (v286).
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
