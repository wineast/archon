"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { CopyIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDatasets } from "@/lib/datasets/hooks";
import { useTools } from "@/lib/tools/hooks";
import { useObjectTypes } from "@/lib/ontology/hooks";

function copyVar(text: string) {
  navigator.clipboard.writeText(text);
  toast.success("已复制");
}

function VarCell({ children }: { children: string }) {
  return (
    <button
      type="button"
      onClick={() => copyVar(children)}
      className="group/var inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs bg-muted hover:bg-muted/80 transition-colors cursor-pointer"
      title="点击复制"
    >
      {children}
      <CopyIcon className="size-3 opacity-0 group-hover/var:opacity-50 transition-opacity" />
    </button>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-semibold text-foreground pt-4 pb-2 first:pt-0">
      {title}
    </h3>
  );
}

function VarTable({
  rows,
}: {
  rows: Array<{ var: string; example?: string; desc: string }>;
}) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-muted-foreground text-left">
          <th className="pb-1 pr-3 font-medium">变量</th>
          <th className="pb-1 pr-3 font-medium">示例</th>
          <th className="pb-1 font-medium">说明</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.var} className="border-t border-border/50">
            <td className="py-1.5 pr-3">
              <VarCell>{r.var}</VarCell>
            </td>
            <td className="py-1.5 pr-3 text-muted-foreground font-mono">
              {r.example ?? "—"}
            </td>
            <td className="py-1.5 text-muted-foreground">{r.desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground/60 italic py-1">{text}</p>;
}

function PatternTable({
  rows,
}: {
  rows: Array<{ pattern: string; desc: string }>;
}) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-muted-foreground text-left">
          <th className="pb-1 pr-3 font-medium">模式</th>
          <th className="pb-1 font-medium">说明</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.pattern} className="border-t border-border/50">
            <td className="py-1.5 pr-3">
              <VarCell>{r.pattern}</VarCell>
            </td>
            <td className="py-1.5 text-muted-foreground">{r.desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EnvVarsPanel({ agentId }: { agentId: string }) {
  const { datasets } = useDatasets(agentId);
  const { tools } = useTools(agentId);
  const { objectTypes } = useObjectTypes(agentId);

  const now = useMemo(() => new Date(), []);
  const pad = (n: number) => String(n).padStart(2, "0");

  const timeRows = useMemo(
    () => [
      {
        var: "{{ date }}",
        example: now.toISOString().slice(0, 10),
        desc: "ISO 日期",
      },
      {
        var: "{{ time }}",
        example: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
        desc: "时间",
      },
      {
        var: "{{ datetime }}",
        example: now.toISOString(),
        desc: "ISO 日期时间",
      },
      {
        var: "{{ timestamp }}",
        example: String(now.getTime()),
        desc: "Unix 毫秒时间戳",
      },
      {
        var: "{{ year }}",
        example: String(now.getFullYear()),
        desc: "年",
      },
      {
        var: "{{ month }}",
        example: pad(now.getMonth() + 1),
        desc: "月（补零）",
      },
      {
        var: "{{ day }}",
        example: pad(now.getDate()),
        desc: "日（补零）",
      },
    ],
    [now]
  );

  const enabledTools = useMemo(
    () => tools.filter((t) => t.enabled),
    [tools]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center border-b px-4 py-2">
        <span className="text-sm font-semibold">环境变量</span>
        <span className="ml-2 text-xs text-muted-foreground">
          模板中可用的变量参考
        </span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 px-4 py-3">
          {/* ── 时间变量 ── */}
          <SectionHeader title="时间变量" />
          <VarTable rows={timeRows} />

          {/* ── 数据集变量 ── */}
          <SectionHeader title="数据集变量" />
          {datasets.length > 0 ? (
            <VarTable
              rows={datasets.map((ds) => ({
                var: `{{ ${ds.key} }}`,
                example: typeof ds.data === "object" ? "{ ... }" : String(ds.data ?? ""),
                desc: ds.name,
              }))}
            />
          ) : (
            <EmptyHint text="暂无数据集，从 Datasets 添加后自动出现" />
          )}

          {/* ── 工具变量 ── */}
          <SectionHeader title="工具变量" />
          <PatternTable
            rows={[
              { pattern: "{{ tool.工具名.name }}", desc: "工具名称" },
              { pattern: "{{ tool.工具名.description }}", desc: "工具描述" },
              { pattern: "{{ tool.工具名.parameters }}", desc: "参数 Schema" },
              { pattern: "{{ tool_entries }}", desc: "所有启用工具数组" },
            ]}
          />
          {enabledTools.length > 0 ? (
            <div className="mt-2">
              <span className="text-xs text-muted-foreground">
                当前工具：
              </span>
              <div className="mt-1 flex flex-wrap gap-1">
                {enabledTools.map((t) => (
                  <VarCell key={t.id}>{`{{ tool.${t.key}.name }}`}</VarCell>
                ))}
              </div>
            </div>
          ) : (
            <EmptyHint text="暂无启用的工具" />
          )}

          {/* ── 本体变量 ── */}
          <SectionHeader title="本体变量" />
          <PatternTable
            rows={[
              { pattern: "{{ ontology.类型key.name }}", desc: "实体类型名" },
              {
                pattern: "{{ ontology.类型key.description }}",
                desc: "实体类型描述",
              },
              { pattern: "{{ ontology_types }}", desc: "所有实体类型数组" },
            ]}
          />
          {objectTypes.length > 0 ? (
            <div className="mt-2">
              <span className="text-xs text-muted-foreground">
                当前实体类型：
              </span>
              <div className="mt-1 flex flex-wrap gap-1">
                {objectTypes.map((ot) => (
                  <VarCell key={ot.id}>{`{{ ontology.${ot.key}.name }}`}</VarCell>
                ))}
              </div>
            </div>
          ) : (
            <EmptyHint text="暂无本体定义" />
          )}

          {/* ── 评估变量 ── */}
          <SectionHeader title="评估变量" />
          <p className="text-xs text-muted-foreground mb-1">
            仅在评估上下文中可用
          </p>
          <VarTable
            rows={[
              { var: "{{ model }}", desc: "当前模型" },
              { var: "{{ caseCount }}", desc: "用例总数" },
              { var: "{{ caseName }}", desc: "当前用例名" },
            ]}
          />

          {/* ── AI 助手上下文变量 ── */}
          <SectionHeader title="AI 助手上下文变量" />
          <p className="text-xs text-muted-foreground mb-1">
            仅在 Assist Agent 系统提示词模板中可用
          </p>
          <VarTable
            rows={[
              {
                var: "{{ fieldContext }}",
                desc: "编辑场景标识",
                example: "wiki-content",
              },
              {
                var: "{{ currentContent }}",
                desc: "当前编辑器内容",
              },
              {
                var: "{{ entity }}",
                desc: "实体类型标识",
                example: "content",
              },
            ]}
          />
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">
              fieldContext 取值：
            </span>
            <div className="mt-1 flex flex-wrap gap-1">
              {[
                "wiki-content",
                "system-prompt",
                "tool-handler",
                "function-code",
                "component-jsx",
                "dataset-data",
                "schema",
              ].map((v) => (
                <VarCell key={v}>{v}</VarCell>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
