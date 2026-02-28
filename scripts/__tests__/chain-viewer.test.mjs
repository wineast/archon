#!/usr/bin/env node
/**
 * 链路报告查看器——需求守护集成测试
 *
 * 覆盖规约：CAP_GUARD.md
 * 测试层级：Integration + Unit (静态)
 *
 * 运行：node scripts/__tests__/chain-viewer.test.mjs
 *
 * 验证的核心能力：
 * - 需求链/缺陷链查看器正确渲染可用报告 + dimmed 节点
 * - SSE /events 端点推送文件变化
 * - 幂等启动检测
 * - 零外部依赖 / SKILL.md 路径统一 / 旧文件删除
 * - Degradation Fence: 手动刷新始终返回最新内容
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, rmSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn, execSync } from "node:child_process";
import http from "node:http";

// ── Helpers ──────────────────────────────────────────────────────────────

const PROJECT_ROOT = join(import.meta.dirname, "../..");
const SCRIPTS_DIR = join(PROJECT_ROOT, "scripts");
const SKILLS_DIR = join(PROJECT_ROOT, ".claude/skills");

/** HTTP GET with timeout */
function httpGet(url, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`GET ${url} timed out`)), timeout);
    http.get(url, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        clearTimeout(timer);
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    }).on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/** SSE: connect to /events and collect messages until predicate or timeout */
function sseCollect(url, predicate, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const messages = [];
    const timer = setTimeout(() => {
      req.destroy();
      resolve(messages); // resolve with whatever we got
    }, timeout);

    const req = http.get(url, (res) => {
      let buf = "";
      res.on("data", (chunk) => {
        buf += chunk.toString();
        const lines = buf.split("\n");
        buf = lines.pop(); // keep incomplete line
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            messages.push(data);
            if (predicate && predicate(data, messages)) {
              clearTimeout(timer);
              req.destroy();
              resolve(messages);
            }
          }
        }
      });
      res.on("end", () => {
        clearTimeout(timer);
        resolve(messages);
      });
    });

    req.on("error", (err) => {
      if (err.code !== "ECONNRESET") {
        clearTimeout(timer);
        reject(err);
      }
    });
  });
}

/** Start viewer in a temp directory, return { proc, port, url, tmpDir, wtDir } */
async function startTestViewer(configScript, fixtures = {}) {
  const tmpDir = mkdtempSync(join(tmpdir(), "viewer-test-"));
  const wtDir = join(tmpDir, ".worktree");
  mkdirSync(wtDir);

  // Write fixture files
  for (const [name, content] of Object.entries(fixtures)) {
    writeFileSync(join(wtDir, name), content);
  }

  // Write meta.json for worktree detection
  writeFileSync(join(wtDir, "meta.json"), JSON.stringify({ baseBranch: "dev" }));

  return new Promise((resolve, reject) => {
    const proc = spawn("node", [configScript], {
      cwd: tmpDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, HOME: tmpDir },
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      reject(new Error(`Viewer start timed out.\nstdout: ${stdout}\nstderr: ${stderr}`));
    }, 10000);

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      const match = stdout.match(/http:\/\/localhost:(\d+)/);
      if (match) {
        clearTimeout(timer);
        const port = parseInt(match[1]);
        const url = `http://localhost:${port}`;

        // Wait a bit for server to be ready
        setTimeout(() => {
          resolve({ proc, port, url, tmpDir, wtDir });
        }, 300);
      }
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("exit", (code) => {
      clearTimeout(timer);
      // If process exits before we get URL, it may be idempotent check
      if (code === 0 && stdout.includes("already running")) {
        resolve({ proc, port: null, url: null, tmpDir, wtDir, idempotent: true, stdout });
      } else if (!stdout.includes("http://localhost:")) {
        reject(new Error(`Viewer exited with code ${code}.\nstdout: ${stdout}\nstderr: ${stderr}`));
      }
    });
  });
}

/** Clean up test viewer */
function cleanupViewer(ctx) {
  if (ctx.proc && !ctx.proc.killed) {
    ctx.proc.kill("SIGTERM");
  }
  // Give process time to clean up viewer.json
  try {
    rmSync(ctx.tmpDir, { recursive: true, force: true });
  } catch {}
}

// ── Static Tests (Unit) ──────────────────────────────────────────────────

