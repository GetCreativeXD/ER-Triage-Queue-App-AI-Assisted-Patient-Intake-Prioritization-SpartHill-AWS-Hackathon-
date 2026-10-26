// =========================================================================
// Patient status-update screen (post-submission)
// -------------------------------------------------------------------------
// Reached from the "You're all set" success page via "Update my status". The
// brief requires a TEXT-ONLY update: a single question ("Are your symptoms
// getting better, worse, or staying the same?") with a text box the patient
// can TYPE or SPEAK into - NO button options. On submit we send the update to
// the backend (which updates the patient on the triage dashboard), then show a
// "Status updated" confirmation that reuses the success-screen format (same
// patient number + check-mark animation).
// =========================================================================

import { el, mount, navigate } from "../services/dom.js";
import { api } from "../services/apiClient.js";
import { voiceService } from "../services/voiceService.js";
import { getLanguage, t } from "../services/i18n.js";
import { renderStatusUpdated } from "./done.js";

/** Normalize text for loose keyword matching (lowercase, no accents). */
function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/**
 * Infer a trend (worsening | improving | stable) from the patient's free-text
 * answer, across the four supported languages. Defaults to "stable" when no
 * clear signal is present, so the deterministic queue rules always get a value.
 */
function inferTrend(text) {
  const s = norm(text);
  const worse = ["worse", "worsen", "bad", "peor", "empeor", "pire", "aggrav", "更糟", "恶化", "严重"];
  const better = ["better", "improv", "good", "mejor", "mieux", "amelior", "好转", "好多了", "改善"];
  if (worse.some((w) => s.includes(w)) || text.includes("更糟") || text.includes("恶化")) return "worsening";
  if (better.some((w) => s.includes(w)) || text.includes("好转") || text.includes("好多了")) return "improving";
  return "stable";
}

export async function renderStatus(sessionId) {
  let session;
  try {
    session = await api.getSession(sessionId);
  } catch { session = null; }
  if (!session) { navigate("/welcome"); return; }

  const error = el("p", { class: "error-text center", text: "" });

  // Single free-text box the patient can type OR speak into (no buttons).
  const answer = el("textarea", { class: "input", placeholder: t("statusUpdatePlaceholder") });
  const micStatus = el("p", { class: "subtle center mic-status", text: t("micHint") });
  const { button: micBtn } = voiceService.createMicWidget({
    language: getLanguage(),
    getBaseText: () => answer.value,
    onText: (text) => { answer.value = text; },
    onStatus: (m) => { micStatus.textContent = m; },
  });

  async function submit() {
    const text = answer.value.trim();
    if (!text) { error.textContent = t("statusUpdateError"); return; }
    try {
      // Text-only update: infer the trend from the words, keep the patient's
      // own text as the description. This updates the patient on the triage
      // dashboard via the backend (recalculates priority, flags for review).
      await api.submitUpdate(sessionId, {
        trend: inferTrend(text),
        description: text,
        warningSigns: [],
        immediateHelp: false,
      });
      const updated = await api.getSession(sessionId).catch(() => session);
      // Confirmation reuses the success-screen format with "Status updated".
      renderStatusUpdated(updated || session);
    } catch {
      error.textContent = t("statusUpdateFailed");
    }
  }

  const card = el("div", { class: "card stack" }, [
    el("h1", { text: t("statusUpdatePrompt") }),
    answer,
    el("div", { class: "mic-block center stack" }, [micBtn, micStatus]),
    error,
    el("div", { class: "row" }, [
      el("button", { class: "btn btn-outline", onClick: () => navigate(`/done/${sessionId}`) }, t("back")),
      el("button", { class: "btn btn-primary", style: "flex:1", onClick: submit }, t("statusUpdateSend")),
    ]),
  ]);

  mount(card);
}
