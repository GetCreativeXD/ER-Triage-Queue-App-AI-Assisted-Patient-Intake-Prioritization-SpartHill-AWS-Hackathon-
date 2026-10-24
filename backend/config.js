// =========================================================================
// Backend configuration
// -------------------------------------------------------------------------
// Centralizes feature flags and AWS settings. In a Node server these would be
// read from process.env (see .env.example). In this file-only demo build the
// AWS features default to disabled, which triggers the demo-mode fallbacks in
// lexService and bedrockService. Flip the flags (or supply real env vars in a
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

    // Amazon Lex (voice intake). Disabled => demo mode.
    lexEnabled: env("LEX_ENABLED", "false") === "true",
    lexBotId: env("LEX_BOT_ID", ""),
    lexBotAliasId: env("LEX_BOT_ALIAS_ID", ""),
    lexLocaleId: env("LEX_LOCALE_ID", "en_US"),

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
