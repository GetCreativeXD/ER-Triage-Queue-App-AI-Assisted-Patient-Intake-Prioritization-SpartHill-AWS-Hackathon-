// =========================================================================
// InTake - triage staff dashboard (Capacitor native app / browser demo)
// -------------------------------------------------------------------------
// A single dashboard view:
//   - Top bar: waitlist total + "Immediate review" count, and a "Sort By"
//     filter dropdown (Immediate Review / Urgent / Low Urgency).
//   - Left:  a draggable, color-coded patient list (number, name, severity
//            category, wait time) with "Checked Out" and "Delete Patient".
//   - Right: the selected patient's details (Summary + the exact words from
//            question 6, translated to English, and all answers in English).
//            Clicking the same patient again closes the panel; a "Close"
//            button does the same.
// Header icons: QR (check-in popup), bell (notifications popup with an unread
// badge), and settings (server URL).
// =========================================================================

import { triageApi, getServerUrl, setServerUrl } from "./api.js";

const view = document.getElementById("view");

let selectedId = null;             // currently open patient detail (null = none)
let sortBy = null;                 // active "Sort By" filter priority (null = none)
let refreshTimer = null;
let queueCache = [];               // last fetched queue (for drag reordering)
let manualOrder = [];              // sessionIds in the staff's dragged order
let lastNotifCount = 0;            // unread notifications (for the bell badge)

// The three filter options the brief asks for.
const SORT_OPTIONS = [
  { label: "Very Urgent", value: "Very urgent", slug: "prio-very-urgent" },
  { label: "Urgent", value: "Urgent", slug: "prio-urgent" },
  { label: "Low Urgency", value: "Low urgency", slug: "prio-low-urgency" },
];

// Specialist referral rosters. These are placeholder (random) names per the
// brief; swap for a real staff directory later.
//
// Priority-based roster: the fallback when we can't match a specific symptom.
const SPECIALISTS_BY_PRIORITY = {
  "Immediate review": {
    specialty: "Emergency / Critical Care",
    providers: ["Dr. Elena Marsh", "Dr. Raymond Osei", "Dr. Priya Nair"],
  },
  "Very urgent": {
    specialty: "Acute Care",
    providers: ["Dr. Marcus Lindqvist", "Dr. Sofia Romano", "Dr. Daniel Cho"],
  },
  "Urgent": {
    specialty: "Internal Medicine",
    providers: ["Dr. Hannah Weiss", "Dr. Omar Farouk", "Dr. Grace Tanaka"],
  },
  "Standard": {
    specialty: "General Practice",
    providers: ["Dr. Leo Bennett", "Dr. Amara Okonkwo", "Dr. Julia Flores"],
  },
  "Low urgency": {
    specialty: "Outpatient / Family Medicine",
    providers: ["Dr. Noah Patel", "Dr. Clara Jensen", "Dr. Theo Russo"],
  },
};

