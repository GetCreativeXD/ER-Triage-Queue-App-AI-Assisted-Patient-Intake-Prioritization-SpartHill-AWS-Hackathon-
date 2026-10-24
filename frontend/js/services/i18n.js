// =========================================================================
// Lightweight i18n (demo translations)
// -------------------------------------------------------------------------
// A tiny string table keyed by language code. Only the handful of strings
// needed for the demo are translated; `t()` falls back to English for any
// missing key/language. A production app would load fuller locale files.
//
// The chosen language is persisted to localStorage so it stays fixed across
// every question and the success screen (the brief requires the language not
// to revert to English after the patient-number prompt).
// =========================================================================

const STRINGS = {
  en: {
    welcomeTitle: "ER Triage Queue",
    welcomeIntro: "Choose your language to begin. A nurse will see your answers to decide who needs help first.",
    languagePrompt: "Choose your language",
    continue: "Continue",
    doneTitle: "You're all set",
    doneSubtitle: "Your patient number is",
    doneHelp: "Please keep this number. A nurse can now see your information.",
  },
  es: {
    welcomeTitle: "Cola de Triaje de Urgencias",
    welcomeIntro: "Elija su idioma para comenzar. Una enfermera verá sus respuestas para decidir quién necesita ayuda primero.",
    languagePrompt: "Elija su idioma",
    continue: "Continuar",
    doneTitle: "Todo listo",
    doneSubtitle: "Su número de paciente es",
    doneHelp: "Conserve este número. Una enfermera ya puede ver su información.",
  },
  fr: {
    welcomeTitle: "File de Triage des Urgences",
    welcomeIntro: "Choisissez votre langue pour commencer. Une infirmière verra vos réponses pour décider qui aider en premier.",
    languagePrompt: "Choisissez votre langue",
    continue: "Continuer",
    doneTitle: "Tout est prêt",
    doneSubtitle: "Votre numéro de patient est",
    doneHelp: "Conservez ce numéro. Une infirmière peut maintenant voir vos informations.",
  },
  zh: {
    welcomeTitle: "急诊分诊队列",
    welcomeIntro: "请选择您的语言开始。护士将查看您的回答以决定优先顺序。",
    languagePrompt: "选择您的语言",
    continue: "继续",
    doneTitle: "已完成",
    doneSubtitle: "您的患者编号是",
    doneHelp: "请保留此编号。护士现在可以查看您的信息。",
  },
};

const STORAGE_KEY = "er-triage-language";

/** Current UI language; restored from storage, defaults to English. */
let current = "en";
try {
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && STRINGS[saved]) current = saved;
  }
} catch { /* ignore */ }

export function setLanguage(code) {
  if (STRINGS[code]) {
    current = code;
    try { if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }
  }
}
export function getLanguage() { return current; }

/** Translate a key for the current language, falling back to English. */
export function t(key) {
  return (STRINGS[current] && STRINGS[current][key]) || STRINGS.en[key] || key;
}
