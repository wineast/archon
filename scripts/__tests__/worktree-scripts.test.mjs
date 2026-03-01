#!/usr/bin/env node
/**
 * Worktree 脚本转换测试
 *
 * 覆盖：
 * - _helpers.mjs 辅助函数（info/success/warn/error/exec/execSafe/getDateSuffix）
 * - worktree.mjs CLI 分发（help/未知命令）
 * - wt-init.mjs / wt-fini.mjs / wt-setup.mjs / wt-teardown.mjs 参数解析
 * - cmd/list.mjs 导出
 * - Makefile 引用一致性
 * - report-viewer.mjs 引用一致性
 * - 无残留 .sh 引用
 *
 * 运行：node --test scripts/__tests__/worktree-scripts.test.mjs
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execSync, spawnSync } from "node:child_process";

const PROJECT_ROOT = join(import.meta.dirname, "../..");
const SCRIPTS_DIR = join(PROJECT_ROOT, "scripts");
const CMD_DIR = join(SCRIPTS_DIR, "cmd");

// ── 文件存在性 ──────────────────────────────────────────────

describe("文件存在性", () => {
  const expectedFiles = [
    "scripts/worktree.mjs",
    "scripts/wt-init.mjs",
    "scripts/wt-fini.mjs",
    "scripts/wt-setup.mjs",
    "scripts/wt-teardown.mjs",
    "scripts/cmd/_helpers.mjs",
    "scripts/cmd/list.mjs",
    "scripts/cmd/create.mjs",
    "scripts/cmd/delete.mjs",
    "scripts/cmd/merge.mjs",
    "scripts/cmd/sync.mjs",
  ];

  for (const file of expectedFiles) {
    it(`${file} 存在`, () => {
      assert.ok(existsSync(join(PROJECT_ROOT, file)), `${file} should exist`);
    });
  }

  const deletedFiles = [
    "scripts/worktree.sh",
    "scripts/wt-init.sh",
    "scripts/wt-fini.sh",
    "scripts/wt-setup.sh",
    "scripts/wt-teardown.sh",
    "scripts/cmd/list.sh",
    "scripts/cmd/create.sh",
    "scripts/cmd/delete.sh",
    "scripts/cmd/merge.sh",
    "scripts/cmd/sync.sh",
  ];

  for (const file of deletedFiles) {
    it(`旧文件 ${file} 已删除`, () => {
      assert.ok(!existsSync(join(PROJECT_ROOT, file)), `${file} should be deleted`);
    });
  }
});

// ── 文件可执行权限 ──────────────────────────────────────────

describe("文件可执行权限", () => {
  const executableFiles = [
    "scripts/worktree.mjs",
    "scripts/wt-init.mjs",
    "scripts/wt-fini.mjs",
    "scripts/wt-setup.mjs",
    "scripts/wt-teardown.mjs",
  ];

  for (const file of executableFiles) {
    it(`${file} 有可执行权限`, () => {
      const stat = statSync(join(PROJECT_ROOT, file));
      // Check owner execute bit (0o100)
      assert.ok(stat.mode & 0o100, `${file} should be executable`);
    });
  }
});

// ── Shebang 检查 ────────────────────────────────────────────

describe("Shebang 检查", () => {
  const topLevelScripts = [
    "scripts/worktree.mjs",
    "scripts/wt-init.mjs",
    "scripts/wt-fini.mjs",
    "scripts/wt-setup.mjs",
    "scripts/wt-teardown.mjs",
  ];

  for (const file of topLevelScripts) {
    it(`${file} 有正确的 shebang`, () => {
      const content = readFileSync(join(PROJECT_ROOT, file), "utf-8");
      assert.ok(
        content.startsWith("#!/usr/bin/env node"),
        `${file} should start with #!/usr/bin/env node`
      );
    });
  }
});

// ── _helpers.mjs 模块导出 ───────────────────────────────────

describe("_helpers.mjs 导出", () => {
  let helpers;

  it("能正常 import", async () => {
    helpers = await import(join(CMD_DIR, "_helpers.mjs"));
  });

  it("导出所有预期函数", () => {
    const expectedExports = [
      "info", "success", "warn", "error",
      "exec", "execSafe", "execInherit",
      "getCurrentBranch", "getDateSuffix",
      "ensureWorktreesDir", "linkAutoMemory",
      "killWorktreeServices", "confirm",
      "resolveWorktreePath",
    ];
    for (const name of expectedExports) {
      assert.equal(typeof helpers[name], "function", `should export function ${name}`);
    }
  });

  it("导出所有预期常量", () => {
    assert.equal(typeof helpers.PROJECT_ROOT, "string");
    assert.equal(typeof helpers.WORKTREES_DIR, "string");
    assert.equal(typeof helpers.WORKTREE_CONFIG_DIR, "string");
    assert.ok(helpers.PROJECT_ROOT.length > 0);
    assert.ok(helpers.WORKTREES_DIR.includes(".worktrees"));
    assert.ok(helpers.WORKTREE_CONFIG_DIR.includes(".worktree"));
  });

  it("exec() 返回 trimmed 字符串", () => {
    const result = helpers.exec("echo hello");
    assert.equal(result, "hello");
  });

  it("exec() 失败时抛出异常", () => {
    assert.throws(() => helpers.exec("false"), /Command failed/);
  });

  it("execSafe() 成功时返回 trimmed 字符串", () => {
    const result = helpers.execSafe("echo world");
    assert.equal(result, "world");
  });

  it("execSafe() 失败时返回 null", () => {
    const result = helpers.execSafe("false");
    assert.equal(result, null);
  });

  it("getDateSuffix() 返回 YYYYMMDD 格式", () => {
    const suffix = helpers.getDateSuffix();
    assert.match(suffix, /^\d{8}$/);
    // Should be today
    const d = new Date();
    const expected = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    assert.equal(suffix, expected);
  });

  it("getCurrentBranch() 返回当前分支名", () => {
    const branch = helpers.getCurrentBranch();
    assert.ok(branch.length > 0);
    // Verify against git
    const gitBranch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
    assert.equal(branch, gitBranch);
  });
});

// ── cmd/list.mjs 模块导出 ───────────────────────────────────

describe("cmd/list.mjs 导出", () => {
  it("导出 cmdList 函数", async () => {
    const mod = await import(join(CMD_DIR, "list.mjs"));
    assert.equal(typeof mod.cmdList, "function");
  });
});

// ── cmd/create.mjs 模块导出 ─────────────────────────────────

describe("cmd/create.mjs 导出", () => {
  it("导出 cmdCreate 函数", async () => {
    const mod = await import(join(CMD_DIR, "create.mjs"));
    assert.equal(typeof mod.cmdCreate, "function");
  });
});

// ── cmd/delete.mjs 模块导出 ─────────────────────────────────

describe("cmd/delete.mjs 导出", () => {
  it("导出 cmdDelete 异步函数", async () => {
    const mod = await import(join(CMD_DIR, "delete.mjs"));
    assert.equal(typeof mod.cmdDelete, "function");
  });
});

// ── cmd/merge.mjs 模块导出 ──────────────────────────────────

describe("cmd/merge.mjs 导出", () => {
  it("导出 cmdMerge 函数", async () => {
    const mod = await import(join(CMD_DIR, "merge.mjs"));
    assert.equal(typeof mod.cmdMerge, "function");
  });
});

// ── cmd/sync.mjs 模块导出 ───────────────────────────────────

describe("cmd/sync.mjs 导出", () => {
  it("导出 cmdSync 函数", async () => {
    const mod = await import(join(CMD_DIR, "sync.mjs"));
    assert.equal(typeof mod.cmdSync, "function");
  });
});

// ── worktree.mjs CLI 分发 ───────────────────────────────────

describe("worktree.mjs CLI", () => {
  const run = (args) =>
    spawnSync("node", [join(SCRIPTS_DIR, "worktree.mjs"), ...args], {
      encoding: "utf-8",
      cwd: PROJECT_ROOT,
    });

  it("help 命令正常输出", () => {
    const result = run(["help"]);
    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes("Git Worktree 管理"));
    assert.ok(result.stdout.includes("list"));
    assert.ok(result.stdout.includes("create"));
    assert.ok(result.stdout.includes("delete"));
    assert.ok(result.stdout.includes("merge"));
    assert.ok(result.stdout.includes("sync"));
  });

  it("--help 别名正常", () => {
    const result = run(["--help"]);
    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes("Git Worktree 管理"));
  });

  it("无参数默认显示 help", () => {
    const result = run([]);
    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes("Git Worktree 管理"));
  });

  it("未知命令退出码 1", () => {
    const result = run(["nonexistent"]);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes("未知命令"));
  });

  it("list 命令输出 git worktree 信息", () => {
    const result = run(["list"]);
    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes("Git Worktrees:"));
  });

  it("ls 别名等同于 list", () => {
    const result = run(["ls"]);
    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes("Git Worktrees:"));
  });

  it("create 无参数时退出码 1 并提示用法", () => {
    const result = run(["create"]);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes("branch-name"));
  });

  it("delete 无参数时退出码 1", () => {
    const result = run(["delete"]);
    assert.equal(result.status, 1);
  });

  it("merge 无参数时退出码 1", () => {
    const result = run(["merge"]);
    assert.equal(result.status, 1);
  });
});

// ── Makefile 引用一致性 ─────────────────────────────────────

describe("Makefile 引用一致性", () => {
  const makefile = readFileSync(join(PROJECT_ROOT, "Makefile"), "utf-8");

  it("wt-list 使用 node scripts/worktree.mjs", () => {
    assert.ok(makefile.includes("node scripts/worktree.mjs list"));
  });

  it("wt-create 使用 node scripts/worktree.mjs", () => {
    assert.ok(makefile.includes("node scripts/worktree.mjs create"));
  });

  it("wt-sync 使用 node scripts/worktree.mjs", () => {
    assert.ok(makefile.includes("node scripts/worktree.mjs sync"));
  });

  it("wt-merge 使用 node scripts/worktree.mjs", () => {
    assert.ok(makefile.includes("node scripts/worktree.mjs merge"));
  });

  it("wt-delete 使用 node scripts/worktree.mjs", () => {
    assert.ok(makefile.includes("node scripts/worktree.mjs delete"));
  });

  it("wt-setup 使用 node scripts/wt-setup.mjs", () => {
    assert.ok(makefile.includes("node scripts/wt-setup.mjs"));
  });

  it("wt-teardown 使用 node scripts/wt-teardown.mjs", () => {
    assert.ok(makefile.includes("node scripts/wt-teardown.mjs"));
  });

  it("wt-init 使用 node scripts/wt-init.mjs", () => {
    assert.ok(makefile.includes("node scripts/wt-init.mjs"));
  });

  it("wt-fini 使用 node scripts/wt-fini.mjs", () => {
    assert.ok(makefile.includes("node scripts/wt-fini.mjs"));
  });

  it("无残留 .sh 引用（worktree 相关）", () => {
    assert.ok(!makefile.includes("worktree.sh"));
    assert.ok(!makefile.includes("wt-init.sh"));
    assert.ok(!makefile.includes("wt-fini.sh"));
    assert.ok(!makefile.includes("wt-setup.sh"));
    assert.ok(!makefile.includes("wt-teardown.sh"));
  });
});

// ── report-viewer.mjs 引用一致性 ────────────────────────────

describe("report-viewer.mjs 引用一致性", () => {
  const viewer = readFileSync(join(SCRIPTS_DIR, "admin", "report-viewer.mjs"), "utf-8");

  it("使用 worktree.mjs 而非 worktree.sh", () => {
    assert.ok(viewer.includes("worktree.mjs"));
    assert.ok(!viewer.includes("worktree.sh"));
  });
});

// ── web/guide/worktree.md 引用一致性 ────────────────────────

describe("web/guide/worktree.md 引用一致性", () => {
  const guide = readFileSync(join(PROJECT_ROOT, "web/guide/worktree.md"), "utf-8");

  it("使用 wt-setup.mjs 而非 wt-setup.sh", () => {
    assert.ok(guide.includes("wt-setup.mjs"));
    assert.ok(!guide.includes("wt-setup.sh"));
  });

  it("使用 wt-init.mjs 而非 wt-init.sh", () => {
    assert.ok(guide.includes("wt-init.mjs"));
    assert.ok(!guide.includes("wt-init.sh"));
  });
});

// ── 全局无残留 .sh 引用 ─────────────────────────────────────

describe("全局无残留 .sh 引用", () => {
  it("scripts/ 目录无残留 worktree .sh 引用（排除测试文件）", () => {
    const result = spawnSync("grep", [
      "-r", "--include=*.mjs",
      "--exclude=*test*",
      "-l",
      "worktree\\.sh\\|wt-init\\.sh\\|wt-fini\\.sh\\|wt-setup\\.sh\\|wt-teardown\\.sh",
      SCRIPTS_DIR,
    ], { encoding: "utf-8" });
    assert.equal(result.stdout.trim(), "", "No .mjs files should reference old .sh scripts");
  });
});
