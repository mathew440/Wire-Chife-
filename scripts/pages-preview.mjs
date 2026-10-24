import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../out/", import.meta.url));
const port = Number(process.env.PORT || 43125);
const prefix = "/Wire-Chife-";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === prefix) {
    res.writeHead(302, { Location: `${prefix}/` });
    res.end();
    return;
  }
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Wire Chief is served under /Wire-Chife-/");
    return;
  }
  let relative = pathname.slice(prefix.length);
  if (relative.endsWith("/")) relative += "index.html";
  const file = normalize(join(root, relative));
  if (!file.startsWith(normalize(root))) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const body = await readFile(file);
    const ext = extname(file);
    const cache = file.endsWith("sw.js") || ext === ".html" ? "no-cache" : "public, max-age=31536000";
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream", "Cache-Control": cache });
    res.end(body);
  } catch {
    try {
      const fallback = await readFile(join(root, "404.html"));
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
      res.end(fallback);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("missing");
    }
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Wire Chief pages preview at http://127.0.0.1:${port}${prefix}/`);
});
