"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EyeIcon, PencilIcon } from "lucide-react";
import Markdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { processTemplate } from "@/lib/wiki/template";
import { stripFrontmatter } from "@/lib/wiki/frontmatter";
import type { WikiDocument } from "@/lib/wiki/types";

interface WikiEditorProps {
  doc: WikiDocument;
  documents: WikiDocument[];
  onUpdate: (id: string, updates: Partial<{ title: string; content: string }>) => Promise<boolean>;
}

export function WikiEditor({ doc, documents, onUpdate }: WikiEditorProps) {
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState(doc.content);
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(doc.title);
    setContent(doc.content);
    setMode("preview");
  }, [doc.id, doc.title, doc.content]);

  const dirty = title !== doc.title || content !== doc.content;

  const handleDone = useCallback(async () => {
    if (dirty) {
      setSaving(true);
      const updates: Partial<Pick<WikiDocument, "title" | "content">> = {};
      if (title !== doc.title) updates.title = title;
      if (content !== doc.content) updates.content = content;
      await onUpdate(doc.id, updates);
      setSaving(false);
    }
    setMode("preview");
  }, [doc.id, doc.title, doc.content, title, content, dirty, onUpdate]);

  const renderedContent = useMemo(() => {
    if (!content) return "";
    // Strip frontmatter for preview rendering
    const body = stripFrontmatter(content);
    return processTemplate(body, {
      documents,
      currentDoc: { ...doc, title, content: body },
    });
  }, [content, title, doc, documents]);

  const createdAt = new Date(doc.createdAt).toLocaleString();
  const updatedAt = new Date(doc.updatedAt).toLocaleString();

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-6 py-4">
        {mode === "edit" ? (
          <Input
            className="border-none px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
          />
        ) : (
          <h1 className="truncate text-xl font-semibold">
            {title || "Untitled"}
          </h1>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          Created {createdAt} &middot; Updated {updatedAt}
        </p>
      </div>

      {mode === "edit" ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <Textarea
            className="h-full resize-none rounded-none border-none px-6 py-4 shadow-none focus-visible:ring-0"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your content in Markdown..."
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
          {content ? (
            <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <Markdown>{renderedContent}</Markdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No content to preview</p>
          )}
        </div>
      )}

      <div className="shrink-0 border-t px-6 py-3">
        {mode === "preview" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMode("edit")}
          >
            <PencilIcon className="size-3" />
            编辑
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={handleDone}
          >
            <EyeIcon className="size-3" />
            {saving ? "保存中..." : "完成"}
          </Button>
        )}
      </div>
    </div>
  );
}
