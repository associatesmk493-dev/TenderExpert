import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// PWA: Guard service worker registration in preview/iframe contexts
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  window.deferredTenderExpertInstall = event as BeforeInstallPromptEvent;
  window.dispatchEvent(new Event("tenderexpert-install-ready"));
});

window.addEventListener("appinstalled", () => {
  window.deferredTenderExpertInstall = null;
  window.dispatchEvent(new Event("tenderexpert-app-installed"));
});

createRoot(document.getElementById("root")!).render(<App />);
