// =========================================================================
// TriageService - core orchestration
// -------------------------------------------------------------------------
// Ties the store, deterministic queue rules, and AI abstractions together.
// Every mutation that changes a patient's priority also:
//   - writes an audit record (accountability),
//   - creates a nurse notification when the change is meaningful.
// The frontend never touches these pieces directly; it goes through api.js,
// which delegates here. This keeps UI code decoupled from persistence and AWS.
// =========================================================================

import {
  createSession, createIntakeResponse, createConditionUpdate,
  createNotification, createAuditRecord,
  PRIORITY, STATUS, TREND, NOTIFICATION_TYPE,
} from "../../shared/schemas.js";
import { store } from "./store.js";
import { recommendPriority, sortQueue, isEscalation } from "./queueRules.js";
import { bedrockService } from "./bedrockService.js";

export const triageService = {
  // ---- Sessions --------------------------------------------------------
  /**
   * Create a patient session. A unique 4-digit patient number is allocated
   * here (the value shown to the patient on the success screen and to triage
   * staff in the queue). `firstName` / `lastName` are optional at creation and
   * are usually set on the first intake step via setSessionName().
   *
   * @param {string} sessionCode       Internal code (also used for demo seeds).
   * @param {string} preferredLanguage Language chosen on the welcome screen.
   * @param {Object} [opts]            { firstName, lastName }.
   */
  createSession(sessionCode, preferredLanguage, { firstName = "", lastName = "" } = {}) {
    const patientNumber = store.nextPatientNumber();
    const session = createSession({ sessionCode, preferredLanguage, patientNumber, firstName, lastName });
    store.addSession(session);
    store.addAudit(createAuditRecord({
      actor: "system", action: "session-created", sessionRef: session.id,
      newValue: patientNumber,
    }));
    return session;
  },

  /** Record the patient's name (first question after language selection). */
  setSessionName(sessionId, firstName = "", lastName = "") {
    const session = store.getSession(sessionId);
    if (!session) throw new Error("Session not found");
    store.updateSession(sessionId, {
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
    });
    return store.getSession(sessionId);
  },

  getSession(id) { return store.getSession(id); },

  // ---- Intake ----------------------------------------------------------
  /**
   * Submit a full set of intake answers. Computes an initial recommended
   * priority, places the patient in the queue, and notifies the nurse.
   *
   * @param {string} sessionId
   * @param {Array}  answers  [{ questionId, answer, inputMethod }]
   * @param {Object} signals  { severity, trend, warningSigns, immediateHelp }
   */
  async submitIntake(sessionId, answers, signals = {}) {
    const session = store.getSession(sessionId);
    if (!session) throw new Error("Session not found");

    // Persist each answer.
    answers.forEach((a) => store.addIntake(createIntakeResponse({ sessionId, ...a })));

    // Deterministic recommendation from the reported signals.
    const { priority, reason } = recommendPriority(signals);

    // Optional AI summary of the free-text description (falls back to raw).
    const descAnswer = answers.find((a) => a.questionId === "description");
    const summary = await bedrockService.summarizePatientDescription(
      descAnswer?.answer || "", session.preferredLanguage
    );

    store.updateSession(sessionId, {
      status: STATUS.WAITING,
      recommendedPriority: priority,
      currentPriority: priority,       // defaults to recommendation until nurse acts
      priorityReason: reason,
      symptomTrend: signals.trend || TREND.STABLE,
      lastUpdateAt: new Date().toISOString(),
      aiSummary: summary,              // stored ALONGSIDE raw answers, never replacing them
    });

    store.addNotification(createNotification({
      sessionId, type: NOTIFICATION_TYPE.NEW_INTAKE,
      message: `New patient (${session.sessionCode}) submitted intake. Recommended: ${priority}.`,
      severity: priority === PRIORITY.IMMEDIATE ? "high" : "normal",
    }));

    store.addAudit(createAuditRecord({
      actor: "system", action: "intake-submitted", sessionRef: sessionId,
      newValue: priority, reason,
    }));

    return store.getSession(sessionId);
  },

  // ---- Condition updates ----------------------------------------------
  /**
   * Record a patient-reported condition change, recalculate priority, and
   * alert the nurse when the change escalates urgency or requests help.
   */
  async submitConditionUpdate(sessionId, { trend, severity, description = "", warningSigns = [], immediateHelp = false }) {
    const session = store.getSession(sessionId);
    if (!session) throw new Error("Session not found");

    const previousPriority = session.currentPriority;
    const { priority, reason } = recommendPriority({ trend, severity, warningSigns, immediateHelp });

    const update = createConditionUpdate({
      sessionId, trend, severity, description, warningSigns,
      previousPriority, recommendedPriority: priority, priorityReason: reason,
    });
    store.addUpdate(update);

    store.updateSession(sessionId, {
      recommendedPriority: priority,
      currentPriority: priority,
      priorityReason: reason,
      symptomTrend: trend,
      lastUpdateAt: new Date().toISOString(),
      needsNurseReview: true,
    });

    // Notify the nurse for meaningful changes.
    if (immediateHelp) {
      store.addNotification(createNotification({
        sessionId, type: NOTIFICATION_TYPE.IMMEDIATE_HELP,
        message: `Patient ${session.sessionCode} requested IMMEDIATE HELP.`,
        severity: "high",
      }));
    } else if (trend === TREND.WORSENING) {
      store.addNotification(createNotification({
        sessionId, type: NOTIFICATION_TYPE.WORSENING,
        message: `Patient ${session.sessionCode} reports worsening symptoms. ${reason}`,
        severity: isEscalation(previousPriority, priority) ? "high" : "normal",
      }));
    } else if (isEscalation(previousPriority, priority)) {
      store.addNotification(createNotification({
        sessionId, type: NOTIFICATION_TYPE.PRIORITY_UP,
        message: `Priority increased for ${session.sessionCode}: ${reason}`,
        severity: "high",
      }));
    }

    store.addAudit(createAuditRecord({
      actor: "patient", action: "condition-update", sessionRef: sessionId,
      previousValue: previousPriority, newValue: priority, reason,
    }));

    return { session: store.getSession(sessionId), update };
  },

  // ---- Nurse queue -----------------------------------------------------
  /** Build the sorted queue of currently waiting/active patients. */
  getQueue() {
    const active = store.allSessions().filter(
      (s) => ![STATUS.COMPLETED, STATUS.UNAVAILABLE].includes(s.status)
    );

    const entries = active.map((s) => ({
      sessionId: s.id,
      sessionCode: s.sessionCode,
      patientNumber: s.patientNumber,
      firstName: s.firstName || "",
      lastName: s.lastName || "",
      priority: s.currentPriority || PRIORITY.STANDARD,
      priorityReason: s.priorityReason,
      recommendedPriority: s.recommendedPriority,
      status: s.status,
      waitingSince: s.createdAt,
      lastUpdatedAt: s.lastUpdateAt,
      symptomTrend: s.symptomTrend,
      needsNurseReview: Boolean(s.needsNurseReview),
    }));

    return sortQueue(entries).map((e, i) => ({ ...e, position: i + 1 }));
  },

  /** Nurse confirms the system recommendation as the final priority. */
  confirmPriority(sessionId) {
    const s = store.getSession(sessionId);
    if (!s) throw new Error("Session not found");
    store.updateSession(sessionId, { currentPriority: s.recommendedPriority, needsNurseReview: false });
    store.addAudit(createAuditRecord({
      actor: "nurse", action: "priority-confirmed", sessionRef: sessionId,
      newValue: s.recommendedPriority, reason: "Nurse confirmed system recommendation.",
    }));
    return store.getSession(sessionId);
  },

  /** Nurse overrides to a different priority. */
  overridePriority(sessionId, newPriority, note = "") {
    const s = store.getSession(sessionId);
    if (!s) throw new Error("Session not found");
    const previous = s.currentPriority;
    store.updateSession(sessionId, {
      currentPriority: newPriority,
      priorityReason: `Nurse override: ${newPriority}.`,
      needsNurseReview: false,
    });
    store.addAudit(createAuditRecord({
      actor: "nurse", action: "priority-overridden", sessionRef: sessionId,
      previousValue: previous, newValue: newPriority, reason: note || "Nurse override.",
    }));
    return store.getSession(sessionId);
  },

  /** Change a patient's waiting-queue status (called, seen, etc.). */
  setStatus(sessionId, status) {
    const s = store.getSession(sessionId);
    if (!s) throw new Error("Session not found");
    const previous = s.status;
    store.updateSession(sessionId, { status, needsNurseReview: false });
    store.addAudit(createAuditRecord({
      actor: "nurse", action: "status-changed", sessionRef: sessionId,
      previousValue: previous, newValue: status,
    }));
    return store.getSession(sessionId);
  },

  // ---- Read helpers for the detail panel ------------------------------
  getPatientDetail(sessionId) {
    const session = store.getSession(sessionId);
    if (!session) return null;
    return {
      session,
      intake: store.intakeForSession(sessionId),
      updates: store.updatesForSession(sessionId),
      audit: store.auditForSession(sessionId),
    };
  },

  // ---- Notifications ---------------------------------------------------
  getNotifications() { return store.allNotifications(); },
  acknowledgeNotification(id) { return store.acknowledgeNotification(id); },
};
