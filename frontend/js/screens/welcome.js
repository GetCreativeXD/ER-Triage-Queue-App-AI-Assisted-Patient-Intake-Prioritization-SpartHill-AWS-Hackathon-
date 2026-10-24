// =========================================================================
// Welcome / language selection screen (patient website)
// -------------------------------------------------------------------------
// The patient arrives here after scanning the triage app's QR code. They pick
// one of four languages from a dropdown, then continue straight into intake —
// there is no session-code step. We create the session in the background (the
// patient never sees an internal code) and the backend assigns the 4-digit
// patient number shown on the success screen. The chosen language is stored so
// it stays fixed for every question that follows.
// =========================================================================

import { el, mount, navigate } from "../services/dom.js";
import { LANGUAGES } from "../config.js";
import { setLanguage, getLanguage, t } from "../services/i18n.js";

export function renderWelcome() {
  let selected = getLanguage() || "en";

  // ---- Language dropdown (four languages) ------------------------------
  const select = el("select", { class: "input lang-select", "aria-label": t("languagePrompt") },
    LANGUAGES.map((lang) =>
      el("option", { value: lang.code, text: `${lang.native} (${lang.label})` })
    )
  );
  select.value = selected;
  select.addEventListener("change", () => {
    selected = select.value;
    setLanguage(selected);         // switch UI strings live
    refresh();                     // re-render so labels update immediately
  });

  const error = el("p", { class: "error-text center", text: "" });

  const continueBtn = el("button", {
    class: "btn btn-primary btn-lg btn-block",
    onClick: start,
  }, t("continue"));

  /** Create a session and go straight into intake. */
  async function start() {
    setLanguage(selected);
    continueBtn.disabled = true;
    try {
      // Internal, patient-invisible code used only as a session label.
      const code = "PT-" + Date.now().toString(36).toUpperCase();
      const { api } = await import("../services/apiClient.js");
      const session = await api.createSession(code, selected);
      navigate(`/intake/${session.id}`);
    } catch {
      continueBtn.disabled = false;
      error.textContent = "Could not start. Please try again.";
    }
  }

  function refresh() {
    const card = el("div", { class: "card stack welcome-card" }, [
      el("div", { class: "brand-mark", "aria-hidden": "true", text: "✚" }),
      el("h1", { text: t("welcomeTitle") }),
      el("p", { class: "subtle", text: t("welcomeIntro") }),
      el("div", { class: "field" }, [
        el("label", { text: t("languagePrompt") }),
        select,
      ]),
      continueBtn,
      error,
    ]);

    // Small demo convenience link to the staff/triage view.
    const staffLink = el("p", { class: "center subtle", style: "margin-top:16px" }, [
      el("a", { href: "#/nurse" }, "Staff / triage view"),
    ]);

    mount(card, staffLink);
    continueBtn.textContent = t("continue");
  }

  refresh();
}
