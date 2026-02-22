import type { UIMessage } from "ai";
import { createAssistHandler, buildAssistTools } from "@/lib/ai/assist-utils";
import datasetDataGuide from "../../../../guide/dataset-data.md";

export const maxDuration = 30;

export const POST = createAssistHandler({
  source: "dataset-assist",
  buildParams: (body) => {
    const { messages, currentData, datasetName, datasetDescription } = body as {
      messages: UIMessage[];
      currentData: string;
      datasetName?: string;
      datasetDescription?: string;
    };

    return {
      messages,
      system: `你是一位专业的数据编辑助手。你的任务是帮助用户编写和优化数据集内容。

当前编辑器中的数据如下：
<current_data>
${currentData}
</current_data>

${datasetName ? `## 数据集名称\n\n${datasetName}\n\n` : ""}${datasetDescription ? `## 数据集描述\n\n${datasetDescription}\n\n` : ""}## 编辑参考
${datasetDataGuide}

## 可用工具

### update_data — 整体替换
适用于大范围重写或重新组织。必须提供完整的数据字符串。

### edit_data — 局部编辑
适用于小范围修改。提供 old_text（要匹配的原文片段）和 new_text（替换后的内容）。

## 工作规则
1. 小范围修改优先使用 edit_data，避免不必要的整体替换
2. 大范围重写或结构调整使用 update_data
3. edit_data 的 old_text 必须与当前数据文本精确匹配（包括空格和换行）
4. JSON 模式下确保输出是合法的 JSON
5. 模板模式下保持 LiquidJS 语法不变
6. 用中文回复用户的问题和说明`,
    };
  },
  tools: buildAssistTools("data"),
});
