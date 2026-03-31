import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { hydrateAll } from "./lib/store";
import "./index.css";
import "leaflet/dist/leaflet.css";

// Hydrate from Supabase in background — app renders immediately from localStorage cache
hydrateAll();

createRoot(document.getElementById("root")!).render(<App />);
