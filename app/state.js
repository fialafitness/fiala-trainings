// The app's shared state: one object for the values that change, and the collections every part works on.
export const initial = () => ({
  view: { name: "clients" },             // where the user is: clients | client | training
  backend: null,                         // { set(kind, id, data), del(kind, id) }: the cloud, or the device alone
  inflight: 0, failed: false, failReason: "",
  offline: false,                        // the last sync could not reach the server: the device copy is on screen
  templateDraft: null,                   // { id, snapshot, dirty, saving } while a template is being edited
  pendingGo: null,                       // where he wanted to go while a draft was unsaved
  pendingOwner: "",                      // whose unsent edits the device holds
  deviceFull: false,                     // the last write of the device copy failed (storage full or blocked)
  sb: null, signedIn: false, syncTimer: null, clientMode: false, myClientId: null, recovering: false,
  syncedOnce: false,                     // this session has had one full answer from the server
  logSetMissing: false, earlyMissing: false, moveMissing: false, missMissing: false, noteMissing: false,   // server rules not installed yet (supabase/*.sql)
  syncing: null,                         // the sync in flight, if any
  offlineEntry: null, resuming: false, signingOut: null,
  sessionEmail: "", entering: false,
  renderedTraining: null,                // the workout whose rows are on screen
  tab: "workouts",                       // the client page's tab: "workouts" | "profile"
  asking: false,                         // a confirm sheet is up: no sync may swap the workout under it, no redraw may rebuild its rows
  seeding: false,                        // a sync must not run while the templates are being written
});
export const S = initial();
export const ui = {};                       // the screen functions the sync layer may call ($, setStatus, render, showProblem, …), filled in by main.js
export function resetState() { Object.assign(S, initial()); for (const m of [clients, trainings, dirty, timers, chains, pendingWeightRows, pendingDoneRows, pendingEarlyRows, pendingFinish, pendingSkip, trainerState, pendingMove, pendingMiss, pendingSwap, pendingNoteRows, seenAt, trainerTouched, trainerNamed, confirmedAt, planTouched]) m.clear(); }

export const clients = new Map();            // id -> { id, name, notes, createdAt, … }
export const trainings = new Map();          // id -> { id, clientId, title, date, createdAt, rows: [...] }
export const dirty = new Map();              // "kind/id" -> local version counter (unconfirmed edits)
export const timers = new Map();             // "kind/id" -> the debounce timer before a save
export const chains = new Map();             // "kind/id" -> the promise chain of saves for that record
export const seenAt = new Map();             // "kind/id" -> updated_at last received from the server
export const confirmedAt = new Map();        // "kind/id" -> when the server last confirmed our write
export const trainerState = new Map();       // trainingId -> Set(field): finished / skipped / date / missed the coach changed and not yet saved
export const trainerTouched = new Map();     // trainingId -> Set(rowId) whose weights the trainer edited since the last sync
export const planTouched = new Set();        // clientId whose plan / packages this device changed since the last sync: a stale save must not lose them
export const trainerNamed = new Map();       // trainingId -> Set(rowId) whose name / alternatives the trainer edited since the last sync
export const pendingWeightRows = new Map();  // client mode: trainingId -> Set(rowId) with sets to send
export const pendingDoneRows = new Map();    // client mode: trainingId -> Set(rowId) with a done flag to send
export const pendingEarlyRows = new Map();   // client mode: trainingId -> Set(rowId) with a "finished early" reason to send
export const pendingFinish = new Set();      // client mode: trainings finished / unfinished to send
export const pendingSkip = new Set();        // client mode: trainings skipped / unskipped to send
export const pendingMove = new Set();        // client mode: "Do it today" to send
export const pendingMiss = new Set();        // client mode: filed as missed (or decided) to send
export const pendingSwap = new Map();        // client mode: trainingId -> Map(rowId -> alternative tapped) to send
export const pendingNoteRows = new Map();   // client mode: trainingId -> Set(rowId) with a note to send
export const deletedNotes = new Set();       // note ids removed on this device: a merge must not bring them back        // client mode: trainingId -> Map(rowId -> alternative tapped) to send
