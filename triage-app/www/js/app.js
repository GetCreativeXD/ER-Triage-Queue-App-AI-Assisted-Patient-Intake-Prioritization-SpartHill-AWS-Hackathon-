// =========================================================================
// Triage app - main logic (Capacitor native app)
// -------------------------------------------------------------------------
// Two tabs:
//   Queue       - live priority list (patient number + name), one-tap sort.
//   Check-in QR - a QR code the patient scans to open the intake website.
// A settings modal sets the backend server URL (the staff machine's address).
// =========================================================================

import { triageApi, getServerUrl, setServerUrl } from "./api.js";

const PRIORITIES = ["Immediate review", "Very urgent", "Urgent", "Standard", "Low urgency"];
const view = document.getElementById("view");

let activeTab = "queue";
let selectedId = null;
let refreshTimer = null;

// ---- Tiny DOM helper (local to the native app) --------------------------
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

function waitingMinutes(since) {
  return Math.max(0, Math.round((Date.now() - new Date(since)) / 60000));
}

// ---- Tab wiring ---------------------------------------------------------
function setTab(tab) {
  activeTab = tab;
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  render();
}

document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));
document.getElementById("settings-btn").addEventListener("click", openSettings);

// ---- Render dispatch ----------------------------------------------------
async function render() {
  clearInterval(refreshTimer);
  if (activeTab === "queue") {
    await renderQueue();
    refreshTimer = setInterval(() => { if (activeTab === "queue") renderQueue(); }, 4000);
  } else {
    await renderQr();
  }
}

// ---- Queue tab ----------------------------------------------------------
async function renderQueue() {
  let queue;
  try {
    queue = await triageApi.getQueue();
  } catch {
    view.innerHTML = "";
    view.appendChild(connErrorCard());
    return;
  }

  const detail = selectedId ? await triageApi.getPatientDetail(selectedId).catch(() => null) : null;

  view.innerHTML = "";
  view.appendChild(summaryBar(queue));

  if (!queue.length) {
    view.appendChild(el("div", { class: "card empty" }, "No patients in the queue yet."));
    return;
  }

  const list = el("div", { class: "queue-list" }, queue.map((q) => {
    const name = [q.firstName, q.lastName].filter(Boolean).join(" ") || "Unnamed";
    return el("button", { class: `queue-row prio-${slug(q.priority)} ${q.needsNurseReview ? "changed" : ""}`, onclick: () => { selectedId = q.sessionId; renderQueue(); } }, [
      el("div", { class: "qr-num", text: "#" + (q.patientNumber || "----") }),
      el("div", { class: "qr-main" }, [
        el("div", { class: "qr-name", text: name }),
        el("div", { class: "qr-sub", text: `${q.priority} · ${waitingMinutes(q.waitingSince)} min` }),
      ]),
      q.needsNurseReview ? el("span", { class: "chip", text: "Changed" }) : null,
    ]);
  }));
  view.appendChild(list);

  if (detail) view.appendChild(detailCard(detail));
}

function summaryBar(queue) {
  const immediate = queue.filter((q) => q.priority === "Immediate review").length;
  const changed = queue.filter((q) => q.needsNurseReview).length;
  const stat = (label, value, danger) => el("div", { class: `stat ${danger && value > 0 ? "danger" : ""}` }, [
    el("div", { class: "stat-num", text: String(value) }),
    el("div", { class: "stat-label", text: label }),
  ]);
  return el("div", { class: "statbar" }, [
    stat("Waiting", queue.length, false),
    stat("Immediate", immediate, true),
    stat("Changed", changed, true),
  ]);
}

