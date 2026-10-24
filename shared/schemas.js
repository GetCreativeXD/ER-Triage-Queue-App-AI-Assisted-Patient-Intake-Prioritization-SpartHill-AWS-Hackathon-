// =========================================================================
// Shared data schemas / factory helpers
// -------------------------------------------------------------------------
// These describe the shape of every record that moves between the frontend
// and backend. Because this is a plain-JS (no TypeScript build) project, we
// document the shapes with JSDoc typedefs and provide factory functions that
// create well-formed objects with sensible defaults.
//
// This file is imported by BOTH the backend service layer and the frontend,
// so both sides agree on field names (matching the "Suggested data model"
// section of the concept document).
// =========================================================================

/** Priority categories, highest urgency first. Order is meaningful: the
 *  queue sorts by this ranking. */
export const PRIORITY = {
  IMMEDIATE: "Immediate review",
  VERY_URGENT: "Very urgent",
  URGENT: "Urgent",
  STANDARD: "Standard",
  LOW: "Low urgency",
};

/** Numeric rank used for sorting (lower number = higher urgency). */
export const PRIORITY_RANK = {
  [PRIORITY.IMMEDIATE]: 0,
  [PRIORITY.VERY_URGENT]: 1,
  [PRIORITY.URGENT]: 2,
  [PRIORITY.STANDARD]: 3,
  [PRIORITY.LOW]: 4,
};

/** Symptom trend reported by the patient. */
export const TREND = { WORSENING: "worsening", STABLE: "stable", IMPROVING: "improving" };

/** Patient lifecycle status in the waiting queue. */
export const STATUS = {
  WAITING: "waiting",
  CALLED: "called",
  BEING_SEEN: "being-seen",
  COMPLETED: "completed",
  UNAVAILABLE: "unavailable",
  RECHECK: "recheck",
};

/** Notification categories surfaced on the nurse dashboard. */
export const NOTIFICATION_TYPE = {
  NEW_INTAKE: "new-intake",
  WORSENING: "worsening",
  PRIORITY_UP: "priority-up",
  IMMEDIATE_HELP: "immediate-help",
  WAIT_THRESHOLD: "wait-threshold",
};

// ---- ID + timestamp helpers --------------------------------------------
let counter = 0;
/** Small readable unique id (good enough for a demo/in-memory store). */
export function genId(prefix = "id") {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter}`;
}
export const now = () => new Date().toISOString();

// ---- Factory functions --------------------------------------------------

/**
 * @typedef {Object} PatientSession
 * Mirrors "Patient session" in the concept data model.
 */
export function createSession({ sessionCode, preferredLanguage = "en", patientNumber = null, firstName = "", lastName = "" }) {
  return {
    id: genId("ses"),
    sessionCode,
    // 4-digit patient number shown to the patient and the triage staff.
    // Allocated sequentially by the store (unique, resets after 10,000).
    patientNumber,
    // Patient-entered name (first question after language selection). The
    // triage app shows this alongside the patient number.
    firstName,
    lastName,
    preferredLanguage,
    status: STATUS.WAITING,
    createdAt: now(),
    updatedAt: now(),
    currentPriority: null,      // nurse-confirmed priority (null until set)
    recommendedPriority: null,  // system recommendation
    priorityReason: "",
    symptomTrend: TREND.STABLE,
    lastUpdateAt: now(),
  };
}

/** @typedef {Object} IntakeResponse */
export function createIntakeResponse({ sessionId, questionId, answer, inputMethod = "typed", transcriptConfidence = null }) {
  return {
    id: genId("int"),
    sessionId,
    questionId,
    answer,
    inputMethod, // "typed" | "selected" | "voice"
    transcriptConfidence,
    createdAt: now(),
  };
}

/** @typedef {Object} ConditionUpdate */
export function createConditionUpdate({ sessionId, trend, severity, description = "", warningSigns = [], previousPriority = null, recommendedPriority = null, priorityReason = "" }) {
  return {
    id: genId("upd"),
    sessionId,
    trend,
    severity,
    description,
    warningSigns,
    previousPriority,
    recommendedPriority,
    priorityReason,
    createdAt: now(),
  };
}

/** @typedef {Object} Notification */
export function createNotification({ sessionId, type, message, severity = "normal" }) {
  return {
    id: genId("ntf"),
    sessionId,
    type,
    message,
    severity, // "normal" | "high"
    acknowledged: false,
    createdAt: now(),
  };
}

/** @typedef {Object} AuditRecord - accountability log entry. */
export function createAuditRecord({ actor, action, sessionRef, previousValue = null, newValue = null, reason = "" }) {
  return {
    id: genId("aud"),
    actor,          // e.g. "system" or "nurse"
    action,
    sessionRef,
    previousValue,
    newValue,
    reason,
    timestamp: now(),
  };
}
