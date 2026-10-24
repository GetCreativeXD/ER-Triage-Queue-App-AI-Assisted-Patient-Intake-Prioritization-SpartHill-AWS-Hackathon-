// =========================================================================
// Nurse dashboard
// -------------------------------------------------------------------------
// The scanable, single-screen staff view: a live priority queue on the left,
// a detail/action panel on the right, and a notifications strip on top. The
// nurse can confirm or override the system recommendation, change patient
// status, and acknowledge alerts. The queue auto-refreshes on a short timer
// so patient updates appear without a manual reload.
// =========================================================================

import { el, mount } from "../services/dom.js";
import { api } from "../services/apiClient.js";
import { header, priorityBadge, trendLabel, stateBlock } from "../components.js";
import { PRIORITY, STATUS } from "../../../shared/schemas.js";

// Which patient is open in the detail panel (persists across refreshes).
let selectedId = null;
// Timer handle so we can stop polling when leaving the screen.
let refreshTimer = null;

export async function renderNurse() {
  await draw();

  // Live updates: re-draw every few seconds. Cleared on hash change.
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (window.location.hash.startsWith("#/nurse")) draw();
    else clearInterval(refreshTimer);
  }, 4000);
}

/** Render (or re-render) the whole dashboard from current data. */
async function draw() {
  // Fetch all data up front so the render helpers stay synchronous.
  const [queue, notifications] = await Promise.all([
    api.getQueue(),
    api.getNotifications(),
  ]);
  const detail = selectedId ? await api.getPatientDetail(selectedId).catch(() => null) : null;

  const layout = el("div", { class: "nurse-layout" }, [
    el("div", { class: "stack" }, [notificationStrip(notifications), queueCard(queue)]),
    detailPanel(detail),
  ]);

  mount(
    header("Nurse dashboard", [
      el("button", { class: "btn btn-outline", onClick: async () => { await api.resetDemo(); selectedId = null; draw(); } }, "Reset demo"),
      el("a", { class: "btn btn-outline", href: "#/welcome" }, "Patient view"),
    ]),
    summaryBar(queue, notifications),
    layout
  );
}

/** Top row of quick counts for at-a-glance situational awareness. */
function summaryBar(queue, notifications) {
  const waiting = queue.length;
  const immediate = queue.filter((q) => q.priority === PRIORITY.IMMEDIATE).length;
  const changed = queue.filter((q) => q.needsNurseReview).length;
  const unack = notifications.filter((n) => !n.acknowledged).length;

  const stat = (label, value, danger = false) =>
    el("div", { class: "card", style: "flex:1;text-align:center;padding:14px" }, [
      el("div", { style: `font-size:1.8rem;font-weight:700;${danger && value > 0 ? "color:var(--p-immediate)" : ""}`, text: String(value) }),
      el("div", { class: "subtle", text: label }),
    ]);

  return el("div", { class: "row", style: "margin-bottom:16px" }, [
    stat("Waiting", waiting),
    stat("Immediate review", immediate, true),
    stat("Condition changed", changed, true),
    stat("Unread alerts", unack, true),
  ]);
}

/** Notifications strip; high-severity alerts are visually distinct. */
function notificationStrip(notifications) {
  const unread = notifications.filter((n) => !n.acknowledged);
  if (!unread.length) {
    return el("div", { class: "card" }, [stateBlock("success", "No new notifications.")]);
  }
  return el("div", { class: "card stack" }, [
    el("h2", { text: `Notifications (${unread.length})` }),
    ...unread.slice(0, 6).map((n) =>
      el("div", { class: `notif ${n.severity === "high" ? "high" : ""}` }, [
        el("div", { class: "row-between" }, [
          el("strong", { text: n.message }),
          el("button", {
            class: "btn btn-outline",
            onClick: async () => { await api.acknowledgeNotification(n.id); draw(); },
          }, "Acknowledge"),
        ]),
        el("div", { class: "subtle", text: new Date(n.createdAt).toLocaleTimeString() }),
      ])
    ),
  ]);
}