function detailCard(detail) {
  const { session, intake } = detail;
  const name = [session.firstName, session.lastName].filter(Boolean).join(" ") || "Unnamed patient";

  const intakeList = (intake && intake.length)
    ? intake.map((r) => el("div", { class: "kv" }, [el("span", { class: "k", text: r.questionId }), el("span", { class: "v", text: String(r.answer) })]))
    : [el("div", { class: "muted", text: "No intake recorded." })];

  // One-tap "Sort patients": pick a priority and the queue re-sorts.
  const sortSelect = el("select", { class: "select" }, [
    el("option", { value: "", text: "Sort patients…" }),
    ...PRIORITIES.map((p) => el("option", { value: p, text: "Set: " + p })),
  ]);
  sortSelect.addEventListener("change", async () => {
    if (sortSelect.value) { await triageApi.sortPatient(session.id, sortSelect.value); renderQueue(); }
  });

  const statusBtn = (label, status) => el("button", { class: "btn btn-outline", onclick: async () => { await triageApi.setStatus(session.id, status); renderQueue(); } }, label);

  return el("div", { class: "card detail" }, [
    el("div", { class: "detail-head" }, [
      el("div", {}, [el("div", { class: "detail-num", text: "#" + (session.patientNumber || "----") }), el("div", { class: "muted", text: name })]),
      el("span", { class: `pill prio-${slug(session.currentPriority)}`, text: session.currentPriority || "Unassigned" }),
    ]),
    el("div", { class: "reason", text: session.priorityReason || "" }),
    session.aiSummary ? el("div", { class: "summary" }, [el("strong", { text: "Summary: " }), session.aiSummary]) : null,
    el("div", { class: "section-label", text: "Intake" }),
    ...intakeList,
    el("div", { class: "section-label", text: "Priority" }),
    el("div", { class: "row" }, [
      el("button", { class: "btn btn-primary", onclick: async () => { await triageApi.confirmPriority(session.id); renderQueue(); } }, "Accept"),
      sortSelect,
    ]),
    el("div", { class: "section-label", text: "Status" }),
    el("div", { class: "row wrap" }, [
      statusBtn("Call now", "called"),
      statusBtn("Start care", "being-seen"),
      statusBtn("Recheck", "recheck"),
      statusBtn("Finish", "completed"),
      statusBtn("Away", "unavailable"),
    ]),
    el("button", { class: "btn btn-text", onclick: () => { selectedId = null; renderQueue(); } }, "Close"),
  ]);
}

// ---- Check-in QR tab ----------------------------------------------------
async function renderQr() {
  view.innerHTML = "";
  const card = el("div", { class: "card qr-card center" }, [
    el("h2", { text: "Patient check-in" }),
    el("p", { class: "muted", text: "Ask the patient to scan this with their phone camera to start the intake form." }),
  ]);
  const holder = el("div", { class: "qr-holder" });
  card.appendChild(holder);
  const urlLine = el("div", { class: "qr-url muted", text: "" });
  card.appendChild(urlLine);
  view.appendChild(card);

  let url;
  try {
    url = (await triageApi.patientUrl()).url;
  } catch {
    view.innerHTML = "";
    view.appendChild(connErrorCard());
    return;
  }

  urlLine.textContent = url;
  // eslint-disable-next-line no-undef
  new QRCode(holder, { text: url, width: 240, height: 240, correctLevel: QRCode.CorrectLevel.M });
}

// ---- Shared pieces ------------------------------------------------------
function connErrorCard() {
  return el("div", { class: "card error" }, [
    el("h2", { text: "Can't reach the server" }),
    el("p", { class: "muted", text: `Tried: ${getServerUrl()}` }),
    el("p", { class: "muted", text: "Make sure the triage server is running and set its address in Settings." }),
    el("button", { class: "btn btn-primary", onclick: openSettings }, "Open settings"),
  ]);
}

function openSettings() {
  const host = document.getElementById("modal-host");
  const input = el("input", { class: "select", type: "url", value: getServerUrl(), placeholder: "http://192.168.1.50:3001" });
  const status = el("p", { class: "muted", text: "" });

  const overlay = el("div", { class: "overlay" }, [
    el("div", { class: "sheet" }, [
      el("h2", { text: "Server settings" }),
      el("p", { class: "muted", text: "Address of the triage/patient server (the computer running it)." }),
      input,
      status,
      el("div", { class: "row" }, [
        el("button", { class: "btn btn-outline", onclick: () => { host.innerHTML = ""; } }, "Cancel"),
        el("button", { class: "btn btn-primary", onclick: async () => {
          setServerUrl(input.value.trim());
          status.textContent = "Checking...";
          try { await triageApi.health(); host.innerHTML = ""; render(); }
          catch { status.textContent = "Still can't reach that address."; }
        } }, "Save & test"),
      ]),
    ]),
  ]);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) host.innerHTML = ""; });
  host.innerHTML = "";
  host.appendChild(overlay);
}

function slug(priority) {
  return (priority || "unassigned").toLowerCase().replace(/[^a-z]+/g, "-");
}

// ---- Boot ---------------------------------------------------------------
setTab("queue");
