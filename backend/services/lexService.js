// =========================================================================
// AmazonLexService - voice/conversational intake abstraction (LIVE)
// -------------------------------------------------------------------------
// The patient-facing voice experience talks to this abstraction, not to AWS
// directly. When Lex credentials are not configured the app runs in demo
// mode: it reports that voice is unavailable so the UI can show a clear
// message and fall back to typed/browser-speech input. Credentials are NEVER
// placed in frontend code; these calls run server-side only.
//
// When LEX_ENABLED=true and a bot id/alias are set, this uses the Lex v2
// Runtime RecognizeText API to drive a text-based conversation turn by turn.
// (Audio streaming via RecognizeUtterance can be added later; text is enough
// to wire the conversation end to end.)
// =========================================================================

import { RecognizeTextCommand } from "@aws-sdk/client-lex-runtime-v2";
import { config } from "../config.js";
import { getLexClient } from "./awsClients.js";

/** Map our app language code to a Lex locale id. */
function localeFor(language) {
  const map = { en: "en_US", es: "es_US", fr: "fr_FR", zh: "zh_CN" };
  return map[language] || config.aws.lexLocaleId || "en_US";
}

/** Send one text turn to the Lex bot and normalize the response. */
async function recognizeText({ sessionId, text, localeId }) {
  const client = getLexClient();
  const command = new RecognizeTextCommand({
    botId: config.aws.lexBotId,
    botAliasId: config.aws.lexBotAliasId,
    localeId: localeId || config.aws.lexLocaleId || "en_US",
    sessionId,
    text,
  });
  const res = await client.send(command);

  const messages = (res.messages || []).map((m) => m.content).filter(Boolean);
  const intent = res.sessionState?.intent;
  const intentComplete = intent?.state === "ReadyForFulfillment" || intent?.state === "Fulfilled";

  return {
    ok: true,
    reply: messages.join(" "),
    messages,
    intentName: intent?.name || null,
    intentComplete,
    slots: intent?.slots || {},
  };
}

export const lexService = {
  /** Whether a real Lex bot is configured (env-driven). */
  isConfigured() {
    return Boolean(config.aws.lexEnabled && config.aws.lexBotId && config.aws.lexBotAliasId);
  },

  /** Begin a conversation for a session/language. Returns an opening prompt. */
  async startConversation(language, sessionId) {
    if (!this.isConfigured()) {
      return { ok: false, demoMode: true, message: "Voice intake is in demo mode. Please type your answers." };
    }
    try {
      // A conventional kickoff utterance to elicit the bot's welcome/first turn.
      const turn = await recognizeText({
        sessionId,
        text: "hello",
        localeId: localeFor(language),
      });
      return {
        ok: true,
        sessionId,
        prompt: turn.reply || "Let's begin. What brings you in today?",
        intentComplete: turn.intentComplete,
      };
    } catch (err) {
      console.error("[lex] startConversation failed, falling back to demo:", err?.name || err);
      return { ok: false, demoMode: true, message: "Voice intake is temporarily unavailable. Please type your answers." };
    }
  },

  /** Send a patient utterance/message and get the bot's next turn. */
  async sendPatientMessage(sessionId, message, language = "en") {
    if (!this.isConfigured()) return { ok: false, demoMode: true };
    try {
      return await recognizeText({ sessionId, text: message, localeId: localeFor(language) });
    } catch (err) {
      console.error("[lex] sendPatientMessage failed:", err?.name || err);
      return { ok: false, demoMode: true };
    }
  },

  /**
   * Ask the bot for the next intake question. With RecognizeText the next
   * question is already contained in the previous turn's reply, so callers
   * generally use sendPatientMessage. This remains for API compatibility.
   */
  async getNextQuestion(sessionId) {
    if (!this.isConfigured()) return { ok: false, demoMode: true };
    return { ok: true, question: "" };
  },

  /** End the conversation and release bot resources. */
  async endConversation(sessionId) {
    // RecognizeText sessions expire on their own; nothing to tear down.
    return { ok: true };
  },
};
