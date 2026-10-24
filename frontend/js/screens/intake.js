// =========================================================================
// Intake screen - one question per step (patient website)
// -------------------------------------------------------------------------
// Walks the patient through QUESTIONS one at a time using large, modern
// controls. Answers are kept in a module-level draft keyed by session id, so
// going back/forward preserves progress (accessibility requirement).
//
// Every question shows a microphone BELOW its content for speaking the answer
// (live transcription + accurate Amazon Transcribe on stop). The chosen
// language is locked for the whole flow. When the last question is answered,
// we submit the intake and show the success screen with the patient number.
// =========================================================================

import { el, mount, navigate } from "../services/dom.js";
import { QUESTIONS, WARNING_SIGNS } from "../data/questions.js";
import { api } from "../services/apiClient.js";
import { voiceService } from "../services/voiceService.js";
import { getLanguage } from "../services/i18n.js";

// Draft answers survive back/forward navigation within a session.
// Shape: { [sessionId]: { step, answers: { questionId: { answer, inputMethod, transcriptConfidence } } } }
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
  const { control, getValue, getConfidence, spokenTarget } = buildControl(q, draft);

  const error = el("p", { class: "error-text", text: "" });

  // ---- Microphone (below every question) --------------------------------
  const micStatus = el("p", { class: "subtle center mic-status", text: "Tap the mic and speak, or type your answer." });
  const { button: micBtn } = voiceService.createMicWidget({
    language: getLanguage(),
    getBaseText: spokenTarget ? spokenTarget.getBase : undefined,
    onText: spokenTarget ? spokenTarget.setText : undefined,
    onStatus: (m) => { micStatus.textContent = m; },
  });
  const micBlock = el("div", { class: "mic-block center stack" }, [micBtn, micStatus]);

  /** Save the current answer, advancing or finishing. */
  async function next() {
    const value = getValue();
    const err = validate(q, value);
    if (err) { error.textContent = err; return; }

    // The name step writes the patient's name to the session right away so the
    // triage app can show it even before the rest of intake is submitted.
    if (q.id === "name" && value && typeof value === "object") {
      try { await api.setSessionName(sessionId, value.firstName, value.lastName); } catch { /* retried on submit */ }
    }

    draft.answers[q.id] = {
      answer: value,
      inputMethod: control.dataset.inputMethod || "selected",
      transcriptConfidence: getConfidence ? getConfidence() : null,
    };

    if (draft.step < QUESTIONS.length - 1) {
      draft.step += 1;
      renderIntake(sessionId); // re-render next step (fire-and-forget)
    } else {
      await submit();
    }
  }

  /** Go back one step (progress preserved). */
  function back() {
    if (draft.step === 0) { navigate("/welcome"); return; }
    draft.step -= 1;
    renderIntake(sessionId);
  }

  /** Submit all answers: derive deterministic queue signals, then post. */
  async function submit() {
    try {
      const answers = QUESTIONS
        .filter((item) => draft.answers[item.id] != null)
        .map((item) => ({ questionId: item.id, answer: serializeAnswer(item, draft.answers[item.id].answer), inputMethod: draft.answers[item.id].inputMethod, transcriptConfidence: draft.answers[item.id].transcriptConfidence }));

      const signals = deriveSignals(draft.answers);
      await api.submitIntake(sessionId, answers, signals);
      clearDraft(sessionId);
      navigate(`/done/${sessionId}`);
    } catch {
      error.textContent = "Could not submit. Please try again.";
    }
  }

  const isLast = draft.step === QUESTIONS.length - 1;
  const card = el("div", { class: "card stack" }, [
    progress,
    el("p", { class: "subtle", text: `Question ${draft.step + 1} of ${QUESTIONS.length}` }),
    el("h1", { text: q.prompt }),
    q.help ? el("p", { class: "subtle", text: q.help }) : null,
    control,
    error,
    micBlock,
    el("div", { class: "row" }, [
      el("button", { class: "btn btn-outline", onClick: back }, "Back"),
      el("button", { class: "btn btn-primary", style: "flex:1", onClick: next }, isLast ? "Submit" : "Next"),
    ]),
  ]);

  mount(card);
}

// =========================================================================
// Controls
// =========================================================================

