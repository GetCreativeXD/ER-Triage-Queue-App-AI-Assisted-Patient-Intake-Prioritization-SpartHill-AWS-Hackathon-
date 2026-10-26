// =========================================================================
// In-memory data store (demo persistence)
// -------------------------------------------------------------------------
// Keeps sessions, intake responses, condition updates, notifications, and
// audit records. For the hackathon this lives in memory and is mirrored to
// localStorage when running in the browser, so a refresh keeps demo state.
//
// The interface is deliberately small so a real AWS DynamoDB-backed store
// could implement the same methods later without touching the UI.
// =========================================================================

const STORAGE_KEY = "er-triage-store-v1";

/** Detect a browser environment so the same module works server-side too. */
const hasLocalStorage = typeof localStorage !== "undefined";

/** The single shared state object. */
const state = {
  sessions: [],
  intake: [],
  updates: [],
  notifications: [],
  audit: [],
  // Rolling counter for 4-digit patient numbers. Starts at 0; the first
  // allocated number is 1. Resets to 0 after reaching 10,000 (so numbers go
  // 1..9999, then 0001 again).
  patientCounter: 0,
};

/** Highest patient number before the counter rolls over. */
const PATIENT_NUMBER_MAX = 10000;

/** Format a raw counter value as a 4-digit, zero-padded string. */
function formatPatientNumber(n) {
  return String(n).padStart(4, "0");
}

/** Load any previously persisted demo state (browser only). */
function load() {
  if (!hasLocalStorage) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) Object.assign(state, JSON.parse(raw));
  } catch {
    // Corrupt storage is non-fatal for a demo; start fresh.
  }
}

/** Persist current state (browser only). */
function save() {
  if (!hasLocalStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota errors in demo */
  }
}

load();

export const store = {
  // ---- Patient numbers -------------------------------------------------
  /**
   * Allocate the next unique 4-digit patient number as a zero-padded string.
   * Numbers are issued in ascending order (0001, 0002, ...), reset to 0001
   * after reaching 10,000, and never repeat a number that is still in use by
   * an active (not completed / not unavailable) session.
   */
  nextPatientNumber() {
    const activeNumbers = new Set(
      state.sessions
        .filter((s) => !["completed", "unavailable"].includes(s.status))
        .map((s) => s.patientNumber)
        .filter(Boolean)
    );

    // Advance the counter until we land on a number not currently in use.
    // Bounded by PATIENT_NUMBER_MAX attempts so a full queue can't loop forever.
    for (let attempts = 0; attempts < PATIENT_NUMBER_MAX; attempts++) {
      state.patientCounter += 1;
      if (state.patientCounter >= PATIENT_NUMBER_MAX) state.patientCounter = 1; // roll 10000 -> 0001
      const candidate = formatPatientNumber(state.patientCounter);
      if (!activeNumbers.has(candidate)) {
        save();
        return candidate;
      }
    }
    // Extremely unlikely fallback (10,000 concurrent active patients): reuse.
    save();
    return formatPatientNumber(state.patientCounter);
  },

  // ---- Sessions --------------------------------------------------------
  addSession(session) { state.sessions.push(session); save(); return session; },
  getSession(id) { return state.sessions.find((s) => s.id === id) || null; },
  /** Permanently remove a session and all of its related records. */
  removeSession(id) {
    const before = state.sessions.length;
    state.sessions = state.sessions.filter((s) => s.id !== id);
    state.intake = state.intake.filter((r) => r.sessionId !== id);
    state.updates = state.updates.filter((u) => u.sessionId !== id);
    state.notifications = state.notifications.filter((n) => n.sessionId !== id);
    save();
    return before !== state.sessions.length;
  },
  getSessionByCode(code) { return state.sessions.find((s) => s.sessionCode === code) || null; },
  allSessions() { return [...state.sessions]; },
  updateSession(id, patch) {
    const s = this.getSession(id);
    if (!s) return null;
    Object.assign(s, patch, { updatedAt: new Date().toISOString() });
    save();
    return s;
  },

  // ---- Intake responses ------------------------------------------------
  addIntake(resp) { state.intake.push(resp); save(); return resp; },
  intakeForSession(sessionId) { return state.intake.filter((r) => r.sessionId === sessionId); },

  // ---- Condition updates ----------------------------------------------
  addUpdate(update) { state.updates.push(update); save(); return update; },
  updatesForSession(sessionId) {
    return state.updates
      .filter((u) => u.sessionId === sessionId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  },

  // ---- Notifications ---------------------------------------------------
  addNotification(n) { state.notifications.push(n); save(); return n; },
  allNotifications() {
    return [...state.notifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  acknowledgeNotification(id) {
    const n = state.notifications.find((x) => x.id === id);
    if (n) { n.acknowledged = true; save(); }
    return n;
  },

  // ---- Audit -----------------------------------------------------------
  addAudit(rec) { state.audit.push(rec); save(); return rec; },
  auditForSession(sessionRef) { return state.audit.filter((a) => a.sessionRef === sessionRef); },

  // ---- Demo controls ---------------------------------------------------
  /** Replace everything with a fresh seed set. The patient-number counter is
   *  intentionally NOT reset, so re-seeding keeps issuing fresh numbers. */
  reset(seed = {}) {
    state.sessions = seed.sessions || [];
    state.intake = seed.intake || [];
    state.updates = seed.updates || [];
    state.notifications = seed.notifications || [];
    state.audit = seed.audit || [];
    save();
  },
  /** True when there is no data yet (used to auto-seed on first load). */
  isEmpty() { return state.sessions.length === 0; },
};
