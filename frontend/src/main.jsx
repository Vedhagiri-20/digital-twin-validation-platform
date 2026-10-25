import "./theme-fix.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./premium-theme.css";
import "./hero-image-fix.css";
import "./black-minimal-theme.css";
import "./final-industrial-polish.css";
import "./button-image-polish.css";
import "./dark-card-fix.css";
import "./readability-final-fix.css";
import ErrorBoundary from "./ErrorBoundary";
import "./grid-stability.css";
import "./image-visibility-fix.css";
import "./image-only-final-fix.css";
import "./industry-ui-reset.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </React.StrictMode>
);