/**
 * Build the right input control for a question type and return accessors.
 * Returns:
 *   control       - the DOM node
 *   getValue      - () => current answer value
 *   getConfidence - () => transcript confidence (text questions only)
 *   spokenTarget  - { getBase, setText } for questions where the mic fills a
 *                   text field (null for pure button questions)
 */
function buildControl(q, draft) {
  const prior = draft.answers[q.id]?.answer;

  // ---- Name (first + last) --------------------------------------------
  if (q.type === "name") {
    const first = el("input", { class: "input", type: "text", placeholder: "First name", value: prior?.firstName || "", autocomplete: "given-name" });
    const last = el("input", { class: "input", type: "text", placeholder: "Last name", value: prior?.lastName || "", autocomplete: "family-name" });
    const wrap = el("div", { class: "stack" }, [
      el("label", { text: "First name" }), first,
      el("label", { text: "Last name" }), last,
    ]);
    wrap.dataset.inputMethod = "typed";
    // The mic fills the name fields: whichever is empty gets the spoken text.
    const spokenTarget = {
      getBase: () => "",
      setText: (text) => {
        const parts = String(text).trim().split(/\s+/);
        if (!first.value) first.value = parts.shift() || "";
        last.value = parts.join(" ") || last.value;
      },
    };
    return {
      control: wrap,
      getValue: () => ({ firstName: first.value.trim(), lastName: last.value.trim() }),
      spokenTarget,
    };
  }

  // ---- Main reason: select all that apply (+ "Other" text) ------------
  if (q.type === "multi-choice") {
    const selected = new Set(Array.isArray(prior?.selected) ? prior.selected : []);
    const container = el("div", { class: "grid-options" });
    q.options.forEach((opt) => {
      const btn = el("button", { class: "btn btn-outline choice", text: opt });
      const sync = () => btn.classList.toggle("selected", selected.has(opt));
      btn.addEventListener("click", () => {
        selected.has(opt) ? selected.delete(opt) : selected.add(opt);
        sync();
      });
      sync();
      container.appendChild(btn);
    });

    // "Other" button reveals a text response (per the brief).
    let otherText = prior?.other || "";
    const otherInput = el("textarea", { class: "input", placeholder: "Please describe the reason for your visit", text: otherText });
    const otherWrap = el("div", { class: "stack", style: "display:none" }, [otherInput]);
    otherInput.addEventListener("input", () => { otherText = otherInput.value; });

    const otherBtn = el("button", { class: "btn btn-outline choice", text: "Other" });
    const otherOn = Boolean(prior?.otherOn);
    const syncOther = () => {
      otherBtn.classList.toggle("selected", otherState.on);
      otherWrap.style.display = otherState.on ? "" : "none";
    };
    const otherState = { on: otherOn };
    otherBtn.addEventListener("click", () => { otherState.on = !otherState.on; syncOther(); });
    container.appendChild(otherBtn);
    if (otherOn) syncOther();

    const wrap = el("div", { class: "stack" }, [container, otherWrap]);
    wrap.dataset.inputMethod = "selected";

    const spokenTarget = {
      getBase: () => otherInput.value,
      setText: (text) => { otherState.on = true; syncOther(); otherInput.value = text; otherText = text; },
    };

    return {
      control: wrap,
      getValue: () => ({ selected: [...selected], otherOn: otherState.on, other: otherState.on ? otherInput.value.trim() : "" }),
      spokenTarget,
    };
  }

  // ---- Severity: colored circular buttons 0-10 ------------------------
  if (q.type === "severity") {
    let chosen = typeof prior === "number" ? prior : null;
    const container = el("div", { class: "severity-scale" });
    for (let n = q.min; n <= q.max; n++) {
      const btn = el("button", {
        class: "severity-dot",
        dataset: { level: severityLevel(n, q.max) },
        "aria-label": `Severity ${n}`,
        text: String(n),
      });
      const sync = () => btn.classList.toggle("selected", chosen === n);
      btn.addEventListener("click", () => { chosen = n; [...container.children].forEach((c) => c.classList.remove("selected")); btn.classList.add("selected"); });
      sync();
      container.appendChild(btn);
    }
    const legend = el("div", { class: "severity-legend row-between" }, [
      el("span", { class: "subtle", text: "None" }),
      el("span", { class: "subtle", text: "Worst" }),
    ]);
    const wrap = el("div", { class: "stack" }, [container, legend]);
    wrap.dataset.inputMethod = "selected";
    return { control: wrap, getValue: () => chosen };
  }

  // ---- Onset: single choice with a detail dropdown for "Longer" -------
  if (q.type === "choice-with-detail") {
    let chosen = prior?.choice ?? null;
    let detail = prior?.detail ?? "";
    const container = el("div", { class: "grid-options" });

    const detailSelect = el("select", { class: "input" }, [
      el("option", { value: "", text: "Choose how long ago" }),
      ...q.detailOptions.map((o) => el("option", { value: o.value, text: o.label })),
    ]);
    detailSelect.value = detail;
    detailSelect.addEventListener("change", () => { detail = detailSelect.value; });
    const detailWrap = el("div", { class: "stack", style: "display:none" }, [detailSelect]);

    const syncDetail = () => { detailWrap.style.display = chosen === q.detailFor ? "" : "none"; };

    q.options.forEach((opt) => {
      const btn = el("button", { class: "btn btn-outline choice", text: opt });
      const sync = () => btn.classList.toggle("selected", chosen === opt);
      btn.addEventListener("click", () => {
        chosen = opt;
        [...container.children].forEach((c) => c.classList.remove("selected"));
        btn.classList.add("selected");
        if (chosen !== q.detailFor) detail = "";
        syncDetail();
      });
      sync();
      container.appendChild(btn);
    });
    syncDetail();

    const wrap = el("div", { class: "stack" }, [container, detailWrap]);
    wrap.dataset.inputMethod = "selected";
    return { control: wrap, getValue: () => ({ choice: chosen, detail }) };
  }

  // ---- Simple single choice (trend) -----------------------------------
  if (q.type === "choice") {
    let chosen = prior ?? null;
    const container = el("div", { class: "grid-options" });
    q.options.forEach((opt) => {
      const label = typeof opt === "string" ? opt : opt.label;
      const value = typeof opt === "string" ? opt : opt.value;
      const btn = el("button", { class: "btn btn-outline choice", text: label });
      const sync = () => btn.classList.toggle("selected", chosen === value);
      btn.addEventListener("click", () => {
        chosen = value;
        [...container.children].forEach((c) => c.classList.remove("selected"));
        btn.classList.add("selected");
      });
      sync();
      container.appendChild(btn);
    });
    container.dataset.inputMethod = "selected";
    return { control: container, getValue: () => chosen };
  }

  // ---- Warning signs: condensed categories + "None of these" ----------
  if (q.type === "warning-multi") {
    const selected = new Set(Array.isArray(prior?.selected) ? prior.selected : []);
    let noneOn = Boolean(prior?.noneOn);
    const container = el("div", { class: "grid-options" });

    const describeInput = el("textarea", { class: "input", placeholder: "Describe what you are feeling", text: prior?.describe || "" });
    const describeWrap = el("div", { class: "stack", style: "display:none" }, [describeInput]);

    const noneBtn = el("button", { class: "btn btn-outline choice", text: "None of these" });

    const syncNone = () => {
      noneBtn.classList.toggle("selected", noneOn);
      describeWrap.style.display = noneOn ? "" : "none";
    };

    q.options.forEach((opt) => {
      const btn = el("button", { class: "btn btn-outline choice", text: opt.label });
      const sync = () => btn.classList.toggle("selected", selected.has(opt.id));
      btn.addEventListener("click", () => {
        // Choosing a real sign clears "None of these".
        if (noneOn) { noneOn = false; syncNone(); }
        selected.has(opt.id) ? selected.delete(opt.id) : selected.add(opt.id);
        sync();
      });
      sync();
      container.appendChild(btn);
    });

    noneBtn.addEventListener("click", () => {
      noneOn = !noneOn;
      if (noneOn) { selected.clear(); [...container.children].forEach((c) => c.classList.remove("selected")); }
      syncNone();
    });
    container.appendChild(noneBtn);
    syncNone();

    const wrap = el("div", { class: "stack" }, [container, describeWrap]);
    wrap.dataset.inputMethod = "selected";

    const spokenTarget = {
      getBase: () => describeInput.value,
      setText: (text) => { noneOn = true; syncNone(); describeInput.value = text; },
    };

    return {
      control: wrap,
      getValue: () => ({ selected: [...selected], noneOn, describe: noneOn ? describeInput.value.trim() : "" }),
      spokenTarget,
    };
  }

  // ---- Free text (description) ----------------------------------------
  let confidence = null;
  const textarea = el("textarea", {
    class: "input", placeholder: "Type here...", text: prior || "",
    oninput: () => { textarea.closest(".stack").dataset.inputMethod = "typed"; },
  });
  const wrap = el("div", { class: "stack" }, [textarea]);
  wrap.dataset.inputMethod = "typed";

  const spokenTarget = {
    getBase: () => textarea.value,
    setText: (text, meta) => {
      textarea.value = text;
      wrap.dataset.inputMethod = "voice";
      if (meta && typeof meta.confidence === "number") confidence = meta.confidence;
    },
  };

  return {
    control: wrap,
    getValue: () => textarea.value.trim(),
    getConfidence: () => confidence,
    spokenTarget,
  };
}

