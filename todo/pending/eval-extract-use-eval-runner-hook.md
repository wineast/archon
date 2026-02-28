---
priority: P2
---
# 抽取 useEvalRunner hook

CaseDetail 与 ResultsPanel 中的 eval run 3-step 流程（create run → execute cases → finalize）逻辑重复，抽取为共享 hook。
