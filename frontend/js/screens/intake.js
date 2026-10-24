// =========================================================================
// Intake screen - one question per step
// -------------------------------------------------------------------------
// Walks the patient through QUESTIONS one at a time using large controls.
// Answers are kept in a module-level draft keyed by session id, so going
// back/forward preserves progress (accessibility requirement). The free-text
// question supports voice via voiceService. When the last question is
// answered, we move to the confirmation screen.
// =========================================================================

import { el, mount, navigate } from "../services/dom.js";
import { QUESTIONS } from "../data/questions.js";
import { api } from "../services/apiClient.js";
import { voiceService, speechLocale } from "../services/voiceService.js";
import { getLanguage } from "../services/i18n.js";

// Draft answers survive back/forward navigation within a session.
// Shape: { [sessionId]: { step, answers: { questionId: { answer, inputMethod } } } }
const drafts = {};

export async function renderIntake(sessionId) {
  let session;
  try {
    session = await api.getSession(sessionId);
  } catch { session = null; }
  if (!session) { navigate("/welcome"); return; }

  const draft = drafts[sessionId] || (drafts[sessionId] = { step: 0, answers: {} });
  const q = QUESTIONS[draft.step];

  // ---- Progress bar -----------------------------------------------------
  const pct = Math.round((draft.step / QUESTIONS.length) * 100);
  const progress = el("div", { class: "progress", "aria-hidden": "true" }, [
    el("span", { style: `width:${pct}%` }),
  ]);

  // ---- Answer control (depends on question type) -----------------------
  const { control, getValue } = buildControl(q, draft, sessionId);

  const error = el("p", { class: "error-text", text: "" });

  /** Save the current answer, advancing or finishing. */
  function next() {
    const value = getValue();
    // "multi" and "slider" always have a value; others must be non-empty.
    if ((q.type === "choice" || q.type === "text") && !value) {
      error.textContent = "Please answer to continue.";
      return;
    }
    draft.answers[q.id] = {
      answer: value,
      inputMethod: control.dataset.inputMethod || "selected",
    };

    if (draft.step < QUESTIONS.length - 1) {
      draft.step += 1;
      renderIntake(sessionId); // re-render next step (fire-and-forget)
    } else {
      navigate(`/confirm/${sessionId}`);
    }
  }

  /** Go back one step (progress preserved). */
  function back() {
    if (draft.step === 0) { navigate(`/session/${getLanguage()}`); return; }
    draft.step -= 1;
    renderIntake(sessionId);
  }

  const card = el("div", { class: "card stack" }, [
    progress,
    el("p", { class: "subtle", text: `Question ${draft.step + 1} of ${QUESTIONS.length}` }),
    el("h1", { text: q.prompt }),
    q.help ? el("p", { class: "subtle", text: q.help }) : null,
    control,
    error,
    el("div", { class: "row" }, [
      el("button", { class: "btn btn-outline", onClick: back }, "← Back"),
      el("button", { class: "btn btn-primary", style: "flex:1", onClick: next }, "Next →"),
    ]),
  ]);

  mount(card);
}

/**
 * Build the right input control for a question type and return a getValue().
 * Each control stashes its chosen input method on control.dataset.inputMethod
 * so we can record typed vs selected vs voice.
 */
function buildControl(q, draft, sessionId) {
  const prior = draft.answers[q.id]?.answer;

  // ---- Single choice (big buttons) ------------------------------------
  if (q.type === "choice") {
    let chosen = prior ?? null;
    const container = el("div", { class: "grid-options" });
    q.options.forEach((opt) => {
      const label = typeof opt === "string" ? opt : opt.label;
      const value = typeof opt === "string" ? opt : opt.value;
      const btn = el("button", {
        class: "btn btn-outline",
        onClick: () => {
          chosen = value;
          [...container.children].forEach((c) => (c.style.borderColor = ""));
          btn.style.borderColor = "var(--color-primary)";
          container.dataset.inputMethod = "selected";
        },
      }, label);
      if (value === chosen) btn.style.borderColor = "var(--color-primary)";
      container.appendChild(btn);
    });
    return { control: container, getValue: () => chosen };
  }

  // ---- Severity slider 0-10 -------------------------------------------
  if (q.type === "slider") {
    const output = el("strong", { text: String(prior ?? q.min) });
    const slider = el("input", {
      class: "slider", type: "range", min: q.min, max: q.max,
      value: prior ?? q.min,
      "aria-label": q.prompt,
      oninput: () => (output.textContent = slider.value),
    });
    const wrap = el("div", { class: "stack" }, [
      slider,
      el("p", { class: "center" }, [el("span", { text: "Selected: " }), output, el("span", { text: ` / ${q.max}` })]),
    ]);
    wrap.dataset.inputMethod = "selected";
    return { control: wrap, getValue: () => Number(slider.value) };
  }

  // ---- Multi-select warning signs -------------------------------------
  if (q.type === "multi") {
    const selectedSet = new Set(Array.isArray(prior) ? prior : []);
    const container = el("div", { class: "grid-options" });
    q.options.forEach((opt) => {
      const btn = el("button", { class: "btn btn-outline", text: opt.label });
      const sync = () => (btn.style.borderColor = selectedSet.has(opt.id) ? "var(--p-immediate)" : "");
      btn.addEventListener("click", () => {
        selectedSet.has(opt.id) ? selectedSet.delete(opt.id) : selectedSet.add(opt.id);
        sync();
      });
      sync();
      container.appendChild(btn);
    });
    container.dataset.inputMethod = "selected";
    return { control: container, getValue: () => [...selectedSet] };
  }

  // ---- Free text (+ optional voice) -----------------------------------
  const textarea = el("textarea", {
    class: "input", placeholder: "Type here...", text: prior || "",
    oninput: () => (textarea.closest(".stack").dataset.inputMethod = "typed"),
  });
  const wrap = el("div", { class: "stack" }, [textarea]);
  wrap.dataset.inputMethod = "typed";

  if (q.allowVoice) {
    const micBtn = el("button", { class: "mic-btn", "aria-label": "Speak your answer", onClick: speak }, "🎤");
    const hint = el("p", { class: "subtle center", text: "Or tap the mic to speak" });
    if (!voiceService.isSupported()) {
      micBtn.disabled = true;
      hint.textContent = "Voice not available in this browser; please type.";
    }
    wrap.appendChild(el("div", { class: "center stack" }, [micBtn, hint]));

    async function speak() {
      try {
        const { transcript } = await voiceService.listenOnce({
          lang: speechLocale(getLanguage()),
          onStart: () => micBtn.classList.add("listening"),
          onEnd: () => micBtn.classList.remove("listening"),
        });
        // Append so the patient can combine typed + spoken input.
        textarea.value = (textarea.value ? textarea.value + " " : "") + transcript;
        wrap.dataset.inputMethod = "voice"; // mark method for the record
      } catch {
        micBtn.classList.remove("listening");
        hint.textContent = "Could not capture audio. Please type your answer.";
      }
    }
  }

  return { control: wrap, getValue: () => textarea.value.trim() };
}

/** Expose the collected draft so the confirm screen can read/submit it. */
export function getDraft(sessionId) { return drafts[sessionId]; }
export function clearDraft(sessionId) { delete drafts[sessionId]; }