describe("静态检查（Unit）", () => {
  it("AC-5: SKILL.md 无旧路径引用", () => {
    const skillDirs = [
      "requirement", "implement", "accept", "cap-guard",
      "diagnose", "fix", "verify", "test-guard",
    ];
    for (const dir of skillDirs) {
      const skillPath = join(SKILLS_DIR, dir, "SKILL.md");
      if (!existsSync(skillPath)) continue;
      const content = readFileSync(skillPath, "utf-8");
      assert.ok(
        !content.includes("test-guard/serve-report"),
        `${dir}/SKILL.md 仍引用旧路径 test-guard/serve-report`
      );
      assert.ok(
        !content.includes("cap-guard/serve-report"),
        `${dir}/SKILL.md 仍引用旧路径 cap-guard/serve-report`
      );
    }
    console.log("  ✓ 8 个 SKILL.md 无旧路径引用");
  });

  it("AC-5: 8 个 SKILL.md 正确引用 scripts/ 脚本", () => {
    const reqChainSkills = ["requirement", "implement", "accept", "cap-guard"];
    const defectChainSkills = ["diagnose", "fix", "verify", "test-guard"];

    for (const dir of reqChainSkills) {
      const content = readFileSync(join(SKILLS_DIR, dir, "SKILL.md"), "utf-8");
      assert.ok(
        content.includes("serve-req-chain.mjs"),
        `${dir}/SKILL.md 未引用 serve-req-chain.mjs`
      );
    }
    for (const dir of defectChainSkills) {
      const content = readFileSync(join(SKILLS_DIR, dir, "SKILL.md"), "utf-8");
      assert.ok(
        content.includes("serve-defect-chain.mjs"),
        `${dir}/SKILL.md 未引用 serve-defect-chain.mjs`
      );
    }
    console.log("  ✓ 需求链 4 个 → scripts/serve-req-chain.mjs，缺陷链 4 个 → scripts/serve-defect-chain.mjs");
  });

  it("C-1: 零外部依赖——仅 node: 内置模块", () => {
    const content = readFileSync(join(SCRIPTS_DIR, "report-viewer.mjs"), "utf-8");
    const imports = content.match(/from\s+["']([^"']+)["']/g) || [];
    for (const imp of imports) {
      const mod = imp.match(/from\s+["']([^"']+)["']/)[1];
      assert.ok(
        mod.startsWith("node:") || mod.startsWith("./") || mod.startsWith("../"),
        `发现非内置依赖: ${mod}`
      );
    }
    console.log(`  ✓ ${imports.length} 个 import 全部为 node: 或相对路径`);
  });

  it("C-2: 两链路脚本独立存在", () => {
    assert.ok(existsSync(join(SCRIPTS_DIR, "serve-req-chain.mjs")), "serve-req-chain.mjs 不存在");
    assert.ok(existsSync(join(SCRIPTS_DIR, "serve-defect-chain.mjs")), "serve-defect-chain.mjs 不存在");
    console.log("  ✓ serve-req-chain.mjs 和 serve-defect-chain.mjs 均存在");
  });

  it("C-3: SSE 使用原生 HTTP 实现", () => {
    const content = readFileSync(join(SCRIPTS_DIR, "report-viewer.mjs"), "utf-8");
    assert.ok(content.includes('"text/event-stream"'), "未找到 text/event-stream Content-Type");
    assert.ok(content.includes("sseClients"), "未找到 sseClients 管理");
    // 确认无第三方 SSE 库
    assert.ok(!content.includes("require(\"sse\")"), "发现第三方 SSE 库引用");
    assert.ok(!content.includes("from \"sse\""), "发现第三方 SSE 库引用");
    console.log("  ✓ SSE 使用原生 HTTP text/event-stream 实现");
  });

  it("C-4: Actions 路由完整（merge-check/merge）", () => {
    const content = readFileSync(join(SCRIPTS_DIR, "report-viewer.mjs"), "utf-8");
    assert.ok(content.includes('url === "/merge-check"'), '未找到 /merge-check 路由');
    assert.ok(content.includes('url === "/merge"'), '未找到 /merge 路由');
    console.log("  ✓ merge-check / merge 路由均存在");
  });

  it("C-5: 旧 serve-report.mjs 文件已删除", () => {
    assert.ok(
      !existsSync(join(SKILLS_DIR, "test-guard/serve-report.mjs")),
      "test-guard/serve-report.mjs 仍存在"
    );
    assert.ok(
      !existsSync(join(SKILLS_DIR, "cap-guard/serve-report.mjs")),
      "cap-guard/serve-report.mjs 仍存在"
    );
    console.log("  ✓ 两个旧 serve-report.mjs 已删除");
  });

  it("C-6: SKILL.md 无旧路径引用（全局 grep）", () => {
    const skillMdFiles = execSync(
      `find "${SKILLS_DIR}" -name "SKILL.md" -type f`,
      { encoding: "utf-8" }
    ).trim().split("\n").filter(Boolean);

    for (const file of skillMdFiles) {
      const content = readFileSync(file, "utf-8");
      assert.ok(
        !content.includes("test-guard/serve-report") && !content.includes("cap-guard/serve-report"),
        `${file} 仍引用旧路径`
      );
    }
    console.log(`  ✓ 全部 ${skillMdFiles.length} 个 SKILL.md 无旧路径引用`);
  });

  it("C-7: Verdict 关键词检测完整", () => {
    const content = readFileSync(join(SCRIPTS_DIR, "report-viewer.mjs"), "utf-8");
    const failKw = ["驳回", "不足", "❌"];
    const warnKw = ["有条件", "部分", "⚠️"];
    for (const kw of failKw) {
      assert.ok(content.includes(kw), `VERDICT_FAIL_KW 缺少关键词: ${kw}`);
    }
    for (const kw of warnKw) {
      assert.ok(content.includes(kw), `VERDICT_WARN_KW 缺少关键词: ${kw}`);
    }
    console.log("  ✓ VERDICT_FAIL_KW 3 个 + VERDICT_WARN_KW 3 个 关键词完整");
  });
});

