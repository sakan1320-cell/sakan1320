import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initGlobalErrorLogger } from "@/lib/logger";

// Safe UUID polyfill for non-secure contexts (HTTP/IPs) where crypto.randomUUID is undefined.
// This is critical to prevent Supabase OAuth from crashing.
if (typeof window !== 'undefined' && (!window.crypto || !window.crypto.randomUUID)) {
  if (!window.crypto) (window as any).crypto = {};
  (window.crypto as any).randomUUID = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };
}

// Inject cached theme variables immediately to prevent flicker
const primary = localStorage.getItem("theme-primary");
const radius = localStorage.getItem("theme-radius");
if (primary) document.documentElement.style.setProperty("--primary", primary);
if (radius) document.documentElement.style.setProperty("--radius", radius);

initGlobalErrorLogger();

createRoot(document.getElementById("root")!).render(<App />);
