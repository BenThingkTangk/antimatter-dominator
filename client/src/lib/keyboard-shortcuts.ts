/**
 * Leader-key state machine + Cmd/Ctrl+K command palette trigger.
 *
 * Press `g` to enter leader mode, then within 1.2s press a second key
 * to navigate:  g→h (home/pitch), g→c (campaigns), g→w (war room),
 * g→p (prospects), g→d (dialer/leadgen), g→m (market intent),
 * g→b (billing), g→s (sonar).
 *
 * Cmd+K / Ctrl+K opens the command palette.
 */

type NavigateFn = (path: string) => void;
type PaletteToggleFn = () => void;

const LEADER_ROUTES: Record<string, string> = {
  h: "/pitch",
  c: "/campaigns",
  w: "/war-room",
  p: "/prospects",
  d: "/atom-leadgen",
  m: "/market-intent",
  b: "/billing",
  s: "/atom-sonar",
};

const LEADER_TIMEOUT = 1200;

export function registerShortcuts(navigate: NavigateFn, togglePalette: PaletteToggleFn): () => void {
  let leaderActive = false;
  let leaderTimer: ReturnType<typeof setTimeout> | null = null;

  function clearLeader() {
    leaderActive = false;
    if (leaderTimer) {
      clearTimeout(leaderTimer);
      leaderTimer = null;
    }
  }

  function handler(e: KeyboardEvent) {
    // Ignore when user is typing in an input/textarea/contenteditable
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if ((e.target as HTMLElement)?.isContentEditable) return;

    // Cmd+K / Ctrl+K → toggle command palette
    if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      togglePalette();
      clearLeader();
      return;
    }

    // Don't process leader keys when modifier is held
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (leaderActive) {
      const route = LEADER_ROUTES[e.key];
      if (route) {
        e.preventDefault();
        navigate(route);
      }
      clearLeader();
      return;
    }

    if (e.key === "g") {
      leaderActive = true;
      leaderTimer = setTimeout(clearLeader, LEADER_TIMEOUT);
    }
  }

  document.addEventListener("keydown", handler);
  return () => {
    document.removeEventListener("keydown", handler);
    clearLeader();
  };
}
