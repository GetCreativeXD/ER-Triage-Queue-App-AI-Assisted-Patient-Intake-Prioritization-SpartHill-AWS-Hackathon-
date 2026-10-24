// =========================================================================
// Intake question set
// -------------------------------------------------------------------------
// One question per step keeps the flow calm for stressed patients. Each
// question declares a `type` that tells the intake screen how to render it
// and, where relevant, how its answer feeds the deterministic queue rules
// (via the `signal` field). Editing triage inputs means editing this list.
// =========================================================================

export const WARNING_SIGNS = [
  { id: "severe-breathing-difficulty", label: "Severe breathing difficulty" },
  { id: "severe-chest-discomfort", label: "Severe chest pain or pressure" },
  { id: "fainting", label: "Fainting or near-fainting" },
  { id: "confusion", label: "New confusion" },
  { id: "severe-bleeding", label: "Severe bleeding" },
  { id: "stroke-symptoms", label: "Face drooping / weakness / slurred speech" },
  { id: "severe-allergic-reaction", label: "Severe allergic reaction" },
];

export const QUESTIONS = [
  {
    id: "main-complaint",
    type: "choice",
    prompt: "What is the main reason for your visit?",
    options: ["Chest pain", "Breathing problem", "Injury", "Abdominal pain", "Fever", "Headache", "Other"],
  },
  {
    id: "severity",
    type: "slider",
    prompt: "How severe is your pain or discomfort right now?",
    help: "0 means none, 10 means the worst you can imagine.",
    min: 0, max: 10,
    signal: "severity", // feeds queue rules
  },
  {
    id: "onset",
    type: "choice",
    prompt: "When did your symptoms start?",
    options: ["Less than 1 hour ago", "Today", "This week", "Longer"],
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
    type: "multi",
    prompt: "Do you have any of these right now?",
    help: "Select all that apply. If none, continue.",
    options: WARNING_SIGNS,
    signal: "warningSigns",
  },
  {
    id: "description",
    type: "text",
    prompt: "In your own words, what happened?",
    help: "You can type or use the microphone.",
    allowVoice: true,
  },
];
