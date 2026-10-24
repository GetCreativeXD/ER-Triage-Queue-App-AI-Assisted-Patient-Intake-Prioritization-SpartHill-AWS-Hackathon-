// =========================================================================
// Lightweight i18n (demo translations)
// -------------------------------------------------------------------------
// A tiny string table keyed by language code. Only the handful of strings
// needed for the demo are translated; `t()` falls back to English for any
// missing key/language. A production app would load fuller locale files.
// =========================================================================

const STRINGS = {
  en: {
    welcomeTitle: "ER Triage Queue",
    welcomeIntro: "Tell us your language, then answer a few short questions so the nurse can see who needs help first.",
    languagePrompt: "Choose your language by typing it or tapping the mic to say it.",
    languagePlaceholder: "Type your language (e.g. English)",
    orSpeak: "Or press the mic and say your language",
    continue: "Continue",
    sessionTitle: "Enter your session code",
    sessionHelp: "Use the code from the registration desk or your wristband.",
    start: "Start",
  },
  es: {
    welcomeTitle: "Cola de Triaje de Urgencias",
    welcomeIntro: "Indíquenos su idioma y responda unas preguntas breves para que la enfermera vea quién necesita ayuda primero.",
    languagePrompt: "Elija su idioma escribiéndolo o tocando el micrófono para decirlo.",
    languagePlaceholder: "Escriba su idioma (p. ej. Español)",
    orSpeak: "O presione el micrófono y diga su idioma",
    continue: "Continuar",
    sessionTitle: "Ingrese su código de sesión",
    sessionHelp: "Use el código del mostrador de registro o de su pulsera.",
    start: "Comenzar",
  },
  fr: {
    welcomeTitle: "File de Triage des Urgences",
    welcomeIntro: "Indiquez votre langue, puis répondez à quelques questions pour que l'infirmière voie qui aider en premier.",
    languagePrompt: "Choisissez votre langue en la tapant ou en appuyant sur le micro pour la dire.",
    languagePlaceholder: "Tapez votre langue (p. ex. Français)",
    orSpeak: "Ou appuyez sur le micro et dites votre langue",
    continue: "Continuer",
    sessionTitle: "Entrez votre code de session",
    sessionHelp: "Utilisez le code du bureau d'enregistrement ou de votre bracelet.",
    start: "Commencer",
  },
};

/** Current UI language; defaults to English. */
let current = "en";
export function setLanguage(code) { if (STRINGS[code]) current = code; }
export function getLanguage() { return current; }

/** Translate a key for the current language, falling back to English. */
export function t(key) {
  return (STRINGS[current] && STRINGS[current][key]) || STRINGS.en[key] || key;
}
