#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let port = 3000;
try {
  const meta = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../.worktree/meta.json"), "utf-8"));
  if (meta.dev) port = meta.dev;
} catch {}

execSync(`npx next dev --port ${port}`, { stdio: "inherit", cwd: resolve(import.meta.dirname, "..") });