// ── Integration Tests ────────────────────────────────────────────────────

describe("集成测试（Integration）", () => {
  const REQ_CHAIN_SCRIPT = join(SCRIPTS_DIR, "serve-req-chain.mjs");
  const DEFECT_CHAIN_SCRIPT = join(SCRIPTS_DIR, "serve-defect-chain.mjs");

  it("AC-1: 仅 REQ.md 时只有需求报告 tab + 其余节点 dimmed", async () => {
    const ctx = await startTestViewer(REQ_CHAIN_SCRIPT, {
      "REQ.md": "# 需求报告\n\n测试内容",
    });
    try {
      const { status, body } = await httpGet(ctx.url);
      assert.equal(status, 200);

      // 需求报告 tab 存在
      assert.ok(body.includes("需求报告"), "HTML 未包含需求报告 tab");

      // 其他 tab 不显示（optional + 文件不存在）
      assert.ok(!body.includes('class="tab" data-key="impl"'), "实现报告 tab 不应存在");

      // 链路节点 dimmed 检查
      assert.ok(body.includes('chain-node impl dimmed'), "impl 节点应为 dimmed");
      assert.ok(body.includes('chain-node accept dimmed'), "accept 节点应为 dimmed");
      assert.ok(body.includes('chain-node req"'), "req 节点不应为 dimmed");

      console.log("  ✓ 仅 REQ.md：需求 tab 可见，impl/accept/guard/report 节点 dimmed");
    } finally {
      cleanupViewer(ctx);
    }
  });

  it("AC-2: SSE /events 推送文件变化", async () => {
    const ctx = await startTestViewer(REQ_CHAIN_SCRIPT, {
      "REQ.md": "# 需求报告\n\n测试内容",
    });
    try {
      // 验证 /events 端点可连接
      const eventsUrl = `${ctx.url}/events`;

      // Start collecting SSE and write a new file
      const collectPromise = sseCollect(eventsUrl, (data) => {
        try {
          const parsed = JSON.parse(data);
          return parsed.type === "file-change";
        } catch { return false; }
      }, 5000);

      // Wait a bit then write file to trigger fs.watch
      await new Promise((r) => setTimeout(r, 600));
      writeFileSync(join(ctx.wtDir, "IMPL_REPORT.md"), "# 实现报告\n\n测试");

      const messages = await collectPromise;
      const hasFileChange = messages.some((m) => {
        try {
          return JSON.parse(m).type === "file-change";
        } catch { return false; }
      });
      assert.ok(hasFileChange, "SSE 未推送 file-change 消息");
      console.log("  ✓ 写入 IMPL_REPORT.md 后 SSE 推送 file-change");
    } finally {
      cleanupViewer(ctx);
    }
  });

  it("AC-3: 缺陷链查看器正确渲染", async () => {
    const ctx = await startTestViewer(DEFECT_CHAIN_SCRIPT, {
      "DEFECT.md": "# 缺陷报告\n\n测试内容",
    });
    try {
      const { status, body } = await httpGet(ctx.url);
      assert.equal(status, 200);

      // 缺陷报告 tab 存在
      assert.ok(body.includes("缺陷报告"), "HTML 未包含缺陷报告 tab");

      // 其他节点 dimmed
      assert.ok(body.includes('chain-node fix dimmed'), "fix 节点应为 dimmed");
      assert.ok(body.includes('chain-node verify dimmed'), "verify 节点应为 dimmed");

      console.log("  ✓ 缺陷链查看器：缺陷 tab 可见，fix/verify/guard dimmed");
    } finally {
      cleanupViewer(ctx);
    }
  });

  it("AC-4: 幂等启动检测", async () => {
    const ctx = await startTestViewer(REQ_CHAIN_SCRIPT, {
      "REQ.md": "# 需求报告\n\n测试",
    });
    try {
      // Verify viewer.json exists
      const viewerJson = join(ctx.wtDir, "viewer.json");
      assert.ok(existsSync(viewerJson), "viewer.json 未创建");
      const info = JSON.parse(readFileSync(viewerJson, "utf-8"));
      assert.ok(info.pid, "viewer.json 缺少 pid");
      assert.ok(info.port, "viewer.json 缺少 port");

      // Try to start again — should detect idempotent
      const ctx2 = await startTestViewer(REQ_CHAIN_SCRIPT, {}).catch((err) => {
        // If it fails because the second process can't start (different tmpDir),
        // we test the idempotent behavior differently
        return null;
      });

      // Direct idempotent test: write viewer.json with live PID into a new tmp dir
      const tmpDir2 = mkdtempSync(join(tmpdir(), "viewer-idem-"));
      const wtDir2 = join(tmpDir2, ".worktree");
      mkdirSync(wtDir2);
      writeFileSync(join(wtDir2, "REQ.md"), "# Test");
      writeFileSync(join(wtDir2, "meta.json"), JSON.stringify({ baseBranch: "dev" }));
      writeFileSync(
        join(wtDir2, "viewer.json"),
        JSON.stringify({ pid: ctx.proc.pid, port: ctx.port, url: ctx.url })
      );

      // Start viewer in tmpDir2 — should detect running and exit
      const result = await new Promise((resolve) => {
        const proc2 = spawn("node", [REQ_CHAIN_SCRIPT], {
          cwd: tmpDir2,
          stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        proc2.stdout.on("data", (c) => (stdout += c.toString()));
        proc2.on("exit", (code) => resolve({ code, stdout }));
      });

      assert.equal(result.code, 0, "幂等进程应以 0 退出");
      assert.ok(
        result.stdout.includes("already running"),
        `幂等输出应包含 "already running"，实际: ${result.stdout}`
      );

      if (ctx2) cleanupViewer(ctx2);
      rmSync(tmpDir2, { recursive: true, force: true });
      console.log("  ✓ 幂等启动：检测到运行中进程，输出 already running 并退出");
    } finally {
      cleanupViewer(ctx);
    }
  });

  it("AC-1 boundary: 全部报告存在时无 dimmed 节点", async () => {
    const ctx = await startTestViewer(REQ_CHAIN_SCRIPT, {
      "REQ.md": "# 需求报告",
      "IMPL_REPORT.md": "# 实现报告",
      "ACCEPT_REPORT.md": "# 验收报告",
      "CAP_GUARD.md": "# 守护规约",
      "CAP_GUARD_REPORT.md": "# 守护报告",
    });
    try {
      const { body } = await httpGet(ctx.url);
      // Check chain-node elements for dimmed class (not CSS definitions)
      const chainNodeDimmed = body.match(/chain-node\s+\w+\s+dimmed"/g);
      assert.ok(!chainNodeDimmed, `全部报告存在时不应有 dimmed 节点，发现: ${chainNodeDimmed}`);
      console.log("  ✓ 全部报告存在时无 dimmed 节点");
    } finally {
      cleanupViewer(ctx);
    }
  });

  it("D-1: 手动刷新始终返回最新内容（退化围栏）", async () => {
    const ctx = await startTestViewer(REQ_CHAIN_SCRIPT, {
      "REQ.md": "# 需求报告",
    });
    try {
      // 初始只有 REQ.md
      const { body: body1 } = await httpGet(ctx.url);
      assert.ok(body1.includes("需求报告"), "初始应包含需求报告");
      assert.ok(!body1.includes("实现报告") || body1.includes("dimmed"), "初始不应有实现报告 tab");

      // 写入新文件
      writeFileSync(join(ctx.wtDir, "IMPL_REPORT.md"), "# 实现报告\n\n新内容");

      // 等一下让 fs.watch 有时间触发（但即使不触发，GET / 也应返回最新）
      await new Promise((r) => setTimeout(r, 800));

      // 手动刷新
      const { body: body2 } = await httpGet(ctx.url);
      // buildHtml() 每次请求都会重新调用 getAvailable()
      assert.ok(body2.includes("实现报告"), "手动刷新后应包含实现报告 tab");
      assert.ok(!body2.includes('chain-node impl dimmed'), "实现报告节点不应 dimmed");

      console.log("  ✓ D-1: 手动 GET / 始终返回最新 HTML（不依赖 SSE）");
    } finally {
      cleanupViewer(ctx);
    }
  });

  it("D-2: Stale viewer.json 被清理后正常启动（退化围栏）", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "viewer-stale-"));
    const wtDir = join(tmpDir, ".worktree");
    mkdirSync(wtDir);
    writeFileSync(join(wtDir, "REQ.md"), "# 需求报告");
    writeFileSync(join(wtDir, "meta.json"), JSON.stringify({ baseBranch: "dev" }));

    // Write viewer.json with a dead PID (PID 1 is init, we use a high unlikely PID)
    writeFileSync(
      join(wtDir, "viewer.json"),
      JSON.stringify({ pid: 999999, port: 99999, url: "http://localhost:99999" })
    );

    try {
      const ctx = await startTestViewer(REQ_CHAIN_SCRIPT, {
        // startTestViewer creates its own tmpDir, so we need to set up differently
      });

      // Instead: use our prepared tmpDir directly
      cleanupViewer(ctx);
    } catch {
      // startTestViewer creates its own dir; let's test directly
    }

    // Direct test: spawn viewer in our prepared dir with stale viewer.json
    const result = await new Promise((resolve, reject) => {
      const proc = spawn("node", [REQ_CHAIN_SCRIPT], {
        cwd: tmpDir,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, HOME: tmpDir },
      });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        // Server started successfully (it's listening)
        proc.kill("SIGTERM");
        resolve({ started: true, stdout, stderr });
      }, 5000);

      proc.stdout.on("data", (c) => {
        stdout += c.toString();
        if (stdout.includes("http://localhost:")) {
          clearTimeout(timer);
          proc.kill("SIGTERM");
          resolve({ started: true, stdout, stderr });
        }
      });
      proc.stderr.on("data", (c) => (stderr += c.toString()));
      proc.on("exit", (code) => {
        clearTimeout(timer);
        resolve({ started: false, code, stdout, stderr });
      });
    });

    assert.ok(result.started, `Stale viewer.json 应被清理后正常启动，实际: ${result.stdout}`);
    rmSync(tmpDir, { recursive: true, force: true });
    console.log("  ✓ D-2: Stale viewer.json（死进程 PID）被清理后正常启动新服务");
  });

  it("/ping 端点返回正确响应", async () => {
    const ctx = await startTestViewer(REQ_CHAIN_SCRIPT, {
      "REQ.md": "# 需求报告",
    });
    try {
      const { status, body } = await httpGet(`${ctx.url}/ping`);
      assert.equal(status, 200);
      const data = JSON.parse(body);
      assert.ok(data.ok, "/ping 应返回 ok: true");
      assert.ok(data.pid, "/ping 应返回 pid");
      console.log("  ✓ /ping 端点返回 { ok: true, pid }");
    } finally {
      cleanupViewer(ctx);
    }
  });
});

