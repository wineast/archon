#!/usr/bin/env node
/**
 * Release Report Viewer
 * 集成链路：集成报告 → 发布检查
 *
 * Usage: node .claude/skills/release/serve-report.mjs
 */

import { startViewer } from "../shared/report-viewer.mjs";

startViewer({
  reports: [
    { key: "integrate", path: "INTEGRATE.md", label: "集成报告", badge: "integrate" },
    { key: "release", path: "RELEASE_REPORT.md", label: "发布检查", badge: "release" },
  ],
  chain: [
    { key: "integrate", label: "集成报告", cssClass: "integrate" },
    { key: "release", label: "发布检查", cssClass: "release" },
  ],
  defaultTab: "release",
  requiredFile: "RELEASE_REPORT.md",
  verdictSource: "release",
  actions: true,
});
