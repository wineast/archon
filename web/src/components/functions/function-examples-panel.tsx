"use client";

import { useMemo } from "react";
import { JsonEditor } from "@/components/editors/json-editor";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFunctionTestCases } from "@/lib/functions/test-case-hooks";
import type { FunctionTestCaseRow } from "@/db/schema";

interface FunctionExamplesPanelProps {
  functionId: string;
}

export function FunctionExamplesPanel({
  functionId,
}: FunctionExamplesPanelProps) {
  const { testCases } = useFunctionTestCases(functionId);

  const examples = useMemo(
    () => testCases.filter((tc) => tc.showAsExample),
    [testCases]
  );

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
          <ExampleCard key={tc.id} testCase={tc} />
        ))}
      </div>
    </ScrollArea>
  );
}

// ── ExampleCard ──

function ExampleCard({ testCase }: { testCase: FunctionTestCaseRow }) {
  return (
    <div className="rounded-lg border">
      <div className="px-4 py-2">
        <h3 className="truncate text-sm font-medium">{testCase.name}</h3>
      </div>
      <div className="space-y-3 border-t px-4 py-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Input
          </label>
          <JsonEditor
            value={JSON.stringify(testCase.input, null, 2)}
            readOnly
            height="100px"
            className="mt-1"
          />
        </div>
        {testCase.expectedOutput != null && (
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Expected Output
            </label>
            <JsonEditor
              value={JSON.stringify(testCase.expectedOutput, null, 2)}
              readOnly
              height="100px"
              className="mt-1"
            />
          </div>
        )}
      </div>
    </div>
  );
}
