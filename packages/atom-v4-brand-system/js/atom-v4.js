/* ============================================================
   ΔTOM Brand / Experience System — V4 runtime
   - Inlines the canonical orbital mark (animated, premium, slow)
   - Loader/splash demo controller
   - Optional theme toggle (V4 is dark-first; light is a fallback shell)
   - Respects prefers-reduced-motion
   @nirmata/atom-v4-brand-system 4.0.0
   ============================================================ */
(function (global) {
  "use strict";

  var CYAN = "#39bfc0";
  var prefersReduced = global.matchMedia &&
    global.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- SVG factories (no external file needed) ---- */
  function svgEl(tag, attrs) {
    var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  // Canonical orbital mark; animated unless reduced motion.
  function buildOrbital(opts) {
    opts = opts || {};
    var animate = opts.animate !== false && !prefersReduced;
    var svg = svgEl("svg", {
      viewBox: "0 0 120 120", width: opts.size || 120, height: opts.size || 120,
      role: "img", "aria-label": "ΔTOM orbital mark", class: "atom-orbit"
    });
    var defs = svgEl("defs", {});
    var grad = svgEl("radialGradient", { id: "atom-rt-nuc", cx: "50%", cy: "50%", r: "50%" });
    [["0%", "#ffffff", 1], ["35%", "#c8f3f3", 1], ["65%", CYAN, 0.95], ["100%", CYAN, 0]]
      .forEach(function (s) {
        grad.appendChild(svgEl("stop", { offset: s[0], "stop-color": s[1], "stop-opacity": s[2] }));
      });
    defs.appendChild(grad); svg.appendChild(defs);

    var orbits = svgEl("g", {
      fill: "none", stroke: CYAN, "stroke-width": 2.2,
      "stroke-linecap": "round", "stroke-linejoin": "round",
      class: animate ? "orbits" : ""
    });
    [0, 60, 120].forEach(function (deg) {
      orbits.appendChild(svgEl("ellipse", {
        cx: 60, cy: 60, rx: 46, ry: 17,
        transform: deg ? "rotate(" + deg + " 60 60)" : ""
      }));
    });
    svg.appendChild(orbits);

    var nuc = svgEl("g", { class: animate ? "nucleus" : "" });
    nuc.appendChild(svgEl("circle", { cx: 60, cy: 60, r: 8, fill: "url(#atom-rt-nuc)" }));
    nuc.appendChild(svgEl("circle", { cx: 60, cy: 60, r: 2.2, fill: "#ffffff" }));
    svg.appendChild(nuc);
    return svg;
  }

  /* ---- Mount any [data-atom-orbit] placeholders ---- */
  function mountOrbits(root) {
    (root || document).querySelectorAll("[data-atom-orbit]").forEach(function (el) {
      if (el.__atomMounted) return;
      var size = parseInt(el.getAttribute("data-atom-orbit"), 10) || 120;
      var animate = el.getAttribute("data-animate") !== "false";
      el.appendChild(buildOrbital({ size: size, animate: animate }));
      el.__atomMounted = true;
    });
  }

  /* ---- Loader demo: shows splash, fakes progress, then reveals ---- */
  function runLoaderDemo(opts) {
    opts = opts || {};
    var el = typeof opts.target === "string" ? document.querySelector(opts.target) : opts.target;
    if (!el) return;
    el.style.opacity = "1";
    el.style.display = "flex";
    var dur = opts.duration || 2400;
    if (prefersReduced) dur = 600;
    setTimeout(function () {
      el.style.transition = "opacity .6s ease";
      el.style.opacity = "0";
      setTimeout(function () { el.style.display = "none"; if (opts.onDone) opts.onDone(); }, 600);
    }, dur);
  }

  /* ---- Theme toggle (dark-first; class on <html>) ---- */
  function toggleTheme(force) {
    var root = document.documentElement;
    var isLight = force != null ? force : !root.classList.contains("atom-light");
    root.classList.toggle("atom-light", isLight);
    return isLight ? "light" : "dark";
  }

  /* ---- Count-up for KPI values ---- */
  function countUp(el, to, dur) {
    if (prefersReduced) { el.textContent = to; return; }
    var start = performance.now(); dur = dur || 1200;
    function tick(now) {
      var p = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (to % 1 === 0 ? Math.round(to * eased) : (to * eased).toFixed(1));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function init() {
    mountOrbits(document);
    document.querySelectorAll("[data-atom-countup]").forEach(function (el) {
      countUp(el, parseFloat(el.getAttribute("data-atom-countup")));
    });
  }

  var ATOMV4 = {
    buildOrbital: buildOrbital,
    mountOrbits: mountOrbits,
    runLoaderDemo: runLoaderDemo,
    toggleTheme: toggleTheme,
    countUp: countUp,
    init: init,
    prefersReducedMotion: prefersReduced,
    CYAN: CYAN
  };

  global.ATOMV4 = ATOMV4;
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})(window);
