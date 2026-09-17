import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyThemePreference, loadThemePreference } from "./lib/theme";
import "./styles/theme.css";

applyThemePreference(loadThemePreference());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