// =========================================================================
// Validation + serialization + signal derivation
// =========================================================================

/** Per-question validation; returns an error string or "" when valid. */
function validate(q, value) {
  switch (q.type) {
    case "name":
      if (!value.firstName || !value.lastName) return "Please enter your first and last name.";
      return "";
    case "multi-choice":
      if (!value.selected.length && !(value.otherOn && value.other)) return "Please select at least one, or describe it under \"Other\".";
      return "";
    case "severity":
      if (value == null) return "Please choose a number.";
      return "";
    case "choice-with-detail":
      if (!value.choice) return "Please answer to continue.";
      if (value.choice === q.detailFor && !value.detail) return "Please choose how long ago.";
      return "";
    case "choice":
      if (!value) return "Please answer to continue.";
      return "";
    case "warning-multi":
      if (!value.selected.length && !value.noneOn) return "Select any that apply, or choose \"None of these\".";
      return "";
    case "text":
      if (!value) return "Please answer to continue.";
      return "";
    default:
      return "";
  }
}

/** Convert a rich answer value into the string the backend/nurse view reads. */
function serializeAnswer(q, value) {
  switch (q.type) {
    case "name":
      return `${value.firstName} ${value.lastName}`.trim();
    case "multi-choice": {
      const parts = [...value.selected];
      if (value.otherOn && value.other) parts.push(`Other: ${value.other}`);
      return parts.join(", ");
    }
    case "severity":
      return String(value);
    case "choice-with-detail":
      return value.choice === q.detailFor && value.detail ? `${value.choice} (${value.detail})` : value.choice;
    case "warning-multi": {
      if (value.noneOn) return value.describe ? `None of the listed signs. ${value.describe}` : "None of the listed signs.";
      return value.selected
        .map((id) => q.options.find((o) => o.id === id)?.label || id)
        .join(", ");
    }
    default:
      return typeof value === "string" ? value : JSON.stringify(value);
  }
}

/** Map intake answers to the deterministic queue signals the rules expect. */
function deriveSignals(answers) {
  const severity = typeof answers["severity"]?.answer === "number" ? answers["severity"].answer : 0;
  const trend = answers["trend"]?.answer || "stable";

  // Expand condensed warning-sign categories back into the critical sign ids
  // the queue rules recognize (see data/questions.js `maps`).
  const warn = answers["warning-signs"]?.answer;
  const warningSigns = [];
  if (warn && !warn.noneOn && Array.isArray(warn.selected)) {
    warn.selected.forEach((catId) => {
      const cat = WARNING_SIGNS.find((w) => w.id === catId);
      if (cat) warningSigns.push(...cat.maps);
    });
  }

  return { severity, trend, warningSigns, immediateHelp: false };
}

/** Severity color band for a value on a 0..max scale. */
function severityLevel(n, max) {
  const ratio = n / max;
  if (ratio <= 0.3) return "safe";      // green
  if (ratio <= 0.6) return "moderate";  // yellow/orange
  return "danger";                      // red
}

/** Expose the collected draft (kept for compatibility; confirm screen removed). */
export function getDraft(sessionId) { return drafts[sessionId]; }
export function clearDraft(sessionId) { delete drafts[sessionId]; }
