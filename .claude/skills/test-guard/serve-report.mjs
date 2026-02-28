#!/usr/bin/env node
/**
 * Test Guard Report Viewer
 * 缺陷链路：缺陷报告 → 修复报告 → 验证报告 → 测试守护（可选）
 *
 * Usage: node .claude/skills/test-guard/serve-report.mjs
 */

import { startViewer } from "../shared/report-viewer.mjs";

startViewer({
  reports: [
    { key: "defect", path: "DEFECT.md", label: "缺陷报告", badge: "defect" },
    { key: "fix", path: "FIX_REPORT.md", label: "修复报告", badge: "fix" },
    { key: "verify", path: "VERIFY_REPORT.md", label: "验证报告", badge: "verify" },
    { key: "guard", path: "TEST_SPEC.md", label: "测试守护", badge: "guard", optional: true },
  ],
  chain: [
    { key: "defect", label: "缺陷报告", cssClass: "defect" },
    { key: "fix", label: "修复报告", cssClass: "fix" },
    { key: "verify", label: "验证报告", cssClass: "verify" },
    { key: "guard", label: "测试守护", cssClass: "guard", optional: true },
  ],
  defaultTab: "last",
  requiredFile: "VERIFY_REPORT.md",
  verdictSource: "verify",
  actions: true,
});
