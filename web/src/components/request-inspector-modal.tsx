"use client";

import type { UIMessage } from "ai";
import { convertToModelMessages } from "ai";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { useTools } from "@/lib/tools/hooks";
import { CopyIcon, CheckIcon, SearchCodeIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface RequestInspectorModalProps {
  model: string;
  systemPrompt: string;
  messages: UIMessage[];
  temperature: number;
  agentId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy}>
      {copied ? (
        <CheckIcon className="mr-1 size-3" />
      ) : (
        <CopyIcon className="mr-1 size-3" />
      )}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

type SystemView = "template" | "rendered";

export function RequestInspectorModal({
  model,
  systemPrompt,
  messages,
  temperature,
  agentId,
  open: controlledOpen,
  onOpenChange,
}: RequestInspectorModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [systemView, setSystemView] = useState<SystemView>("rendered");
  const [renderedPrompt, setRenderedPrompt] = useState<string | null>(null);
  const [renderLoading, setRenderLoading] = useState(false);
  const prevPromptRef = useRef(systemPrompt);

  // Reset rendered cache when systemPrompt changes
  useEffect(() => {
    if (prevPromptRef.current !== systemPrompt) {
      prevPromptRef.current = systemPrompt;
      setRenderedPrompt(null);
    }
  }, [systemPrompt]);

  // Fetch rendered prompt when switching to rendered view
  useEffect(() => {
    if (systemView !== "rendered" || !open || !agentId) return;
    if (renderedPrompt !== null) return;

    let cancelled = false;
    setRenderLoading(true);
    fetch("/api/template/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: systemPrompt, agentId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setRenderedPrompt(data.rendered);
      })
      .catch(() => {
        if (!cancelled) setRenderedPrompt(systemPrompt);
      })
      .finally(() => {
        if (!cancelled) setRenderLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [systemView, open, agentId, systemPrompt, renderedPrompt]);

  const systemDisplayText =
    systemView === "template"
      ? systemPrompt
      : (renderedPrompt ?? systemPrompt);

  const { tools: allTools } = useTools(agentId);
  const tools = useMemo(
    () =>
      allTools
        .filter((t) => t.enabled)
        .map(({ name, description, handler, url }) => ({
          name,
          description,
          handler: handler ?? "",
          url: url ?? "",
        })),
    [allTools]
  );

  const [msgFormat, setMsgFormat] = useState<"ui" | "model">("ui");
  const [modelMessagesJson, setModelMessagesJson] = useState<string | null>(null);

  useEffect(() => {
    if (msgFormat !== "model") {
      setModelMessagesJson(null);
      return;
    }
    let cancelled = false;
    convertToModelMessages(messages).then((result) => {
      if (!cancelled) setModelMessagesJson(JSON.stringify(result, null, 2));
    });
    return () => { cancelled = true; };
  }, [messages, msgFormat]);

  const messagesJson =
    msgFormat === "model"
      ? modelMessagesJson ?? "Converting..."
      : JSON.stringify(messages, null, 2);

  const toolsJson = JSON.stringify(tools, null, 2);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <SearchCodeIcon className="mr-1.5 size-4" />
            Inspect
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Request Inspector</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="overview" className="flex-1 overflow-hidden">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
          </TabsList>

          <TabsContent
            value="overview"
            className="overflow-y-auto max-h-[calc(85vh-140px)] space-y-4 p-1"
          >
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Model</p>
              <Badge variant="secondary">{model}</Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Temperature</p>
              <Badge variant="secondary">{temperature}</Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">System Prompt</p>
              <p className="text-sm line-clamp-3 whitespace-pre-wrap">{systemPrompt}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Messages</p>
              <p className="text-sm">{messages.length} message(s)</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Tools</p>
              <p className="text-sm">{tools.length} tool(s) enabled</p>
            </div>
          </TabsContent>

          <TabsContent
            value="system"
            className="overflow-y-auto max-h-[calc(85vh-140px)]"
          >
            {agentId ? (
              <Tabs
                value={systemView}
                onValueChange={(v) => setSystemView(v as SystemView)}
              >
                <div className="flex items-center justify-between mb-2">
                  <TabsList className="h-7">
                    <TabsTrigger value="rendered" className="text-xs">Rendered</TabsTrigger>
                    <TabsTrigger value="template" className="text-xs">Template</TabsTrigger>
                  </TabsList>
                  <CopyButton text={systemDisplayText} />
                </div>
                <TabsContent value="rendered">
                  {renderLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Spinner className="size-5" />
                    </div>
                  ) : (
                    <pre className="text-sm whitespace-pre-wrap rounded-md bg-muted p-4">
                      {renderedPrompt ?? systemPrompt}
                    </pre>
                  )}
                </TabsContent>
                <TabsContent value="template">
                  <pre className="text-sm whitespace-pre-wrap rounded-md bg-muted p-4">
                    {systemPrompt}
                  </pre>
                </TabsContent>
              </Tabs>
            ) : (
              <>
                <div className="flex justify-end mb-2">
                  <CopyButton text={systemPrompt} />
                </div>
                <pre className="text-sm whitespace-pre-wrap rounded-md bg-muted p-4">
                  {systemPrompt}
                </pre>
              </>
            )}
          </TabsContent>

          <TabsContent
            value="messages"
            className="overflow-y-auto max-h-[calc(85vh-140px)]"
          >
            <Tabs
              value={msgFormat}
              onValueChange={(v) => setMsgFormat(v as "ui" | "model")}
            >
              <div className="flex items-center justify-between mb-2">
                <TabsList className="h-7">
                  <TabsTrigger value="ui" className="text-xs">UI</TabsTrigger>
                  <TabsTrigger value="model" className="text-xs">Model</TabsTrigger>
                </TabsList>
                <CopyButton text={messagesJson} />
              </div>
              <TabsContent value="ui">
                <pre className="text-sm whitespace-pre-wrap rounded-md bg-muted p-4 overflow-x-auto">
                  {JSON.stringify(messages, null, 2)}
                </pre>
              </TabsContent>
              <TabsContent value="model">
                <pre className="text-sm whitespace-pre-wrap rounded-md bg-muted p-4 overflow-x-auto">
                  {modelMessagesJson ?? "Converting..."}
                </pre>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent
            value="tools"
            className="overflow-y-auto max-h-[calc(85vh-140px)]"
          >
            <div className="flex justify-end mb-2">
              <CopyButton text={toolsJson} />
            </div>
            <pre className="text-sm whitespace-pre-wrap rounded-md bg-muted p-4 overflow-x-auto">
              {toolsJson}
            </pre>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
