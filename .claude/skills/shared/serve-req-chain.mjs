#!/usr/bin/env node
/**
 * Requirement Chain Report Viewer
 * 需求链路：需求报告 → 实现报告 → 验收报告 → 守护规约 → 守护报告
 *
 * 所有报告均为 optional，支持链路任意阶段启动。
 * 幂等：已有 viewer 进程运行时自动跳过。
 *
 * Usage: node .claude/skills/shared/serve-req-chain.mjs
 */

import { startViewer } from "./report-viewer.mjs";

startViewer({
  reports: [
    { key: "req", path: "REQ.md", label: "需求报告", badge: "req", optional: true },
    { key: "impl", path: "IMPL_REPORT.md", label: "实现报告", badge: "impl", optional: true },
    { key: "accept", path: "ACCEPT_REPORT.md", label: "验收报告", badge: "accept", optional: true },
    { key: "guard", path: "CAP_GUARD.md", label: "守护规约", badge: "guard", optional: true },
    { key: "report", path: "CAP_GUARD_REPORT.md", label: "守护报告", badge: "report", optional: true },
  ],
  chain: [
    { key: "req", label: "需求报告", cssClass: "req" },
    { key: "impl", label: "实现报告", cssClass: "impl" },
    { key: "accept", label: "验收报告", cssClass: "accept" },
    { key: "guard", label: "守护规约", cssClass: "guard", optional: true },
    { key: "report", label: "守护报告", cssClass: "report", optional: true },
  ],
  defaultTab: "last",
  verdictSource: "accept",
  actions: true,
});
