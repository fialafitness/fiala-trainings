// Loads the real app script from ../index.html into Node (with the browser stand-ins) and hands back its internals.
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
require("./env");
let app = null;
module.exports = function load() {
  if (app) return app;
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const start = html.lastIndexOf("<script>\n(() => {"); const end = html.indexOf("</script>", start);
  if (start < 0 || end < 0) throw new Error("app script not found in index.html");
  let code = html.slice(start + "<script>\n".length, end);
  const hook = `
  globalThis.__app = {
    fns: { fetchAll, mergeDown, cloudBackend, clientBackend, localBackend, flushOne, scheduleSave, markDirty, persistPending, restorePending, freshRow, isEmptyWorkout, effDate, clientTrainings, lastWeights, setsOf, groupKey, noteEntries, packNotes, mergeNotes, validateBackup, buildReport, reportRange, parseTtf, pdfDoc, today, localIso, uid, key, setFinished, setSkipped, touchState, isTemplateClient, addTraining, render, setStatus },
    maps: { clients, trainings, dirty, seenAt, confirmedAt, timers, chains, trainerState, trainerTouched, trainerNamed, pendingWeightRows, pendingDoneRows, pendingEarlyRows, pendingFinish, pendingSkip, pendingMove, pendingMiss, pendingSwap },
    get: () => ({ sb, signedIn, clientMode, myClientId, backend, view, renderedTraining, offline, syncedOnce, moveMissing, missMissing, earlyMissing, logSetMissing, deviceFull, failed, inflight }),
    set: (o) => { if ("sb" in o) sb = o.sb; if ("signedIn" in o) signedIn = o.signedIn; if ("clientMode" in o) clientMode = o.clientMode; if ("myClientId" in o) myClientId = o.myClientId; if ("backend" in o) backend = o.backend; if ("view" in o) view = o.view; if ("renderedTraining" in o) renderedTraining = o.renderedTraining; if ("offline" in o) offline = o.offline; if ("syncedOnce" in o) syncedOnce = o.syncedOnce; if ("moveMissing" in o) moveMissing = o.moveMissing; if ("missMissing" in o) missMissing = o.missMissing; if ("earlyMissing" in o) earlyMissing = o.earlyMissing; if ("logSetMissing" in o) logSetMissing = o.logSetMissing; if ("failed" in o) failed = o.failed; },
    reset: () => { for (const m of [clients, trainings, dirty, seenAt, confirmedAt, timers, chains, trainerState, trainerTouched, trainerNamed, pendingWeightRows, pendingDoneRows, pendingEarlyRows, pendingFinish, pendingSkip, pendingMove, pendingMiss, pendingSwap]) m.clear();
      sb = null; signedIn = false; clientMode = false; myClientId = null; backend = null; offline = false; syncedOnce = false; moveMissing = false; missMissing = false; earlyMissing = false; logSetMissing = false; failed = false; inflight = 0; view = { name: "clients" }; renderedTraining = null; deviceFull = false; localStorage.clear(); },
  };
`;
  const marker = "\n  boot();\n";
  if (code.split(marker).length !== 2) throw new Error("expected exactly one boot() call");
  code = code.replace(marker, "\n" + hook + "\n");
  vm.runInThisContext(code, { filename: "index.html#app" });
  app = globalThis.__app; delete globalThis.__app;
  return app;
};
