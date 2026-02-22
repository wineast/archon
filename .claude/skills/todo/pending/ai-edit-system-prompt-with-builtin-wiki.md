# AI 辅助编辑需要系统提示词 + builtin wiki + 字段上下文变量

1. AI 辅助编辑目前没有系统提示词
2. 需要创建 builtin wiki 文档（内容来自 guide 目录）
3. 增加系统变量：当前辅助编辑所在的字段是什么（如 modelConfig 的系统提示词）
4. 根据字段上下文系统变量动态获取对应的 builtin wiki 文档作为 AI 编辑的参考
