"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { JsonEditor } from "@/components/editors/json-editor";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { useSchemaTestCases } from "@/lib/schemas/test-case-hooks";
import type { SchemaTestCaseRow } from "@/db/schema";

interface SchemaExamplesPanelProps {
  schemaId: string;
}

export function SchemaExamplesPanel({ schemaId }: SchemaExamplesPanelProps) {
  const { testCases, isLoading } = useSchemaTestCases(schemaId);

  const examples = useMemo(
    () => testCases.filter((tc) => tc.showAsExample),
    [testCases]
  );

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Spinner className="size-5" />
      </div>
    );
  }

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
      <div className="space-y-4 p-4">
        {examples.map((tc) => (
          <ExampleCard key={tc.id} testCase={tc} />
        ))}
      </div>
    </ScrollArea>
  );
}

// ── ExampleCard ──

function ExampleCard({ testCase }: { testCase: SchemaTestCaseRow }) {
  const inputStr = useMemo(
    () => JSON.stringify(testCase.input, null, 2),
    [testCase.input]
  );

  const expectedErrorsStr = useMemo(() => {
    if (!testCase.expectedErrors || testCase.expectedErrors.length === 0) return null;
    return JSON.stringify(testCase.expectedErrors, null, 2);
  }, [testCase.expectedErrors]);

  return (
    <div className="rounded-lg border">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2">
        <h3 className="flex-1 truncate text-sm font-medium">
          {testCase.name}
        </h3>
        <Badge
          variant="secondary"
          className="px-1.5 py-0 text-[10px]"
        >
          {testCase.shouldPass ? "Valid" : "Invalid"}
        </Badge>
        {testCase.tags.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="px-1.5 py-0 text-[10px]"
          >
            {tag}
          </Badge>
        ))}
      </div>

      {/* Body */}
      <div className="space-y-3 border-t px-4 py-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Input
          </label>
          <JsonEditor
            value={inputStr}
            readOnly
            height="100px"
            className="mt-1"
          />
        </div>

        {expectedErrorsStr && (
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Expected Errors
            </label>
            <JsonEditor
              value={expectedErrorsStr}
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
