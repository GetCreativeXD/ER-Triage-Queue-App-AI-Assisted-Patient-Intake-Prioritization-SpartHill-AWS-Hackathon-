// =========================================================================
// Welcome / language selection screen (patient website)
// -------------------------------------------------------------------------
// The patient arrives here first. They pick one of four languages from a
// dropdown OR speak their language into the microphone - whichever language
// they say is matched and selected in the dropdown automatically. Then they
// continue into intake. We create the session in the background (the patient
// never sees an internal code) and the backend assigns the 4-digit patient
// number shown on the success screen. The chosen language is stored so it
// stays fixed for every question that follows and never reverts to English.
//
// The patient CANNOT switch to the staff/triage view from here - there is no
// link to it anywhere in the patient flow.
// =========================================================================

import { el, mount, navigate } from "../services/dom.js";
import { LANGUAGES } from "../config.js";
import { setLanguage, t } from "../services/i18n.js";
import { voiceService } from "../services/voiceService.js";

export function renderWelcome() {
  // The patient form ALWAYS starts in English. The welcome screen is the entry
  // point of the flow, so reset the language here regardless of any language a
  // previous patient left persisted in storage. The patient can still pick
  // another language below, and that choice stays locked for the rest of the
  // flow.
  setLanguage("en");
  let selected = "en";

  // ---- Language dropdown (four languages) ------------------------------
  const select = el("select", { class: "input lang-select", "aria-label": t("languagePrompt") },
    LANGUAGES.map((lang) =>
      el("option", { value: lang.code, text: `${lang.native} (${lang.label})` })
    )
  );
  select.value = selected;
  select.addEventListener("change", () => {
    selected = select.value;
    setLanguage(selected);         // switch UI strings live
    refresh();                     // re-render so labels update immediately
  });

  const error = el("p", { class: "error-text center", text: "" });

  // ---- Voice language picker -------------------------------------------
  // The patient can tap the mic and say a language ("English", "Español",
  // "French", "中文", ...). We match the spoken text against each language's
  // name/native/voice hint and select it in the dropdown.
  const micStatus = el("p", { class: "subtle center mic-status", text: t("languageSpeakHint") });
  const { button: micBtn } = voiceService.createMicWidget({
    language: selected,
    onText: (text) => {
      const match = matchLanguage(text);
      if (match) {
        selected = match.code;
        setLanguage(selected);
        refresh();                 // re-render: dropdown + labels reflect the pick
        micStatusText = `${match.native} (${match.label})`;
      }
    },
    onStatus: (m) => { micStatus.textContent = m; },
  });
  // Keep the last confirmed pick message after a re-render.
  let micStatusText = t("languageSpeakHint");

  const micBlock = el("div", { class: "mic-block center stack" }, [micBtn, micStatus]);

  const continueBtn = el("button", {
    class: "btn btn-primary btn-lg btn-block",
    onClick: start,
  }, t("continue"));

  /** Create a session, play a localized "Welcome!" transition, then go into
   *  the first question of the intake. */
  async function start() {
    setLanguage(selected);
    continueBtn.disabled = true;
    try {
      // Internal, patient-invisible code used only as a session label.
      const code = "PT-" + Date.now().toString(36).toUpperCase();
      const { api } = await import("../services/apiClient.js");
      const session = await api.createSession(code, selected);
      // Animated "Welcome!" transition (in the language the patient chose),
      // then route into the questionnaire's first page.
      await playWelcomeTransition();
      navigate(`/intake/${session.id}`);
    } catch {
      continueBtn.disabled = false;
      error.textContent = "Could not start. Please try again.";
    }
  }

  /**
   * Show a full-screen animated "Welcome!" overlay in the selected language,
   * then resolve once the animation has played so the first question appears
   * right after it. The message is pulled via t() so it is always locked to
   * the language chosen on this screen.
   */
  function playWelcomeTransition() {
    return new Promise((resolve) => {
      const overlay = el("div", { class: "welcome-transition" }, [
        el("div", { class: "welcome-transition-text", text: t("welcomeTransition") }),
      ]);
      document.body.appendChild(overlay);
      // Trigger the enter animation on the next frame.
      requestAnimationFrame(() => overlay.classList.add("show"));
      // Hold briefly, then fade out and clean up.
      const HOLD_MS = 1400;
      setTimeout(() => {
        overlay.classList.add("leave");
        setTimeout(() => { overlay.remove(); resolve(); }, 450);
      }, HOLD_MS);
    });
  }

  function refresh() {
    select.value = selected;
    const card = el("div", { class: "card stack welcome-card" }, [
      el("img", { class: "brand-mark", src: "assets/logo.svg", alt: "InTake logo", width: "72", height: "72" }),
      el("h1", { text: t("welcomeTitle") }),
      el("p", { class: "subtle", text: t("welcomeIntro") }),
      el("div", { class: "field" }, [
        el("label", { text: t("languagePrompt") }),
        select,
      ]),
      micBlock,
      continueBtn,
      error,
    ]);

    mount(card);
    continueBtn.textContent = t("continue");
    micStatus.textContent = micStatusText;
  }

  refresh();
}

/**
 * Match a spoken/typed phrase to one of the supported languages. Checks the
 * English label, the native name, and the explicit voiceHint, case-insensitive
 * and accent-insensitive, so "espanol", "Español", "spanish", "中文", etc. all
 * resolve. Returns the matched language object or null.
 */
function matchLanguage(text) {
  if (!text) return null;
  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const spoken = norm(text);
  // Extra spoken aliases people commonly use, mapped to a language code.
  const aliases = {
    english: "en", ingles: "en", anglais: "en",
    spanish: "es", espanol: "es", castellano: "es",
    french: "fr", francais: "fr", frances: "fr",
    chinese: "zh", mandarin: "zh", zhongwen: "zh",
  };
  for (const lang of LANGUAGES) {
    const candidates = [lang.label, lang.native, lang.voiceHint, lang.code].map(norm);
    if (candidates.some((c) => c && (spoken === c || spoken.includes(c)))) return lang;
  }
  for (const [alias, code] of Object.entries(aliases)) {
    if (spoken.includes(alias)) return LANGUAGES.find((l) => l.code === code) || null;
  }
  // Chinese characters anywhere -> Chinese.
  if (/[\u4e00-\u9fff]/.test(text)) return LANGUAGES.find((l) => l.code === "zh") || null;
  return null;
}
