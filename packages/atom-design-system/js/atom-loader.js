/*
 * ATOMLoader · standalone JS module
 * Pair with the markup in components/atom-loader.html (and its inline <style>).
 *
 * API exposed on window.ATOMLoader:
 *   init({ duration?: number = 2500, autoStart?: boolean = true })
 *   show()
 *   hide()
 *   play({ duration?: number })
 */
(function () {
  var STATE = { duration: 2500, el: null };

  function getEl() {
    if (!STATE.el) STATE.el = document.getElementById('atom-loader');
    return STATE.el;
  }

  function show() {
    var el = getEl();
    if (!el) return;
    el.setAttribute('aria-hidden', 'false');
    el.style.display = '';
  }

  function hide() {
    var el = getEl();
    if (!el) return;
    el.setAttribute('aria-hidden', 'true');
  }

  function play(opts) {
    var d = (opts && typeof opts.duration === 'number') ? opts.duration : STATE.duration;
    show();
    window.setTimeout(hide, d);
  }

  function init(opts) {
    opts = opts || {};
    if (typeof opts.duration === 'number') STATE.duration = opts.duration;
    if (opts.autoStart !== false) {
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        play({ duration: STATE.duration });
      } else {
        document.addEventListener('DOMContentLoaded', function () {
          play({ duration: STATE.duration });
        });
      }
    }
  }

  window.ATOMLoader = { init: init, show: show, hide: hide, play: play };
})();
