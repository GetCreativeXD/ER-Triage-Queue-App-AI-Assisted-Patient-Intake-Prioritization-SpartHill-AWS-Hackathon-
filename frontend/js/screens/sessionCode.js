// =========================================================================
// Session-code screen
// -------------------------------------------------------------------------
// Instead of creating an account, the patient enters a short code from the
// registration desk / wristband. We create a session and move into intake.
// Input is validated (non-empty, reasonable length) on the client; the
// backend service also owns session creation so the UI stays thin.
// =========================================================================

import { el, mount, navigate } from "../services/dom.js";
import { api } from "../services/apiClient.js";
import { setLanguage, t } from "../services/i18n.js";

/**
 * @param {string} param  language code passed from the welcome screen.
 */
export function renderSessionCode(param) {
  const language = param || "en";
  setLanguage(language);

  const error = el("p", { class: "error-text", text: "" });

  const input = el("input", {
    class: "input",
    type: "text",
    placeholder: "e.g. ER-1042",
    "aria-label": t("sessionTitle"),
    maxlength: "20",
    onkeydown: (e) => { if (e.key === "Enter") start(); },
  });

  /** Validate the code, create a session, and go to intake. */
  async function start() {
    const code = input.value.trim();
    if (code.length < 3) {
      error.textContent = "Please enter the code from the registration desk.";
      return;
    }
    try {
      const session = await api.createSession(code, language);
      navigate(`/intake/${session.id}`);
    } catch (e) {
      error.textContent = "Could not start a session. Please try again.";
    }
  }

  const card = el("div", { class: "card stack" }, [
    el("h1", { text: t("sessionTitle") }),
    el("p", { class: "subtle", text: t("sessionHelp") }),
    el("div", { class: "field" }, [input]),
    error,
    el("button", { class: "btn btn-primary btn-lg btn-block", onClick: start }, t("start")),
    el("p", { class: "center" }, [el("a", { href: "#/welcome" }, "← Change language")]),
  ]);

  mount(card);
}
