"use client";

import { useEffect } from "react";
import type { ComponentType } from "react";
import { DynamicComponentRenderer } from "@/tool-ui/_dynamic-renderer";
import { DynamicComponentErrorBoundary } from "@/tool-ui/_error-boundary";
import type { ComponentRendererProps } from "@/tool-ui/_registry";

export interface ToolComponentPreviewData {
  compiledComponent: ComponentType<ComponentRendererProps>;
  generatedCss: string;
}

interface ToolComponentPreviewProps {
  toolName: string;
  input: unknown;
  output: unknown;
  preview: ToolComponentPreviewData;
}

/**
 * Renders a tool's associated component in preview mode.
 *
 * Injects generatedCss into @layer components (NOT @layer utilities) to avoid
 * duplicating global Tailwind rules. This ensures component-specific classes
 * (e.g. arbitrary values like bg-[#ff5722]) are available while standard
 * utilities defer to the global Tailwind stylesheet.
 */
export function ToolComponentPreview({
  toolName,
  input,
  output,
  preview,
}: ToolComponentPreviewProps) {
  useEffect(() => {
    if (!preview.generatedCss) return;
    const style = document.createElement("style");
    style.setAttribute("data-tool-preview", "true");
    style.textContent = `@layer components {\n${preview.generatedCss}\n}`;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, [preview.generatedCss]);

  return (
    <div className="mt-2">
      <label className="text-xs font-medium text-muted-foreground">
        Component Preview
      </label>
      <div className="mt-1 rounded-md border p-3">
        <DynamicComponentErrorBoundary fallbackLabel={toolName}>
          <DynamicComponentRenderer
            tool={{ name: toolName, input, output }}
            state="output-available"
            compiledComponent={preview.compiledComponent}
          />
        </DynamicComponentErrorBoundary>
      </div>
    </div>
  );
}