// Symptom-based roster: a MORE SPECIFIC referral matched to the patient's main
// complaint. Each entry carries a clinical specialty, named providers and
// their role, so the dashboard recommends a fitting doctor/nurse rather than a
// generic category. `match` holds lowercase keywords tested against the
// (English) main-complaint answer.
const SPECIALISTS_BY_SYMPTOM = [
  {
    key: "cardiology",
    match: ["chest pain", "chest tightness", "chest discomfort", "palpitation", "heart"],
    specialty: "Cardiology",
    providers: [
      { name: "Dr. Victor Alvarez", role: "Cardiologist" },
      { name: "Dr. Naomi Sato", role: "Cardiologist" },
      { name: "NP Dana Whitfield", role: "Cardiac Nurse Practitioner" },
    ],
  },
  {
    key: "pulmonology",
    match: ["breathing", "breath", "shortness of breath", "cough", "wheez", "asthma", "respirator"],
    specialty: "Pulmonology / Respiratory",
    providers: [
      { name: "Dr. Idris Rahman", role: "Pulmonologist" },
      { name: "Dr. Claire Dubois", role: "Pulmonologist" },
      { name: "RN Marcus Bell", role: "Respiratory Nurse" },
    ],
  },
  {
    key: "orthopedics",
    match: ["injury", "injured", "fracture", "broken", "sprain", "ankle", "wrist", "fell", "fall", "bone", "joint"],
    specialty: "Orthopedics / Trauma",
    providers: [
      { name: "Dr. Helena Novak", role: "Orthopedic Surgeon" },
      { name: "Dr. Samuel Addo", role: "Trauma Specialist" },
      { name: "NP Olivia Brenner", role: "Orthopedic Nurse Practitioner" },
    ],
  },
  {
    key: "gastroenterology",
    match: ["abdominal", "abdomen", "stomach", "belly", "nausea", "vomit", "diarrhea"],
    specialty: "Gastroenterology",
    providers: [
      { name: "Dr. Farah Haddad", role: "Gastroenterologist" },
      { name: "Dr. Peter Lindgren", role: "Gastroenterologist" },
      { name: "RN Tanya Cole", role: "GI Nurse" },
    ],
  },
  {
    key: "infectious",
    match: ["fever", "chills", "infection", "flu", "temperature"],
    specialty: "Infectious Disease / Internal Medicine",
    providers: [
      { name: "Dr. Yuki Tanaka", role: "Infectious Disease Physician" },
      { name: "Dr. Andre Mensah", role: "Internist" },
      { name: "RN Sofia Pereira", role: "Triage Nurse" },
    ],
  },
  {
    key: "neurology",
    match: ["headache", "migraine", "head", "dizz", "confusion", "numb", "stroke", "vision"],
    specialty: "Neurology",
    providers: [
      { name: "Dr. Laila Haroun", role: "Neurologist" },
      { name: "Dr. Thomas Reiner", role: "Neurologist" },
      { name: "NP Grace Lin", role: "Neuro Nurse Practitioner" },
    ],
  },
];

// Human-readable source language for the translation subscript.
const LANGUAGE_NAMES = { en: "English", es: "Spanish", fr: "French", zh: "Chinese" };

/**
 * Pick a stable, MORE SPECIFIC specialist referral for a patient. We first try
 * to match the patient's main complaint to a clinical specialty (cardiology,
 * pulmonology, ...). If nothing matches we fall back to the priority-based
 * roster. "Stable" means the same patient always maps to the same provider
 * (seeded by patient number) so the card doesn't reshuffle on refresh.
 *
 * @param {string} priority       patient's current priority category
 * @param {number} patientNumber  used as a stable seed
 * @param {string} [complaint]    English main-complaint answer, if available
 */
function specialistFor(priority, patientNumber, complaint = "") {
  const seed = Number(patientNumber) || 0;
  const text = String(complaint || "").toLowerCase();

  const bySymptom = SPECIALISTS_BY_SYMPTOM.find((entry) =>
    entry.match.some((kw) => text.includes(kw)));

  if (bySymptom) {
    const pick = bySymptom.providers[seed % bySymptom.providers.length];
    return { specialty: bySymptom.specialty, provider: pick.name, role: pick.role };
  }

  const roster = SPECIALISTS_BY_PRIORITY[priority] || SPECIALISTS_BY_PRIORITY["Standard"];
  return { specialty: roster.specialty, provider: roster.providers[seed % roster.providers.length], role: "Attending" };
}

// ---- Tiny DOM helper ----------------------------------------------------
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return node;
}

// White check-mark icon (used inside the green circular "checked out" button).
function checkIconSvg() {
  return (
    '<svg class="circle-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">' +
    '<path fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.2 4.2L19 7"/>' +
    "</svg>"
  );
}

// White X icon (used inside the red circular "delete patient" button).
function xIconSvg() {
  return (
    '<svg class="circle-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">' +
    '<path fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/>' +
    "</svg>"
  );
}

function waitingMinutes(since) {
  return Math.max(0, Math.round((Date.now() - new Date(since)) / 60000));
}

