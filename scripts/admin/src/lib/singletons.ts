/**
 * Singleton management for Admin API server.
 * All stateful instances are attached to `globalThis.__archonAdmin`
 * to survive Next.js HMR / module re-evaluation.
 */

import { execSync } from "node:child_process";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  createTerminalManager,
  type TerminalManager,
} from "@/services/terminal-manager";
import {
  createTransitionHooks,
  type TransitionHooks,
} from "@/services/transition-hooks";
import { scanTasks } from "@/services/task-scanner";
import { exec } from "@/services/git-ops";

export interface Dirs {
  PROJECT_ROOT: string;
  WORKTREES_DIR: string;
  TODO_DIR: string;
  ISSUES_DIR: string;
}

interface AdminSingletons {
  dirs: Dirs;
  termManager: TerminalManager;
  hooks: TransitionHooks;
  mergeStates: Map<string, string>;
  _ready: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var __archonAdmin: AdminSingletons | undefined;
}

async function initAdmin(): Promise<AdminSingletons> {
  // Compute dirs
  const PROJECT_ROOT = execSync("git rev-parse --show-toplevel", {
    encoding: "utf-8",
  }).trim();
  const WORKTREES_DIR = join(PROJECT_ROOT, ".worktrees");
  const TODO_DIR = join(PROJECT_ROOT, "todo");
  const ISSUES_DIR = join(PROJECT_ROOT, "issues");
  const dirs: Dirs = { PROJECT_ROOT, WORKTREES_DIR, TODO_DIR, ISSUES_DIR };

  const termManager = createTerminalManager();
  const hooks = createTransitionHooks();

  // Post-hook: ->ready — create worktree + write TASK.md + launch terminal
  hooks.post({ to: "ready" }, async (ctx) => {
    const { type, id, dirs: d } = ctx;
    const {
      PROJECT_ROOT: root,
      WORKTREES_DIR: wtDir,
      TODO_DIR: todoDir,
      ISSUES_DIR: issuesDir,
    } = d;

    // 1. Create worktree
    const result = exec(
      `node scripts/worktree/worktree.mjs create ${id}`,
      root,
      { timeout: 60000 }
    );
    console.log(
      `[hook:ready] Worktree created: ${result.split("\n").pop()}`
    );

    const wtPath = join(wtDir, id);
    if (!existsSync(wtPath)) {
      throw new Error(`Worktree not found: ${wtPath}`);
    }

    // 2. Write TASK.md (strip frontmatter)
    const tasks = scanTasks(root, todoDir, issuesDir);
    const task = tasks.find((t) => t.id === id && t.type === type);
    if (task) {
      const raw = readFileSync(join(root, task.path), "utf-8");
      const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
      writeFileSync(join(wtPath, ".worktree", "TASK.md"), body);
    }

    // 3. Write worktree field back to task frontmatter
    const baseDir = type === "todo" ? todoDir : issuesDir;
    const filePath = join(baseDir, `${id}.md`);
    let content = readFileSync(filePath, "utf-8");
    if (/^worktree:/m.test(content)) {
      content = content.replace(/^worktree:.*/m, `worktree: ${id}`);
    } else {
      content = content.replace(/\n---/, `\nworktree: ${id}\n---`);
    }
    writeFileSync(filePath, content);

    // 4. Launch terminal with chain skill
    const skill = type === "todo" ? "/req-chain" : "/defect-chain";
    termManager.create(`${id}::${skill}`, wtPath, `claude ${skill}`);
  });

  return {
    dirs,
    termManager,
    hooks,
    mergeStates: new Map(),
    _ready: true,
  };
}

/**
 * Get or create the singleton admin instance.
 * Survives HMR via globalThis.
 */
export async function getAdmin(): Promise<AdminSingletons> {
  if (globalThis.__archonAdmin?._ready) {
    return globalThis.__archonAdmin;
  }
  const admin = await initAdmin();
  globalThis.__archonAdmin = admin;
  return admin;
}

export type { TerminalManager, TransitionHooks, AdminSingletons };
