// =========================================================================
// Shared UI components
// -------------------------------------------------------------------------
// Small reusable pieces used across screens: a page header, a priority badge
// (color + text, never color alone), a trend label, and the emergency-help
// modal that satisfies the concept's safety requirement.
// =========================================================================

import { el, showModal } from "./services/dom.js";

/** Page header with a title and optional right-side actions. */
export function header(title, actions = []) {
  return el("div", { class: "row-between", style: "margin-bottom:20px" }, [
    el("h1", { text: title }),
    el("div", { class: "row" }, actions),
  ]);
}

/** Priority badge: colored box PLUS the text label (accessible). */
export function priorityBadge(priority) {
  return el("span", { class: "priority", dataset: { priority } }, [
    el("span", { class: "dot", "aria-hidden": "true" }),
    priority || "Unassigned",
  ]);
}

/** Symptom trend shown as a labeled, colored word. */
export function trendLabel(trend) {
  const map = {
    worsening: ["trend-worsening", "↑ Worsening"],
    improving: ["trend-improving", "↓ Improving"],
    stable: ["trend-stable", "→ Stable"],
  };
  const [cls, label] = map[trend] || map.stable;
  return el("span", { class: cls, text: label });
}

/** Loading / empty / error state block. */
export function stateBlock(kind, message) {
  const icons = { loading: "⏳", empty: "📭", error: "⚠️", success: "✅" };
  return el("div", { class: "state" }, [
    el("span", { class: "icon", "aria-hidden": "true", text: icons[kind] || "ℹ️" }),
    el("div", { text: message }),
  ]);
}

/**
 * Emergency-help modal. Required safety behavior: when a patient indicates a
 * potentially life-threatening change, we tell them to notify staff NOW and
 * never rely only on the queue/notification path.
 */
export function openEmergencyModal() {
  const content = el("div", { class: "stack" }, [
    el("h2", { text: "Get help now" }),
    el("p", {
      class: "error-text",
      text: "If this is an emergency, tell the nearest ER staff member right away or call for help. Do not wait for the app.",
    }),
    el("p", { class: "subtle", text: "Staff can see your update, but speaking to someone nearby is the fastest way to get help." }),
    el("button", { class: "btn btn-primary btn-block", onClick: () => close() }, "I understand"),
  ]);
  const close = showModal(content);
  return close;
}
