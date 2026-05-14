import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { hydrateAll, startAutoSync } from "./lib/store";
import { startSamsaraAutoSync } from "./lib/samsara";
import "./index.css";
import "leaflet/dist/leaflet.css";

// Hydrate from Supabase in background — app renders immediately from localStorage cache
hydrateAll().then(() => {
  // Poll Supabase every 30s so multi-user changes sync automatically
  startAutoSync(30_000);
  // Pull fresh Samsara fleet data every 15 minutes (skips silently if no token saved)
  startSamsaraAutoSync(15 * 60 * 1000);
});

createRoot(document.getElementById("root")!).render(<App />);
