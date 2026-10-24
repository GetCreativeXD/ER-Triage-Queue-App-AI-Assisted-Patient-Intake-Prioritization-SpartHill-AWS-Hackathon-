// =========================================================================
// Success / patient-number screen (patient website)
// -------------------------------------------------------------------------
// Shown immediately after the patient submits their intake. Per the brief it
// displays a big white check mark inside a green circle, with the 4-digit
// patient number in a large font beneath it. All text stays in the language
// the patient chose at the start (never reverts to English).
// =========================================================================

import { el, mount, navigate } from "../services/dom.js";
import { api } from "../services/apiClient.js";
import { t } from "../services/i18n.js";

export async function renderDone(sessionId) {
  let session;
  try {
    session = await api.getSession(sessionId);
  } catch { session = null; }
  if (!session) { navigate("/welcome"); return; }

  // Big white check mark in a green circle. The SVG is built via innerHTML so
  // the browser parses it in the SVG namespace (createElement would not).
  const circle = el("div", { class: "success-circle" });
  circle.innerHTML =
    '<svg viewBox="0 0 52 52" class="success-tick" width="76" height="76" aria-hidden="true">' +
    '<path fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" d="M14 27l8 8 16-18"/>' +
    "</svg>";
  const check = el("div", { class: "success-check", "aria-hidden": "true" }, [circle]);

  const card = el("div", { class: "card stack center done-card" }, [
    check,
    el("h1", { text: t("doneTitle") }),
    el("p", { class: "subtle", text: t("doneSubtitle") }),
    el("div", { class: "patient-number", "aria-label": t("doneSubtitle"), text: session.patientNumber || "----" }),
    el("p", { class: "subtle", text: t("doneHelp") }),
  ]);

  mount(card);
}
