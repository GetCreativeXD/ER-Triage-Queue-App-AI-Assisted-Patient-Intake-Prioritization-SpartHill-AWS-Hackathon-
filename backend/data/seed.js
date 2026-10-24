// =========================================================================
// Demo seed data
// -------------------------------------------------------------------------
// Creates several fake patients at different priorities so the nurse
// dashboard is populated for a demo. Uses fake session codes only (no real
// PII). One patient is left ready to "worsen" during the demo via the
// patient status screen.
//
// Severity/trend/warning-sign values flow through the real deterministic
// rules, so the seeded priorities are produced by the same logic the live
// app uses (nothing is hard-coded past the rules).
// =========================================================================

import { TREND } from "../../shared/schemas.js";

/**
 * Populate the store through the triageService so every seeded patient goes
 * through the same intake path as a real one.
 * @param {import("../services/triageService.js").triageService} triage
 */
export async function seedDemoData(triage) {
  const patients = [
    {
      code: "ER-1001", lang: "en",
      answers: [
        { questionId: "main-complaint", answer: "Chest tightness", inputMethod: "selected" },
        { questionId: "description", answer: "Pressure in chest for the last hour.", inputMethod: "typed" },
      ],
      signals: { severity: 8, trend: TREND.WORSENING, warningSigns: ["severe-chest-discomfort"] },
    },
    {
      code: "ER-1002", lang: "es",
      answers: [
        { questionId: "main-complaint", answer: "Sprained ankle", inputMethod: "selected" },
        { questionId: "description", answer: "Twisted ankle on the stairs.", inputMethod: "typed" },
      ],
      signals: { severity: 4, trend: TREND.STABLE, warningSigns: [] },
    },
    {
      code: "ER-1003", lang: "en",
      answers: [
        { questionId: "main-complaint", answer: "Headache", inputMethod: "selected" },
        { questionId: "description", answer: "Mild headache, getting better after water.", inputMethod: "typed" },
      ],
      signals: { severity: 2, trend: TREND.IMPROVING, warningSigns: [] },
    },
    {
      code: "ER-1004", lang: "fr",
      // This patient is a good candidate to "worsen" live during the demo.
      answers: [
        { questionId: "main-complaint", answer: "Abdominal pain", inputMethod: "selected" },
        { questionId: "description", answer: "Stomach pain since this morning.", inputMethod: "typed" },
      ],
      signals: { severity: 6, trend: TREND.STABLE, warningSigns: [] },
    },
  ];

  for (const p of patients) {
    const session = triage.createSession(p.code, p.lang);
    await triage.submitIntake(session.id, p.answers, p.signals);
  }
}
