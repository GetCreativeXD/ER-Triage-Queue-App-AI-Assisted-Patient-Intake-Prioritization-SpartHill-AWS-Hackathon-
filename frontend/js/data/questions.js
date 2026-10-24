// =========================================================================
// Intake question set (patient website)
// -------------------------------------------------------------------------
// One question per step keeps the flow calm for stressed patients. Each
// question declares a `type` that tells the intake screen how to render it
// and, where relevant, how its answer feeds the deterministic queue rules
// (via the `signal` field). Editing triage inputs means editing this list.
//
// Every question allows voice: the mic sits below the question content on
// every step (handled by the intake screen, not per-question flags).
// =========================================================================

// Condensed warning-sign categories. The brief asks for 4-5 boxes with short
// labels (3-5 words each) plus a "None of these" escape that lets the patient
// speak or type what they feel. Each box maps to the critical warning-sign ids
// the deterministic queue rules already understand.
export const WARNING_SIGNS = [
  { id: "breathing-or-chest", label: "Breathing or chest pain", maps: ["severe-breathing-difficulty", "severe-chest-discomfort"] },
  { id: "fainting-or-confusion", label: "Fainting or confusion", maps: ["fainting", "confusion"] },
  { id: "severe-bleeding", label: "Severe bleeding", maps: ["severe-bleeding"] },
  { id: "stroke-signs", label: "Face droop or slurred speech", maps: ["stroke-symptoms"] },
  { id: "allergic-reaction", label: "Severe allergic reaction", maps: ["severe-allergic-reaction"] },
];

// Options shown when the patient picks "Longer" on the onset question.
export const ONSET_LONGER_OPTIONS = [
  { label: "2-3 weeks ago", value: "2-3 weeks ago" },
  { label: "1 month ago", value: "1 month ago" },
  { label: "2 months+", value: "2 months+" },
];

export const QUESTIONS = [
  {
    id: "name",
    type: "name",
    prompt: "What is your name?",
    help: "Enter your first and last name.",
  },
  {
    id: "main-complaint",
    type: "multi-choice",
    prompt: "What is the main reason for your visit?",
    help: "Select all that apply.",
    options: ["Chest pain", "Breathing problem", "Injury", "Abdominal pain", "Fever", "Headache"],
    // When "Other" is chosen the patient gets a free-text box to describe it.
    allowOther: true,
  },
  {
    id: "severity",
    type: "severity",
    prompt: "How severe is your pain or discomfort right now?",
    help: "0 means none, 10 means the worst you can imagine.",
    min: 0, max: 10,
    signal: "severity", // feeds queue rules
  },
  {
    id: "onset",
    type: "choice-with-detail",
    prompt: "When did your symptoms start?",
    options: ["Less than 1 hour ago", "Today", "This week", "Longer"],
    // Picking this option reveals a dropdown of longer ranges.
    detailFor: "Longer",
    detailOptions: ONSET_LONGER_OPTIONS,
  },
  {
    id: "trend",
    type: "choice",
    prompt: "Are your symptoms getting better, worse, or staying the same?",
    options: [
      { label: "Worse", value: "worsening" },
      { label: "Same", value: "stable" },
      { label: "Better", value: "improving" },
    ],
    signal: "trend",
  },
  {
    id: "warning-signs",
    type: "warning-multi",
    prompt: "Do you have any of these right now?",
    help: "Select all that apply, or choose \"None of these\" to describe it yourself.",
    options: WARNING_SIGNS,
    signal: "warningSigns",
  },
  {
    id: "description",
    type: "text",
    prompt: "In your own words, what happened?",
    help: "You can type or use the microphone.",
  },
];
