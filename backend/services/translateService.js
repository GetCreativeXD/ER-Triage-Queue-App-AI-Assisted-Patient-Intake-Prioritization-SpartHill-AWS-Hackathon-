// =========================================================================
// translateService - render patient answers in English for the triage staff
// -------------------------------------------------------------------------
// The patient fills the intake form in their chosen language (en/es/fr/zh) and
// the triage dashboard must always read in English. Choice-based answers are
// already stored as stable English values by the patient form, so they need no
// work. Only FREE TEXT - the symptom "Other" box, the onset free-text, and the
// question-6 "in your own words" description - is in the patient's language.
//
// Primary path (ACTUAL translation): Amazon Translate. When TRANSLATE_ENABLED
// is "true" and credentials are available (resolved server-side via the AWS
// default provider chain), arbitrary patient free text is translated to real
// English via Amazon Translate.
//
// Fallback path: when Translate is not configured, or a live call fails, we
// fall back to a small deterministic phrase/word dictionary covering the demo
// content so the app still works offline.
//
// Because Amazon Translate is async, the public translateToEnglish() is async.
// A synchronous dictionary-only helper (translateToEnglishOffline) is kept for
// any caller that cannot await.
// =========================================================================

import { TranslateTextCommand } from "@aws-sdk/client-translate";
import { config } from "../config.js";
import { getTranslateClient } from "./awsClients.js";

// Known full phrases from the seed/demo flows, keyed by source language.
// Matching is case-insensitive and accent-insensitive.
const PHRASES = {
  es: {
    "dolor en el pecho desde esta manana.": "Chest pain since this morning.",
    "dolor en el pecho": "Chest pain",
    "me duele el pecho": "My chest hurts",
    "no puedo respirar": "I can't breathe",
    "dolor de estomago": "Stomach pain",
    "me duele la cabeza": "My head hurts",
    "tengo fiebre": "I have a fever",
    "me cai": "I fell",
  },
  fr: {
    "douleur a la poitrine depuis ce matin.": "Chest pain since this morning.",
    "douleur a la poitrine": "Chest pain",
    "j'ai mal a la poitrine": "My chest hurts",
    "je ne peux pas respirer": "I can't breathe",
    "mal au ventre": "Stomach pain",
    "j'ai mal a la tete": "My head hurts",
    "j'ai de la fievre": "I have a fever",
    "je suis tombe": "I fell",
  },
  zh: {
    "从今天早上开始胸痛。": "Chest pain since this morning.",
    "胸痛": "Chest pain",
    "我胸口疼": "My chest hurts",
    "我无法呼吸": "I can't breathe",
    "肚子疼": "Stomach pain",
    "我头疼": "My head hurts",
    "我发烧了": "I have a fever",
    "我摔倒了": "I fell",
  },
};

// Per-word fallback dictionary for words not covered by a full phrase.
const WORDS = {
  es: {
    dolor: "pain", pecho: "chest", cabeza: "head", estomago: "stomach",
    respirar: "breathe", fiebre: "fever", desde: "since", esta: "this",
    manana: "morning", mucho: "a lot", muy: "very", no: "not", y: "and",
  },
  fr: {
    douleur: "pain", poitrine: "chest", tete: "head", ventre: "stomach",
    respirer: "breathe", fievre: "fever", depuis: "since", ce: "this",
    matin: "morning", beaucoup: "a lot", tres: "very", pas: "not", et: "and",
  },
  zh: {},
};

/** Lowercase + strip accents for loose matching. */
function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/** Map our app language code to an Amazon Translate source language code. */
function translateSourceCode(language) {
  const map = { es: "es", fr: "fr", zh: "zh" };
  return map[language] || null;
}

/** Whether a real Amazon Translate integration is wired up (env-driven). */
function isConfigured() {
  return Boolean(config.aws.translateEnabled);
}

/**
 * Offline, SYNCHRONOUS dictionary translation (the fallback).
 *   - English (or empty) is returned unchanged.
 *   - A known full phrase is returned from the dictionary.
 *   - Otherwise a best-effort per-word translation is applied, with any
 *     untranslated words left as-is (so no information is lost).
 */
export function translateToEnglishOffline(text, language = "en") {
  const original = String(text || "").trim();
  if (!original || language === "en" || !PHRASES[language]) return original;

  const key = norm(original);
  const phrase = PHRASES[language][key] || PHRASES[language][key.replace(/[.!?]+$/, "")];
  if (phrase) return phrase;

  const words = WORDS[language] || {};
  let translatedAny = false;
  const out = original.split(/(\s+)/).map((tok) => {
    if (/^\s+$/.test(tok)) return tok;
    const w = norm(tok).replace(/[.,!?;:]+$/, "");
    if (words[w]) { translatedAny = true; return words[w]; }
    return tok;
  }).join("");

  return translatedAny ? out : original;
}

/**
 * Translate a free-text string to English, ACTUALLY translating via Amazon
 * Translate when configured and falling back to the offline dictionary
 * otherwise.
 *   - English (or empty) input is returned unchanged.
 *   - Unsupported languages are returned unchanged.
 *
 * @param {string} text
 * @param {string} language  app language code ("en", "es", "fr", "zh")
 * @returns {Promise<string>} the English text
 */
export async function translateToEnglish(text, language = "en") {
  const original = String(text || "").trim();
  if (!original || language === "en") return original;

  const sourceCode = translateSourceCode(language);
  if (sourceCode && isConfigured()) {
    try {
      const client = getTranslateClient();
      const res = await client.send(new TranslateTextCommand({
        Text: original,
        SourceLanguageCode: sourceCode,
        TargetLanguageCode: "en",
      }));
      const translated = (res && res.TranslatedText || "").trim();
      if (translated) return translated;
    } catch (err) {
      console.error("[translate] TranslateText failed, using offline fallback:", err?.name || err);
      // fall through to the offline dictionary
    }
  }

  // Not configured, unsupported, or the live call failed: offline fallback.
  return translateToEnglishOffline(original, language);
}

export const translateService = {
  isConfigured,
  translateToEnglish,
  translateToEnglishOffline,
};
