import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const appRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: appRoot,
  plugins: [react()],
  build: {
    outDir: resolve(appRoot, "../dist"),
    emptyOutDir: true
  },
  server: {
    port: 1420,
    strictPort: true
  }
});
