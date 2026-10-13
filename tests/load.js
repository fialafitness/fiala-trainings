// Loads the real app module (app/main.js) into Node after the browser stand-ins, and hands back its internals.
import "./env.js";
let app = null;
export async function load() {
  if (app) return app;
  const mod = await import("../app/main.js");
  app = mod.internals();
  return app;
}
