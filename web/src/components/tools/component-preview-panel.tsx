"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronDownIcon, EyeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { JsonEditor } from "@/components/editors/json-editor";
import {
  DynamicToolRenderer,
  DynamicComponentErrorBoundary,
  compileComponentGraph,
  type ComponentRecord,
} from "@/tool-ui";

interface ComponentPreviewPanelProps {
  componentSource: string;
  mockData: string;
  onMockDataChange: (value: string) => void;
  /** When false, renders preview directly without collapsible wrapper. Default true. */
  collapsible?: boolean;
  componentKey?: string;
  allComponents?: ComponentRecord[];
}

export function ComponentPreviewPanel({
  componentSource,
  mockData,
  onMockDataChange,
  collapsible = true,
  componentKey,
  allComponents,
}: ComponentPreviewPanelProps) {
  const [open, setOpen] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const parsedMock = useMemo(() => {
    try {
      return JSON.parse(mockData || "{}");
    } catch {
      return {};
    }
  }, [mockData]);

  // Compile component graph for composition support
  const compiledComponent = useMemo(() => {
    if (!componentKey || !allComponents?.length || !componentSource.trim()) return undefined;
    try {
      const records = allComponents.map((r) =>
        r.key === componentKey ? { ...r, source: componentSource } : r
      );
      const compiled = compileComponentGraph(records);
      return compiled.get(componentKey);
    } catch (e) {
      console.error("[preview-composition]", e);
      return undefined;
    }
  }, [componentKey, allComponents, componentSource]);

  const handleRefresh = useCallback(() => {
    setPreviewKey((k) => k + 1);
  }, []);

  if (!componentSource.trim()) return null;

  const content = (
    <div className="space-y-2">
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Mock 数据 (JSON)
        </label>
        <JsonEditor
          value={mockData}
          onChange={onMockDataChange}
          height="100px"
          className="mt-1"
        />
      </div>

      <Button
        size="sm"
        variant="outline"
        onClick={handleRefresh}
        className="gap-1"
      >
        <EyeIcon className="size-3" />
        刷新预览
      </Button>

      <div className="rounded-md border p-3">
        <DynamicComponentErrorBoundary
          key={previewKey}
          fallbackToolName="preview"
        >
          <DynamicToolRenderer
            tool={{ name: "preview", input: {}, output: parsedMock }}
            state="output-available"
            source={compiledComponent ? undefined : componentSource}
            compiledComponent={compiledComponent}
          />
        </DynamicComponentErrorBoundary>
      </div>
    </div>
  );

  if (!collapsible) return content;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 px-0 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronDownIcon
            className={`size-3 transition-transform ${open ? "" : "-rotate-90"}`}
          />
          预览
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        {content}
      </CollapsibleContent>
    </Collapsible>
  );
}
