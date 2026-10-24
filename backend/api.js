// =========================================================================
// API facade
// -------------------------------------------------------------------------
// This mirrors the REST operations listed in the concept doc (POST /api/...)
// but, because this demo has no running Node server, it resolves calls
// in-process against triageService. The method names/shapes match the planned
// HTTP endpoints, so swapping to real `fetch` calls later only means changing
// the body of each method here. The frontend imports ONLY this module.
// =========================================================================

import { triageService } from "./services/triageService.js";
import { lexService } from "./services/lexService.js";
import { store } from "./services/store.js";
import { seedDemoData } from "./data/seed.js";

export const api = {
  // ---- Sessions / intake ----------------------------------------------
  // POST /api/sessions
  createSession(sessionCode, language) {
    return triageService.createSession(sessionCode, language);
  },
  // GET /api/sessions/:id
  getSession(id) { return triageService.getSession(id); },
  // POST /api/sessions/:id/intake
  submitIntake(id, answers, signals) { return triageService.submitIntake(id, answers, signals); },
  // POST /api/sessions/:id/updates
  submitUpdate(id, update) { return triageService.submitConditionUpdate(id, update); },

  // ---- Queue -----------------------------------------------------------
  // GET /api/queue
  getQueue() { return triageService.getQueue(); },
  // GET /api/queue/:sessionId  (detail view)
  getPatientDetail(id) { return triageService.getPatientDetail(id); },
  // POST /api/queue/:sessionId/confirm
  confirmPriority(id) { return triageService.confirmPriority(id); },
  // POST /api/queue/:sessionId/override
  overridePriority(id, priority, note) { return triageService.overridePriority(id, priority, note); },
  // POST /api/queue/:sessionId/status
  setStatus(id, status) { return triageService.setStatus(id, status); },

  // ---- Notifications ---------------------------------------------------
  // GET /api/notifications
  getNotifications() { return triageService.getNotifications(); },
  // POST /api/notifications/:id/acknowledge
  acknowledgeNotification(id) { return triageService.acknowledgeNotification(id); },

  // ---- Voice (Amazon Lex abstraction) ---------------------------------
  startVoice(language, sessionId) { return lexService.startConversation(language, sessionId); },

  // ---- Demo controls ---------------------------------------------------
  /** Load demo data if the store is empty (called once on startup). */
  ensureSeed() { if (store.isEmpty()) seedDemoData(triageService); },
  /** Clear + reseed demo data (the "Reset demo" button). */
  resetDemo() { store.reset(); seedDemoData(triageService); },
};