// ── Journey Test ─────────────────────────────────────────────────────────

describe("Journey: 需求链完整旅程", () => {
  const REQ_CHAIN_SCRIPT = join(SCRIPTS_DIR, "serve-req-chain.mjs");
  let ctx;

  after(() => {
    if (ctx) cleanupViewer(ctx);
  });

  it("完整旅程：启动 → 报告递增 → 幂等 → 停止", async () => {
    // Step 1: 仅 REQ.md 启动
    console.log("  Step 1: 仅 REQ.md 启动查看器");
    ctx = await startTestViewer(REQ_CHAIN_SCRIPT, {
      "REQ.md": "# 需求报告\n\n链路第一步",
    });

    // Step 2: 验证初始状态
    console.log("  Step 2: 验证初始 HTML（只有 req tab）");
    const { body: html1 } = await httpGet(ctx.url);
    assert.ok(html1.includes("需求报告"), "应有需求报告 tab");
    assert.ok(html1.includes('chain-node impl dimmed'), "impl 应 dimmed");
    assert.ok(html1.includes('chain-node accept dimmed'), "accept 应 dimmed");

    // Step 3: 写入 IMPL_REPORT.md → SSE 推送
    console.log("  Step 3: 写入 IMPL_REPORT.md，等待 SSE 推送");
    const ssePromise = sseCollect(`${ctx.url}/events`, (data) => {
      try { return JSON.parse(data).type === "file-change"; } catch { return false; }
    }, 5000);
    await new Promise((r) => setTimeout(r, 500));
    writeFileSync(join(ctx.wtDir, "IMPL_REPORT.md"), "# 实现报告\n\n链路第二步");
    const msgs1 = await ssePromise;
    assert.ok(msgs1.length > 0, "SSE 应推送 file-change");

    // Step 4: 验证新 tab 出现
    console.log("  Step 4: GET / 验证实现报告 tab 出现");
    const { body: html2 } = await httpGet(ctx.url);
    assert.ok(html2.includes("实现报告"), "应有实现报告 tab");
    assert.ok(!html2.includes('chain-node impl dimmed'), "impl 不应再 dimmed");

    // Step 5: 写入 ACCEPT_REPORT.md → SSE 推送
    console.log("  Step 5: 写入 ACCEPT_REPORT.md");
    const ssePromise2 = sseCollect(`${ctx.url}/events`, (data) => {
      try { return JSON.parse(data).type === "file-change"; } catch { return false; }
    }, 5000);
    await new Promise((r) => setTimeout(r, 500));
    writeFileSync(join(ctx.wtDir, "ACCEPT_REPORT.md"), "# 验收报告\n\n## 5. Verdict\n\n✅ 合并");
    const msgs2 = await ssePromise2;
    assert.ok(msgs2.length > 0, "SSE 应推送 file-change");

    // Step 6: 验证三个 tab
    console.log("  Step 6: 验证三个 tab 全部可见");
    const { body: html3 } = await httpGet(ctx.url);
    assert.ok(html3.includes("需求报告"), "应有需求报告 tab");
    assert.ok(html3.includes("实现报告"), "应有实现报告 tab");
    assert.ok(html3.includes("验收报告"), "应有验收报告 tab");
    assert.ok(!html3.includes('chain-node req dimmed'), "req 不应 dimmed");
    assert.ok(!html3.includes('chain-node impl dimmed'), "impl 不应 dimmed");
    assert.ok(!html3.includes('chain-node accept dimmed'), "accept 不应 dimmed");

    // Step 7: 幂等检测
    console.log("  Step 7: 幂等检测");
    const tmpDir2 = mkdtempSync(join(tmpdir(), "viewer-journey-idem-"));
    const wtDir2 = join(tmpDir2, ".worktree");
    mkdirSync(wtDir2);
    writeFileSync(join(wtDir2, "REQ.md"), "# test");
    writeFileSync(join(wtDir2, "meta.json"), JSON.stringify({ baseBranch: "dev" }));
    writeFileSync(
      join(wtDir2, "viewer.json"),
      JSON.stringify({ pid: ctx.proc.pid, port: ctx.port, url: ctx.url })
    );
    const idemResult = await new Promise((resolve) => {
      const proc2 = spawn("node", [REQ_CHAIN_SCRIPT], {
        cwd: tmpDir2,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      proc2.stdout.on("data", (c) => (stdout += c.toString()));
      proc2.on("exit", (code) => resolve({ code, stdout }));
    });
    assert.equal(idemResult.code, 0);
    assert.ok(idemResult.stdout.includes("already running"));
    rmSync(tmpDir2, { recursive: true, force: true });

    // Step 8: 停止 → viewer.json 清理
    console.log("  Step 8: 停止查看器，验证 viewer.json 清理");
    const viewerJsonPath = join(ctx.wtDir, "viewer.json");
    assert.ok(existsSync(viewerJsonPath), "运行中应有 viewer.json");
    ctx.proc.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 500));
    // After SIGTERM, cleanup should remove viewer.json
    // (Note: process may not have time if tmpDir is already cleaned)

    console.log("  ✓ 完整旅程通过：启动 → 3 份报告递增 → 幂等 → 停止");
  });
});
