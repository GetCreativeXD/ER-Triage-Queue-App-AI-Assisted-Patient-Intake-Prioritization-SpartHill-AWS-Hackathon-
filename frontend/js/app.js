// =========================================================================
// app.js - application entry point + hash router
// -------------------------------------------------------------------------
// Loads demo data on first run, then maps the URL hash to a screen module.
// Patient routes carry the session id as a parameter, e.g. #/intake/ses_abc.
// Keeping routing here (and screens as pure render functions) is what lets
// each screen stay small and independently readable.
// =========================================================================

import { api } from "./services/apiClient.js";
import { renderWelcome } from "./screens/welcome.js";
import { renderIntake } from "./screens/intake.js";
import { renderDone } from "./screens/done.js";
import { renderStatus } from "./screens/status.js";

// Demo data is seeded server-side on boot; nothing to do here.
api.ensureSeed();

/**
 * Route table. Each entry matches a hash path and calls a screen renderer.
 * Paths may carry a trailing id segment (handled by the router below).
 */
const routes = {
  "/welcome": renderWelcome,
  "/intake": renderIntake,     // #/intake/:sessionId
  "/done": renderDone,         // #/done/:sessionId  (success + patient number)
  "/status": renderStatus,     // #/status/:sessionId
};

/** Parse the current hash into { path, param }. */
function parseHash() {
  const raw = window.location.hash.replace(/^#/, "") || "/welcome";
  const [, base = "welcome", param = ""] = raw.split("/");
  return { path: "/" + base, param };
}

/** Render the screen for the current hash. Screen renderers may be async. */
async function router() {
  const { path, param } = parseHash();
  const render = routes[path] || renderWelcome;
  try {
    await render(param);
  } catch (err) {
    // Any screen error should not blank the app; show a friendly message.
    console.error("Screen render error:", err);
    document.getElementById("app").innerHTML =
      '<div class="card state"><span class="icon">⚠️</span>Something went wrong. ' +
      '<a href="#/welcome">Return to start</a>.</div>';
  }
}

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);

// If the page loaded before DOMContentLoaded listener attached, render now.
if (document.readyState !== "loading") router();
