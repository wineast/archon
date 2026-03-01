/**
 * Command Runner service — SSE command execution + terminal opener.
 * Merged from reports.mjs sseExec, worktrees.mjs runCommand, tasks.mjs openTerminal.
 * Zero HTTP awareness.
 */

import { spawn } from "node:child_process";

/**
 * Spawn a process and stream stdout/stderr via callbacks.
 * Returns the child process.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {object} options  - spawn options (cwd, env, shell …)
 * @param {{ onStdout, onStderr, onExit, onError }} handlers
 */
export function runStreaming(command, args, options, handlers) {
  const child = spawn(command, args, {
    ...options,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    for (const line of chunk.toString().split("\n")) {
      if (line) handlers.onStdout?.(line);
    }
  });

  child.stderr.on("data", (chunk) => {
    for (const line of chunk.toString().split("\n")) {
      if (line) handlers.onStderr?.(line);
    }
  });

  child.on("close", (code) => handlers.onExit?.(code));
  child.on("error", (err) => handlers.onError?.(err.message));

  return child;
}

/**
 * SSE-flavour: write SSE frames to an HTTP response.
 * Returns the child process so callers can hook `close`.
 */
export function sseExec(command, args, options, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  const child = runStreaming(command, args, options, {
    onStdout: (line) => send("stdout", line),
    onStderr: (line) => send("stderr", line),
    onExit: (code) => { send("exit", code); res.end(); },
    onError: (msg) => { send("error", msg); res.end(); },
  });

  res.on("close", () => child.kill());
  return child;
}

/**
 * SSE-flavour with shell=true (used by worktree delete / branch ops).
 */
export function sseShell(cmd, args, cwd, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  const child = spawn(cmd, args, {
    cwd,
    env: { ...process.env, FORCE_COLOR: "0" },
    shell: true,
  });

  child.stdout.on("data", (d) => {
    for (const line of d.toString().split("\n")) {
      if (line) send("stdout", line);
    }
  });

  child.stderr.on("data", (d) => {
    for (const line of d.toString().split("\n")) {
      if (line) send("stderr", line);
    }
  });

  child.on("close", (code) => { send("exit", code); res.end(); });
  child.on("error", (err) => { send("error", err.message); res.end(); });

  return child;
}

/**
 * Open a macOS Terminal.app window running a command.
 */
export function openTerminal(cwd, taskId, initialInput) {
  const cmd = initialInput
    ? `cd ${JSON.stringify(cwd)} && claude ${initialInput}`
    : `cd ${JSON.stringify(cwd)} && claude`;
  const script = `
    tell application "Terminal"
      activate
      set newTab to do script ${JSON.stringify(cmd)}
      set custom title of front window to ${JSON.stringify("Claude: " + taskId)}
    end tell
  `;
  spawn("osascript", ["-e", script], { stdio: "ignore", detached: true }).unref();
}
