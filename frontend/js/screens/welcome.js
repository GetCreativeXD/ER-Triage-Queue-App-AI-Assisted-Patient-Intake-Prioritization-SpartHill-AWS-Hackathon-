// =========================================================================
// Welcome / language selection screen
// -------------------------------------------------------------------------
// This is the intro page described in the brief:
//   - a text box where the patient types their language, and
//   - a microphone button at the bottom to SPEAK their language.
// Typing or speaking resolves to one of the supported languages; the match
// is highlighted and the patient continues to the session-code step.
//
// A quick link to the nurse dashboard is included so the two experiences can
// be opened in separate tabs during a demo.
// =========================================================================

import { el, mount, navigate } from "../services/dom.js";
import { LANGUAGES, findLanguage } from "../config.js";
import { setLanguage, t } from "../services/i18n.js";
import { voiceService, speechLocale } from "../services/voiceService.js";

export function renderWelcome() {
  // Holds the currently chosen language code (null until picked).
  let selected = null;

  // ---- Language text box ------------------------------------------------
  const input = el("input", {
    class: "input",
    type: "text",
    placeholder: t("languagePlaceholder"),
    "aria-label": t("languagePrompt"),
    oninput: () => matchLanguage(input.value),
  });

  // Row of language buttons (tap alternative to typing).
  const buttons = LANGUAGES.map((lang) =>
    el("button", {
      class: "btn btn-outline",
      dataset: { code: lang.code },
      onClick: () => choose(lang.code),
    }, `${lang.native}`)
  );

  // Status line that confirms the matched language.
  const matchLine = el("p", { class: "subtle", text: "" });

  // Continue button (disabled until a language is chosen).
  const continueBtn = el("button", {
    class: "btn btn-primary btn-lg btn-block",
    disabled: true,
    onClick: () => proceed(),
  }, t("continue"));

  // ---- Microphone button (bottom of the page) --------------------------
  const micBtn = el("button", {
    class: "mic-btn",
    "aria-label": t("orSpeak"),
    title: t("orSpeak"),
    onClick: () => speakLanguage(),
  }, "🎤");

  const micHint = el("p", { class: "subtle center", text: t("orSpeak") });

  // If the browser cannot do speech, explain and keep typed input usable.
  if (!voiceService.isSupported()) {
    micBtn.disabled = true;
    micHint.textContent = "Voice input is not available in this browser. Please type your language.";
  }

  // ---- Behavior ---------------------------------------------------------

  /** Try to match free text/speech to a supported language. */
  function matchLanguage(value) {
    const q = (value || "").trim().toLowerCase();
    const found = LANGUAGES.find(
      (l) => l.voiceHint === q || l.label.toLowerCase() === q || l.native.toLowerCase() === q
    );
    if (found) select(found.code);
    else { selected = null; continueBtn.disabled = true; matchLine.textContent = ""; highlight(); }
  }

  /** Mark a language as chosen and reflect it in the UI. */
  function select(code) {
    selected = code;
    const lang = findLanguage(code);
    matchLine.innerHTML = `Selected language: <strong>${lang.native}</strong>`;
    matchLine.className = "success-text";
    continueBtn.disabled = false;
    highlight();
  }

  /** Choose via a tap button: also fill the text box for clarity. */
  function choose(code) {
    input.value = findLanguage(code).native;
    select(code);
  }

  /** Outline the button matching the current selection. */
  function highlight() {
    buttons.forEach((b) => {
      b.style.borderColor = b.dataset.code === selected ? "var(--color-primary)" : "";
    });
  }

  /** Use the microphone to capture the spoken language name. */
  async function speakLanguage() {
    try {
      const { transcript } = await voiceService.listenOnce({
        lang: speechLocale(selected || "en"),
        onStart: () => micBtn.classList.add("listening"),
        onEnd: () => micBtn.classList.remove("listening"),
      });
      input.value = transcript;
      matchLanguage(transcript);
      if (!selected) matchLine.textContent = `Heard "${transcript}" — please pick a language above.`;
    } catch (err) {
      micBtn.classList.remove("listening");
      micHint.textContent = "Could not capture audio. Please type your language instead.";
    }
  }

  /** Lock in the language and advance to the session-code screen. */
  function proceed() {
    if (!selected) return;
    setLanguage(selected);                 // switch UI strings
    navigate(`/session/${selected}`);      // pass the chosen language forward
  }

  // ---- Layout -----------------------------------------------------------
  const card = el("div", { class: "card stack" }, [
    el("h1", { text: t("welcomeTitle") }),
    el("p", { class: "subtle", text: t("welcomeIntro") }),

    el("div", { class: "field" }, [
      el("label", { text: t("languagePrompt") }),
      input,
    ]),
    el("div", { class: "grid-options" }, buttons),
    matchLine,
    continueBtn,

    // Microphone lives at the bottom, as requested.
    el("hr", { style: "border:none;border-top:1px solid var(--color-border)" }),
    el("div", { class: "center stack" }, [micBtn, micHint]),
  ]);

  // Small demo convenience: jump straight to the nurse dashboard.
  const nurseLink = el("p", { class: "center subtle", style: "margin-top:16px" }, [
    el("a", { href: "#/nurse" }, "Open nurse dashboard (staff)"),
  ]);

  mount(card, nurseLink);
}
