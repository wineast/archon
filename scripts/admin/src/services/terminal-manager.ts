/**
 * Terminal Manager — macOS Terminal.app window management.
 *
 * Uses AppleScript to open/activate Terminal.app windows.
 * In-memory Map tracks taskId -> { windowId, cwd }.
 * Persists to /tmp file, auto-restores on restart.
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const PERSIST_PATH = "/tmp/archon-admin-terminal-sessions.json";

interface TerminalSession {
  windowId: string;
  cwd: string;
}

export interface TerminalManager {
  create: (taskId: string, cwd: string, command?: string) => void;
  activate: (taskId: string) => boolean;
  has: (taskId: string) => boolean;
  verify: (taskId: string) => boolean;
  verifyByPrefix: (prefix: string) => string[];
  destroy: (taskId: string) => void;
  destroyByTaskId: (taskId: string) => void;
  list: () => Array<{ sessionId: string; windowId: string; cwd: string }>;
}

function osascript(script: string): string {
  try {
    return execSync("osascript -", {
      input: script,
      encoding: "utf-8",
      timeout: 10000,
    }).trim();
  } catch {
    return "";
  }
}

export function createTerminalManager(): TerminalManager {
  const sessions = new Map<string, TerminalSession>();

  // ── Persistence ──

  function save(): void {
    try {
      const data = Object.fromEntries(sessions);
      writeFileSync(PERSIST_PATH, JSON.stringify(data));
    } catch {
      // ignore
    }
  }

  function restore(): void {
    try {
      const data = JSON.parse(readFileSync(PERSIST_PATH, "utf-8"));
      for (const [id, session] of Object.entries(data)) {
        sessions.set(id, session as TerminalSession);
      }
    } catch {
      // file not found or corrupt — start fresh
    }

    // Verify each restored session — remove stale ones
    for (const [id] of [...sessions]) {
      if (!verify(id)) {
        sessions.delete(id);
      }
    }
    save();
    const count = sessions.size;
    if (count > 0) {
      console.log(`[terminal] Restored ${count} session(s) from disk`);
    }
  }

  // Restore on startup
  restore();

  // ── Core operations ──

  function create(taskId: string, cwd: string, command?: string): void {
    if (sessions.has(taskId)) {
      if (activate(taskId)) return;
      // Window was closed, fall through to create new one
    }

    const shellCmd = command ? `cd '${cwd}' && ${command}` : `cd '${cwd}'`;

    const windowId = osascript(`
tell application "Terminal"
  do script "${shellCmd.replace(/"/g, '\\"')}"
  set winId to id of front window
  activate
  return winId as text
end tell
`);

    if (windowId) {
      sessions.set(taskId, { windowId, cwd });
      save();
      console.log(
        `[terminal] Opened Terminal.app for ${taskId} (window ${windowId})`
      );
    } else {
      console.error(`[terminal] Failed to open Terminal.app for ${taskId}`);
    }
  }

  function activate(taskId: string): boolean {
    const session = sessions.get(taskId);
    if (!session) return false;

    const result = osascript(`
tell application "Terminal"
  set found to false
  repeat with w in windows
    if (id of w as text) is "${session.windowId}" then
      set index of w to 1
      set found to true
      exit repeat
    end if
  end repeat
  if found then
    activate
    return "ok"
  else
    return "not_found"
  end if
end tell
`);

    if (result === "ok") {
      console.log(
        `[terminal] Activated window ${session.windowId} for ${taskId}`
      );
      return true;
    }

    console.log(
      `[terminal] Window ${session.windowId} not found for ${taskId}, removing session`
    );
    sessions.delete(taskId);
    save();
    return false;
  }

  function has(taskId: string): boolean {
    return sessions.has(taskId);
  }

  function verify(taskId: string): boolean {
    const session = sessions.get(taskId);
    if (!session) return false;

    const result = osascript(`
tell application "Terminal"
  repeat with w in windows
    if (id of w as text) is "${session.windowId}" then return "ok"
  end repeat
  return "gone"
end tell
`);

    if (result === "ok") return true;

    console.log(
      `[terminal] Window ${session.windowId} gone for ${taskId}, cleaning up`
    );
    sessions.delete(taskId);
    save();
    return false;
  }

  function destroy(taskId: string): void {
    sessions.delete(taskId);
    save();
  }

  function destroyByTaskId(taskId: string): void {
    sessions.delete(taskId);
    save();
  }

  function verifyByPrefix(prefix: string): string[] {
    const result: string[] = [];
    for (const [id] of [...sessions]) {
      if (!id.startsWith(prefix)) continue;
      if (verify(id)) {
        result.push(id);
      }
    }
    return result;
  }

  function list(): Array<{
    sessionId: string;
    windowId: string;
    cwd: string;
  }> {
    return Array.from(sessions.entries()).map(([id, s]) => ({
      sessionId: id,
      windowId: s.windowId,
      cwd: s.cwd,
    }));
  }

  return {
    create,
    activate,
    has,
    verify,
    verifyByPrefix,
    destroy,
    destroyByTaskId,
    list,
  };
}