function waitLabel(since) {
  const m = waitingMinutes(since);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h} h ${rem} min` : `${h} h`;
}

function slug(priority) {
  return (priority || "unassigned").toLowerCase().replace(/[^a-z]+/g, "-");
}

// Severity category label shown on each row (derived from priority).
function severityCategory(priority) {
  return priority || "Unassigned";
}

// ---- Header actions -----------------------------------------------------
document.getElementById("settings-btn").addEventListener("click", openSettings);
document.getElementById("qr-btn").addEventListener("click", openQrPopup);
document.getElementById("bell-btn").addEventListener("click", openNotifications);

// ---- Refresh loop -------------------------------------------------------
async function render() {
  clearInterval(refreshTimer);
  await renderDashboard();
  refreshTimer = setInterval(renderDashboard, 4000);
}

// Keep the manual (dragged) order in sync with the live queue: append any new
// patients, drop any that have left.
function reconcileOrder(queue) {
  const ids = queue.map((q) => q.sessionId);
  manualOrder = manualOrder.filter((id) => ids.includes(id));
  ids.forEach((id) => { if (!manualOrder.includes(id)) manualOrder.push(id); });
}

// Order the queue by the staff's manual drag order, then apply the Sort By
// filter (which pins the chosen category to the top).
function orderedQueue(queue) {
  const byId = new Map(queue.map((q) => [q.sessionId, q]));
  let ordered = manualOrder.map((id) => byId.get(id)).filter(Boolean);
  if (sortBy) {
    const match = ordered.filter((q) => q.priority === sortBy);
    const rest = ordered.filter((q) => q.priority !== sortBy);
    ordered = [...match, ...rest];
  }
  return ordered;
}

// ---- Dashboard ----------------------------------------------------------
async function renderDashboard() {
  let queue;
  try {
    queue = await triageApi.getQueue();
  } catch {
    view.innerHTML = "";
    view.appendChild(connErrorCard());
    return;
  }
  queueCache = queue;
  reconcileOrder(queue);
  updateBellBadge().catch(() => {});

  // Fetch the open patient's detail (if any) before rebuilding the view.
  let detail = null;
  if (selectedId) {
    detail = await triageApi.getPatientDetail(selectedId).catch(() => null);
    if (!detail) selectedId = null; // patient left/deleted
  }

  view.innerHTML = "";
  view.appendChild(dashTop(queue));

  if (!queue.length) {
    view.appendChild(el("div", { class: "card empty" }, "No patients on the waitlist yet."));
    return;
  }

  const board = el("div", { class: `dashboard ${selectedId ? "" : "single"}` });
  board.appendChild(queueList(orderedQueue(queue)));
  if (selectedId && detail) board.appendChild(detailCard(detail));
  view.appendChild(board);
}

// ---- Top bar: stats + Sort By ------------------------------------------
function dashTop(queue) {
  const immediate = queue.filter((q) => q.priority === "Immediate review").length;

  const stats = el("div", { class: "statbar" }, [
    el("div", { class: "stat waiting" }, [
      el("div", { class: "stat-num", text: String(queue.length) }),
      el("div", { class: "stat-label", text: "On waitlist" }),
    ]),
    el("div", { class: "stat immediate" }, [
      el("div", { class: "stat-num", text: String(immediate) }),
      el("div", { class: "stat-label", text: "Immediate review" }),
    ]),
  ]);

  return el("div", { class: "dash-top" }, [stats, sortByControl()]);
}

// "Sort By" dropdown that stays open until the staff clicks an option or
// clicks away (handled by a one-shot document listener).
function sortByControl() {
  const wrap = el("div", { class: "sortby" });
  const current = SORT_OPTIONS.find((o) => o.value === sortBy);
  const btn = el("button", { class: "sortby-btn" }, [
    el("span", { text: current ? `Sort By: ${current.label}` : "Sort By" }),
    el("span", { class: "caret", text: "▼" }),
  ]);

  let menu = null;
  const closeMenu = () => { if (menu) { menu.remove(); menu = null; } };

  const onDocClick = (e) => {
    if (menu && !wrap.contains(e.target)) { closeMenu(); document.removeEventListener("click", onDocClick, true); }
  };

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu) { closeMenu(); document.removeEventListener("click", onDocClick, true); return; }
    menu = el("div", { class: "sortby-menu" }, [
      ...SORT_OPTIONS.map((o) =>
        el("button", {
          class: o.value === sortBy ? "active" : "",
          onclick: () => { sortBy = (sortBy === o.value ? null : o.value); closeMenu(); document.removeEventListener("click", onDocClick, true); renderDashboard(); },
        }, [el("span", { class: `dot ${o.slug}` }), o.label])
      ),
      sortBy ? el("button", { onclick: () => { sortBy = null; closeMenu(); document.removeEventListener("click", onDocClick, true); renderDashboard(); } }, "Clear filter") : null,
    ]);
    wrap.appendChild(menu);
    // Register the click-away listener on the next tick so this very click
    // doesn't immediately close the menu.
    setTimeout(() => document.addEventListener("click", onDocClick, true), 0);
  });

  wrap.appendChild(btn);
  return wrap;
}

// ---- Patient list (left, draggable) ------------------------------------
function queueList(queue) {
  const list = el("div", { class: "queue-list" });

  queue.forEach((q) => {
    const name = [q.firstName, q.lastName].filter(Boolean).join(" ") || "Unnamed";
    const prioSlug = slug(q.priority);

    const row = el("div", {
      class: `queue-row prio-${prioSlug} ${q.needsNurseReview ? "changed" : ""} ${selectedId === q.sessionId ? "selected" : ""}`,
      draggable: "true",
      "data-id": q.sessionId,
    }, [
      el("span", { class: "drag-handle", title: "Drag to reorder", text: "⠿" }),
      el("div", { class: "qr-num", text: "#" + (q.patientNumber || "----") }),
      el("div", { class: "qr-main" }, [
        el("div", { class: "qr-name", text: name }),
        el("div", { class: "qr-sub", text: `Waiting ${waitLabel(q.waitingSince)}` }),
        el("span", { class: `qr-cat prio-${prioSlug}`, text: severityCategory(q.priority) }),
      ]),
      el("div", { class: "row-actions" }, [
        q.needsNurseReview ? el("span", { class: "chip", text: "Changed" }) : null,
        // Green circular button with a white check mark = check the patient out.
        el("button", {
          class: "circle-btn checkout",
          title: "Checked out",
          "aria-label": `Check out patient #${q.patientNumber || ""}`,
          html: checkIconSvg(),
          onclick: async (e) => { e.stopPropagation(); await triageApi.setStatus(q.sessionId, "completed"); if (selectedId === q.sessionId) selectedId = null; renderDashboard(); },
        }),
        // Red circular button with a white X = delete the patient.
        el("button", {
          class: "circle-btn delete",
          title: "Delete patient",
          "aria-label": `Delete patient #${q.patientNumber || ""}`,
          html: xIconSvg(),
          onclick: async (e) => {
            e.stopPropagation();
            if (!confirm(`Delete patient #${q.patientNumber || ""}? This cannot be undone.`)) return;
            await triageApi.deletePatient(q.sessionId);
            if (selectedId === q.sessionId) selectedId = null;
            renderDashboard();
          },
        }),
      ]),
    ]);

    // Click a row to open its detail; click the open one again to close it.
    row.addEventListener("click", () => {
      selectedId = (selectedId === q.sessionId) ? null : q.sessionId;
      renderDashboard();
    });

    wireDrag(row, list);
    list.appendChild(row);
  });

  return list;
}

