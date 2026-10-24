// =========================================================================
// voiceService - browser speech capture
// -------------------------------------------------------------------------
// Two capture paths, so voice works in every environment:
//
//  1. Server speech-to-text (preferred): record a clip from the microphone,
//     encode it as 16-bit PCM at 16 kHz mono, and upload it to the backend,
//     which runs Amazon Transcribe for an accurate, nuance-preserving
//     transcript. This is what feeds Bedrock's symptom summary.
//
//  2. On-device fallback: the browser Web Speech API (SpeechRecognition).
//     Zero cloud credentials, but lower accuracy and limited browser support.
//     Used automatically when the server reports demo mode or recording is
//     unsupported.
//
// Screens call `captureTranscript(...)`, which tries the recorder+server path
// first and transparently falls back to on-device recognition. If nothing is
// available, `isSupported()` returns false and the UI shows typed input only.
// =========================================================================

import { api } from "./apiClient.js";

const SpeechRecognition = typeof window !== "undefined"
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

const AudioContextCtor = typeof window !== "undefined"
  ? (window.AudioContext || window.webkitAudioContext)
  : null;

// Amazon Transcribe handles 8 kHz–48 kHz; 16 kHz mono is the sweet spot for
// speech accuracy versus upload size.
const TARGET_SAMPLE_RATE = 16000;

/** True when we can record audio to send to the server for transcription. */
function canRecord() {
  return Boolean(
    AudioContextCtor &&
    typeof navigator !== "undefined" &&
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia
  );
}

/** Map an app language code to a Web Speech locale (on-device fallback). */
export function speechLocale(code) {
  return { en: "en-US", es: "es-ES", fr: "fr-FR", zh: "zh-CN" }[code] || "en-US";
}

// ---- PCM helpers --------------------------------------------------------

/** Flatten an array of Float32 frames into one contiguous Float32Array. */
function mergeFloat32(chunks, length) {
  const out = new Float32Array(length);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

/** Linear-resample mono Float32 audio from one rate to another. */
function resample(float32, inRate, outRate) {
  if (inRate === outRate) return float32;
  const ratio = inRate / outRate;
  const outLen = Math.round(float32.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = float32[idx] || 0;
    const b = float32[idx + 1] !== undefined ? float32[idx + 1] : a;
    out[i] = a + (b - a) * frac; // linear interpolation
  }
  return out;
}

/** Convert Float32 [-1,1] samples to signed 16-bit little-endian PCM bytes. */
function floatTo16BitPCM(float32) {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    let s = Math.max(-1, Math.min(1, float32[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(i * 2, s, true); // little-endian
  }
  return buffer;
}

// ---- Microphone recorder (-> 16-bit PCM) -------------------------------

/**
 * Record from the microphone until `stop()` is called, then resolve with a
 * 16 kHz mono 16-bit PCM ArrayBuffer ready to upload to Amazon Transcribe.
 * @returns {Promise<{ stop: () => Promise<{ pcm: ArrayBuffer, sampleRate: number }> }>}
 */
async function startRecorder() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new AudioContextCtor();
  const source = ctx.createMediaStreamSource(stream);
  // ScriptProcessor is deprecated but universally available and fine for a
  // short intake clip; an AudioWorklet could replace it later.
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const chunks = [];
  let total = 0;

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input));
    total += input.length;
  };

  source.connect(processor);
  processor.connect(ctx.destination);

  return {
    async stop() {
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      const merged = mergeFloat32(chunks, total);
      const resampled = resample(merged, ctx.sampleRate, TARGET_SAMPLE_RATE);
      await ctx.close();
      return { pcm: floatTo16BitPCM(resampled), sampleRate: TARGET_SAMPLE_RATE };
    },
  };
}

// ---- On-device Web Speech fallback -------------------------------------

