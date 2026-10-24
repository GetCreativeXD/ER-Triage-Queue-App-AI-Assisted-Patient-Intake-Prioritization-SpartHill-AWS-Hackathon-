// =========================================================================
// Intake screen - one question per step (patient website)
// -------------------------------------------------------------------------
// Walks the patient through QUESTIONS one at a time using large, modern
// controls. Answers are kept in a module-level draft keyed by session id, so
// going back/forward preserves progress (accessibility requirement).
//
// Every question shows a microphone BELOW its content for speaking the answer.
// What the mic does depends on the question:
//   - name / symptoms "Other" / description : fills a text field
//   - severity   : speak a number 1-10 -> that circular button is pressed
//   - onset      : speak an option on screen -> that button is pressed; if the
//                  spoken phrase is NOT one of the options, it is typed into a
//                  free-text box shown below the options
//   - trend      : speak "better/worse/same" -> that button is pressed
//
// ALL patient-facing text is localized via i18n (t()) using the language the
// patient chose on the welcome screen. It is locked for the whole flow and the
// success screen - it never reverts to English.
// =========================================================================

import { el, mount, navigate } from "../services/dom.js";
import { QUESTIONS } from "../data/questions.js";
import { SEVERITY_COLORS } from "../data/questions.js";
import { api } from "../services/apiClient.js";
import { voiceService } from "../services/voiceService.js";
import { getLanguage, t } from "../services/i18n.js";

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
  const { control, getValue, getConfidence, spokenTarget, suppressSharedMic } = buildControl(q, draft);

  const error = el("p", { class: "error-text", text: "" });

  // ---- Microphone (below every question) --------------------------------
  // Some questions (e.g. name) manage their own per-field mics so a single
  // shared mic does not write into more than one box at once. Those opt out of
  // the shared mic via `suppressSharedMic`.
  let micBlock = null;
  if (!suppressSharedMic) {
    const micStatus = el("p", { class: "subtle center mic-status", text: t("micHint") });
    // Question 6 (the free-text "in your own words" description) keeps the mic
    // ON for a full 15 seconds after the patient stops speaking before it turns
    // off, so they have time to gather their thoughts. Every other question
    // uses the shorter 1.5s window.
    const silenceMs = q.id === "description" ? 15000 : 1500;
    const { button: micBtn } = voiceService.createMicWidget({
      language: getLanguage(),
      getBaseText: spokenTarget ? spokenTarget.getBase : undefined,
      onText: spokenTarget ? spokenTarget.setText : undefined,
      onStatus: (m) => { micStatus.textContent = m; },
      silenceMs,
    });
    micBlock = el("div", { class: "mic-block center stack" }, [micBtn, micStatus]);
  }

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
      error.textContent = t("submitError");
    }
  }

  const isLast = draft.step === QUESTIONS.length - 1;
  const helpText = q.helpKey ? t(q.helpKey) : null;
  const card = el("div", { class: "card stack" }, [
    progress,
    el("p", { class: "subtle", text: t("questionCounter", { current: draft.step + 1, total: QUESTIONS.length }) }),
    el("h1", { text: t(q.promptKey) }),
    helpText ? el("p", { class: "subtle", text: helpText }) : null,
    control,
    error,
    micBlock,
    el("div", { class: "row" }, [
      el("button", { class: "btn btn-outline", onClick: back }, t("back")),
      el("button", { class: "btn btn-primary", style: "flex:1", onClick: next }, isLast ? t("submit") : t("next")),
    ]),
  ]);

  mount(card);
}

// =========================================================================
// Controls
// =========================================================================

/** Normalize text for loose spoken-phrase matching (lowercase, no accents). */
function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/**
 * Build the right input control for a question type and return accessors.
 * Returns:
 *   control       - the DOM node
 *   getValue      - () => current answer value
 *   getConfidence - () => transcript confidence (text questions only)
 *   spokenTarget  - { getBase, setText } describing what the mic does for this
 *                   question (press a button, or fill a text field)
 */
