// =========================================================================
// Deterministic queue priority rules
// -------------------------------------------------------------------------
// This is the single source of truth for how a recommended priority is
// calculated. It is intentionally transparent and easy to edit (the concept
// doc requires rules to live in a separate, obvious module). Every result
// includes a human-readable reason that the nurse can read and override.
//
// Bedrock / AI is NEVER used here. AI only summarizes and explains; the
// actual priority always comes from these deterministic rules.
// =========================================================================

import { PRIORITY, PRIORITY_RANK, TREND } from "../../shared/schemas.js";

/** Warning signs that, on their own, mean the patient must be seen now. */
export const CRITICAL_WARNING_SIGNS = [
  "severe-breathing-difficulty",
  "severe-chest-discomfort",
  "fainting",
  "confusion",
  "severe-bleeding",
  "stroke-symptoms",
  "severe-allergic-reaction",
];

/**
 * Compute a recommended priority from patient-reported inputs.
 *
 * @param {Object} input
 * @param {boolean} [input.immediateHelp]  Patient pressed "I need help now".
 * @param {string[]} [input.warningSigns]  Reported critical warning signs.
 * @param {number}  [input.severity]       0-10 pain/discomfort severity.
 * @param {string}  [input.trend]          worsening | stable | improving.
 * @returns {{ priority: string, reason: string }}
 */
export function recommendPriority({ immediateHelp = false, warningSigns = [], severity = 0, trend = TREND.STABLE } = {}) {
  // 1. Explicit request for immediate help always wins.
  if (immediateHelp) {
    return { priority: PRIORITY.IMMEDIATE, reason: "Patient requested immediate help." };
  }

  // 2. Any single critical warning sign => immediate review.
  const critical = (warningSigns || []).filter((s) => CRITICAL_WARNING_SIGNS.includes(s));
  if (critical.length > 0) {
    return {
      priority: PRIORITY.IMMEDIATE,
      reason: `Patient reported a critical warning sign (${critical.join(", ")}).`,
    };
  }

  // 3. Worsening symptoms with high severity => very urgent.
  if (trend === TREND.WORSENING && severity >= 7) {
    return { priority: PRIORITY.VERY_URGENT, reason: "Symptoms are worsening with high reported severity." };
  }

  // 4. High severity without a critical sign => urgent.
  if (severity >= 7) {
    return { priority: PRIORITY.URGENT, reason: "High reported severity." };
  }

  // 5. Low severity and improving => low urgency.
  if (severity <= 3 && trend === TREND.IMPROVING) {
    return { priority: PRIORITY.LOW, reason: "Low severity and improving symptoms." };
  }

  // 6. Everything else => standard.
  return { priority: PRIORITY.STANDARD, reason: "Moderate severity or stable symptoms." };
}

/**
 * Sort queue entries by priority rank, using waiting time as a tie-breaker.
 * Longer-waiting patients come first WITHIN the same priority band, but a
 * long wait never jumps a patient ahead of a more urgent one.
 *
 * @param {Array} entries  Objects with { priority, waitingSince }.
 * @returns {Array} new sorted array (does not mutate input).
 */
export function sortQueue(entries) {
  return [...entries].sort((a, b) => {
    const rankDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (rankDiff !== 0) return rankDiff;
    // Same priority: earlier waitingSince (longer wait) first.
    return new Date(a.waitingSince) - new Date(b.waitingSince);
  });
}

/**
 * Describe whether a priority change is meaningful enough to alert the nurse.
 * @returns {boolean} true if the new priority is more urgent than the old.
 */
export function isEscalation(previousPriority, newPriority) {
  if (!previousPriority) return false;
  return PRIORITY_RANK[newPriority] < PRIORITY_RANK[previousPriority];
}
