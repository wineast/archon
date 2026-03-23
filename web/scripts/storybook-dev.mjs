#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let port = 6006;
try {
  const meta = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../.worktree/meta.json"), "utf-8"));
  if (meta.storybook) port = meta.storybook;
} catch {}

execSync(`npx storybook dev --no-open -p ${port}`, { stdio: "inherit", cwd: resolve(import.meta.dirname, "..") });
