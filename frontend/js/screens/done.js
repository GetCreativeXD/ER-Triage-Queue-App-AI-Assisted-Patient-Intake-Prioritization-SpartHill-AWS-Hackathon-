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

// Build the big white check mark in a green circle used on both the success
// screen and the "Status updated" confirmation.
function successCheck() {
  const circle = el("div", { class: "success-circle" });
  circle.innerHTML =
    '<svg viewBox="0 0 52 52" class="success-tick" width="76" height="76" aria-hidden="true">' +
    '<path fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" d="M14 27l8 8 16-18"/>' +
    "</svg>";
  return el("div", { class: "success-check", "aria-hidden": "true" }, [circle]);
}

export async function renderDone(sessionId) {
  let session;
  try {
    session = await api.getSession(sessionId);
  } catch { session = null; }
  if (!session) { navigate("/welcome"); return; }

  const card = el("div", { class: "card stack center done-card" }, [
    successCheck(),
    el("h1", { text: t("doneTitle") }),
    el("p", { class: "subtle", text: t("doneSubtitle") }),
    el("div", { class: "patient-number", "aria-label": t("doneSubtitle"), text: session.patientNumber || "----" }),
    el("p", { class: "subtle", text: t("doneHelp") }),
    // Status-update button: opens the text-only "how do you feel now?" flow.
    el("button", {
      class: "btn btn-primary btn-block",
      onClick: () => navigate(`/status/${sessionId}`),
    }, t("statusUpdateButton")),
  ]);

  mount(card);
}

/**
 * "Status updated" confirmation: reuses the success-screen format (check-mark
 * animation + patient number) but with the "Status updated" title. Rendered by
 * the status screen after a successful update submission.
 */
export function renderStatusUpdated(session) {
  const card = el("div", { class: "card stack center done-card" }, [
    successCheck(),
    el("h1", { text: t("statusUpdatedTitle") }),
    el("p", { class: "subtle", text: t("doneSubtitle") }),
    el("div", { class: "patient-number", "aria-label": t("doneSubtitle"), text: session.patientNumber || "----" }),
    el("p", { class: "subtle", text: t("doneHelp") }),
  ]);
  mount(card);
}
