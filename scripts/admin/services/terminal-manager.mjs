/**
 * Terminal Manager — macOS Terminal.app window management.
 *
 * 用 AppleScript 打开/激活 Terminal.app 窗口。
 * 内存 Map 记录 taskId → { windowId, tabIndex }。
 * 用窗口 ID 追踪，不依赖自定义标题（标题会被进程覆盖）。
 */

import { execSync } from "node:child_process";

function osascript(script) {
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

export function createTerminalManager() {
  /** @type {Map<string, { windowId: string, cwd: string }>} */
  const sessions = new Map();

  /**
   * Open a new Terminal.app window with optional command.
   * If session already exists, activate the existing window.
   */
  function create(taskId, cwd, command) {
    if (sessions.has(taskId)) {
      if (activate(taskId)) return;
      // Window was closed, fall through to create new one
    }

    const shellCmd = command ? `cd '${cwd}' && ${command}` : `cd '${cwd}'`;

    // do script returns a reference to the tab; get the window id
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
      console.log(`[terminal] Opened Terminal.app for ${taskId} (window ${windowId})`);
    } else {
      console.error(`[terminal] Failed to open Terminal.app for ${taskId}`);
    }
  }

  /**
   * Bring existing terminal window to front.
   * Returns true if window was found and activated.
   */
  function activate(taskId) {
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
      console.log(`[terminal] Activated window ${session.windowId} for ${taskId}`);
      return true;
    }

    // Window was closed by user
    console.log(`[terminal] Window ${session.windowId} not found for ${taskId}, removing session`);
    sessions.delete(taskId);
    return false;
  }

  /** Check if a session exists in memory. */
  function has(taskId) {
    return sessions.has(taskId);
  }

  /**
   * Verify the terminal window still exists (without activating it).
   * Cleans up the session if the window was closed.
   * @returns {boolean}
   */
  function verify(taskId) {
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

    console.log(`[terminal] Window ${session.windowId} gone for ${taskId}, cleaning up`);
    sessions.delete(taskId);
    return false;
  }

  /** Remove session from memory. */
  function destroy(taskId) {
    sessions.delete(taskId);
  }

  /** Remove session by taskId. */
  function destroyByTaskId(taskId) {
    sessions.delete(taskId);
  }

  /** List all tracked sessions. */
  function list() {
    return Array.from(sessions.entries()).map(([id, s]) => ({
      sessionId: id,
      windowId: s.windowId,
      cwd: s.cwd,
    }));
  }

  return { create, activate, has, verify, destroy, destroyByTaskId, list };
}
