"use client";

import { useMemo, type ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useComponentTestCases } from "@/lib/components/test-case-hooks";
import {
  DynamicToolRenderer,
  DynamicComponentErrorBoundary,
  compileComponentGraph,
  type ComponentRecord,
  type ToolRendererProps,
} from "@/tool-ui";
import type { ComponentTestCaseRow } from "@/db/schema";

interface ComponentExamplesPanelProps {
  componentId: string;
  componentSource: string;
  componentKey?: string;
  allComponents?: ComponentRecord[];
}

export function ComponentExamplesPanel({
  componentId,
  componentSource,
  componentKey,
  allComponents,
}: ComponentExamplesPanelProps) {
  const { testCases } = useComponentTestCases(componentId);

  const examples = useMemo(
    () => testCases.filter((tc) => tc.showAsExample),
    [testCases]
  );

  // Compile component graph to resolve cross-component references
  const compiledComponent = useMemo(() => {
    if (!componentKey || !allComponents?.length || !componentSource.trim())
      return undefined;
    try {
      const records = allComponents.map((r) =>
        r.key === componentKey ? { ...r, source: componentSource } : r
      );
      const compiled = compileComponentGraph(records);
      return compiled.get(componentKey);
    } catch {
      return undefined;
    }
  }, [componentKey, allComponents, componentSource]);

  if (examples.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-center text-sm text-muted-foreground">
          No examples yet. Go to the <strong>Test Cases</strong> tab and toggle{" "}
          <strong>Show as Example</strong> on any test case to display it here.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="p-4 space-y-4">
        {examples.map((tc) => (
          <ExampleCard
            key={tc.id}
            testCase={tc}
            componentSource={componentSource}
            compiledComponent={compiledComponent}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

// ── ExampleCard (read-only) ──

interface ExampleCardProps {
  testCase: ComponentTestCaseRow;
  componentSource: string;
  compiledComponent: ComponentType<ToolRendererProps> | undefined;
}

function ExampleCard({
  testCase,
  componentSource,
  compiledComponent,
}: ExampleCardProps) {
  return (
    <div className="rounded-lg border">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2">
        <h3 className="flex-1 truncate text-sm font-medium">
          {testCase.name}
        </h3>
        {testCase.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {testCase.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="p-4">
        <DynamicComponentErrorBoundary
          fallbackToolName={testCase.tool.name || "example"}
        >
          <DynamicToolRenderer
            tool={testCase.tool}
            state="output-available"
            source={compiledComponent ? undefined : componentSource}
            compiledComponent={compiledComponent}
          />
        </DynamicComponentErrorBoundary>
      </div>
    </div>
  );
}
