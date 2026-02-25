import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ResultCard } from "../result-card";
import type { EvalResult } from "@/lib/eval/types";

const meta = {
  title: "Eval/ResultCard",
  component: ResultCard,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-[600px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ResultCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/* ── mock data ── */

const MARKDOWN_RESPONSE = `## 空调故障排查指南

根据您描述的情况，空调不制冷可能有以下几个原因：

### 1. 制冷剂不足
- **症状**：空调运行但出风口温度不低
- **解决方案**：联系专业技师补充制冷剂

### 2. 滤网堵塞
清洗步骤：
1. 关闭电源
2. 打开前面板
3. 取出滤网用水冲洗
4. 晾干后装回

### 3. 压缩机故障
如果以上方法都无效，可能是压缩机问题，建议拨打售后热线 **400-123-4567**。

> 💡 建议每年至少清洗一次滤网，可有效延长空调寿命。

| 故障类型 | 自行处理 | 需要报修 |
|---------|---------|---------|
| 滤网堵塞 | ✅ | ❌ |
| 制冷剂不足 | ❌ | ✅ |
| 压缩机故障 | ❌ | ✅ |`;

const MARKDOWN_RESPONSE_SHORT = `好的，已为您查询到以下信息：

- **型号**: GMCC-3000
- **保修状态**: 保修期内（剩余 **186 天**）
- **上次维修**: 2024-08-15

如需进一步帮助，请告诉我。`;

const singleResult: EvalResult = {
  caseId: "case-1",
  caseName: "空调不制冷咨询",
  mode: "single",
  turns: [{ id: "t1", role: "user", content: "我的空调开了但是不制冷，怎么办？" }],
  chatMessages: [
    { role: "user", content: "我的空调开了但是不制冷，怎么办？" },
    { role: "assistant", content: MARKDOWN_RESPONSE },
  ],
  turnResults: [],
  chatResponse: MARKDOWN_RESPONSE,
  assertionResults: [
    {
      assertion: { id: "a1", type: "contains", value: "制冷剂" },
      passed: true,
      message: 'Response contains "制冷剂"',
    },
    {
      assertion: { id: "a2", type: "contains", value: "滤网" },
      passed: true,
      message: 'Response contains "滤网"',
    },
    {
      assertion: { id: "a3", type: "length-min", value: "100" },
      passed: true,
      message: "Response length ≥ 100 characters",
    },
  ],
  allAssertionsPassed: true,
  judgeResult: {
    scores: {
      专业性: { score: 9, reason: "回答涵盖了多种可能的故障原因，并给出了专业的排查步骤" },
      实用性: { score: 8, reason: "提供了具体的清洗步骤和售后热线，用户可直接操作" },
      友好度: { score: 7, reason: "语言清晰但偏专业，可以更口语化" },
    },
    overallScore: 8,
  },
  timestamp: Date.now(),
  durationMs: 2340,
};

const singleWithToolCalls: EvalResult = {
  ...singleResult,
  caseName: "查询保修状态（含工具调用）",
  chatMessages: [
    { role: "user", content: "帮我查一下我的空调保修状态" },
    {
      role: "assistant",
      content: MARKDOWN_RESPONSE_SHORT,
      toolCalls: [
        {
          name: "query_warranty",
          args: { product_id: "GMCC-3000", customer_id: "C-20240001" },
        },
      ],
    },
  ],
  chatResponse: MARKDOWN_RESPONSE_SHORT,
  assertionResults: [
    {
      assertion: { id: "a1", type: "tool-called", value: "query_warranty" },
      passed: true,
      message: 'Tool "query_warranty" was called',
    },
    {
      assertion: { id: "a2", type: "contains", value: "保修" },
      passed: true,
      message: 'Response contains "保修"',
    },
  ],
  durationMs: 1560,
};

const singleFailed: EvalResult = {
  ...singleResult,
  caseName: "错误回答示例",
  chatResponse: "请联系客服。",
  chatMessages: [
    { role: "user", content: "空调不制冷怎么办？" },
    { role: "assistant", content: "请联系客服。" },
  ],
  assertionResults: [
    {
      assertion: { id: "a1", type: "contains", value: "制冷剂" },
      passed: false,
      message: 'Response does not contain "制冷剂"',
    },
    {
      assertion: { id: "a2", type: "length-min", value: "100" },
      passed: false,
      message: "Response length 5 < 100",
    },
  ],
  allAssertionsPassed: false,
  judgeResult: {
    scores: {
      专业性: { score: 2, reason: "回答过于简短，未提供任何排查建议" },
      实用性: { score: 1, reason: "没有可操作的信息" },
      友好度: { score: 3, reason: "语气冷淡" },
    },
    overallScore: 2,
  },
  durationMs: 890,
};

const injectedResult: EvalResult = {
  caseId: "case-2",
  caseName: "注入历史后追问维修进度",
  mode: "injected",
  turns: [
    { id: "t1", role: "user", content: "我上次报修的空调，现在进度怎么样了？" },
    {
      id: "t2",
      role: "assistant",
      content: "我来帮您查询一下维修进度。",
      toolCalls: [
        { name: "query_repair_status", args: { order_id: "R-20240815" }, result: '{"status":"in_progress","eta":"2024-09-01"}' },
      ],
    },
    { id: "t3", role: "user", content: "能快点吗？我这边很着急" },
  ],
  chatMessages: [
    { role: "user", content: "我上次报修的空调，现在进度怎么样了？", injected: true },
    {
      role: "assistant",
      content: "我来帮您查询一下维修进度。",
      injected: true,
      toolCalls: [
        { name: "query_repair_status", args: { order_id: "R-20240815" } },
      ],
    },
    { role: "user", content: "能快点吗？我这边很着急" },
    {
      role: "assistant",
      content: `非常理解您的心情！根据系统记录：

### 维修进度

- **工单号**: R-20240815
- **当前状态**: 维修中
- **预计完成**: 2024-09-01

我已帮您标记为 **加急工单**，维修团队会优先处理。如有进展会第一时间通知您。

还有其他需要帮助的吗？`,
    },
  ],
  turnResults: [
    {
      turnIndex: 2,
      role: "user",
      assertionResults: [
        {
          assertion: { id: "a1", type: "contains", value: "加急" },
          passed: true,
          message: 'Response contains "加急"',
        },
      ],
      judgeResult: {
        scores: {
          共情能力: { score: 9, reason: "积极回应了用户的焦急情绪" },
          解决效率: { score: 8, reason: "查询了进度并提供了加急操作" },
        },
        overallScore: 9,
      },
    },
  ],
  chatResponse: "",
  assertionResults: [],
  allAssertionsPassed: true,
  judgeResult: {
    scores: {
      共情能力: { score: 9, reason: "积极回应了用户的焦急情绪" },
      解决效率: { score: 8, reason: "查询了进度并提供了加急操作" },
    },
    overallScore: 9,
  },
  timestamp: Date.now(),
  durationMs: 3120,
};

const sequentialResult: EvalResult = {
  caseId: "case-3",
  caseName: "多轮顺序对话 — 故障诊断",
  mode: "sequential",
  turns: [
    { id: "t1", role: "user", content: "空调有异响" },
    { id: "t2", role: "user", content: "是嗡嗡声，开机几分钟后出现" },
    {
      id: "t3",
      role: "user",
      content: "外机声音更大",
      assertions: [
        { id: "a1", type: "contains", value: "压缩机" },
        { id: "a2", type: "tool-called", value: "schedule_repair" },
      ],
      judge: true,
    },
  ],
  chatMessages: [
    { role: "user", content: "空调有异响" },
    {
      role: "assistant",
      content: `收到，空调异响有多种可能。为了更准确地判断，我需要了解几个信息：

1. **异响的类型**是什么？（嗡嗡声、咔咔声、滴水声等）
2. **什么时候出现**？（开机即有、运行一段时间后、关机时）
3. **室内机还是室外机**？`,
    },
    { role: "user", content: "是嗡嗡声，开机几分钟后出现" },
    {
      role: "assistant",
      content: `嗡嗡声 + 开机后出现，可能的原因：

- **风扇叶片松动** — 共振导致嗡鸣
- **压缩机启动噪音** — 正常范围内的声响
- **管路振动** — 制冷剂流动引起

请问声音是从 **室内机** 还是 **室外机** 发出的？这对判断很关键。`,
    },
    { role: "user", content: "外机声音更大" },
    {
      role: "assistant",
      content: `根据您的描述——外机嗡嗡声、开机后出现——**大概率是压缩机或外机风扇问题**。

### 初步判断

| 可能原因 | 概率 | 紧急程度 |
|---------|------|---------|
| 压缩机异常振动 | 高 | ⚠️ 中 |
| 外机风扇轴承磨损 | 中 | 🔴 较高 |
| 外机固定螺丝松动 | 低 | 🟢 低 |

已为您预约上门检修，工单信息：
- **工单号**: R-20241001
- **预约时间**: 明天 14:00-16:00
- **预计费用**: 免费（保修期内）`,
      toolCalls: [
        {
          name: "schedule_repair",
          args: { customer_id: "C-001", issue: "外机异响", priority: "medium" },
        },
      ],
    },
  ],
  turnResults: [
    {
      turnIndex: 0,
      role: "user",
      assertionResults: [],
      judgeResult: null,
    },
    {
      turnIndex: 1,
      role: "user",
      assertionResults: [],
      judgeResult: null,
    },
    {
      turnIndex: 2,
      role: "user",
      assertionResults: [
        {
          assertion: { id: "a1", type: "contains", value: "压缩机" },
          passed: true,
          message: 'Response contains "压缩机"',
        },
        {
          assertion: { id: "a2", type: "tool-called", value: "schedule_repair" },
          passed: true,
          message: 'Tool "schedule_repair" was called',
        },
      ],
      judgeResult: {
        scores: {
          诊断准确性: { score: 9, reason: "逐步缩小范围，最终给出了合理的判断" },
          服务主动性: { score: 10, reason: "主动预约了维修，无需用户额外操作" },
        },
        overallScore: 9,
      },
    },
  ],
  chatResponse: "",
  assertionResults: [
    {
      assertion: { id: "a1", type: "contains", value: "压缩机" },
      passed: true,
      message: 'Final response contains "压缩机"',
    },
  ],
  allAssertionsPassed: true,
  judgeResult: {
    scores: {
      诊断准确性: { score: 9, reason: "逐步缩小范围，最终给出了合理的判断" },
      服务主动性: { score: 10, reason: "主动预约了维修，无需用户额外操作" },
    },
    overallScore: 9,
  },
  timestamp: Date.now(),
  durationMs: 5670,
};

const errorResult: EvalResult = {
  caseId: "case-err",
  caseName: "运行出错示例",
  mode: "single",
  turns: [{ id: "t1", role: "user", content: "测试输入" }],
  chatMessages: [],
  turnResults: [],
  chatResponse: "",
  assertionResults: [],
  allAssertionsPassed: false,
  judgeResult: null,
  timestamp: Date.now(),
  durationMs: 150,
  error: "Model API returned 429: Rate limit exceeded. Please retry after 30 seconds.",
};

/* ── stories ── */

export const Single: Story = {
  name: "单轮对话",
  args: { result: singleResult },
};

export const SingleWithToolCalls: Story = {
  name: "单轮 + 工具调用",
  args: { result: singleWithToolCalls },
};

export const SingleFailed: Story = {
  name: "单轮（未通过）",
  args: { result: singleFailed },
};

export const Injected: Story = {
  name: "注入历史对话",
  args: { result: injectedResult },
};

export const Sequential: Story = {
  name: "多轮顺序对话",
  args: { result: sequentialResult },
};

export const Error: Story = {
  name: "运行错误",
  args: { result: errorResult },
};
