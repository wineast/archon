import type { ResourceSummary } from "./resource-summary";

/**
 * Build system prompt for the Build Chat assistant.
 * Injects current resource state so the AI knows what already exists.
 */
export function buildSystemPrompt(summary: ResourceSummary): string {
  const sections: string[] = [];

  sections.push(`你是 Archon Agent 配置助手。用户通过对话操作当前 Agent 的所有资源。

## 操作规范
- 使用中文回复
- key 字段使用 snake_case 格式
- 修改或删除前先确认当前状态
- 创建资源时自动生成合理的 key（基于 name 的英文翻译）
- 操作完成后简洁告知结果
- 如果用户意图不明确，先列出现有资源让用户选择`);

  // Tools
  if (summary.tools.length > 0) {
    const list = summary.tools
      .map(
        (t) =>
          `- ${t.name} (key: ${t.key}, id: ${t.id}, ${t.enabled ? "启用" : "禁用"}): ${t.description}`
      )
      .join("\n");
    sections.push(`## 当前工具 (${summary.tools.length})\n${list}`);
  } else {
    sections.push("## 当前工具\n暂无工具");
  }

  // Schemas
  if (summary.schemas.length > 0) {
    const list = summary.schemas
      .map((s) => `- ${s.name} (key: ${s.key}, id: ${s.id}): ${s.description}`)
      .join("\n");
    sections.push(`## 当前 Schema (${summary.schemas.length})\n${list}`);
  } else {
    sections.push("## 当前 Schema\n暂无 Schema");
  }

  // Wiki
  if (summary.wiki.length > 0) {
    const list = summary.wiki
      .map((w) => `- ${w.name} (key: ${w.key}, id: ${w.id})`)
      .join("\n");
    sections.push(`## 当前 Wiki (${summary.wiki.length})\n${list}`);
  } else {
    sections.push("## 当前 Wiki\n暂无 Wiki 文档");
  }

  // Datasets
  if (summary.datasets.length > 0) {
    const list = summary.datasets
      .map((d) => `- ${d.name} (key: ${d.key}, id: ${d.id}): ${d.description}`)
      .join("\n");
    sections.push(`## 当前数据集 (${summary.datasets.length})\n${list}`);
  } else {
    sections.push("## 当前数据集\n暂无数据集");
  }

  // Functions
  if (summary.functions.length > 0) {
    const list = summary.functions
      .map((f) => `- ${f.name} (key: ${f.key}, id: ${f.id}): ${f.description}`)
      .join("\n");
    sections.push(`## 当前函数 (${summary.functions.length})\n${list}`);
  } else {
    sections.push("## 当前函数\n暂无函数");
  }

  // Components
  if (summary.components.length > 0) {
    const schemaMap = new Map(summary.schemas.map((s) => [s.id, s.name]));
    const list = summary.components
      .map((c) => {
        let line = `- ${c.name} (key: ${c.key}, id: ${c.id}): ${c.description}`;
        const inputName = c.toolInputSchemaId ? schemaMap.get(c.toolInputSchemaId) : null;
        const outputName = c.toolOutputSchemaId ? schemaMap.get(c.toolOutputSchemaId) : null;
        if (inputName || outputName) {
          const parts: string[] = [];
          if (inputName) parts.push(`input: ${inputName}`);
          if (outputName) parts.push(`output: ${outputName}`);
          line += ` [schema: ${parts.join(", ")}]`;
        }
        return line;
      })
      .join("\n");
    sections.push(`## 当前组件 (${summary.components.length})\n${list}`);
  } else {
    sections.push("## 当前组件\n暂无组件");
  }

  // Model Configs
  if (summary.modelConfigs.length > 0) {
    const list = summary.modelConfigs
      .map(
        (m) =>
          `- ${m.name} (key: ${m.key}, id: ${m.id}, model: ${m.modelId}${m.isActive ? ", 活跃" : ""})`
      )
      .join("\n");
    sections.push(
      `## 当前模型配置 (${summary.modelConfigs.length})\n${list}`
    );
  } else {
    sections.push("## 当前模型配置\n暂无模型配置");
  }

  // Chat Config
  if (summary.chatConfig) {
    const c = summary.chatConfig;
    sections.push(
      `## 当前聊天配置\n- id: ${c.id}\n- title: ${c.title}\n- welcomeTitle: ${c.welcomeTitle}\n- placeholder: ${c.placeholder}\n- suggestions: ${c.suggestions.length > 0 ? c.suggestions.join(", ") : "无"}`
    );
  } else {
    sections.push("## 当前聊天配置\n暂未配置");
  }

  // Ontology
  if (summary.objectTypes.length > 0) {
    const list = summary.objectTypes
      .map(
        (t) => `- ${t.name} (key: ${t.key}, id: ${t.id}): ${t.description}`
      )
      .join("\n");
    sections.push(
      `## 当前对象类型 (${summary.objectTypes.length})\n${list}`
    );
  } else {
    sections.push("## 当前对象类型\n暂无对象类型");
  }

  if (summary.objectRelations.length > 0) {
    const list = summary.objectRelations
      .map(
        (r) =>
          `- ${r.name} (key: ${r.key}, id: ${r.id}): ${r.sourceTypeId} → ${r.targetTypeId} (${r.relationType})`
      )
      .join("\n");
    sections.push(
      `## 当前对象关系 (${summary.objectRelations.length})\n${list}`
    );
  } else {
    sections.push("## 当前对象关系\n暂无对象关系");
  }

  // Skills
  if (summary.skills.length > 0) {
    const list = summary.skills
      .map(
        (s) =>
          `- ${s.name} (key: ${s.key}, id: ${s.id}, order: ${s.order}, ${s.enabled ? "启用" : "禁用"}): ${s.description}`
      )
      .join("\n");
    sections.push(`## 当前技能 (${summary.skills.length})\n${list}`);
  } else {
    sections.push("## 当前技能\n暂无技能");
  }

  return sections.join("\n\n");
}