function buildControl(q, draft) {
  const prior = draft.answers[q.id]?.answer;

  // ---- Name (first + last) --------------------------------------------
  // Each field has its OWN mic that records ONLY into that field, so speaking a
  // name never fills both boxes at once. The mic auto-stops after a short pause
  // (handled by the voice widget's silence timer).
  if (q.type === "name") {
    const first = el("input", { class: "input", type: "text", placeholder: t("name.firstPlaceholder"), value: prior?.firstName || "", autocomplete: "given-name" });
    const last = el("input", { class: "input", type: "text", placeholder: t("name.lastPlaceholder"), value: prior?.lastName || "", autocomplete: "family-name" });

    // Build a labeled field paired with its own compact mic. The mic writes
    // only to this input; other fields are untouched.
    const makeField = (labelKey, input) => {
      const { button: mic } = voiceService.createMicWidget({
        language: getLanguage(),
        getBaseText: () => "",            // name fields replace, not append
        onText: (text) => { input.value = String(text).trim(); },
      });
      return el("div", { class: "stack" }, [
        el("label", { text: t(labelKey) }),
        el("div", { class: "field-with-mic" }, [input, mic]),
      ]);
    };

    const wrap = el("div", { class: "stack" }, [
      makeField("name.firstLabel", first),
      makeField("name.lastLabel", last),
    ]);
    wrap.dataset.inputMethod = "typed";

    return {
      control: wrap,
      getValue: () => ({ firstName: first.value.trim(), lastName: last.value.trim() }),
      suppressSharedMic: true, // per-field mics replace the shared one here
    };
  }

  // ---- Symptoms: select all that apply (+ "Other" text) ----------------
  // Voice: each spoken symptom that matches an on-screen option presses that
  // option's button. Any spoken words that match NO option are placed in the
  // "Other" text box.
  if (q.type === "multi-choice") {
    const selected = new Set(Array.isArray(prior?.selected) ? prior.selected : []);
    const container = el("div", { class: "grid-options" });
    const optionMatchers = []; // { value, label, setOn }
    q.options.forEach((opt) => {
      const label = t(opt.key);
      const btn = el("button", { class: "btn btn-outline choice", text: label });
      const sync = () => btn.classList.toggle("selected", selected.has(opt.value));
      btn.addEventListener("click", () => {
        selected.has(opt.value) ? selected.delete(opt.value) : selected.add(opt.value);
        sync();
      });
      sync();
      container.appendChild(btn);
      optionMatchers.push({ value: opt.value, label, setOn: () => { selected.add(opt.value); sync(); } });
    });

    // "Other" button reveals a text response.
    let otherText = prior?.other || "";
    const otherInput = el("textarea", { class: "input", placeholder: t("symptom.otherPlaceholder"), text: otherText });
    const otherWrap = el("div", { class: "stack", style: "display:none" }, [otherInput]);
    otherInput.addEventListener("input", () => { otherText = otherInput.value; });

    const otherBtn = el("button", { class: "btn btn-outline choice", text: t("symptom.other") });
    const otherState = { on: Boolean(prior?.otherOn) };
    const syncOther = () => {
      otherBtn.classList.toggle("selected", otherState.on);
      otherWrap.style.display = otherState.on ? "" : "none";
    };
    otherBtn.addEventListener("click", () => { otherState.on = !otherState.on; syncOther(); });
    container.appendChild(otherBtn);
    syncOther();

    const wrap = el("div", { class: "stack" }, [container, otherWrap]);
    wrap.dataset.inputMethod = "selected";

    const spokenTarget = {
      getBase: () => "",
      // Press every option the patient named; collect anything unmatched into
      // "Other". Spoken phrases may list several symptoms separated by commas,
      // "and", or "y"/"et"/"和" in the supported languages.
      setText: (text) => {
        const raw = String(text).trim();
        if (!raw) return;
        const phrases = raw
          .split(/,|;|\band\b|\by\b|\bet\b|和|、/i)
          .map((p) => p.trim())
          .filter(Boolean);

        const unmatched = [];
        phrases.forEach((phrase) => {
          const spoken = norm(phrase);
          const hit = optionMatchers.find((o) =>
            spoken && (spoken === norm(o.label) || spoken.includes(norm(o.label)) || norm(o.label).includes(spoken)));
          if (hit) hit.setOn();
          else unmatched.push(phrase);
        });

        if (unmatched.length) {
          otherState.on = true;
          syncOther();
          const existing = otherInput.value.trim();
          otherInput.value = existing ? `${existing}, ${unmatched.join(", ")}` : unmatched.join(", ");
          otherText = otherInput.value;
        }
      },
    };

    return {
      control: wrap,
      getValue: () => ({ selected: [...selected], otherOn: otherState.on, other: otherState.on ? otherInput.value.trim() : "" }),
      spokenTarget,
    };
  }

  // ---- Severity: colored circular buttons 1-10 ------------------------
  // Smooth gradient (light green -> dark red) using the brief's exact hex
  // values. Speaking a number 1-10 presses that button.
  if (q.type === "severity") {
    let chosen = typeof prior === "number" ? prior : null;
    const container = el("div", { class: "severity-scale" });
    const byLevel = {};
    for (let n = q.min; n <= q.max; n++) {
      const color = SEVERITY_COLORS[n - 1] || "#ccc";
      const btn = el("button", {
        class: "severity-dot",
        style: `background:${color};color:${textOn(color)}`,
        "aria-label": `${n}`,
        text: String(n),
      });
      const select = () => {
        chosen = n;
        [...container.children].forEach((c) => c.classList.remove("selected"));
        btn.classList.add("selected");
      };
      btn.addEventListener("click", select);
      if (chosen === n) btn.classList.add("selected");
      byLevel[n] = select;
      container.appendChild(btn);
    }
    const legend = el("div", { class: "severity-legend row-between" }, [
      el("span", { class: "subtle", text: `1 - ${t("severity.min")}` }),
      el("span", { class: "subtle", text: `10 - ${t("severity.max")}` }),
    ]);
    const wrap = el("div", { class: "stack" }, [container, legend]);
    wrap.dataset.inputMethod = "selected";

    // Voice: pull the first 1-10 number out of the spoken text and press it.
    const spokenTarget = {
      getBase: () => "",
      setText: (text) => {
        const n = parseSpokenNumber(text, q.min, q.max);
        if (n != null && byLevel[n]) byLevel[n]();
      },
    };
    return { control: wrap, getValue: () => chosen, spokenTarget };
  }

  // ---- Onset: single choice; "Longer" reveals a dropdown --------------
  // Voice: if the spoken phrase matches an on-screen option, press it. If not,
  // type the spoken phrase into a free-text box shown below the options.
  if (q.type === "choice-with-detail") {
    let chosen = prior?.choice ?? null;
    let detail = prior?.detail ?? "";
    let otherText = prior?.other ?? "";
    const container = el("div", { class: "grid-options" });
    const byValue = {};

    const detailSelect = el("select", { class: "input" }, [
      el("option", { value: "", text: t("onset.selectOption") }),
      ...q.detailOptions.map((o) => el("option", { value: o.value, text: t(o.key) })),
    ]);
    detailSelect.value = detail;
    detailSelect.addEventListener("change", () => { detail = detailSelect.value; });
    const detailWrap = el("div", { class: "stack", style: "display:none" }, [detailSelect]);

    // Free-text box for a spoken answer that is not one of the options.
    const otherInput = el("input", { class: "input", type: "text", placeholder: t("onset.otherPlaceholder"), value: otherText });
    const otherWrap = el("div", { class: "stack", style: otherText ? "" : "display:none" }, [otherInput]);
    otherInput.addEventListener("input", () => { otherText = otherInput.value; });

    const syncDetail = () => { detailWrap.style.display = chosen === q.detailFor ? "" : "none"; };

    const pick = (value) => {
      chosen = value;
      [...container.children].forEach((c) => c.classList.toggle("selected", c.dataset.value === value));
      if (chosen !== q.detailFor) detail = "";
      // Picking an option clears the free-text fallback.
      otherText = ""; otherInput.value = ""; otherWrap.style.display = "none";
      syncDetail();
    };

    q.options.forEach((opt) => {
      const btn = el("button", { class: "btn btn-outline choice", text: t(opt.key), dataset: { value: opt.value } });
      btn.addEventListener("click", () => pick(opt.value));
      if (chosen === opt.value) btn.classList.add("selected");
      byValue[opt.value] = { pick: () => pick(opt.value), label: t(opt.key) };
      container.appendChild(btn);
    });
    syncDetail();

    const wrap = el("div", { class: "stack" }, [container, detailWrap, otherWrap]);
    wrap.dataset.inputMethod = "selected";

    const spokenTarget = {
      getBase: () => "",
      setText: (text) => {
        const spoken = norm(text);
        // Try to match a visible option by its localized label.
        const hit = Object.values(byValue).find((o) => spoken && (spoken === norm(o.label) || spoken.includes(norm(o.label)) || norm(o.label).includes(spoken)));
        if (hit) { hit.pick(); return; }
        // Not an option on the page -> type it into the free-text box.
        chosen = null;
        [...container.children].forEach((c) => c.classList.remove("selected"));
        otherText = String(text).trim();
        otherInput.value = otherText;
        otherWrap.style.display = "";
        detailWrap.style.display = "none";
      },
    };

    return {
      control: wrap,
      getValue: () => ({ choice: chosen, detail, other: chosen ? "" : otherText.trim() }),
      spokenTarget,
    };
  }

  // ---- Simple single choice (trend) -----------------------------------
  // Voice: speaking an option label presses that button automatically.
  if (q.type === "choice") {
    let chosen = prior ?? null;
    const container = el("div", { class: "grid-options" });
    const byLabel = [];
    q.options.forEach((opt) => {
      const label = typeof opt === "string" ? opt : t(opt.key);
      const value = typeof opt === "string" ? opt : opt.value;
      const btn = el("button", { class: "btn btn-outline choice", text: label });
      const select = () => {
        chosen = value;
        [...container.children].forEach((c) => c.classList.remove("selected"));
        btn.classList.add("selected");
      };
      btn.addEventListener("click", select);
      if (chosen === value) btn.classList.add("selected");
      byLabel.push({ label, select });
      container.appendChild(btn);
    });
    container.dataset.inputMethod = "selected";

    const spokenTarget = {
      getBase: () => "",
      setText: (text) => {
        const spoken = norm(text);
        const hit = byLabel.find((o) => spoken && (spoken === norm(o.label) || spoken.includes(norm(o.label)) || norm(o.label).includes(spoken)));
        if (hit) hit.select();
      },
    };
    return { control: container, getValue: () => chosen, spokenTarget };
  }

  // ---- Free text (description) ----------------------------------------
  let confidence = null;
  const textarea = el("textarea", {
    class: "input", placeholder: t("description.placeholder"), text: prior || "",
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

/** Pull the first integer in [min,max] out of a spoken phrase (digits or words). */
function parseSpokenNumber(text, min, max) {
  const s = norm(text);
  // Digit form first ("7", "pain is 7").
  const digit = s.match(/\d{1,2}/);
  if (digit) {
    const n = parseInt(digit[0], 10);
    if (n >= min && n <= max) return n;
  }
  // Word form (English + the other three supported languages, 1-10).
  const words = {
    en: ["one","two","three","four","five","six","seven","eight","nine","ten"],
    es: ["uno","dos","tres","cuatro","cinco","seis","siete","ocho","nueve","diez"],
    fr: ["un","deux","trois","quatre","cinq","six","sept","huit","neuf","dix"],
    zh: ["一","二","三","四","五","六","七","八","九","十"],
  };
  for (const list of Object.values(words)) {
    for (let i = 0; i < list.length; i++) {
      const n = i + 1;
      if (n >= min && n <= max && (s.includes(list[i]) || text.includes(list[i]))) return n;
    }
  }
  return null;
}

/** Pick black or white text for legibility on a given hex background. */
function textOn(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Perceived luminance (sRGB). Light backgrounds -> dark text.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#1a1a1a" : "#ffffff";
}

// =========================================================================
// Validation + serialization + signal derivation
// =========================================================================

/** Per-question validation; returns an error string or "" when valid. */
function validate(q, value) {
  switch (q.type) {
    case "name":
      if (!value.firstName || !value.lastName) return t("name.error");
      return "";
    case "multi-choice":
      if (!value.selected.length && !(value.otherOn && value.other)) return t("symptom.error");
      return "";
    case "severity":
      if (value == null) return t("severity.error");
      return "";
    case "choice-with-detail":
      // Valid if a button is chosen, or a free-text answer was given.
      if (!value.choice && !value.other) return t("onset.error");
      if (value.choice === q.detailFor && !value.detail) return t("onset.detailError");
      return "";
    case "choice":
      if (!value) return t("trend.error");
      return "";
    case "text":
      if (!value) return t("description.error");
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
      if (!value.choice && value.other) return value.other;
      return value.choice === q.detailFor && value.detail ? `${value.choice} (${value.detail})` : value.choice;
    default:
      return typeof value === "string" ? value : JSON.stringify(value);
  }
}

/** Map intake answers to the deterministic queue signals the rules expect. */
function deriveSignals(answers) {
  const severity = typeof answers["severity"]?.answer === "number" ? answers["severity"].answer : 0;
  const trend = answers["trend"]?.answer || "stable";
  // The warning-signs question was removed from the patient form, so no
  // critical signs are collected here; the queue rules handle an empty list.
  return { severity, trend, warningSigns: [], immediateHelp: false };
}

/** Expose the collected draft (kept for compatibility). */
export function getDraft(sessionId) { return drafts[sessionId]; }
export function clearDraft(sessionId) { delete drafts[sessionId]; }