/** Listen once with the browser's on-device recognizer. */
function listenOnceWebSpeech({ lang = "en-US", onStart, onEnd } = {}) {
  return new Promise((resolve, reject) => {
    if (!SpeechRecognition) {
      reject(new Error("Speech recognition is not supported in this browser."));
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => onStart && onStart();
    recognition.onerror = (e) => { onEnd && onEnd(); reject(new Error(e.error || "voice-error")); };
    recognition.onend = () => onEnd && onEnd();
    recognition.onresult = (event) => {
      const result = event.results[0][0];
      resolve({ transcript: result.transcript, confidence: result.confidence, source: "browser" });
    };

    recognition.start();
  });
}

/**
 * Start the on-device recognizer with INTERIM results so the UI can show text
 * live as the patient speaks. Returns a handle with stop(); the final
 * transcript resolves via onFinal. Used purely for live on-screen feedback —
 * the accurate transcript still comes from Amazon Transcribe when available.
 */
function startLiveWebSpeech({ lang = "en-US", onInterim, onFinal, onEnd } = {}) {
  if (!SpeechRecognition) return null;
  const recognition = new SpeechRecognition();
  recognition.lang = lang;
  recognition.interimResults = true;
  recognition.continuous = true;
  recognition.maxAlternatives = 1;

  let finalText = "";
  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      if (res.isFinal) finalText += res[0].transcript + " ";
      else interim += res[0].transcript;
    }
    onInterim && onInterim((finalText + interim).trim());
  };
  recognition.onerror = () => { /* non-fatal: live feedback only */ };
  recognition.onend = () => {
    onEnd && onEnd();
    onFinal && onFinal(finalText.trim());
  };

  try { recognition.start(); } catch { return null; }
  return {
    stop() { try { recognition.stop(); } catch { /* already stopped */ } },
  };
}

