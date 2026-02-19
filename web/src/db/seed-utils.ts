import { readFileSync, readdirSync } from "fs";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── File helpers ──

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8"));
}

/** Read directory entries, returning [] if the directory doesn't exist. */
export function readDirSafe(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

// ── Key / name helpers ──

/** Derive a snake_case key from an arbitrary name. */
export function toKey(name: string): string {
  return name.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase();
}

/** Derive a snake_case key from a filename (strip extension, replace `-` with `_`). */
export function fileNameToKey(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/-/g, "_");
}

/** Convert a snake_case key to a Title Case name. */
export function keyToName(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ── Logging ──

type LogLevel = "info" | "ok" | "warn" | "skip";

const PREFIX: Record<LogLevel, string> = {
  info: "  ",
  ok: "  ✓",
  warn: "  ⚠",
  skip: "  –",
};

export function log(level: LogLevel, message: string): void {
  const fn = level === "warn" ? console.warn : console.log;
  fn(`${PREFIX[level]} ${message}`);
}

export function logSection(title: string): void {
  console.log(`\n▸ ${title}`);
}

// ── DB connection wrapper ──

/**
 * Run a callback with a managed postgres client.
 * Automatically creates and closes the connection.
 */
export async function withClient<T>(
  fn: (db: PostgresJsDatabase) => Promise<T>,
): Promise<T> {
  const { createClient } = await import("./client");
  const sql = createClient();
  const db = drizzle({ client: sql });
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}
