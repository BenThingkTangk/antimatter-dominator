/*
 * ATOMLoader · ESM entrypoint
 * Pair with the markup in components/atom-loader.html.
 *
 * Usage:
 *   import { ATOMLoader } from "@nirmata/atom-design-system/loader";
 *   ATOMLoader.init({ duration: 2500, autoStart: true });
 */

const STATE = { duration: 2500, el: null };

function getDocument() {
  return typeof document === "undefined" ? null : document;
}

function getWindow() {
  return typeof window === "undefined" ? null : window;
}

function getEl() {
  const doc = getDocument();
  if (!doc) return null;
  if (!STATE.el) STATE.el = doc.getElementById("atom-loader");
  return STATE.el;
}

function show() {
  const el = getEl();
  if (!el) return;
  el.setAttribute("aria-hidden", "false");
  el.style.display = "";
}

function hide() {
  const el = getEl();
  if (!el) return;
  el.setAttribute("aria-hidden", "true");
}

function play(opts = {}) {
  const win = getWindow();
  const duration = typeof opts.duration === "number" ? opts.duration : STATE.duration;
  show();
  if (win) win.setTimeout(hide, duration);
}

function init(opts = {}) {
  const doc = getDocument();
  const win = getWindow();
  if (typeof opts.duration === "number") STATE.duration = opts.duration;
  if (win) win.ATOMLoader = ATOMLoader;
  if (!doc || opts.autoStart === false) return;

  if (doc.readyState === "complete" || doc.readyState === "interactive") {
    play({ duration: STATE.duration });
  } else {
    doc.addEventListener("DOMContentLoaded", () => {
      play({ duration: STATE.duration });
    });
  }
}

export const ATOMLoader = { init, show, hide, play };
export default ATOMLoader;
