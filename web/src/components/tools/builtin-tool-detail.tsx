"use client";

import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

const BUILTIN_TOOLS: Record<
  string,
  {
    name: string;
    description: string;
    parameters: { name: string; type: string; description: string }[];
    returns: string;
  }
> = {
  get_skill_detail: {
    name: "get_skill_detail",
    description:
      "获取技能的完整内容指引。当需要使用某个技能时，先调用此工具获取详细指引。",
    parameters: [
      {
        name: "skill_key",
        type: "string",
        description: "技能的 key",
      },
    ],
    returns: "{ name, content } 或 { error }",
  },
};

interface BuiltinToolDetailProps {
  toolKey: string;
}

export function BuiltinToolDetail({ toolKey }: BuiltinToolDetailProps) {
  const tool = BUILTIN_TOOLS[toolKey];
  if (!tool) return null;

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="space-y-4 p-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Name
            </label>
            <Input
              className="mt-1 h-8 text-sm font-mono"
              value={tool.name}
              readOnly
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Description
            </label>
            <Input
              className="mt-1 h-8 text-sm"
              value={tool.description}
              readOnly
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Parameters
            </label>
            <div className="mt-1 space-y-2">
              {tool.parameters.map((param) => (
                <div
                  key={param.name}
                  className="rounded-md border px-3 py-2 text-sm"
                >
                  <span className="font-mono font-medium">{param.name}</span>
                  <span className="ml-2 text-muted-foreground">
                    ({param.type})
                  </span>
                  <span className="ml-2 text-muted-foreground">
                    — {param.description}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Returns
            </label>
            <Input
              className="mt-1 h-8 text-sm font-mono"
              value={tool.returns}
              readOnly
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
