"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { JsEditor } from "@/components/ui/editors/js-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BuiltinFunction } from "@/lib/functions/builtin";
import { BuiltinPlayground } from "./builtin-playground";
import { BuiltinTestCases } from "./builtin-test-cases";

interface FunctionBuiltinDetailProps {
  fn: BuiltinFunction;
}

export function FunctionBuiltinDetail({ fn }: FunctionBuiltinDetailProps) {
  const hasTestCases = fn.testCases && fn.testCases.length > 0;

  return (
    <Tabs
      defaultValue="detail"
      className="flex h-full flex-col"
    >
      <TabsList variant="line" className="shrink-0 px-4 pt-1">
        <TabsTrigger value="detail">Detail</TabsTrigger>
        <TabsTrigger value="playground">Playground</TabsTrigger>
        {hasTestCases && (
          <TabsTrigger value="test-cases">Test Cases</TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="detail" className="flex min-h-0 flex-1 flex-col">
        <ScrollArea className="flex-1 min-h-0 overflow-hidden">
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{fn.name}</span>
              <Badge variant="outline" className="text-[10px]">
                Built-in
              </Badge>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Key
              </label>
              <p className="mt-1 font-mono text-sm">{fn.key}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Source
              </label>
              <p className="mt-1 text-sm">{fn.source}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Description
              </label>
              <p className="mt-1 text-sm text-muted-foreground">
                {fn.description}
              </p>
            </div>

            {fn.parameters && fn.parameters.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Parameters
                </label>
                <div className="mt-1 space-y-1">
                  {fn.parameters.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <code className="font-mono text-xs">{p.name}</code>
                      <Badge variant="secondary" className="text-[10px]">
                        {p.type}
                      </Badge>
                      {p.required && (
                        <Badge variant="outline" className="text-[10px]">
                          required
                        </Badge>
                      )}
                      {p.description && (
                        <span className="text-xs text-muted-foreground truncate">
                          {p.description}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {fn.returnParameters && fn.returnParameters.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Return Parameters
                </label>
                <div className="mt-1 space-y-1">
                  {fn.returnParameters.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <code className="font-mono text-xs">{p.name}</code>
                      <Badge variant="secondary" className="text-[10px]">
                        {p.type}
                      </Badge>
                      {p.required && (
                        <Badge variant="outline" className="text-[10px]">
                          required
                        </Badge>
                      )}
                      {p.description && (
                        <span className="text-xs text-muted-foreground truncate">
                          {p.description}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Usage
              </label>
              <div className="mt-1">
                <JsEditor
                  value={fn.code}
                  readOnly
                  height="300px"
                />
              </div>
            </div>
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="playground" className="flex min-h-0 flex-1 flex-col">
        <BuiltinPlayground builtinKey={fn.key} testCases={fn.testCases} />
      </TabsContent>

      {hasTestCases && (
        <TabsContent value="test-cases" className="flex min-h-0 flex-1 flex-col">
          <BuiltinTestCases
            builtinKey={fn.key}
            testCases={fn.testCases!}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}