/** The sorted priority queue table. */
function queueCard(queue) {
  if (!queue.length) {
    return el("div", { class: "card" }, [stateBlock("empty", "No patients in the queue yet.")]);
  }

  const rows = queue.map((q) => {
    const name = [q.firstName, q.lastName].filter(Boolean).join(" ") || "—";
    const tr = el("tr", { class: q.needsNurseReview ? "needs-review" : "", onClick: () => { selectedId = q.sessionId; draw(); } }, [
      el("td", { text: String(q.position) }),
      el("td", {}, [el("strong", { text: "#" + (q.patientNumber || "----") })]),
      el("td", {}, [
        el("span", { text: name }),
        q.needsNurseReview ? el("span", { class: "badge badge-changed", style: "margin-left:8px", text: "Changed" }) : null,
      ]),
      el("td", {}, [priorityBadge(q.priority)]),
      el("td", {}, [trendLabel(q.symptomTrend)]),
      el("td", { text: waitingMinutes(q.waitingSince) + " min" }),
      el("td", { class: "subtle", text: new Date(q.lastUpdatedAt).toLocaleTimeString() }),
    ]);
    return tr;
  });

  return el("div", { class: "card" }, [
    el("h2", { text: "Priority queue" }),
    el("table", { class: "queue-table" }, [
      el("thead", {}, [
        el("tr", {}, ["#", "Patient #", "Name", "Priority", "Trend", "Waiting", "Last update"].map((h) => el("th", { text: h }))),
      ]),
      el("tbody", {}, rows),
    ]),
  ]);
}

/** Right-hand detail + actions panel for the selected patient.
 *  Receives pre-fetched detail data so it can stay synchronous. */
function detailPanel(detail) {
  if (!selectedId) {
    return el("div", { class: "card" }, [stateBlock("empty", "Select a patient to see details.")]);
  }
  if (!detail) return el("div", { class: "card" }, [stateBlock("error", "Patient not found.")]);

  const { session, intake, updates } = detail;

  // Intake answers list.
  const intakeList = intake.length
    ? intake.map((r) => el("div", { class: "subtle" }, [el("strong", { text: r.questionId + ": " }), String(r.answer)]))
    : [el("p", { class: "subtle", text: "No intake recorded." })];

  // Update timeline.
  const timeline = updates.length
    ? updates.map((u) =>
        el("div", { style: "border-left:3px solid var(--color-border);padding-left:10px;margin:8px 0" }, [
          el("div", {}, [trendLabel(u.trend), el("span", { text: ` severity ${u.severity}` })]),
          u.description ? el("div", { class: "subtle", text: u.description }) : null,
          el("div", { class: "subtle", text: new Date(u.createdAt).toLocaleTimeString() }),
        ])
      )
    : [el("p", { class: "subtle", text: "No updates yet." })];

  // Status action buttons — short, specific verbs.
  const statusBtn = (label, status) =>
    el("button", { class: "btn btn-outline", onClick: async () => { await api.setStatus(session.id, status); draw(); } }, label);

  const name = [session.firstName, session.lastName].filter(Boolean).join(" ") || "Unnamed patient";

  return el("div", { class: "card stack" }, [
    el("div", { class: "row-between" }, [
      el("div", {}, [
        el("h2", { text: "#" + (session.patientNumber || "----") }),
        el("div", { class: "subtle", text: name }),
      ]),
      priorityBadge(session.currentPriority),
    ]),

    el("p", {}, [el("strong", { text: "Why this priority: " }), el("span", { text: session.priorityReason || "—" })]),
    el("p", { class: "subtle", text: "System recommendation — accept it or sort patients below." }),

    // Accept recommendation / sort patients (one-tap change of priority).
    el("div", { class: "row" }, [
      el("button", { class: "btn btn-primary", onClick: async () => { await api.confirmPriority(session.id); draw(); } }, "Accept priority"),
      sortPatientsSelect(session.id),
    ]),

    el("h2", { text: "Intake summary" }),
    ...intakeList,
    session.aiSummary ? el("p", { class: "subtle" }, [el("em", { text: "AI summary: " + session.aiSummary })]) : null,

    el("h2", { text: "Update timeline" }),
    ...timeline,

    el("h2", { text: "Set status" }),
    el("div", { class: "row" }, [
      statusBtn("Call now", STATUS.CALLED),
      statusBtn("Start care", STATUS.BEING_SEEN),
      statusBtn("Recheck", STATUS.RECHECK),
      statusBtn("Finish", STATUS.COMPLETED),
      statusBtn("Mark away", STATUS.UNAVAILABLE),
    ]),
  ]);
}

/** One-tap "Sort patients" control: changing the priority re-sorts the queue
 *  immediately. Replaces the old multi-step "override" dropdown. */
function sortPatientsSelect(sessionId) {
  const select = el("select", { class: "input", style: "max-width:220px" }, [
    el("option", { value: "", text: "Sort patients…" }),
    ...Object.values(PRIORITY).map((p) => el("option", { value: p, text: "Set: " + p })),
  ]);
  select.addEventListener("change", async () => {
    if (select.value) { await api.overridePriority(sessionId, select.value, "Nurse sorted from dashboard."); draw(); }
  });
  return select;
}

/** Whole minutes a patient has been waiting. */
function waitingMinutes(since) {
  return Math.max(0, Math.round((Date.now() - new Date(since)) / 60000));
}
