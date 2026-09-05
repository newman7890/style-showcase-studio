import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

window.addEventListener("error", (e) => {
  console.error("Global window error:", e);
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled promise rejection:", e.reason);
});

try {
  const rootEl = document.getElementById("root");
  if (!rootEl) {
    throw new Error("Root element #root not found");
  }
  createRoot(rootEl).render(<App />);
} catch (err: any) {
  console.error("Failed to render App:", err);
  const rootEl = document.getElementById("root");
  if (rootEl) {
    rootEl.innerHTML = `
      <div style="padding: 24px; font-family: sans-serif; color: #dc2626; background: #fef2f2; border: 1px solid #f87171; border-radius: 12px; margin: 24px; max-width: 600px;">
        <h2 style="margin-top: 0;">Application Startup Error</h2>
        <pre style="white-space: pre-wrap; font-size: 13px; background: white; padding: 12px; border-radius: 8px;">${err?.stack || err?.message || String(err)}</pre>
      </div>
    `;
  }
}

