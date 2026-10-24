// =========================================================================
// voiceService - browser speech input
// -------------------------------------------------------------------------
// Wraps the browser Web Speech API (SpeechRecognition) so screens get a tiny,
// consistent interface for voice capture. This is the client-side fallback
// that keeps voice working with no cloud credentials. In a full build the
// backend lexService would drive the conversation instead; this module is
// kept separate so that swap does not touch the screens.
//
// If the browser has no speech support, `isSupported()` returns false and the
// UI shows typed input only.
// =========================================================================

const SpeechRecognition = typeof window !== "undefined"
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

export const voiceService = {
  /** True when the browser can do on-device speech recognition. */
  isSupported() { return Boolean(SpeechRecognition); },

  /**
   * Listen once and resolve with the transcript.
   * @param {Object} opts
   * @param {string} [opts.lang]        BCP-47 language (e.g. "en-US").
   * @param {Function} [opts.onStart]   called when listening starts.
   * @param {Function} [opts.onEnd]     called when listening stops.
   * @returns {Promise<{ transcript: string, confidence: number }>}
   */
  listenOnce({ lang = "en-US", onStart, onEnd } = {}) {
    return new Promise((resolve, reject) => {
      if (!this.isSupported()) {
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
        resolve({ transcript: result.transcript, confidence: result.confidence });
      };

      recognition.start();
    });
  },
};

/** Map an app language code to a Web Speech locale. */
export function speechLocale(code) {
  return { en: "en-US", es: "es-ES", fr: "fr-FR", zh: "zh-CN" }[code] || "en-US";
}
