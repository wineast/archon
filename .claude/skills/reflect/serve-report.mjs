#!/usr/bin/env node
/**
 * Reflect Report Viewer
 * 元认知经验提取：经验报告 → 补丁提案
 *
 * Usage: node .claude/skills/reflect/serve-report.mjs
 */

import { startViewer } from "../shared/report-viewer.mjs";

startViewer({
  reports: [
    { key: "reflect", path: "REFLECT.md", label: "经验报告", badge: "reflect" },
    { key: "patches", path: "REFLECT_PATCHES.md", label: "补丁提案", badge: "patches" },
  ],
  chain: [
    { key: "reflect", label: "经验报告", cssClass: "reflect" },
    { key: "patches", label: "补丁提案", cssClass: "patches" },
  ],
  defaultTab: "patches",
  requiredFile: "REFLECT.md",
  verdictSource: null,
  actions: false,
});
