import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = join(process.cwd(), "dist");
const port = Number(process.env.PORT || 5173);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function sendFile(response, filePath) {
  response.writeHead(200, {
    "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);

    if (url.pathname.startsWith("/scryfall-card-image/")) {
      const target = `https://cards.scryfall.io${url.pathname.replace("/scryfall-card-image", "")}${url.search}`;
      const imageResponse = await fetch(target);
      response.writeHead(imageResponse.status, {
        "Content-Type": imageResponse.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      });
      response.end(Buffer.from(await imageResponse.arrayBuffer()));
      return;
    }

    const decodedPath = decodeURIComponent(url.pathname);
    const normalizedPath = normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
    let filePath = join(root, normalizedPath);
    if (!filePath.startsWith(root)) filePath = join(root, "index.html");

    if (!existsSync(filePath) || (await stat(filePath)).isDirectory()) {
      filePath = join(root, "index.html");
    }

    sendFile(response, filePath);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.message : String(error));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`The Oracle preview is running at http://127.0.0.1:${port}/`);
});
