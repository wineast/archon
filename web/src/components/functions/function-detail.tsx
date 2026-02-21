"use client";

import { useCallback, useState } from "react";
import { RotateCcwIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FunctionForm,
  type FunctionFormHandle,
} from "./function-form";
import { FunctionExamplesPanel } from "./function-examples-panel";
import { FunctionPlayground } from "./function-playground";
import { FunctionTestCasesPanel } from "./function-test-cases-panel";
import type { FunctionRow } from "@/db/schema";
import type { JsonSchema7 } from "@/lib/schemas/types";

interface FunctionDetailProps {
  agentId: string;
  fn: FunctionRow;
  onSave: (
    id: string,
    data: { name: string; description: string; code: string; parametersSchema: JsonSchema7 | null; returnParametersSchema: JsonSchema7 | null }
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function FunctionDetail({
  agentId,
  fn,
  onSave,
  onDelete,
}: FunctionDetailProps) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [draftRef, setDraftRef] = useState<FunctionFormHandle | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busy = saving || deleting;

  const handleSave = useCallback(async () => {
    if (!draftRef) return;
    const draft = draftRef.getDraft();
    setSaving(true);
    try {
      await onSave(fn.id, {
        name: draft.name,
        description: draft.description,
        code: draft.code,
        parametersSchema: draft.parametersSchema,
        returnParametersSchema: draft.returnParametersSchema,
      });
    } finally {
      setSaving(false);
    }
  }, [draftRef, onSave, fn.id]);

  const handleReset = useCallback(() => {
    draftRef?.reset();
  }, [draftRef]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await onDelete(fn.id);
    } finally {
      setDeleting(false);
    }
  }, [fn.id, onDelete]);

  return (
    <Tabs defaultValue="edit" className="flex h-full flex-col">
      <TabsList variant="line" className="shrink-0 px-4 pt-1">
        <TabsTrigger value="edit">Edit</TabsTrigger>
        <TabsTrigger value="examples">Examples</TabsTrigger>
        <TabsTrigger value="playground">Playground</TabsTrigger>
        <TabsTrigger value="test-cases">Test Cases</TabsTrigger>
      </TabsList>

      <TabsContent value="edit" className="flex min-h-0 flex-1 flex-col">
        <ScrollArea className="flex-1 min-h-0 overflow-hidden [&_[data-slot=scroll-area-viewport]>div]:!block">
          <div className="p-4 space-y-3">
            <FunctionForm
              key={fn.id}
              agentId={agentId}
              functionKey={fn.key}
              name={fn.name}
              description={fn.description}
              code={fn.code}
              parametersSchema={fn.parametersSchema ?? null}
              returnParametersSchema={fn.returnParametersSchema ?? null}
              onDraftRef={setDraftRef}
              onDirtyChange={setDirty}
            />
          </div>
        </ScrollArea>

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
            onClick={handleReset}
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
          title="Delete Function"
          description={`Are you sure you want to delete "${fn.name}"? This action cannot be undone.`}
          onConfirm={handleDelete}
        />
      </TabsContent>

      <TabsContent value="examples" className="flex min-h-0 flex-1 flex-col">
        <FunctionExamplesPanel functionId={fn.id} />
      </TabsContent>

      <TabsContent value="playground" className="flex min-h-0 flex-1 flex-col">
        <FunctionPlayground functionId={fn.id} />
      </TabsContent>

      <TabsContent value="test-cases" className="flex min-h-0 flex-1 flex-col">
        <FunctionTestCasesPanel functionId={fn.id} />
      </TabsContent>
    </Tabs>
  );
}
