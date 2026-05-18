import { createRoot } from "react-dom/client";
// ΔTOM brand system CSS — must load before app stylesheets so component
// tokens are available everywhere and app-level utilities can override.
import "@nirmata/atom-design-system/css";
import App from "./App";
import "./index.css";

if (!window.location.hash) {
  window.location.hash = "#/";
}

createRoot(document.getElementById("root")!).render(<App />);
