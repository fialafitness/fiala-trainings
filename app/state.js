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
  sb: null, signedIn: false, syncTimer: null, clientMode: false, myClientId: null, recovering: false, recoveryAs: "",
  syncedOnce: false,                     // this session has had one full answer from the server
  syncedOn: "",                          // the day of its latest one: the week's filing of missed workouts waits for one from today
  syncedAt: 0,                           // v316 (the check rounds): when this page's latest full sync began (its read: an answer that lands late is as old as its read): the tidying of empty workouts trusts only a copy that fresh
  syncedPerf: 0,                         // v316 (the eighteenth check round): the same moment on the page's steady clock (performance.now), which a clock set by hand never moves
  logSetMissing: false, earlyMissing: false, moveMissing: false, missMissing: false, noteMissing: false, orderMissing: false, zoneMissing: false, zoneSetMissing: false, consentMissing: false, photoMissing: false, profileMissing: false,
  catalogWait: 0,                     // tests shorten the catalogs' deadline (0 = the usual 8 s)
  saveWait: 0,                        // tests shorten a save's deadline (0 = the usual 15 s)   // server rules not installed yet (supabase/*.sql)
  syncing: null,                         // the sync in flight, if any
  offlineEntry: null, resuming: false, signingOut: null,
  sessionEmail: "", entering: false,
  renderedTraining: null,                // the workout whose rows are on screen
  histVer: 0,                            // (15 Nov 2026, the audit's #11) bumped when a sync changes another workout of the client on screen: the open one's Last time and Best are drawn again once no field or question owns the page
  tab: "workouts",                       // the client page's tab: "workouts" | "profile"
  asking: false,                         // a confirm sheet is up: no sync may swap the workout under it, no redraw may rebuild its rows
  seeding: false,                        // a sync must not run while the templates are being written
});
export const S = initial();
export const ui = {};                       // the screen functions the sync layer may call ($, setStatus, render, showProblem, …), filled in by main.js
export function resetState() { Object.assign(S, initial()); for (const m of [clients, trainings, dirty, deleting, deletedHere, heldBack, timers, chains, pendingWeightRows, pendingDoneRows, pendingEarlyRows, pendingFinish, pendingSkip, trainerState, pendingMove, pendingMiss, pendingSwap, pendingOrder, pendingNoteRows, pendingProfile, pendingChoices, heldAgree, settledAnswers, profileTouched, profileUnder, carriedFrom, withdrawnAt, typedHere, deliv, seenAt, trainerTouched, trainerNamed, trainerNoted, confirmedAt, planTouched, deletedNotes, deletedPackages, folderTouched, deletedFolders, fromFile]) m.clear(); }