// Native HTML5 drag-and-drop reordering of the patient rows. Reordering is
// local to the staff's view (updates manualOrder) and survives refreshes.
function wireDrag(row, list) {
  row.addEventListener("dragstart", (e) => {
    row.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", row.dataset.id); } catch { /* some browsers */ }
  });
  row.addEventListener("dragend", () => {
    row.classList.remove("dragging");
    list.querySelectorAll(".drag-over").forEach((n) => n.classList.remove("drag-over"));
    // Persist the new order from the DOM into manualOrder.
    manualOrder = [...list.querySelectorAll(".queue-row")].map((n) => n.dataset.id);
  });
  row.addEventListener("dragover", (e) => {
    e.preventDefault();
    const dragging = list.querySelector(".dragging");
    if (!dragging || dragging === row) return;
    const rect = row.getBoundingClientRect();
    const after = (e.clientY - rect.top) > rect.height / 2;
    list.insertBefore(dragging, after ? row.nextSibling : row);
  });
}

// ---- Patient detail (right) --------------------------------------------
function detailCard(detail) {
  const { session, intake, summary, question6Original, question6English, language } = detail;
  const name = [session.firstName, session.lastName].filter(Boolean).join(" ") || "Unnamed patient";

  // Build the English answer list, skipping the free-text description (it is
  // shown verbatim under the summary instead) and the name (already in header).
  const labelFor = {
    "main-complaint": "Symptoms",
    "severity": "Severity (1-10)",
    "onset": "Symptoms started",
    "trend": "Trend",
  };
  const trendText = { worsening: "Worse", improving: "Better", stable: "Same" };
  const rows = (intake || [])
    .filter((r) => r.questionId !== "description" && r.questionId !== "name")
    .map((r) => {
      let value = r.answerEnglish || r.answerOriginal || "";
      if (r.questionId === "trend") value = trendText[value] || value;
      return el("div", { class: "kv" }, [
        el("span", { class: "k", text: labelFor[r.questionId] || r.questionId }),
        el("span", { class: "v", text: String(value) }),
      ]);
    });

  const closePanel = () => { selectedId = null; renderDashboard(); };

  // Was question 6 spoken/typed in another language? Note the translation.
  const translated = language && language !== "en" && question6Original && question6English !== question6Original;
  const sourceLangName = LANGUAGE_NAMES[language] || language;

  // Specialist referral matched to the patient's main complaint (falling back
  // to the priority category when the symptom isn't recognized).
  const complaint = (intake || []).find((r) => r.questionId === "main-complaint");
  const complaintText = complaint ? (complaint.answerEnglish || complaint.answerOriginal || "") : "";
  const referral = specialistFor(session.currentPriority, session.patientNumber, complaintText);

  return el("div", { class: "card detail" }, [
    el("div", { class: "detail-head" }, [
      el("div", {}, [
        el("div", { class: "detail-num", text: "#" + (session.patientNumber || "----") }),
        el("div", { class: "detail-name", text: name }),
      ]),
      el("span", { class: `qr-cat prio-${slug(session.currentPriority)}`, text: severityCategory(session.currentPriority) }),
    ]),

    // Summary: an overview of the intake, NOT a copy of the patient's words.
    el("div", { class: "section-label", text: "Summary" }),
    el("div", { class: "summary", text: summary || "No summary available." }),

    // Referral: a specific specialist/provider matched to the patient's
    // symptom, with their role and the fitting clinical specialty.
    el("div", { class: "section-label", text: "Recommended specialist" }),
    el("div", { class: "referral" }, [
      el("div", { class: "referral-provider", text: `${referral.provider}${referral.role ? ` — ${referral.role}` : ""}` }),
      el("div", { class: "referral-specialty", text: `${referral.specialty} · ${severityCategory(session.currentPriority)}` }),
    ]),

    // Question 6 ("in your own words"), shown FULLY TRANSLATED to English. The
    // original-language script is intentionally NOT displayed; staff only read
    // English. We only note which language it was translated from.
    el("div", { class: "section-label", text: "Patient's own words (question 6)" }),
    el("div", { class: "quote" }, [
      el("div", { class: "q-text", text: question6English ? `“${question6English}”` : "— not provided —" }),
      translated
        ? el("div", { class: "q-note" }, [
            el("span", { class: "q-note-label", text: `Translated to English from ${sourceLangName}.` }),
          ])
        : null,
    ]),

    // All submitted answers, in English.
    el("div", { class: "section-label", text: "Intake answers (English)" }),
    ...(rows.length ? rows : [el("div", { class: "muted", text: "No intake recorded." })]),

    el("button", { class: "btn btn-text", onclick: closePanel }, "Close"),
  ]);
}

