#!/usr/bin/env node

/**
 * 构建静态资源，部署到 Cloudflare Pages。
 * 每个项目独立构建、独立部署、独立域名。
 *
 * 用法：
 *   node scripts/build-static.mjs storybook   → .static-dist/storybook/
 *   node scripts/build-static.mjs demo-umi    → .static-dist/demo-umi/
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIST = resolve(ROOT, ".static-dist");

const target = process.argv[2];

if (!target) {
  console.error("用法: node scripts/build-static.mjs <name>");
  console.error("  可选: storybook, demo-umi");
  process.exit(1);
}

function run(cmd, cwd) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

const out = resolve(DIST, target);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

switch (target) {
  case "storybook": {
    console.log("\n━━━ Storybook ━━━");
    run(`npm run build-storybook -- -o ${out}`, resolve(ROOT, "web"));
    break;
  }

  case "demo-umi": {
    console.log("\n━━━ Demo: umi ━━━");
    const demoDir = resolve(ROOT, "embed-umi-demo");
    if (!existsSync(demoDir)) {
      console.error(`❌ ${demoDir} 不存在`);
      process.exit(1);
    }
    run("pnpm install --frozen-lockfile", demoDir);
    run("pnpm build", demoDir);
    cpSync(resolve(demoDir, "dist"), out, { recursive: true });
    break;
  }

  // 未来新增:
  // case "demo-vue": { ... break; }

  default:
    console.error(`❌ 未知目标: ${target}`);
    console.error("  可选: storybook, demo-umi");
    process.exit(1);
}

console.log(`\n✅ ${target} → .static-dist/${target}/`);
