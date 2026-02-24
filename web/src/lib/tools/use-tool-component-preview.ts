import { useMemo } from "react";
import { useComponents } from "@/lib/components/hooks";
import { useCompiledComponent } from "@/lib/components/use-compiled-component";
import type { ToolComponentPreviewData } from "@/components/tools/tool-component-preview";

/**
 * Given a tool's componentId and agentId, returns the compiled component
 * for ToolComponentPreview.
 *
 * Returns `null` when:
 * - componentId is null/undefined (tool has no associated component)
 * - Component not found in the agent's component list
 * - Compilation fails
 */
export function useToolComponentPreview(
  componentId: string | null | undefined,
  agentId: string | undefined,
): ToolComponentPreviewData | null {
  const { components } = useComponents(agentId);

  const target = useMemo(
    () => (componentId ? components.find((c) => c.id === componentId) : undefined),
    [componentId, components],
  );

  const allRecords = useMemo(
    () => components.map((c) => ({ key: c.key, source: c.componentSource })),
    [components],
  );

  const { compiledComponent } = useCompiledComponent(
    target?.key,
    allRecords,
    target?.componentSource ?? "",
  );

  return useMemo(() => {
    if (!compiledComponent || !target) return null;
    return {
      compiledComponent,
      generatedCss: target.generatedCss || "",
    };
  }, [compiledComponent, target]);
}