// ---- QR check-in popup --------------------------------------------------
async function openQrPopup() {
  const host = document.getElementById("modal-host");
  const holder = el("div", { class: "qr-holder" });
  const urlLine = el("div", { class: "qr-url", text: "Loading…" });

  const close = () => { host.innerHTML = ""; };
  const overlay = el("div", { class: "overlay" }, [
    el("div", { class: "popup center" }, [
      el("div", { class: "popup-head" }, [
        el("h2", { text: "Patient check-in" }),
        el("button", { class: "close-x", "aria-label": "Close", onclick: close, text: "✕" }),
      ]),
      el("p", { class: "muted", text: "Ask the patient to scan this with their phone camera to open the intake form." }),
      holder,
      urlLine,
      el("button", { class: "btn btn-outline btn-block", onclick: close }, "Exit"),
    ]),
  ]);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  host.innerHTML = "";
  host.appendChild(overlay);

  try {
    const url = (await triageApi.patientUrl()).url;
    urlLine.textContent = url;
    // eslint-disable-next-line no-undef
    new QRCode(holder, { text: url, width: 240, height: 240, correctLevel: QRCode.CorrectLevel.M });
  } catch {
    urlLine.textContent = "Could not load the check-in URL. Check Settings.";
  }
}

// ---- Notifications popup ------------------------------------------------
async function updateBellBadge() {
  const badge = document.getElementById("bell-badge");
  if (!badge) return;
  const notifs = await triageApi.getNotifications().catch(() => []);
  const unread = (notifs || []).filter((n) => !n.acknowledged).length;
  lastNotifCount = unread;
  if (unread > 0) { badge.textContent = String(unread); badge.hidden = false; }
  else { badge.hidden = true; }
}

