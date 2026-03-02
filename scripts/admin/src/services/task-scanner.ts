/**
 * Task Scanner service — scan todo/issues, parse frontmatter, move status.
 * Zero HTTP awareness.
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { join, relative } from "node:path";

// ── Types ───────────────────────────────────────────────────

export interface Frontmatter {
  [key: string]: string;
}

export interface Task {
  type: "todo" | "issue";
  id: string;
  title: string;
  priority: string;
  status: string;
  worktree: string;
  merged: boolean;
  path: string;
  /** Enriched by API: chain report status from worktree */
  chain?: Record<string, boolean> | null;
  /** Enriched by API: active terminal session names */
  terminals?: string[];
}

export interface MoveResult {
  ok?: boolean;
  moved?: boolean;
  from?: string;
  to?: string;
  error?: string;
}

export interface MarkMergedResult {
  ok?: boolean;
  type?: string;
  status?: string;
  error?: string;
}

// ── Parsing ─────────────────────────────────────────────────

export function parseFrontmatter(content: string): Frontmatter {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const fm: Frontmatter = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (kv) {
      let val = kv[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      fm[kv[1]] = val;
    }
  }
  return fm;
}

export function parseTitle(content: string): string {
  const m = content.match(/^#\s+(.+)/m);
  return m ? m[1].trim() : "(untitled)";
}

// ── Scanning ────────────────────────────────────────────────

export function scanTasks(
  PROJECT_ROOT: string,
  TODO_DIR: string,
  ISSUES_DIR: string
): Task[] {
  const tasks: Task[] = [];

  if (existsSync(TODO_DIR)) {
    for (const file of readdirSync(TODO_DIR).filter((f) => f.endsWith(".md"))) {
      const filePath = join(TODO_DIR, file);
      const content = readFileSync(filePath, "utf-8");
      const fm = parseFrontmatter(content);
      const title = parseTitle(content);
      const id = file.replace(/\.md$/, "");
      tasks.push({
        type: "todo",
        id,
        title,
        priority: fm.priority || "P3",
        status: fm.status || "pending",
        worktree: fm.worktree || "",
        merged: fm.merged === "true",
        path: relative(PROJECT_ROOT, filePath),
      });
    }
  }

  if (existsSync(ISSUES_DIR)) {
    for (const file of readdirSync(ISSUES_DIR).filter((f) =>
      f.endsWith(".md")
    )) {
      const filePath = join(ISSUES_DIR, file);
      const content = readFileSync(filePath, "utf-8");
      const fm = parseFrontmatter(content);
      const title = parseTitle(content);
      const id = file.replace(/\.md$/, "");
      tasks.push({
        type: "issue",
        id,
        title,
        priority: fm.priority || "P3",
        status: fm.status || "open",
        worktree: fm.worktree || "",
        merged: fm.merged === "true",
        path: relative(PROJECT_ROOT, filePath),
      });
    }
  }

  return tasks;
}

export function readTaskContent(
  PROJECT_ROOT: string,
  taskPath: string
): string | null {
  const fullPath = join(PROJECT_ROOT, taskPath);
  if (!fullPath.startsWith(PROJECT_ROOT) || !existsSync(fullPath)) {
    return null;
  }
  return readFileSync(fullPath, "utf-8");
}

// ── Status query ────────────────────────────────────────────

export function getTaskStatus(
  type: string,
  id: string,
  TODO_DIR: string,
  ISSUES_DIR: string
): string | null {
  const baseDir = type === "todo" ? TODO_DIR : ISSUES_DIR;
  const filePath = join(baseDir, `${id}.md`);
  if (!existsSync(filePath)) return null;
  const content = readFileSync(filePath, "utf-8");
  const fm = parseFrontmatter(content);
  return fm.status || (type === "todo" ? "pending" : "open");
}

// ── Status mutation ─────────────────────────────────────────

export function moveTaskStatus(
  type: string,
  id: string,
  to: string,
  TODO_DIR: string,
  ISSUES_DIR: string
): MoveResult {
  const validTodo = [
    "pending",
    "ready",
    "backlog",
    "merged",
    "cancelled",
  ];
  const validIssue = ["open", "ready", "merged", "wontfix"];
  const allowed = type === "todo" ? validTodo : validIssue;
  if (!allowed.includes(to)) {
    return { error: `Invalid target status: ${to}` };
  }

  const baseDir = type === "todo" ? TODO_DIR : ISSUES_DIR;
  const filePath = join(baseDir, `${id}.md`);

  if (!existsSync(filePath)) return { error: `Task not found: ${id}` };

  let content = readFileSync(filePath, "utf-8");
  const fm = parseFrontmatter(content);
  if (fm.status === to) return { ok: true, moved: false };

  const from = fm.status || (type === "todo" ? "pending" : "open");

  // Update frontmatter status field in-place
  const hasFm = /^---\r?\n[\s\S]*?\r?\n---/.test(content);
  if (hasFm) {
    if (/^status:/m.test(content)) {
      content = content.replace(/^(status:).*/m, `$1 ${to}`);
    } else {
      content = content.replace(/\n---/, `\nstatus: ${to}\n---`);
    }
    // Clear worktree field only when moving back (not to ready/terminal states)
    const terminal = ["merged", "cancelled", "wontfix"];
    if (
      to !== "ready" &&
      !terminal.includes(to) &&
      /^worktree:/m.test(content)
    ) {
      content = content.replace(/^worktree:.*\n?/m, "");
    }
  } else {
    content = `---\nstatus: ${to}\n---\n${content}`;
  }
  writeFileSync(filePath, content);

  return { ok: true, moved: true, from, to };
}

// ── Merge completion ────────────────────────────────────────

export function markTaskMerged(
  id: string,
  TODO_DIR: string,
  ISSUES_DIR: string
): MarkMergedResult {
  // Find task file — worktree name = task id
  let filePath = join(TODO_DIR, `${id}.md`);
  let type = "todo";
  if (!existsSync(filePath)) {
    filePath = join(ISSUES_DIR, `${id}.md`);
    type = "issue";
  }
  if (!existsSync(filePath)) return { error: `Task not found: ${id}` };

  let content = readFileSync(filePath, "utf-8");
  const terminalStatus = "merged";

  const hasFm = /^---\r?\n[\s\S]*?\r?\n---/.test(content);
  if (hasFm) {
    // Set status
    if (/^status:/m.test(content)) {
      content = content.replace(/^(status:).*/m, `$1 ${terminalStatus}`);
    } else {
      content = content.replace(/\n---/, `\nstatus: ${terminalStatus}\n---`);
    }
    // Set merged: true
    if (/^merged:/m.test(content)) {
      content = content.replace(/^(merged:).*/m, `$1 true`);
    } else {
      content = content.replace(/\n---/, `\nmerged: true\n---`);
    }
  } else {
    content = `---\nstatus: ${terminalStatus}\nmerged: true\n---\n${content}`;
  }

  writeFileSync(filePath, content);
  return { ok: true, type, status: terminalStatus };
}
