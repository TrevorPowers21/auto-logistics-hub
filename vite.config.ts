import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { samsaraProxyPlugin } from "./server/samsara-proxy";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "localhost",
    port: 5175,
    strictPort: false,
  },
  plugins: [react(), samsaraProxyPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
