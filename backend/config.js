// =========================================================================
// Backend configuration
// -------------------------------------------------------------------------
// Centralizes feature flags and AWS settings. In a Node server these would be
// read from process.env (see .env.example). In this file-only demo build the
// AWS features default to disabled, which triggers the demo-mode fallbacks in
// transcribeService and bedrockService. Flip the flags (or supply real env vars in a
// Node deployment) to enable the live integrations.
// =========================================================================

/** Safely read an env var in either Node or the browser. */
function env(key, fallback = "") {
  if (typeof process !== "undefined" && process.env && key in process.env) {
    return process.env[key];
  }
  return fallback;
}

export const config = {
  aws: {
    region: env("AWS_REGION", "us-east-1"),

    // Amazon Transcribe (voice intake -> accurate speech-to-text).
    // Disabled => demo mode (server returns "voice unavailable" so the UI
    // falls back to typed input / the browser's on-device Web Speech API).
    transcribeEnabled: env("TRANSCRIBE_ENABLED", "false") === "true",
    // Use Amazon Transcribe Medical (clinical vocabulary) when "true".
    // Falls back to standard Transcribe otherwise.
    transcribeMedical: env("TRANSCRIBE_MEDICAL", "false") === "true",
    // Medical specialty (PRIMARYCARE is the broadest; good default for ER intake).
    transcribeMedicalSpecialty: env("TRANSCRIBE_MEDICAL_SPECIALTY", "PRIMARYCARE"),
    // Expected sample rate of the uploaded PCM audio, in hertz.
    transcribeSampleRate: Number(env("TRANSCRIBE_SAMPLE_RATE", "16000")),

    // Amazon Bedrock (AI summaries/explanations). Disabled => raw answers.
    bedrockEnabled: env("BEDROCK_ENABLED", "false") === "true",
    bedrockModelId: env("BEDROCK_MODEL_ID", "anthropic.claude-3-haiku-20240307-v1:0"),
  },

  server: {
    port: Number(env("PORT", "3001")),
  },

  queue: {
    // Alert the nurse if a patient waits longer than this (minutes).
    waitThresholdMinutes: Number(env("WAIT_THRESHOLD_MINUTES", "30")),
  },
};
