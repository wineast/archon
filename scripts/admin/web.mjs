#!/usr/bin/env node
/**
 * Archon Admin — Production web server.
 * Serves static files from dist/ and proxies /api to the API server.
 *
 * Usage:
 *   node scripts/admin/web.mjs          # default: listen 3100, proxy to 4100
 *   PORT=8080 API_URL=http://localhost:4100 node scripts/admin/web.mjs
 */

import { createServer, request as httpRequest } from "node:http";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const ADMIN_DIR = new URL(".", import.meta.url).pathname;
const DIST_DIR = join(ADMIN_DIR, "dist");
const API_URL = process.env.API_URL || "http://localhost:4100";
const PORT = parseInt(process.env.PORT || "3100", 10);

if (!existsSync(join(DIST_DIR, "index.html"))) {
  console.error("dist/index.html not found. Run `make admin-build` first.");
  process.exit(1);
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
};

// ── API proxy ───────────────────────────────────────────────

function proxyToApi(req, res) {
  const target = new URL(req.url, API_URL);
  const proxyReq = httpRequest(
    target,
    { method: req.method, headers: req.headers },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on("error", (e) => {
    res.writeHead(502);
    res.end(`API proxy error: ${e.message}`);
  });
  req.pipe(proxyReq);
}

// ── Static file serving ─────────────────────────────────────

function serveStatic(req, res) {
  const urlPath = new URL(req.url, "http://localhost").pathname;
  let filePath = urlPath === "/" ? join(DIST_DIR, "index.html") : join(DIST_DIR, urlPath);

  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!existsSync(filePath)) {
    // SPA fallback
    if (!extname(urlPath)) {
      filePath = join(DIST_DIR, "index.html");
    } else {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
  }

  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType });
  res.end(readFileSync(filePath));
}

// ── HTTP Server ─────────────────────────────────────────────

const server = createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    proxyToApi(req, res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  const url = `http://localhost:${server.address().port}`;
  console.log(`\n  Archon Admin: ${url}\n`);
  try {
    execSync(`open "${url}"`, { stdio: "ignore" });
  } catch {}
});
