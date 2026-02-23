"use client";

import { Badge } from "@/components/ui/badge";
import { JsEditor } from "@/components/editors/js-editor";
import { KeyDisplay } from "@/components/ui/key-display";
import { InlineSchemaEditor } from "@/components/schemas/inline-schema-editor";
import { inferComponentDeps, keyToPascal, type ComponentRecord } from "@/tool-ui";
import type { ComponentRow } from "@/db/schema";
import type { PoolMeta } from "@/components/pool/types";
import { PoolRefBadge } from "@/components/pool/pool-ref-badge";
import { useMemo } from "react";

interface ComponentPoolViewProps {
  component: ComponentRow;
  allComponents?: ComponentRecord[];
  poolMeta: PoolMeta;
}

export function ComponentPoolView({ component, allComponents, poolMeta }: ComponentPoolViewProps) {
  const isBuiltin = poolMeta.origin === "builtin";

  const referencedComponents = useMemo(() => {
    if (!allComponents?.length || !component.componentSource) return [];
    const knownKeys = new Set(allComponents.map((c) => c.key));
    return inferComponentDeps(component.componentSource, knownKeys);
  }, [allComponents, component.componentSource]);

  return (
    <div className="space-y-3 min-w-0">
      <PoolRefBadge origin={poolMeta.origin} />
      <KeyDisplay value={component.key} />
      <div>
        <p className="text-xs font-medium text-muted-foreground">Name</p>
        <p className="mt-0.5 text-sm">{component.name || "\u2014"}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Description</p>
        <p className="mt-0.5 text-sm whitespace-pre-wrap">{component.description || "\u2014"}</p>
      </div>
      <InlineSchemaEditor
        label="Tool Input Schema"
        value={component.toolInputSchema ?? null}
        onChange={() => {}}
        readOnly
      />
      <InlineSchemaEditor
        label="Component Input Schema"
        value={component.componentInputSchema ?? null}
        onChange={() => {}}
        readOnly
      />
      {isBuiltin ? (
        <p className="text-xs text-muted-foreground italic">
          系统内置组件的 JSX/CSS 由平台管理，不可编辑。
        </p>
      ) : (
        <>
          {component.componentSource && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Component Source (JSX)</p>
              <div className="mt-1">
                <JsEditor value={component.componentSource} onChange={() => {}} readOnly height="300px" />
              </div>
              {referencedComponents.length > 0 && (
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground">引用组件:</span>
                  {referencedComponents.map((key) => (
                    <Badge key={key} variant="secondary" className="text-xs font-mono">
                      {keyToPascal(key)}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
      {component.generatedCss && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Generated CSS</p>
          <pre className="mt-1 bg-muted rounded p-3 text-xs font-mono overflow-auto max-h-[200px]">
            {component.generatedCss}
          </pre>
        </div>
      )}
    </div>
  );
}
