// A tiny stand-in for the browser, just enough for the app's script to load in Node.
// Elements are permissive stubs: any property reads back what was written, any method is a no-op.
const METHODS = new Set(["addEventListener", "removeEventListener", "dispatchEvent", "focus", "blur", "click", "scrollIntoView", "setAttribute", "removeAttribute",
  "append", "appendChild", "prepend", "replaceChildren", "remove", "insertAdjacentHTML", "after", "before", "select", "setSelectionRange", "showPicker", "scrollTo"]);
const byId = new Map();
function el(tag) {
  const store = { tagName: (tag || "div").toUpperCase(), hidden: false, textContent: "", value: "", innerHTML: "", className: "", disabled: false, readOnly: false, tabIndex: 0, placeholder: "", children: [], options: [], files: null, offsetHeight: 0, scrollHeight: 0, clientHeight: 0, offsetWidth: 0,
    dataset: {}, style: { setProperty() {}, removeProperty() {} }, classes: new Set() };
  store.classList = { add: (...c) => c.forEach((x) => store.classes.add(x)), remove: (...c) => c.forEach((x) => store.classes.delete(x)), toggle: (c, f) => { const on = f === undefined ? !store.classes.has(c) : !!f; if (on) store.classes.add(c); else store.classes.delete(c); return on; }, contains: (c) => store.classes.has(c) };
  return new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      if (METHODS.has(k)) return () => {};
      if (k === "contains") return () => false;
      if (k === "querySelector" || k === "closest") return () => (k === "closest" ? null : el());
      if (k === "querySelectorAll") return () => [];
      if (k === "getAttribute") return () => null;
      if (k === "getBoundingClientRect") return () => ({ top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 });
      if (k === "firstChild" || k === "lastChild" || k === "firstElementChild" || k === "parentElement" || k === "nextElementSibling") return el();
      if (typeof k === "symbol") return undefined;
      return el();
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
const storage = { map: new Map(), fail: false,
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; },
  setItem(k, v) { if (this.fail) throw new Error("QuotaExceededError"); this.map.set(k, String(v)); },
  removeItem(k) { this.map.delete(k); }, clear() { this.map.clear(); }, key(i) { return [...this.map.keys()][i] ?? null; }, get length() { return this.map.size; } };
const document = {
  getElementById: (id) => { if (!byId.has(id)) byId.set(id, el()); return byId.get(id); },
  querySelector: () => el(), querySelectorAll: () => [], createElement: (t) => el(t), createTextNode: (s) => ({ textContent: s }),
  addEventListener() {}, removeEventListener() {}, body: el("body"), documentElement: el("html"), activeElement: null, hidden: false, visibilityState: "visible",
};
class Option { constructor(text, value) { this.text = text; this.value = value; } }
const window = globalThis;
const define = (o) => { for (const [k, v] of Object.entries(o)) Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true }); };   // Node has read-only getters for some of these
define({
  window, document, localStorage: storage, Option,
  addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, getComputedStyle: () => ({ getPropertyValue: () => "", display: "block", color: "" }),
  navigator: { onLine: true, vibrate() {}, userAgent: "node", language: "en-US" },
  location: { protocol: "http:", hostname: "localhost", hash: "", pathname: "/", origin: "http://localhost", search: "", href: "http://localhost/" },
  history: { replaceState() {}, pushState() {} },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  requestAnimationFrame: (fn) => setTimeout(fn, 0), cancelAnimationFrame: (id) => clearTimeout(id),
  scrollTo() {}, scrollBy() {}, innerHeight: 800, innerWidth: 390, alert() {}, confirm: () => true,
});
const realSetInterval = globalThis.setInterval;
globalThis.setInterval = (fn, ms) => { const t = realSetInterval(fn, ms); if (t && t.unref) t.unref(); return t; };
export { el, byId, storage, document };
