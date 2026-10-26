// =========================================================================
// Frontend configuration
// -------------------------------------------------------------------------
// UI-level settings: supported languages (for the welcome screen) and small
// feature flags. AWS settings live on the backend; the frontend only needs
// to know which languages to offer and how to label them.
// =========================================================================

/** Languages offered on the welcome screen. `voiceHint` is spoken/typed by
 *  the patient to pick that language by voice. */
export const LANGUAGES = [
  { code: "en", label: "English", native: "English", voiceHint: "english" },
  { code: "es", label: "Spanish", native: "Español", voiceHint: "spanish" },
  { code: "fr", label: "French", native: "Français", voiceHint: "french" },
  { code: "zh", label: "Chinese", native: "中文", voiceHint: "chinese" },
];

/** Find a language by its BCP-47-ish code. */
export function findLanguage(code) {
  return LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
}
