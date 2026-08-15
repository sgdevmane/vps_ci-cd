import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 5173,
    proxy: {
      // Must match the PORT in .env.local
      "/api": {
        target: "http://127.0.0.1:24816",
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: "dist",
    target: "es2022",
  },
});
