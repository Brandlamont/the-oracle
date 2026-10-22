import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  cacheDir: ".vite-cache/mtg-oracle",
  server: {
    proxy: {
      "/scryfall-card-image": {
        target: "https://cards.scryfall.io",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/scryfall-card-image/, ""),
      },
    },
  },
});
