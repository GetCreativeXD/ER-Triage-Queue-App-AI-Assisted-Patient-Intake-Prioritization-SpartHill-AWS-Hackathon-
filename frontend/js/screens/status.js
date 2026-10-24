// =========================================================================
// Patient status + condition-update screen
// -------------------------------------------------------------------------
// After intake, the patient sees a calm status page with a prominent
// "Has your condition changed?" action. Selecting "I need help now" opens the
// emergency modal immediately (never relying only on the queue/notification).
// Other choices open a short follow-up that recalculates priority and alerts
// the nurse via the backend service.
// =========================================================================

import { el, mount, navigate } from "../services/dom.js";
import { api } from "../services/apiClient.js";
import { priorityBadge, openEmergencyModal } from "../components.js";
import { WARNING_SIGNS } from "../data/questions.js";
import { voiceService } from "../services/voiceService.js";
import { getLanguage } from "../services/i18n.js";

export async function renderStatus(sessionId) {
  let session;
  try {
    session = await api.getSession(sessionId);
  } catch { session = null; }
  if (!session) { navigate("/welcome"); return; }

  // The update sub-form is toggled in place to avoid an extra navigation.
  const panel = el("div", {});

  function showSummary() {
    panel.innerHTML = "";
    panel.appendChild(el("div", { class: "stack" }, [
      el("p", { text: "You are in the queue. A nurse can see your information." }),
      el("div", { class: "row-between" }, [
        el("span", { class: "subtle", text: "Your current priority (nurse-reviewed):" }),
        priorityBadge(session.currentPriority),
      ]),
      el("p", { class: "subtle", text: "This is a system suggestion that the nurse confirms. Priority can change." }),
    ]));
  }

  /** Render the condition-update choices. */
  function showUpdateChoices() {
    panel.innerHTML = "";
    const choices = [
      { label: "I feel worse", trend: "worsening" },
      { label: "I feel better", trend: "improving" },
      { label: "My symptoms changed", trend: "stable" },
    ];
    const buttons = choices.map((c) =>
      el("button", { class: "btn btn-outline btn-lg btn-block", onClick: () => showFollowUp(c.trend) }, c.label)
    );
    // "I need help now" is a distinct, high-visibility danger action.
    const helpBtn = el("button", {
      class: "btn btn-danger btn-lg btn-block",
      onClick: () => handleImmediateHelp(),
    }, "I need help now");

    panel.appendChild(el("div", { class: "stack" }, [...buttons, helpBtn]));
  }

  /** Short follow-up: severity + optional note, then submit the update. */
  function showFollowUp(trend) {
    // Severity as colored circular buttons (green -> yellow/orange -> red).
    let severity = 5;
    const scale = el("div", { class: "severity-scale" });
    for (let n = 0; n <= 10; n++) {
      const ratio = n / 10;
      const level = ratio <= 0.3 ? "safe" : ratio <= 0.6 ? "moderate" : "danger";
      const dot = el("button", { class: "severity-dot", dataset: { level }, "aria-label": `Severity ${n}`, text: String(n) });
      if (n === severity) dot.classList.add("selected");
      dot.addEventListener("click", () => {
        severity = n;
        [...scale.children].forEach((c) => c.classList.remove("selected"));
        dot.classList.add("selected");
      });
      scale.appendChild(dot);
    }

    // Let the patient flag condensed warning-sign categories on an update too.
    const signSet = new Set();
    const signButtons = WARNING_SIGNS.map((w) => {
      const b = el("button", { class: "btn btn-outline choice", text: w.label });
      b.addEventListener("click", () => {
        signSet.has(w.id) ? signSet.delete(w.id) : signSet.add(w.id);
        b.classList.toggle("selected", signSet.has(w.id));
      });
      return b;
    });

    const note = el("textarea", { class: "input", placeholder: "Describe the change (optional)" });
    const micStatus = el("p", { class: "subtle center mic-status", text: "Tap the mic and speak, or type." });
    const { button: micBtn } = voiceService.createMicWidget({
      language: getLanguage(),
      getBaseText: () => note.value,
      onText: (text) => { note.value = text; },
      onStatus: (m) => { micStatus.textContent = m; },
    });

    const error = el("p", { class: "error-text", text: "" });

    async function submit() {
      try {
        // Expand categories into the critical sign ids the rules understand.
        const warningSigns = [];
        signSet.forEach((id) => {
          const cat = WARNING_SIGNS.find((w) => w.id === id);
          if (cat) warningSigns.push(...cat.maps);
        });
        await api.submitUpdate(sessionId, {
          trend,
          severity,
          description: note.value.trim(),
          warningSigns,
          immediateHelp: false,
        });
        // If a critical sign was reported, still strongly advise staff contact.
        if (signSet.size > 0) openEmergencyModal();
        await showConfirmation();
      } catch {
        error.textContent = "Could not send your update. Please tell nearby staff.";
      }
    }

    panel.innerHTML = "";
    panel.appendChild(el("div", { class: "stack" }, [
      el("h2", { text: "How severe is it now?" }),
      scale,
      el("div", { class: "severity-legend row-between" }, [
        el("span", { class: "subtle", text: "None" }),
        el("span", { class: "subtle", text: "Worst" }),
      ]),
      el("h2", { text: "Any of these now?" }),
      el("div", { class: "grid-options" }, signButtons),
      el("label", { text: "Describe the change" }),
      note,
      el("div", { class: "mic-block center stack" }, [micBtn, micStatus]),
      error,
      el("div", { class: "row" }, [
        el("button", { class: "btn btn-outline", onClick: showUpdateChoices }, "Back"),
        el("button", { class: "btn btn-primary", style: "flex:1", onClick: submit }, "Send update"),
      ]),
    ]));
  }

  /** Immediate-help path: warn first, then record and alert the nurse. */
  async function handleImmediateHelp() {
    openEmergencyModal(); // safety-first: tell them to get staff NOW
    await api.submitUpdate(sessionId, {
      trend: "worsening", severity: 10, description: "Patient requested immediate help.",
      warningSigns: [], immediateHelp: true,
    });
  }

  async function showConfirmation() {
    panel.innerHTML = "";
    const updated = await api.getSession(sessionId);
    panel.appendChild(el("div", { class: "stack" }, [
      el("p", { class: "success-text", text: "Thank you. Your update was sent to the nurse." }),
      el("div", { class: "row-between" }, [
        el("span", { class: "subtle", text: "Updated priority suggestion:" }),
        priorityBadge(updated.currentPriority),
      ]),
      el("button", { class: "btn btn-outline btn-block", onClick: showSummary }, "Back to status" ),
    ]));
  }

  // ---- Page layout ------------------------------------------------------
  showSummary();
  const card = el("div", { class: "card stack" }, [
    el("h1", { text: "You're checked in" }),
    el("p", { class: "subtle", text: `Session ${session.sessionCode}` }),
    panel,
    el("hr", { style: "border:none;border-top:1px solid var(--color-border)" }),
    el("h2", { text: "Has your condition changed?" }),
    el("button", { class: "btn btn-primary btn-block", onClick: showUpdateChoices }, "Report a change"),
    el("p", { class: "error-text center", text: "For severe or sudden symptoms, tell ER staff right away." }),
  ]);

  mount(card);
}
