import { createRoot } from "react-dom/client";
// ΔTOM brand system CSS — must load before app stylesheets so component
// tokens are available everywhere and app-level utilities can override.
import "@nirmata/atom-design-system/css";
// ΔTOM V4 brand/experience system — canonical black & cyan identity
// (multi-orbit atom, glowing nucleus, ΔTOM wordmark, cyan #39BFC0).
// Loaded after v1 tokens so V4 --atom-* values and component classes win.
import "@nirmata/atom-v4-brand-system/css";
import App from "./App";
import "./index.css";
// ATOM Brand Standard OS — canonical, reusable brand kit (dark-only, cyan
// #22e6d6). Loaded LAST so its --atom-* tokens and namespaced .atom-* component
// classes win the cascade over the older vendored brand packages. This is the
// same kit shipped to client/public/brand for drop-in use by any ATOM Vercel app.
import "./brand/atom-tokens.css";
import "./brand/atom-components.css";

if (!window.location.hash) {
  window.location.hash = "#/";
}

createRoot(document.getElementById("root")!).render(<App />);
