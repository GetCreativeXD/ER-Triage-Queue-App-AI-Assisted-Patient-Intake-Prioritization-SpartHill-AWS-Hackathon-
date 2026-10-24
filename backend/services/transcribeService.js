// =========================================================================
// transcribeService - speech-to-text via Amazon Transcribe (LIVE)
// -------------------------------------------------------------------------
// Replaces the former Amazon Lex integration. Lex is a chatbot/intent engine
// built for slot-filling dialogs; it forces free speech into predefined
// intents and discards nuance. For ER intake we instead want a faithful,
// verbatim transcript of the patient's own words so that Bedrock can produce
// an accurate, nuance-preserving summary. Amazon Transcribe is the dedicated
// speech-to-text engine for exactly this, and Amazon Transcribe Medical adds
// clinical vocabulary (symptoms, anatomy, medications) for better accuracy.
//
// Pipeline:  patient audio  ->  Transcribe (verbatim text)  ->  Bedrock.
//
// The frontend records a short clip and uploads raw 16-bit little-endian PCM
// (mono). We feed that buffer to the Transcribe STREAMING API in small frames
// and concatenate the final results. Streaming is used because it returns
// word-level confidence scores and handles arbitrary clip lengths without a
// separate S3 upload.
//
// When Transcribe is not configured (TRANSCRIBE_ENABLED != true) or a live
// call fails, the service reports demo mode so the UI falls back to typed
// input / the browser's on-device Web Speech API. Credentials are resolved
// server-side via the AWS default provider chain (see awsClients.js) and are
// NEVER placed in frontend code.
// =========================================================================

import {
  StartStreamTranscriptionCommand,
  StartMedicalStreamTranscriptionCommand,
} from "@aws-sdk/client-transcribe-streaming";
import { config } from "../config.js";
import { getTranscribeClient } from "./awsClients.js";

// Transcribe streaming accepts audio frames up to 32 KB. We keep frames well
// under that and pace them to approximate real-time so the service ingests
// the whole clip cleanly.
const FRAME_BYTES = 8 * 1024;

/** Map our app language code to a Transcribe language code (standard STT). */
function languageCodeFor(language) {
  const map = { en: "en-US", es: "es-US", fr: "fr-FR", zh: "zh-CN" };
  return map[language] || "en-US";
}

/**
 * Build an async-iterable AudioStream from a PCM buffer by slicing it into
 * frames. Transcribe expects each chunk wrapped as an AudioEvent.
 */
async function* pcmChunks(buffer) {
  for (let offset = 0; offset < buffer.length; offset += FRAME_BYTES) {
    const slice = buffer.subarray(offset, Math.min(offset + FRAME_BYTES, buffer.length));
    yield { AudioEvent: { AudioChunk: slice } };
  }
}

/**
 * Consume the Transcribe result stream, keeping only FINAL (non-partial)
 * segments. Returns the concatenated transcript and an average word-level
 * confidence (0..1) across all final items that carry a confidence.
 */
async function collectTranscript(resultStream) {
  const finals = [];
  let confidenceSum = 0;
  let confidenceCount = 0;

  for await (const event of resultStream) {
    const results =
      event.TranscriptEvent?.Transcript?.Results ||
      event.MedicalTranscriptEvent?.Transcript?.Results ||
      [];

    for (const result of results) {
      if (result.IsPartial) continue; // only trust finalized segments
      const alt = result.Alternatives?.[0];
      if (!alt) continue;
      if (alt.Transcript) finals.push(alt.Transcript);
      for (const item of alt.Items || []) {
        if (typeof item.Confidence === "number") {
          confidenceSum += item.Confidence;
          confidenceCount += 1;
        }
      }
    }
  }

  const transcript = finals.join(" ").replace(/\s+/g, " ").trim();
  const confidence = confidenceCount > 0 ? confidenceSum / confidenceCount : null;
  return { transcript, confidence };
}

export const transcribeService = {
  /** Whether a real Transcribe integration is wired up (env-driven). */
  isConfigured() {
    return Boolean(config.aws.transcribeEnabled);
  },

  /** Describe the active mode for health/status reporting. */
  mode() {
    if (!this.isConfigured()) return "demo";
    return config.aws.transcribeMedical ? "medical" : "standard";
  },

  /**
   * Transcribe a complete audio clip into verbatim text.
   *
   * @param {Object}  opts
   * @param {Buffer}  opts.audio       Raw 16-bit little-endian PCM, mono.
   * @param {string} [opts.language]   App language code ("en", "es", ...).
   * @param {number} [opts.sampleRate] Audio sample rate in Hz.
   * @returns {Promise<{ ok, transcript?, confidence?, mode?, demoMode?, message? }>}
   */
  async transcribeAudio({ audio, language = "en", sampleRate } = {}) {
    if (!this.isConfigured()) {
      return {
        ok: false,
        demoMode: true,
        message: "Server speech-to-text is in demo mode. Please type your answer or use your browser's microphone.",
      };
    }
    if (!audio || audio.length === 0) {
      return { ok: false, message: "No audio was received." };
    }

    const rate = Number(sampleRate) || config.aws.transcribeSampleRate || 16000;
    const client = getTranscribeClient();

    try {
      let response;
      if (config.aws.transcribeMedical) {
        // Amazon Transcribe Medical: tuned for clinical speech.
        response = await client.send(
          new StartMedicalStreamTranscriptionCommand({
            LanguageCode: "en-US", // Transcribe Medical supports en-US only
            MediaSampleRateHertz: rate,
            MediaEncoding: "pcm",
            Specialty: config.aws.transcribeMedicalSpecialty || "PRIMARYCARE",
            Type: "DICTATION", // a single speaker dictating their symptoms
            ShowSpeakerLabel: false,
            AudioStream: pcmChunks(audio),
          })
        );
      } else {
        // Standard Transcribe: broader language support.
        response = await client.send(
          new StartStreamTranscriptionCommand({
            LanguageCode: languageCodeFor(language),
            MediaSampleRateHertz: rate,
            MediaEncoding: "pcm",
            AudioStream: pcmChunks(audio),
          })
        );
      }

      const stream = response.TranscriptResultStream || response.MedicalTranscriptResultStream;
      const { transcript, confidence } = await collectTranscript(stream);

      if (!transcript) {
        return { ok: false, message: "Could not detect any speech in the audio." };
      }
      return { ok: true, transcript, confidence, mode: this.mode() };
    } catch (err) {
      console.error("[transcribe] transcribeAudio failed:", err?.name || err);
      return {
        ok: false,
        demoMode: true,
        message: "Speech-to-text is temporarily unavailable. Please type your answer.",
      };
    }
  },
};
