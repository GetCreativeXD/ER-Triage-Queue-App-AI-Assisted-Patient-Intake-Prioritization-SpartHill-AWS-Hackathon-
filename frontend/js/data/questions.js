// =========================================================================
// Intake question set (patient website)
// -------------------------------------------------------------------------
// One question per step keeps the flow calm for stressed patients. Each
// question declares a `type` that tells the intake screen how to render it
// and, where relevant, how its answer feeds the deterministic queue rules
// (via the `signal` field).
//
// IMPORTANT (language lock): all patient-facing text lives in i18n.js keyed by
// language code. Questions reference those keys (promptKey, helpKey, optionKeys)
// so the whole form stays in the language the patient chose on the welcome
// screen and NEVER reverts to English - including the success screen.
//
// Every question allows voice: the mic sits below the question content on
// every step (handled by the intake screen, not per-question flags).
// =========================================================================

// Condensed warning-sign categories. These are NOT shown as an intake question
// anymore (the brief excludes "Do you have any of these right now?" from the
// patient form), but the post-intake status/update screen still lets a waiting
// patient flag them, so the data is kept here for that screen to import. Each
// box maps to the critical warning-sign ids the deterministic queue rules
// already understand.
export const WARNING_SIGNS = [
  { id: "breathing-or-chest", label: "Breathing or chest pain", maps: ["severe-breathing-difficulty", "severe-chest-discomfort"] },
  { id: "fainting-or-confusion", label: "Fainting or confusion", maps: ["fainting", "confusion"] },
  { id: "severe-bleeding", label: "Severe bleeding", maps: ["severe-bleeding"] },
  { id: "stroke-signs", label: "Face droop or slurred speech", maps: ["stroke-symptoms"] },
  { id: "allergic-reaction", label: "Severe allergic reaction", maps: ["severe-allergic-reaction"] },
];

// Severity 1-10 colour gradient (light green -> dark red). Exact hex values
// are mandated by the brief. Index 0 is level 1, index 9 is level 10.
export const SEVERITY_COLORS = [
  "#D9F7BE", // 1  minimal discomfort
  "#B7EB8F", // 2
  "#95DE64", // 3
  "#D3F261", // 4
  "#FFEC3D", // 5
  "#FFC53D", // 6
  "#FA8C16", // 7
  "#D46B08", // 8
  "#F5222D", // 9
  "#A8071A", // 10 extreme pain
];

// Options shown when the patient picks "Longer" on the onset question.
// Values are stable keys; labels are localized in i18n.js (onsetLonger.*).
export const ONSET_LONGER_OPTIONS = [
  { value: "2-3 weeks ago", key: "onset.longer.2to3weeks" },
  { value: "1 month ago", key: "onset.longer.1month" },
  { value: "2 months+", key: "onset.longer.2monthsPlus" },
];

// Stable option values for the multi-choice symptom question. Labels are
// localized via i18n (symptom.*). The value is what the nurse view reads.
// The "Other Symptoms" choice is rendered separately (it reveals a free-text
// box), so it is not part of this option list.
export const SYMPTOM_OPTIONS = [
  { value: "Trouble breathing", key: "symptom.breathing" },
  { value: "Pain or injury", key: "symptom.painInjury" },
  { value: "Fever or headache", key: "symptom.feverHeadache" },
];

// Stable option values for the onset question.
export const ONSET_OPTIONS = [
  { value: "Less than 1 hour ago", key: "onset.lessThanHour" },
  { value: "Today", key: "onset.today" },
  { value: "This week", key: "onset.thisWeek" },
  { value: "Longer", key: "onset.longer" },
];

// Stable option values for the trend question.
export const TREND_OPTIONS = [
  { value: "worsening", key: "trend.worse" },
  { value: "stable", key: "trend.same" },
  { value: "improving", key: "trend.better" },
];

// Question list. Order matches the brief:
//   1 name, 2 symptoms, 3 severity, 4 onset, 5 trend, 6 description.
// (The old "Do you have any of these right now?" warning-signs question is
//  intentionally excluded per the brief.)
export const QUESTIONS = [
  {
    id: "name",
    type: "name",
    promptKey: "q.name.prompt",
    helpKey: "q.name.help",
  },
  {
    id: "main-complaint",
    type: "multi-choice",
    promptKey: "q.symptoms.prompt",
    helpKey: "q.symptoms.help",
    options: SYMPTOM_OPTIONS,
    allowOther: true,
  },
  {
    id: "severity",
    type: "severity",
    // No help line under this prompt (removed per the brief).
    promptKey: "q.severity.prompt",
    min: 1, max: 10,
    signal: "severity", // feeds queue rules
  },
  {
    id: "onset",
    type: "choice-with-detail",
    promptKey: "q.onset.prompt",
    options: ONSET_OPTIONS,
    // Picking this option reveals a dropdown of longer ranges.
    detailFor: "Longer",
    detailOptions: ONSET_LONGER_OPTIONS,
  },
  // The trend question ("getting better/worse/same") was removed from the
  // intake form. It now lives ONLY in the post-submission status-update flow.
  {
    id: "description",
    type: "text",
    promptKey: "q.description.prompt",
    helpKey: "q.description.help",
  },
];