export const voiceService = {
  /** True when ANY voice capture path is available. */
  isSupported() { return canRecord() || Boolean(SpeechRecognition); },

  /** True when we can record audio for server-side transcription. */
  canRecord,

  /**
   * Capture speech and return a transcript, preferring server-side Amazon
   * Transcribe for accuracy and falling back to on-device recognition.
   *
   * Server path (press to start, call the returned stop() to finish):
   *   const session = await voiceService.startCapture({ language, onStart, onEnd });
   *   const { transcript, confidence, source } = await session.stop();
   *
   * On-device path (single-shot) is used automatically when recording isn't
   * possible; in that case startCapture resolves immediately with the result.
   */
  async startCapture({ language = "en", onStart, onEnd } = {}) {
    // Preferred: record and send to the server (Amazon Transcribe).
    if (canRecord()) {
      let recorder;
      try {
        recorder = await startRecorder();
      } catch (err) {
        // Mic permission denied or unavailable -> try on-device below.
        recorder = null;
      }
      if (recorder) {
        onStart && onStart();
        return {
          mode: "server",
          async stop() {
            onEnd && onEnd();
            const { pcm, sampleRate } = await recorder.stop();
            try {
              const res = await api.transcribeVoice(pcm, { language, sampleRate });
              if (res && res.ok && res.transcript) {
                return { transcript: res.transcript, confidence: res.confidence ?? null, source: "transcribe" };
              }
              // Server in demo mode / no speech -> fall back on-device.
              if (SpeechRecognition) {
                return await listenOnceWebSpeech({ lang: speechLocale(language) });
              }
              throw new Error(res?.message || "Transcription unavailable.");
            } catch (err) {
              if (SpeechRecognition) {
                return await listenOnceWebSpeech({ lang: speechLocale(language) });
              }
              throw err;
            }
          },
        };
      }
    }

    // Fallback: on-device single-shot recognition. There is nothing to stop,
    // so the result is available immediately and stop() just returns it.
    const result = await listenOnceWebSpeech({ lang: speechLocale(language), onStart, onEnd });
    return { mode: "browser", async stop() { return result; } };
  },

  /**
   * Backward-compatible single-shot helper (on-device only). Kept so any
   * existing caller of listenOnce keeps working.
   */
  listenOnce(opts) { return listenOnceWebSpeech(opts); },

  /**
   * Build a complete, reusable microphone widget for a question. It creates a
   * RED circular mic button with a WHITE icon that PULSES while listening, and
   * drives live on-screen transcription as the patient speaks. Tap to start,
   * tap again to stop.
   *
   * While listening it calls onText(liveText) with interim words (from the
   * on-device recognizer) so the caller can show the response forming in real
   * time. On stop it resolves the accurate transcript from Amazon Transcribe
   * (when available) via onText(finalText, { confidence }); otherwise it keeps
   * the live on-device text.
   *
   * @param {Object} opts
   * @param {string}   opts.language          App language code ("en", ...).
   * @param {Function} opts.onText            (text, meta?) => void. Called with
   *                                          live interim text and the final text.
   * @param {Function} [opts.getBaseText]     Returns existing text to prepend to,
   *                                          so voice appends rather than replaces.
   * @param {Function} [opts.onStatus]        (message) => void status updates.
   * @returns {{ button: HTMLElement }}  the mic button element to mount.
   */
  createMicWidget({ language = "en", onText, getBaseText, onStatus } = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mic-btn";
    button.setAttribute("aria-label", "Speak your answer");
    button.innerHTML = micIconSvg();

    const supported = this.isSupported();
    if (!supported) {
      button.disabled = true;
      onStatus && onStatus("Voice is not available in this browser; please type.");
      return { button };
    }

    const base = () => (getBaseText ? (getBaseText() || "") : "");
    let recorder = null;      // audio recorder for the accurate Transcribe pass
    let live = null;          // on-device interim recognizer (live feedback)
    let listening = false;
    let liveText = "";        // latest interim text from the on-device recognizer

    const setListening = (on) => {
      listening = on;
      button.classList.toggle("listening", on); // CSS adds the pulse
    };

    async function start() {
      liveText = "";
      const prefix = base() ? base() + " " : "";

      // Live on-screen transcription (interim words) via the on-device engine.
      live = startLiveWebSpeech({
        lang: speechLocale(language),
        onInterim: (text) => { liveText = text; onText && onText(prefix + text); },
      });

      // In parallel, record audio so we can get the ACCURATE transcript on stop.
      if (canRecord()) {
        try { recorder = await startRecorder(); }
        catch { recorder = null; } // mic denied: rely on the live on-device text
      }

      setListening(true);
      onStatus && onStatus("Listening... tap the mic again to stop.");
    }

    async function stop() {
      setListening(false);
      if (live) { live.stop(); live = null; }
      const prefix = base() ? base() + " " : "";

      if (recorder) {
        onStatus && onStatus("Transcribing...");
        button.disabled = true;
        try {
          const { pcm, sampleRate } = await recorder.stop();
          recorder = null;
          const res = await api.transcribeVoice(pcm, { language, sampleRate });
          if (res && res.ok && res.transcript) {
            onText && onText(prefix + res.transcript, { confidence: res.confidence ?? null, source: "transcribe" });
            onStatus && onStatus("Review the text and edit if needed, or tap the mic to add more.");
            return;
          }
        } catch {
          /* fall through to keep the live on-device text */
        } finally {
          button.disabled = false;
        }
      }

      // No server transcript: keep whatever the live recognizer produced.
      if (liveText) {
        onText && onText(prefix + liveText, { source: "browser" });
        onStatus && onStatus("Review the text and edit if needed, or tap the mic to add more.");
      } else {
        onStatus && onStatus("Tap the mic and speak, or type your answer.");
      }
    }

    button.addEventListener("click", async () => {
      if (listening) { await stop(); return; }
      try { await start(); }
      catch {
        setListening(false);
        onStatus && onStatus("Could not start the microphone. Please type your answer.");
      }
    });

    return { button };
  },
};

/** Inline white microphone SVG icon (so we can color the circle red via CSS). */
export function micIconSvg() {
  return (
    '<svg class="mic-icon" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">' +
    '<path fill="currentColor" d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3z"/>' +
    '<path fill="currentColor" d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V21H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-3.08A7 7 0 0 0 19 11z"/>' +
    "</svg>"
  );
}