export const clients = new Map();            // id -> { id, name, notes, createdAt, … }
export const trainings = new Map();          // id -> { id, clientId, title, date, createdAt, rows: [...] }
export const dirty = new Map();              // "kind/id" -> local version counter (unconfirmed edits)
export const deleting = new Set();           // v316 (the check rounds): "kind/id" deleted here on purpose (deleteRec): only these are ever sent as deletions
export const deletedHere = new Map();        // v316 (the check rounds): "kind/id" -> the server stamp of the copy whose deletion this page saw land: another page's queue never hands that same deletion back (two windows sent one Delete back and forth), while a later Delete of a copy restored since still goes
export const heldBack = new Set();           // v316 (the seventeenth check round): workouts the latest sync passed over (a question up over it, an edit of it still to send) while the server's copy differed from this page's: no tidying trusts this page's copy of them until a sync or a save of theirs lands
export const timers = new Map();             // "kind/id" -> the debounce timer before a save
export const chains = new Map();             // "kind/id" -> the promise chain of saves for that record
export const seenAt = new Map();             // "kind/id" -> updated_at last received from the server
export const confirmedAt = new Map();        // "kind/id" -> when the server last confirmed our write
export const trainerState = new Map();       // trainingId -> Set(field): finished / skipped / date / missed the coach changed and not yet saved
export const trainerTouched = new Map();     // trainingId -> Set(rowId) whose weights the trainer edited since the last sync
export const planTouched = new Set();        // clientId whose plan / packages this device changed since the last sync: a stale save must not lose them
export const trainerNamed = new Map();       // trainingId -> Set(rowId) whose name / alternatives the trainer edited since the last sync
export const trainerNoted = new Map();       // trainingId -> Set(rowId) whose card note the trainer wrote or removed since the last sync (the note alone: a note edit never carries old weights)
export const pendingWeightRows = new Map();  // client mode: trainingId -> Set(rowId) with sets to send
export const pendingDoneRows = new Map();    // client mode: trainingId -> Set(rowId) with a done flag to send
export const pendingEarlyRows = new Map();   // client mode: trainingId -> Set(rowId) with a "finished early" reason to send
export const pendingFinish = new Set();      // client mode: trainings finished / unfinished to send
export const pendingSkip = new Set();        // client mode: trainings skipped / unskipped to send
export const pendingMove = new Set();        // client mode: "Do it today" to send
export const pendingMiss = new Set();        // client mode: filed as missed (or decided) to send
export const pendingSwap = new Map();        // client mode: trainingId -> Map(rowId -> alternative tapped) to send
export const pendingOrder = new Set();       // client mode: trainings whose exercise order the client changed ("Start this exercise") to send
export const pendingNoteRows = new Map();   // client mode: trainingId -> Set(rowId) with a note to send
export const profileTouched = new Map();    // coach: clientId -> Set(key) of the client's profile fields (v299: Health details, Health & safety, the units) this device changed and not yet saved: a save with no copy read to merge against keeps the server's for the rest
export const pendingProfile = new Map();    // client mode: clientId -> Set(key) of the client's own profile fields to send through client_set_profile (v299: Health details, Health & safety, the units)
export const pendingChoices = new Map();    // client mode: clientId -> Map(kind -> { answer, parent, at, by, before }) of the client's own answers (before: a withdrawal given offline ahead of this answer, sent first) to send through client_set_choice (v316: Share time zone with coach; Store health details)
export const profileUnder = new Map();      // client mode: clientId -> Map(key -> the health answer on record (its at) when that waiting detail was typed): a withdrawal made elsewhere since takes it off the phone (v316, the check rounds)
export const carriedFrom = new Map();       // client mode: "clientId\nkey" -> the page a waiting detail was taken from (never typed here): a newer value from that page replaces it (v316, the check rounds)
export const heldAgree = new Map();         // client mode: clientId -> { at, why }: an Agree refused for a parent ("parent needed") whose details wait on the phone until the parent answers; asked again, kept across a relaunch (v316, the check rounds)
export const settledAnswers = new Map();   // client mode: id -> "ok" | "stale" | "refused" for the client's answers the server has replied to (the last 100, kept with the queue): a second page's copy is never sent again, and its guess of one refused or set aside comes off (v316, the check rounds)
export const deletedNotes = new Map();       // noteId -> clientId: notes removed on this device and not yet saved to the server; a merge must not bring them back
export const deletedPackages = new Map();    // packageId -> clientId (the Templates record): packages removed on this device and not yet saved; a merge must not bring them back
export const folderTouched = new Map();      // node id -> clientId (the Templates record): a template folder or slide this device made, renamed or moved and not yet saved; a merge keeps this device's copy of it
export const deletedFolders = new Map();     // node id -> clientId (the Templates record): template folders and slides removed on this device and not yet saved; a merge must not bring them back
export const fromFile = new Map();           // "kind/id" -> the save version that carries a backup's copy: written as the file has it, nothing merged in, until a write at or after that version lands

export const withdrawnAt = new Map();       // client mode: clientId -> the newest health withdrawal given on this phone (its at), kept with the queue as `wd`: a page that learns of it late drops its waiting details typed before it and never takes such a detail from another page (v316, the check rounds)
export const deliv = new Map();             // client mode: "clientId\nkey" -> the newest typing time of that detail sent and confirmed by any page of this phone (the last 100, kept with the queue): a carried copy as old or older goes, whichever page delivered it (v316, the check rounds)
export const typedHere = new Set();         // client mode: "clientId\nkey" of details typed on this page: they stand against another page's value; any other copy (carried, restored after a reload) takes a correction (v316, the check rounds)