async function openNotifications() {
  const host = document.getElementById("modal-host");
  const close = () => { host.innerHTML = ""; renderDashboard(); };

  const listWrap = el("div", { class: "notif-list" }, el("div", { class: "muted", text: "Loading…" }));
  const overlay = el("div", { class: "overlay" }, [
    el("div", { class: "popup" }, [
      el("div", { class: "popup-head" }, [
        el("h2", { text: "Notifications" }),
        el("button", { class: "close-x", "aria-label": "Close", onclick: close, text: "✕" }),
      ]),
      listWrap,
      el("button", { class: "btn btn-outline btn-block", onclick: close }, "Close"),
    ]),
  ]);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  host.innerHTML = "";
  host.appendChild(overlay);

  const notifs = await triageApi.getNotifications().catch(() => []);
  listWrap.innerHTML = "";
  if (!notifs.length) {
    listWrap.appendChild(el("div", { class: "muted", text: "No notifications yet." }));
    return;
  }
  notifs.forEach((n) => {
    const when = new Date(n.createdAt);
    const row = el("div", { class: `notif ${n.acknowledged ? "" : "unread"} ${n.severity === "high" ? "high" : ""}` }, [
      el("div", { class: "notif-body" }, [
        el("div", { class: "notif-msg", text: n.message }),
        el("div", { class: "notif-time", text: when.toLocaleString() }),
      ]),
    ]);
    // Open the related patient and acknowledge the notification.
    row.addEventListener("click", async () => {
      if (!n.acknowledged) { await triageApi.acknowledgeNotification(n.id).catch(() => {}); }
      if (n.sessionId) selectedId = n.sessionId;
      close();
    });
    listWrap.appendChild(row);
  });
}

// ---- Shared pieces ------------------------------------------------------
function connErrorCard() {
  return el("div", { class: "card error" }, [
    el("h2", { text: "Can't reach the server" }),
    el("p", { class: "muted", text: `Tried: ${getServerUrl()}` }),
    el("p", { class: "muted", text: "Make sure the InTake server is running and set its address in Settings." }),
    el("button", { class: "btn btn-primary", onclick: openSettings }, "Open settings"),
  ]);
}

function openSettings() {
  const host = document.getElementById("modal-host");
  const input = el("input", { class: "select", type: "url", value: getServerUrl(), placeholder: "http://192.168.1.50:3001" });
  const status = el("p", { class: "muted", text: "" });
  const close = () => { host.innerHTML = ""; };

  const overlay = el("div", { class: "overlay" }, [
    el("div", { class: "popup sheet" }, [
      el("div", { class: "popup-head" }, [
        el("h2", { text: "Server settings" }),
        el("button", { class: "close-x", "aria-label": "Close", onclick: close, text: "✕" }),
      ]),
      el("p", { class: "muted", text: "Address of the InTake/patient server (the computer running it)." }),
      input,
      status,
      el("div", { class: "row" }, [
        el("button", { class: "btn btn-outline", onclick: close }, "Cancel"),
        el("button", { class: "btn btn-primary", onclick: async () => {
          setServerUrl(input.value.trim());
          status.textContent = "Checking...";
          try { await triageApi.health(); close(); render(); }
          catch { status.textContent = "Still can't reach that address."; }
        } }, "Save & test"),
      ]),
    ]),
  ]);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  host.innerHTML = "";
  host.appendChild(overlay);
}

// ---- Boot ---------------------------------------------------------------
render();
