---
priority: P2
---
# SWR fetcher 未检查 HTTP 状态码

## Symptom（看到了什么）
多个 SWR fetcher 使用 `fetch(url).then(r => r.json())` 模式，未检查 `r.ok`。HTTP 404/500 响应不会触发 SWR 的 error 回调，而是尝试 JSON 解析响应体——可能导致静默失败或错误数据。

## Trigger（怎么触发的）
代码扫描发现。涉及文件：
- `web/src/lib/session/hooks.ts`
- `web/src/lib/memory/hooks.ts`
- 其他使用相同 fetcher 模式的 hooks

## Locale（大概在哪）
`web/src/lib/` 下的各种 SWR hooks。

## Hypothesis（猜是什么原因）
初始开发时 API 总是返回 200，后来随着错误处理完善，部分 API 开始返回非 200 状态码，但 fetcher 没有同步更新。建议统一封装一个带状态检查的 fetcher。
