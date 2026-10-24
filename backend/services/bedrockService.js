// =========================================================================
// BedrockService - optional AI-assist layer (LIVE integration)
// -------------------------------------------------------------------------
// Bedrock is used ONLY to organize and explain information:
//   - summarize a free-text/voice description,
//   - extract structured symptoms,
//   - identify missing intake info,
//   - explain why a priority recommendation changed.
//
// It NEVER diagnoses or sets the final priority (that stays with the
// deterministic queue rules + the nurse). When Bedrock is not configured, or
// a live call fails, the methods fall back to the raw patient answers so the
// app keeps working.
//
// Credentials are resolved server-side via the AWS default provider chain
// (see awsClients.js). Model output is validated against a small fixed schema
// before we trust it.
// =========================================================================

import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { config } from "../config.js";
import { getBedrockClient } from "./awsClients.js";

/** Validate an AI response against a tiny fixed schema. Unknown/garbage
 *  output is rejected so we fall back to raw answers instead of trusting it. */
function validateSymptomSchema(obj) {
  return obj
    && typeof obj.summary === "string"
    && Array.isArray(obj.symptoms)
    && Array.isArray(obj.missing);
}

/**
 * Invoke the configured Claude model on Bedrock with a system + user prompt
 * and return the model's text output. Uses the Anthropic Messages API format
 * expected by Claude 3 models on Bedrock.
 */
async function invokeClaude({ system, user, maxTokens = 512 }) {
  const client = getBedrockClient();
  const body = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: [{ type: "text", text: user }] }],
  };

  const command = new InvokeModelCommand({
    modelId: config.aws.bedrockModelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(body),
  });

  const response = await client.send(command);
  const decoded = JSON.parse(new TextDecoder().decode(response.body));
  // Claude 3 returns { content: [{ type: "text", text: "..." }], ... }
  const text = Array.isArray(decoded.content)
    ? decoded.content.map((c) => c.text || "").join("").trim()
    : "";
  return text;
}

/** Best-effort extraction of a JSON object from a model's text response. */
function parseJsonLoose(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Model sometimes wraps JSON in prose or fences; grab the first {...} block.
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { return null; }
    }
    return null;
  }
}

export const bedrockService = {
  /** Whether a real Bedrock model is wired up (env-driven). */
  isConfigured() {
    return Boolean(config.aws.bedrockEnabled && config.aws.bedrockModelId);
  },

  /**
   * Summarize a patient's description into one or two plain sentences.
   * Falls back to a trimmed version of the raw text on any failure.
   */
  async summarizePatientDescription(description, language = "en") {
    if (!description) return "";
    const fallback = description.length > 160 ? description.slice(0, 157) + "..." : description;
    if (!this.isConfigured()) return fallback;

    try {
      const text = await invokeClaude({
        system:
          "You are a clinical intake assistant. Summarize the patient's own words " +
          "into one or two short, neutral sentences for a triage nurse. Do NOT " +
          "diagnose, do NOT assign urgency, do NOT add information the patient did " +
          `not state. Respond in the patient's language (code: ${language}).`,
        user: `Patient description:\n${description}`,
        maxTokens: 200,
      });
      const summary = text.trim();
      return summary.length > 0 ? summary.slice(0, 300) : fallback;
    } catch (err) {
      console.error("[bedrock] summarize failed, using raw text:", err?.name || err);
      return fallback;
    }
  },

  /** Extract a structured list of symptoms from free text. */
  async extractSymptoms(description, language = "en") {
    const fallback = { summary: description || "", symptoms: [], missing: [] };
    if (!description || !this.isConfigured()) return fallback;

    try {
      const text = await invokeClaude({
        system:
          "You extract structured intake data from a patient's description for a " +
          "triage nurse. Return ONLY valid JSON matching exactly this shape: " +
          '{"summary": string, "symptoms": string[], "missing": string[]}. ' +
          "'summary' is one or two neutral sentences, 'symptoms' are short phrases " +
          "the patient reported, 'missing' are important intake details the patient " +
          "did NOT provide (e.g. onset, severity, duration). Do not diagnose. " +
          "No prose outside the JSON.",
        user: `Patient description:\n${description}`,
        maxTokens: 400,
      });
      const parsed = parseJsonLoose(text);
      return validateSymptomSchema(parsed) ? parsed : fallback;
    } catch (err) {
      console.error("[bedrock] extractSymptoms failed:", err?.name || err);
      return fallback;
    }
  },

  /** Identify intake questions the patient left blank or vague. */
  async identifyMissingIntakeInformation(responses) {
    const answered = new Set((responses || []).map((r) => r.questionId));
    const expected = ["main-complaint", "severity", "onset", "warning-signs"];
    return expected.filter((q) => !answered.has(q));
  },

  /** Produce a human-readable explanation for a priority change. */
  async explainPriorityChange(previousData, currentData) {
    // Deterministic reason is always available; AI only rephrases it.
    const base = currentData?.priorityReason || "Priority was recalculated.";
    if (!this.isConfigured()) return base;

    try {
      const text = await invokeClaude({
        system:
          "You explain, in one plain sentence for a nurse, why a patient's triage " +
          "priority recommendation changed. Base your explanation ONLY on the " +
          "deterministic reason provided. Do not invent clinical details and do not " +
          "diagnose.",
        user:
          `Deterministic reason: ${base}\n` +
          `Previous priority: ${previousData?.currentPriority || "n/a"}\n` +
          `New priority: ${currentData?.recommendedPriority || currentData?.currentPriority || "n/a"}`,
        maxTokens: 150,
      });
      const explanation = text.trim();
      return explanation.length > 0 ? explanation : base;
    } catch (err) {
      console.error("[bedrock] explainPriorityChange failed:", err?.name || err);
      return base;
    }
  },
};
