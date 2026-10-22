import react from "@vitejs/plugin-react";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.CI = "true";

const { createServer } = await import("vite");

const server = await createServer({
  configFile: false,
  root: process.cwd(),
  plugins: [react()],
  cacheDir: join(tmpdir(), `mtg-oracle-vite-${process.pid}`),
  server: {
    host: "127.0.0.1",
    proxy: {
      "/scryfall-card-image": {
        target: "https://cards.scryfall.io",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/scryfall-card-image/, ""),
      },
    },
  },
});

await server.listen();
server.printUrls();

setInterval(() => {}, 2147483647);
