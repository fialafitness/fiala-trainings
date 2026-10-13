// Notes on a client: the shape inside c.notes (a string = the old single note; { log: [...] } = the dated list).
import { uid } from "./util.js";

export const noteEntries = (c) => {
  const n = c && c.notes;
  const raw = n && typeof n === "object" && Array.isArray(n.log) ? n.log : [];
  const list = raw.filter((x) => x && typeof x === "object" && typeof x.text === "string")
    .map((x) => ({ id: String(x.id || uid()), at: x.at && !isNaN(new Date(x.at)) ? String(x.at) : null, text: x.text,
      workout: x.workout && typeof x.workout === "object" && x.workout.id ? { id: String(x.workout.id), title: String(x.workout.title || ""), date: String(x.workout.date || "") } : null }));
  if (typeof n === "string" && n.trim()) list.push({ id: "legacy", at: null, text: n });
  return list;
};
export const packNotes = (list) => ({ log: list.map((x) => ({ id: x.id === "legacy" ? uid() : x.id, at: x.at, text: x.text, ...(x.workout ? { workout: x.workout } : {}) })) });
export const mergeNotes = (mine, theirs, deletedNotes) => {                          // another device saved first: keep both sets; what this device deleted stays deleted
  const a = noteEntries({ notes: mine }), b = noteEntries({ notes: theirs }), ids = new Set(a.map((x) => x.id));
  const extra = b.filter((x) => x.id !== "legacy" && !ids.has(x.id) && !deletedNotes.has(x.id));
  return extra.length ? packNotes([...a, ...extra]) : mine;
};
