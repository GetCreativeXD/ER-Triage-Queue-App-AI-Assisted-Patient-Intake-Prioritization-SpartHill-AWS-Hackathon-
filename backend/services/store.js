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
};

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
  // ---- Sessions --------------------------------------------------------
  addSession(session) { state.sessions.push(session); save(); return session; },
  getSession(id) { return state.sessions.find((s) => s.id === id) || null; },
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
  /** Replace everything with a fresh seed set. */
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
