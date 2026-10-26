// =========================================================================
// apiClient - frontend HTTP client
// -------------------------------------------------------------------------
// Drop-in replacement for the old in-process `backend/api.js`. Every method
// mirrors a REST endpoint exposed by backend/server.js and returns a Promise.
// Screens import THIS module and `await` the results, so all patient/queue
// state now lives on the server (which owns the AWS integrations: Bedrock for
// summaries, Transcribe for voice). The frontend never touches AWS or holds state.
//
// Base URL: same origin when served by the Node server (http://localhost:3001).
// Override with window.__API_BASE__ if the frontend is hosted separately.
// =========================================================================

const BASE = (typeof window !== "undefined" && window.__API_BASE__) || "";

/** Perform a JSON request and throw on non-2xx so callers can catch. */
async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).error || ""; } catch { /* ignore */ }
    throw new Error(`API ${method} ${path} failed (${res.status}) ${detail}`.trim());
  }
  // Some endpoints (204) may have no body.
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const api = {
  // ---- Sessions / intake ----------------------------------------------
  createSession(sessionCode, language) {
    return request("/api/sessions", { method: "POST", body: { sessionCode, language } });
  },
  getSession(id) {
    return request(`/api/sessions/${encodeURIComponent(id)}`);
  },
  setSessionName(id, firstName, lastName) {
    return request(`/api/sessions/${encodeURIComponent(id)}/name`, { method: "POST", body: { firstName, lastName } });
  },
  submitIntake(id, answers, signals) {
    return request(`/api/sessions/${encodeURIComponent(id)}/intake`, { method: "POST", body: { answers, signals } });
  },
  submitUpdate(id, update) {
    return request(`/api/sessions/${encodeURIComponent(id)}/updates`, { method: "POST", body: { update } });
  },

  // ---- Queue -----------------------------------------------------------
  getQueue() {
    return request("/api/queue");
  },
  getPatientDetail(id) {
    return request(`/api/queue/${encodeURIComponent(id)}`);
  },
  confirmPriority(id) {
    return request(`/api/queue/${encodeURIComponent(id)}/confirm`, { method: "POST" });
  },
  overridePriority(id, priority, note) {
    return request(`/api/queue/${encodeURIComponent(id)}/override`, { method: "POST", body: { priority, note } });
  },
  setStatus(id, status) {
    return request(`/api/queue/${encodeURIComponent(id)}/status`, { method: "POST", body: { status } });
  },

  // ---- Notifications ---------------------------------------------------
  getNotifications() {
    return request("/api/notifications");
  },
  acknowledgeNotification(id) {
    return request(`/api/notifications/${encodeURIComponent(id)}/acknowledge`, { method: "POST" });
  },

  // ---- Voice (Amazon Transcribe speech-to-text) -----------------------
  /**
   * Upload a recorded clip of raw 16-bit PCM audio and get back an accurate
   * verbatim transcript. The server runs Amazon Transcribe; on demo mode or
   * failure it returns { ok:false, demoMode:true } so callers fall back to the
   * browser's on-device recognition or typed input.
   *
   * @param {ArrayBuffer|Uint8Array} pcm  16-bit little-endian mono PCM.
   * @param {Object} opts  { language, sampleRate }
   */
  async transcribeVoice(pcm, { language = "en", sampleRate = 16000 } = {}) {
    const params = new URLSearchParams({ language, sampleRate: String(sampleRate) });
    const res = await fetch(`${BASE}/api/voice/transcribe?${params.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: pcm,
    });
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json()).error || ""; } catch { /* ignore */ }
      throw new Error(`API POST /api/voice/transcribe failed (${res.status}) ${detail}`.trim());
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  },

  // ---- Demo controls ---------------------------------------------------
  /** Server seeds demo data on startup; kept for API compatibility. */
  async ensureSeed() { /* no-op: handled server-side on boot */ },
  resetDemo() {
    return request("/api/demo/reset", { method: "POST" });
  },

  // ---- Health ----------------------------------------------------------
  health() {
    return request("/api/health");
  },
  /** The patient-website URL the triage app encodes into its QR code. */
  patientUrl() {
    return request("/api/patient-url");
  },
};
