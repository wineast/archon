#!/usr/bin/env node
/**
 * Capability Guard Report Viewer
 * 需求链路：需求报告 → 实现报告 → 验收报告 → 守护规约 → 守护报告
 *
 * Usage: node .claude/skills/cap-guard/serve-report.mjs
 */

import { startViewer } from "../shared/report-viewer.mjs";

startViewer({
  reports: [
    { key: "req", path: "REQ.md", label: "需求报告", badge: "req" },
    { key: "impl", path: "IMPL_REPORT.md", label: "实现报告", badge: "impl" },
    { key: "accept", path: "ACCEPT_REPORT.md", label: "验收报告", badge: "accept" },
    { key: "guard", path: "CAP_GUARD.md", label: "守护规约", badge: "guard" },
    { key: "report", path: "CAP_GUARD_REPORT.md", label: "守护报告", badge: "report" },
  ],
  chain: [
    { key: "req", label: "需求报告", cssClass: "req" },
    { key: "impl", label: "实现报告", cssClass: "impl" },
    { key: "accept", label: "验收报告", cssClass: "accept" },
    { key: "guard", label: "守护规约", cssClass: "guard" },
    { key: "report", label: "守护报告", cssClass: "report" },
  ],
  defaultTab: "report",
  requiredFile: "CAP_GUARD.md",
  verdictSource: "report",
  actions: true,
});
