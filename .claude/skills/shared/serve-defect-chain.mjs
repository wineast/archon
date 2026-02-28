#!/usr/bin/env node
/**
 * Defect Chain Report Viewer
 * 缺陷链路：缺陷报告 → 修复报告 → 验证报告 → 测试守护
 *
 * 所有报告均为 optional，支持链路任意阶段启动。
 * 幂等：已有 viewer 进程运行时自动跳过。
 *
 * Usage: node .claude/skills/shared/serve-defect-chain.mjs
 */

import { startViewer } from "./report-viewer.mjs";

startViewer({
  reports: [
    { key: "defect", path: "DEFECT.md", label: "缺陷报告", badge: "defect", optional: true },
    { key: "fix", path: "FIX_REPORT.md", label: "修复报告", badge: "fix", optional: true },
    { key: "verify", path: "VERIFY_REPORT.md", label: "验证报告", badge: "verify", optional: true },
    { key: "guard", path: "TEST_SPEC.md", label: "测试守护", badge: "guard", optional: true },
  ],
  chain: [
    { key: "defect", label: "缺陷报告", cssClass: "defect" },
    { key: "fix", label: "修复报告", cssClass: "fix" },
    { key: "verify", label: "验证报告", cssClass: "verify" },
    { key: "guard", label: "测试守护", cssClass: "guard", optional: true },
  ],
  defaultTab: "last",
  verdictSource: "verify",
  actions: true,
});
