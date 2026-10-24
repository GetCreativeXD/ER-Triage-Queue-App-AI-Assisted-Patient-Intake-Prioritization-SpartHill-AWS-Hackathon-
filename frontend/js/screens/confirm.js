// =========================================================================
// Confirmation screen
// -------------------------------------------------------------------------
// Shows a readable summary of everything the patient entered so they can
// catch transcription errors before submitting (a safety requirement for
// voice input). "Edit" sends them back into the intake flow at that step;
// "Submit" derives the queue signals from the answers and posts the intake.
// =========================================================================

import { el, mount, navigate } from "../services/dom.js";
import { QUESTIONS, WARNING_SIGNS } from "../data/questions.js";
import { api } from "../services/apiClient.js";
import { getDraft, clearDraft } from "./intake.js";

export function renderConfirm(sessionId) {
  const draft = getDraft(sessionId);
  if (!draft) { navigate(`/intake/${sessionId}`); return; }

  const error = el("p", { class: "error-text", text: "" });

  // Build a readable summary row for each answered question.
  const rows = QUESTIONS.map((q, index) => {
    const a = draft.answers[q.id];
    return el("div", { class: "row-between", style: "border-bottom:1px solid var(--color-border);padding:10px 0" }, [
      el("div", {}, [
        el("div", { class: "subtle", text: q.prompt }),
        el("strong", { text: formatAnswer(q, a?.answer) }),
      ]),
      el("button", {
        class: "btn btn-outline",
        onClick: () => { draft.step = index; navigate(`/intake/${sessionId}`); },
      }, "Edit"),
    ]);
  });

  /** Submit the intake: turn answers into deterministic queue signals. */
  async function submit() {
    try {
      const answers = QUESTIONS
        .filter((q) => draft.answers[q.id] != null)
        .map((q) => ({ questionId: q.id, ...draft.answers[q.id] }));

      // Map answers to the signals the queue rules understand.
      const signals = {
        severity: Number(draft.answers["severity"]?.answer) || 0,
        trend: draft.answers["trend"]?.answer || "stable",
        warningSigns: draft.answers["warning-signs"]?.answer || [],
        immediateHelp: false,
      };

      await api.submitIntake(sessionId, answers, signals);
      clearDraft(sessionId);
      navigate(`/status/${sessionId}`);
    } catch (e) {
      error.textContent = "Could not submit. Please try again.";
    }
  }

  const card = el("div", { class: "card stack" }, [
    el("h1", { text: "Review your answers" }),
    el("p", { class: "subtle", text: "Check these are correct. Tap Edit to change anything, then submit." }),
    ...rows,
    error,
    el("div", { class: "row" }, [
      el("button", { class: "btn btn-outline", onClick: () => navigate(`/intake/${sessionId}`) }, "← Back"),
      el("button", { class: "btn btn-primary", style: "flex:1", onClick: submit }, "Submit to nurse"),
    ]),
  ]);

  mount(card);
}

/** Turn a raw answer into human-readable text for the summary. */
function formatAnswer(q, answer) {
  if (answer == null || answer === "") return "(no answer)";
  if (q.id === "warning-signs") {
    if (!answer.length) return "None reported";
    return answer
      .map((id) => WARNING_SIGNS.find((w) => w.id === id)?.label || id)
      .join(", ");
  }
  if (q.id === "trend") {
    return { worsening: "Worse", stable: "Same", improving: "Better" }[answer] || answer;
  }
  return String(answer);
}
