"use client";

import { useCallback, useRef, useState } from "react";
import { RotateCcwIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ComponentExamplesPanel } from "./component-examples-panel";
import { ComponentForm, type ComponentFormHandle } from "./component-form";
import { ComponentPlayground } from "./component-playground";
import { ComponentTestCasesPanel } from "./component-test-cases-panel";
import type { ComponentRow } from "@/db/schema";
import type { ComponentDefinition } from "@/lib/components/types";
import type { ComponentRecord } from "@/tool-ui";

interface ComponentDetailProps {
  component: ComponentRow;
  agentId?: string;
  allComponents?: ComponentRecord[];
  onSave: (updated: ComponentDefinition) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function ComponentDetail({ component, agentId, allComponents, onSave, onDelete }: ComponentDetailProps) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const draftRef = useRef<ComponentFormHandle | null>(null);
  const handleDraftRef = useCallback((ref: ComponentFormHandle) => {
    draftRef.current = ref;
  }, []);
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busy = saving || deleting;

  const handleSave = useCallback(async () => {
    if (!draftRef.current) return;
    const draft = draftRef.current.getDraft();
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await onDelete(component.id);
    } finally {
      setDeleting(false);
    }
  }, [component.id, onDelete]);

  return (
    <Tabs defaultValue="edit" className="flex h-full flex-col">
      <TabsList variant="line" className="shrink-0 px-4 pt-1">
        <TabsTrigger value="edit">Edit</TabsTrigger>
        <TabsTrigger value="examples">Examples</TabsTrigger>
        <TabsTrigger value="playground">Playground</TabsTrigger>
        <TabsTrigger value="test-cases">Test Cases</TabsTrigger>
      </TabsList>

      <TabsContent value="edit" className="flex min-h-0 flex-1 flex-col">
        {/* Form body */}
        <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
          <div className="p-4 min-w-0 overflow-hidden">
            <ComponentForm
              component={{
                id: component.id,
                key: component.key,
                name: component.name,
                description: component.description,
                scenario: component.scenario,
                inputSchema: component.inputSchema ?? null,
                outputSchema: component.outputSchema ?? null,
                componentSource: component.componentSource,
              }}
              agentId={agentId}
              allComponents={allComponents}
              onDraftRef={handleDraftRef}
              onDirtyChange={setDirty}
            />
            {component.generatedCss && (
              <div className="mt-4">
                <label className="text-xs font-medium text-muted-foreground">
                  Generated CSS
                </label>
                <pre className="mt-1 bg-muted rounded p-3 text-xs font-mono overflow-auto max-h-[200px]">
                  {component.generatedCss}
                </pre>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Bottom bar */}
        <div className="flex items-center gap-2 border-t px-4 py-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={busy || !dirty}
          >
            {saving ? (
              <Spinner className="mr-1 size-3" />
            ) : (
              <SaveIcon className="mr-1 size-3" />
            )}
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => draftRef.current?.reset()}
            disabled={busy || !dirty}
          >
            <RotateCcwIcon className="mr-1 size-3" />
            Reset
          </Button>
          <div className="flex-1" />
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={busy}
          >
            {deleting ? (
              <Spinner className="mr-1 size-3" />
            ) : (
              <Trash2Icon className="mr-1 size-3" />
            )}
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Delete Component"
          description={`Are you sure you want to delete "${component.name}"? This action cannot be undone.`}
          onConfirm={handleDelete}
        />
      </TabsContent>

      <TabsContent value="examples" className="flex min-h-0 flex-1 flex-col">
        <ComponentExamplesPanel
          componentId={component.id}
          componentSource={component.componentSource}
          componentKey={component.key}
          allComponents={allComponents}
        />
      </TabsContent>

      <TabsContent value="playground" className="flex min-h-0 flex-1 flex-col">
        <ComponentPlayground
          componentId={component.id}
          componentSource={component.componentSource}
          componentKey={component.key}
          allComponents={allComponents}
          inputSchema={component.inputSchema ?? null}
        />
      </TabsContent>

      <TabsContent value="test-cases" className="flex min-h-0 flex-1 flex-col">
        <ComponentTestCasesPanel
          componentId={component.id}
          componentSource={component.componentSource}
          componentKey={component.key}
          allComponents={allComponents}
          inputSchema={component.inputSchema ?? null}
        />
      </TabsContent>
    </Tabs>
  );
}
