#!/usr/bin/env node
/**
 * 工作区静态环境清理（wt-setup 的反向操作）
 * 用法: node scripts/wt-teardown.mjs [target_dir]
 *
 * 流程: 删缓存/依赖 → 删环境文件 → 删工作区元数据
 */

import { rmSync, unlinkSync } from "node:fs";
import { resolve, join } from "node:path";

const targetDir = resolve(process.argv[2] || ".");

// ── 清理缓存和依赖 ──────────────────────────────────────────

console.log("🗑️  [wt-teardown] 清理构建缓存和依赖...");
rmSync(join(targetDir, "web", ".next"), { recursive: true, force: true });
rmSync(join(targetDir, "web", "node_modules"), { recursive: true, force: true });

// ── 删除环境文件 ────────────────────────────────────────────

console.log("📄 [wt-teardown] 删除环境文件...");
try { unlinkSync(join(targetDir, "web", ".env.development.local")); } catch { /* not exists */ }
try { unlinkSync(join(targetDir, "web", ".env.local")); } catch { /* not exists */ }

// ── 删除工作区元数据 ────────────────────────────────────────

console.log("📦 [wt-teardown] 删除工作区元数据...");
rmSync(join(targetDir, ".worktree"), { recursive: true, force: true });
