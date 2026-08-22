import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AuthCallback from "./components/AuthCallback";
import "./index.css";

// If we're on /callback, render the callback handler instead of the main app
const isCallback = window.location.pathname === "/callback";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isCallback ? <AuthCallback /> : <App />}
  </StrictMode>
);
