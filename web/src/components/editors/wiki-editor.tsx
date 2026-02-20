"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trash2Icon } from "lucide-react";
import Markdown from "react-markdown";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MdEditor } from "@/components/editors/md-editor";
import { useDatasetVarsMap } from "@/lib/datasets/hooks";
import { useTools } from "@/lib/tools/hooks";
import { BUILTIN_VAR_NAMES } from "@/lib/template";
import { wikiApiKey, wikiFetcher } from "@/lib/wiki/api";
import { processTemplate } from "@/lib/wiki/template";
import { stripFrontmatter } from "@/lib/wiki/frontmatter";
import type { WikiDocument } from "@/lib/wiki/types";

interface WikiEditorProps {
  doc: WikiDocument;
  documents: WikiDocument[];
  agentId: string;
  onUpdate: (id: string, updates: { name: string; content: string }) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

export function WikiEditor({ doc, documents, agentId, onUpdate, onDelete }: WikiEditorProps) {
  const [name, setName] = useState(doc.name);
  const [content, setContent] = useState(doc.content);
  const [activeTab, setActiveTab] = useState<"preview" | "edit">("preview");
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { tools: allTools } = useTools(agentId);
  const { datasetVars } = useDatasetVarsMap(agentId);
  const { data: wikiDocs = [] } = useSWR(wikiApiKey(agentId), wikiFetcher);

  const allVariables = useMemo(() => {
    const datasetKeys = Object.keys(datasetVars);
    return [...BUILTIN_VAR_NAMES, ...datasetKeys];
  }, [datasetVars]);

  const completionTools = useMemo(
    () =>
      allTools
        .filter((t) => t.enabled)
        .map((t) => ({ name: t.name, description: t.description })),
    [allTools]
  );

  const completionDocs = useMemo(
    () => wikiDocs.map((d) => ({ title: d.name })),
    [wikiDocs]
  );

  const snapshotRef = useRef({ name: doc.name, content: doc.content });

  useEffect(() => {
    setName(doc.name);
    setContent(doc.content);
    snapshotRef.current = { name: doc.name, content: doc.content };
    setActiveTab("preview");
  }, [doc.id, doc.name, doc.content]);

  const dirty = name !== snapshotRef.current.name || content !== snapshotRef.current.content;
  const busy = saving || deleting;

  const handleSave = useCallback(async () => {
    setSaving(true);
    const ok = await onUpdate(doc.id, { name, content });
    if (ok) {
      snapshotRef.current = { name, content };
    }
    setSaving(false);
  }, [doc.id, name, content, onUpdate]);

  const handleReset = useCallback(() => {
    setName(snapshotRef.current.name);
    setContent(snapshotRef.current.content);
  }, []);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    await onDelete(doc.id);
    setDeleting(false);
    setDeleteDialogOpen(false);
  }, [doc.id, onDelete]);

  const renderedContent = useMemo(() => {
    if (!content) return "";
    const body = stripFrontmatter(content);
    return processTemplate(body, {
      documents,
      currentDoc: { ...doc, name, content: body },
    });
  }, [content, name, doc, documents]);

  const createdAt = new Date(doc.createdAt).toLocaleString();
  const updatedAt = new Date(doc.updatedAt).toLocaleString();

  return (
    <>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="shrink-0 space-y-2 px-6 py-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Key</label>
            <Input
              className="mt-1 h-8 text-sm font-mono bg-muted"
              value={doc.key}
              readOnly
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input
              className="mt-1 h-8 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Document name"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Created {createdAt} &middot; Updated {updatedAt}
          </p>
        </div>

        {/* Content area */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "edit" | "preview")}
          className="flex flex-col flex-1 min-h-0"
        >
          <TabsList className="shrink-0 mx-6">
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="edit" className="flex-1 min-h-0 overflow-hidden px-6 pb-4">
            <MdEditor
              value={content}
              onChange={setContent}
              variables={allVariables}
              documents={completionDocs}
              tools={completionTools}
              placeholder="Write your content in Markdown..."
              className="h-full [&_.cm-editor]:h-full"
            />
          </TabsContent>
          <TabsContent value="preview" className="flex-1 min-h-0 overflow-auto px-6 py-4">
            {content ? (
              <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                <Markdown>{renderedContent}</Markdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No content to preview</p>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center gap-2 shrink-0 border-t px-6 py-3">
          <Button size="sm" onClick={handleSave} disabled={!dirty || busy}>
            {saving && <Spinner className="mr-1.5 size-3" />}
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset} disabled={!dirty || busy}>
            Reset
          </Button>
          <div className="flex-1" />
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={busy}
          >
            <Trash2Icon className="size-3" />
            Delete
          </Button>
        </div>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{doc.name || "Untitled"}&rdquo;?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete this document.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Spinner className="mr-2 size-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
