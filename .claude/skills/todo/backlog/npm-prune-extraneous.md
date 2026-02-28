---
priority: P3
---
# 清理 node_modules 中的 extraneous 包

`npm ls` 显示 6 个 extraneous 包（`@emnapi/core`, `@emnapi/runtime`, `@emnapi/wasi-threads`, `@napi-rs/wasm-runtime`, `@tybys/wasm-util`, `@types/prop-types`）。可能是之前安装后又从 package.json 移除的残留。`npm prune` 即可清理。

> Anchor: `web/package.json`, 运行 `cd web && npm prune`
