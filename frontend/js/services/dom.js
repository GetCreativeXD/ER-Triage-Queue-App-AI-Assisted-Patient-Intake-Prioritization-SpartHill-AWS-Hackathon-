// =========================================================================
// Tiny DOM helpers
// -------------------------------------------------------------------------
// Minimal utilities so screen modules can build UI without a framework and
// without repeating boilerplate. `el` creates elements, `mount` swaps the
// app container's contents, and `navigate` changes the hash route.
// =========================================================================

/**
 * Create a DOM element.
 * @param {string} tag
 * @param {Object} [attrs]  attributes; `class`, `html`, `text`, `on*` handlers.
 * @param {Array|Node|string} [children]
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key === "html") node.innerHTML = value;
    else if (key === "text") node.textContent = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value !== null && value !== undefined && value !== false) {
      node.setAttribute(key, value);
    }
  }
  const kids = Array.isArray(children) ? children : [children];
  kids.forEach((c) => {
    if (c == null) return;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return node;
}

/** Replace the main app container's contents with the given node(s). */
export function mount(...nodes) {
  const root = document.getElementById("app");
  root.innerHTML = "";
  nodes.forEach((n) => root.appendChild(n));
  root.scrollTop = 0;
}

/** Navigate to a hash route, e.g. navigate("/nurse"). */
export function navigate(path) { window.location.hash = "#" + path; }

/** Show a modal dialog in the shared modal host. Returns a close() function. */
export function showModal(contentNode) {
  const host = document.getElementById("modal-host");
  const overlay = el("div", { class: "modal-overlay", role: "dialog", "aria-modal": "true" }, [
    el("div", { class: "modal" }, [contentNode]),
  ]);
  const close = () => { host.innerHTML = ""; };
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  host.innerHTML = "";
  host.appendChild(overlay);
  return close;
}
