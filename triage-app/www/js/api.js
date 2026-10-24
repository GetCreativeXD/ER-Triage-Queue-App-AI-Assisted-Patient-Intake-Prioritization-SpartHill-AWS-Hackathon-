// =========================================================================
// Triage app API client
// -------------------------------------------------------------------------
// The native app runs on a staff phone, so it cannot assume "same origin" —
// it must know the address of the Express backend (the same server that hosts
// the patient website). The base URL is user-configurable in Settings and
// persisted in localStorage. Everything else mirrors the backend REST API.
// =========================================================================

const STORAGE_KEY = "triage-app-server-url";

/**
 * Pick a sensible default server URL for the current environment:
 *  - Desktop browser demo (served over http/https): use the SAME ORIGIN, so
 *    opening the app at http://localhost:3001/triage-app/ just works.
 *  - Native app (loaded from a file:// / capacitor:// style origin): fall back
 *    to 10.0.2.2:3001, the Android emulator's alias for the host's localhost.
 * A saved Settings value always overrides this.
 */
function defaultServerUrl() {
  try {
    const origin = window.location.origin;
    if (origin && /^https?:/i.test(origin)) return origin;
  } catch { /* ignore */ }
  return "http://10.0.2.2:3001";
}

export function getServerUrl() {
  try {
    return localStorage.getItem(STORAGE_KEY) || defaultServerUrl();
  } catch {
    return defaultServerUrl();
  }
}

export function setServerUrl(url) {
  try { localStorage.setItem(STORAGE_KEY, url.replace(/\/+$/, "")); } catch { /* ignore */ }
}

/** Fetch JSON from the backend, throwing on non-2xx. */
async function request(path, { method = "GET", body } = {}) {
  const base = getServerUrl().replace(/\/+$/, "");
  const res = await fetch(base + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).error || ""; } catch { /* ignore */ }
    throw new Error(`${method} ${path} failed (${res.status}) ${detail}`.trim());
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const triageApi = {
  health() { return request("/api/health"); },
  patientUrl() { return request("/api/patient-url"); },
  getQueue() { return request("/api/queue"); },
  getPatientDetail(id) { return request(`/api/queue/${encodeURIComponent(id)}`); },
  getNotifications() { return request("/api/notifications"); },
  acknowledgeNotification(id) { return request(`/api/notifications/${encodeURIComponent(id)}/acknowledge`, { method: "POST" }); },
  confirmPriority(id) { return request(`/api/queue/${encodeURIComponent(id)}/confirm`, { method: "POST" }); },
  sortPatient(id, priority) { return request(`/api/queue/${encodeURIComponent(id)}/override`, { method: "POST", body: { priority, note: "Sorted from triage app." } }); },
  setStatus(id, status) { return request(`/api/queue/${encodeURIComponent(id)}/status`, { method: "POST", body: { status } }); },
};
