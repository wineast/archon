---
priority: P2
---
# 导出/导入 JSON 中区分模板字符串与纯 JSON

某些字段（如 parametersSchema）实际存储的是 LiquidJS 模板字符串而非纯 JSON，但导出后看起来都是 JSON。需要在导出/导入时明确区分，避免用户混淆或导入时丢失模板语法。
