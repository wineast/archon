"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import useSWR from "swr";
import { UserMenu } from "@/components/auth/user-menu";
import { DefaultChatTransport, isTextUIPart } from "ai";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  usePromptInputAttachments,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { SpeechInput } from "@/components/ai-elements/speech-input";
import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { MessageParts, UserMessageContent } from "@/components/message-parts";
import { ShareButton } from "@/components/share-button";
import { ChatWelcome } from "@/components/chat-welcome";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { RequestInspectorModal } from "@/components/request-inspector-modal";
import { UserSettingsModal } from "@/components/user/user-settings-modal";
import { useChatConfig } from "@/lib/chat-config/hooks";
import { useActiveModelConfig } from "@/lib/model-config/hooks";
import { useTools } from "@/lib/tools/hooks";
import { executeClientTool } from "@/lib/tools/client-executor";
import { useComponents } from "@/lib/components/hooks";
import {
  registerDynamicComponentSource,
  registerCompiledComponent,
  clearCompiledRegistry,
  compileComponentGraph,
  type ComponentRecord,
} from "@/tool-ui";
import { SessionHistory } from "@/components/session-history";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useSessions, deleteSession } from "@/lib/session/hooks";
import { useAgentRole } from "@/lib/auth/hooks";
import {
  DownloadIcon,
  EllipsisVerticalIcon,
  PaperclipIcon,
  SearchCodeIcon,
  Trash2Icon,
  UploadIcon,
  UserCogIcon,
} from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { AgentRow } from "@/db/schema";
import { useSessionParam } from "@/lib/session/use-session-param";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/* ─────────── Sub-components ─────────── */

function SuggestionItem({
  suggestion,
  onClick,
}: {
  suggestion: string;
  onClick: (s: string) => void;
}) {
  const handleClick = useCallback(() => {
    onClick(suggestion);
  }, [onClick, suggestion]);

  return <Suggestion onClick={handleClick} suggestion={suggestion} />;
}

/* ─────────── Prompt sub-components (need PromptInput context) ─────────── */

function AttachmentPreviewBar() {
  const { files, remove } = usePromptInputAttachments();
  if (files.length === 0) return null;
  return (
    <PromptInputHeader>
      <Attachments variant="grid">
        {files.map((f) => (
          <Attachment key={f.id} data={f} onRemove={() => remove(f.id)}>
            <AttachmentPreview />
            <AttachmentRemove />
          </Attachment>
        ))}
      </Attachments>
    </PromptInputHeader>
  );
}

function AttachmentButton() {
  const { openFileDialog } = usePromptInputAttachments();
  return (
    <PromptInputButton onClick={openFileDialog} tooltip="添加附件">
      <PaperclipIcon className="size-4" />
    </PromptInputButton>
  );
}

function ChatInputSubmit({ input, isStreaming }: { input: string; isStreaming: boolean }) {
  const { files } = usePromptInputAttachments();
  return (
    <PromptInputSubmit
      disabled={(!input.trim() && files.length === 0) || isStreaming}
      status={isStreaming ? "streaming" : "ready"}
    />
  );
}

/* ─────────── Chat content ─────────── */

function AgentChatContent({ agent, orgSlug }: { agent: AgentRow; orgSlug: string }) {
  const [input, setInput] = useState("");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [userSettingsOpen, setUserSettingsOpen] = useState(false);

  const { canEdit, canViewAllSessions } = useAgentRole(agent.id);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const { activeConfig } = useActiveModelConfig(agent.id);
  const { tools: toolsList } = useTools(agent.id);
  const { components: componentsList } = useComponents(agent.id);
  // Register dynamic component sources with composition support
  useMemo(() => {
    clearCompiledRegistry();
    // Build componentId → key map
    const idToKey = new Map(componentsList.map((c) => [c.id, c.key]));

    // Build component records for graph compilation
    const records: ComponentRecord[] = componentsList
      .filter((c) => c.componentSource.trim())
      .map((c) => ({ key: c.key, source: c.componentSource }));

    // Try to compile the full component graph (supports cross-component references)
    let compiled: ReturnType<typeof compileComponentGraph> = new Map();
    try {
      compiled = compileComponentGraph(records);
    } catch (e) {
      console.error("[component-composition]", e);
    }

    for (const t of toolsList) {
      const compKey = t.componentId ? idToKey.get(t.componentId) : undefined;
      const compiledComp = compKey ? compiled.get(compKey) : undefined;
      if (compiledComp) {
        // Use pre-compiled component (with composition deps resolved)
        registerCompiledComponent(t.name, compiledComp);
      } else if (compKey) {
        // Fallback: look up source from componentsList
        const comp = componentsList.find((c) => c.key === compKey);
        if (comp?.componentSource) registerDynamicComponentSource(t.name, comp.componentSource);
      }
    }
  }, [toolsList, componentsList]);

  useEffect(() => {
    const cssBlocks: string[] = [];
    for (const c of componentsList) {
      if (c.generatedCss) cssBlocks.push(c.generatedCss);
    }
    if (cssBlocks.length === 0) return;
    const style = document.createElement("style");
    style.setAttribute("data-dynamic-components", "true");
    style.textContent = cssBlocks.join("\n");
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, [componentsList]);

  const sessionIdRef = useRef<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const { sessions, mutate: mutateSessions } = useSessions(agent.id, showAllSessions);
  const isFirstMessageRef = useRef(true);
  const { sessionId: urlSessionId, setSessionParam, isInternalNavRef } = useSessionParam();

  const { config: chatConfig } = useChatConfig(agent.id);
  const configTitle = chatConfig?.title ?? "";
  const configWelcomeTitle = chatConfig?.welcomeTitle ?? "";
  const configWelcomeIcon = (chatConfig?.welcomeIcon ?? "") as import("@/lib/config/types").WelcomeIconKey;
  const configPlaceholder = chatConfig?.placeholder ?? "";
  const quickActions = chatConfig?.quickActions ?? [];
  const suggestions = chatConfig?.suggestions ?? [];
  const enableVoice = chatConfig?.enableVoice ?? false;
  const enableAttachment = chatConfig?.enableAttachment ?? false;
  const setSessionParamRef = useRef(setSessionParam);
  setSessionParamRef.current = setSessionParam;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => {
          if (!sessionIdRef.current) {
            sessionIdRef.current = crypto.randomUUID();
            setActiveSessionId(sessionIdRef.current);
            isFirstMessageRef.current = true;
            setSessionParamRef.current(sessionIdRef.current, { replace: true });
          }
          return {
            sessionId: sessionIdRef.current,
            agentId: agent.id,
          };
        },
      }),
    [agent.id]
  );

  const { messages, setMessages, sendMessage, status, addToolOutput } = useChat({
    transport,
    onToolCall: ({ toolCall }) => {
      executeClientTool(toolCall, addToolOutput, toolsList);
    },
  });

  /* ── Session handlers ── */

  const handleNewChat = useCallback(() => {
    setMessages([]);
    sessionIdRef.current = null;
    setActiveSessionId(null);
    setShareId(null);
    isFirstMessageRef.current = true;
    setSessionParam(null);
  }, [setMessages, setSessionParam]);

  const loadSessionMessages = useCallback(
    async (id: string) => {
      const [msgsRes, sessionRes] = await Promise.all([
        fetch(`/api/sessions/${id}/messages`),
        fetch(`/api/sessions/${id}`),
      ]);
      const msgs = await msgsRes.json();
      const uiMessages: UIMessage[] = msgs.map(
        (m: { id: string; role: string; parts: unknown[] }) => ({
          id: m.id,
          role: m.role,
          parts: m.parts,
        })
      );
      setMessages(uiMessages);
      sessionIdRef.current = id;
      setActiveSessionId(id);
      isFirstMessageRef.current = false;
      if (sessionRes.ok) {
        const session = await sessionRes.json();
        setShareId(session.shareId ?? null);
      }
    },
    [setMessages]
  );

  const handleLoadSession = useCallback(
    async (id: string) => {
      await loadSessionMessages(id);
      setSessionParam(id);
    },
    [loadSessionMessages, setSessionParam]
  );

  const handleDeleteSession = useCallback(
    async (id: string) => {
      const ok = await deleteSession(id, mutateSessions);
      if (ok && activeSessionId === id) {
        setActiveSessionId(null);
        setMessages([]);
        sessionIdRef.current = null;
        isFirstMessageRef.current = true;
        setSessionParam(null, { replace: true });
      }
    },
    [mutateSessions, activeSessionId, setMessages, setSessionParam]
  );

  /* ── URL ↔ state sync ── */

  // Mount: validate session from URL
  const mountValidatedRef = useRef(false);
  useEffect(() => {
    if (mountValidatedRef.current) return;
    mountValidatedRef.current = true;
    if (!urlSessionId) return;

    (async () => {
      try {
        const res = await fetch(`/api/sessions/${urlSessionId}`);
        if (!res.ok) {
          setSessionParam(null, { replace: true });
          toast.error("会话不存在或尚未保存");
          return;
        }
        const session = await res.json();
        if (session.agentId && session.agentId !== agent.id) {
          setSessionParam(null, { replace: true });
          toast.error("会话不属于当前 Agent");
          return;
        }
        // URL already has session param, just load messages (no URL push)
        await loadSessionMessages(urlSessionId);
      } catch {
        setSessionParam(null, { replace: true });
        toast.error("会话加载失败");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Popstate: browser Back/Forward → sync state
  const prevUrlSessionIdRef = useRef(urlSessionId);
  useEffect(() => {
    if (prevUrlSessionIdRef.current === urlSessionId) return;
    prevUrlSessionIdRef.current = urlSessionId;

    // Skip if this change was triggered by our own navigation
    if (isInternalNavRef.current) {
      isInternalNavRef.current = false;
      return;
    }

    // Browser navigation (Back/Forward) — just sync state, no URL change needed
    if (urlSessionId) {
      loadSessionMessages(urlSessionId);
    } else {
      setMessages([]);
      sessionIdRef.current = null;
      setActiveSessionId(null);
      isFirstMessageRef.current = true;
    }
  }, [urlSessionId, loadSessionMessages, setMessages, isInternalNavRef]);

  /* ── Chat handlers ── */

  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(event.target.value);
    },
    []
  );

  const onPromptSubmit = useCallback((message: PromptInputMessage) => {
    if (!message.text.trim() && message.files.length === 0) return;
    sendMessage(message);
    setInput("");
    if (isFirstMessageRef.current) {
      isFirstMessageRef.current = false;
      setTimeout(() => mutateSessions(), 2000);
    }
  }, [sendMessage, mutateSessions]);

  const handleTranscription = useCallback((text: string) => {
    setInput((prev) => prev + text);
  }, []);

  const [speechSupported, setSpeechSupported] = useState(false);
  useEffect(() => {
    setSpeechSupported(
      "SpeechRecognition" in window || "webkitSpeechRecognition" in window
    );
  }, []);

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      sendMessage({ text: suggestion });
      if (isFirstMessageRef.current) {
        isFirstMessageRef.current = false;
        setTimeout(() => mutateSessions(), 2000);
      }
    },
    [sendMessage, mutateSessions]
  );

  const handleSuggestionFill = useCallback(
    (suggestion: string) => {
      setInput(suggestion);
    },
    []
  );

  /* ── Export / Import handlers ── */

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportChat = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      const [sessionRes, msgsRes] = await Promise.all([
        fetch(`/api/sessions/${activeSessionId}`),
        fetch(`/api/sessions/${activeSessionId}/messages`),
      ]);
      if (!sessionRes.ok || !msgsRes.ok) {
        toast.error("导出失败：无法获取会话数据");
        return;
      }
      const session = await sessionRes.json();
      const msgs = await msgsRes.json();

      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        session: {
          title: session.title,
          model: session.model,
          createdAt: session.createdAt,
        },
        messages: msgs.map(
          (m: { role: string; parts: unknown[]; content: string | null; createdAt: string }) => ({
            role: m.role,
            parts: m.parts,
            content: m.content,
            createdAt: m.createdAt,
          })
        ),
      };

      const slug = (session.title || "chat")
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40);
      const date = new Date().toISOString().slice(0, 10);
      const filename = `chat-${slug}-${date}.json`;

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("导出失败");
    }
  }, [activeSessionId]);

  const handleImportChat = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.version !== 1 || !data.session || !Array.isArray(data.messages)) {
        toast.error("无效的聊天导出文件");
        return;
      }

      const res = await fetch(`/api/sessions/import?agentId=${agent.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "导入失败");
        return;
      }

      const { sessionId: newId } = await res.json();
      await loadSessionMessages(newId);
      mutateSessions();
      setSessionParam(newId);
      toast.success("会话导入成功");
    } catch {
      toast.error("导入失败：文件格式错误");
    }
  }, [agent.id, loadSessionMessages, mutateSessions, setSessionParam]);

  const isStreaming = status === "streaming" || status === "submitted";

  const title = configTitle || agent.name;

  /* ─────────── Render ─────────── */

  return (
    <SidebarProvider className="h-svh">
      <SessionHistory
        sessions={sessions}
        activeSessionId={activeSessionId}
        onLoadSession={handleLoadSession}
        onDeleteSession={handleDeleteSession}
        onNewChat={handleNewChat}
        canViewAllSessions={canViewAllSessions}
        showAll={showAllSessions}
        onToggleShowAll={() => setShowAllSessions((prev) => !prev)}
      />
      <SidebarInset className="overflow-hidden">
        {/* ── Controlled modals ── */}
        <RequestInspectorModal
          model={activeConfig?.modelId ?? ""}
          systemPrompt={activeConfig?.systemPrompt ?? ""}
          messages={messages}
          temperature={activeConfig?.temperature ?? 0.7}
          agentId={agent.id}
          open={inspectorOpen}
          onOpenChange={setInspectorOpen}
        />
        <UserSettingsModal open={userSettingsOpen} onOpenChange={setUserSettingsOpen} />

        {/* ── Layout header ── */}
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <span className="text-sm font-medium">{title}</span>
          <div className="ml-auto flex items-center gap-2">
            {messages.length > 0 && (
              <ShareButton
                sessionId={activeSessionId ?? undefined}
                shareId={shareId}
                onShareChange={setShareId}
              />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <EllipsisVerticalIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {messages.length > 0 && activeSessionId && (
                  <>
                    <DropdownMenuItem onClick={handleNewChat}>
                      <Trash2Icon className="size-4" />
                      Clear Chat
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportChat}>
                      <DownloadIcon className="size-4" />
                      Export Chat
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <UploadIcon className="size-4" />
                  Import Chat
                </DropdownMenuItem>
                {canEdit && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setInspectorOpen(true)}>
                      <SearchCodeIcon className="size-4" />
                      Inspect
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <UserMenu />
          </div>
        </header>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportChat(file);
            e.target.value = "";
          }}
        />

        {/* ── Chat interface ── */}
        <div className="relative flex min-h-0 flex-1 flex-col divide-y overflow-hidden">
          {messages.length === 0 ? (
            <ChatWelcome
              title={configWelcomeTitle}
              iconKey={configWelcomeIcon}
              quickActions={quickActions}
              onQuickAction={handleSuggestionClick}
            />
          ) : (
            <Conversation>
              <ConversationContent>
                {messages.map((message) => (
                  <Message from={message.role} key={message.id}>
                    {message.role === "user" ? (
                      <UserMessageContent message={message} />
                    ) : (
                      <MessageParts message={message} />
                    )}
                  </Message>
                ))}
                {isStreaming &&
                  (() => {
                    const last = messages[messages.length - 1];
                    return (
                      !last ||
                      last.role !== "assistant" ||
                      !last.parts?.some(isTextUIPart)
                    );
                  })() && (
                    <Message from="assistant">
                      <Spinner className="my-1 text-muted-foreground" />
                    </Message>
                  )}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>
          )}
          <div className="grid shrink-0 gap-4 pt-4">
            {messages.length === 0 && suggestions.length > 0 && (
              <Suggestions className="px-4">
                {suggestions.map((suggestion) => (
                  <SuggestionItem
                    key={suggestion}
                    onClick={handleSuggestionFill}
                    suggestion={suggestion}
                  />
                ))}
              </Suggestions>
            )}
            <div className="w-full px-4 pb-4">
              <PromptInput onSubmit={onPromptSubmit} multiple>
                <PromptInputBody>
                  {enableAttachment && <AttachmentPreviewBar />}
                  <PromptInputTextarea
                    onChange={handleTextChange}
                    placeholder={configPlaceholder}
                    value={input}
                  />
                </PromptInputBody>
                <PromptInputFooter>
                  {enableAttachment && <AttachmentButton />}
                  {enableVoice && speechSupported && (
                    <SpeechInput
                      size="icon-sm"
                      onTranscriptionChange={handleTranscription}
                      lang="zh-CN"
                    />
                  )}
                  <div className="flex-1" />
                  <ChatInputSubmit input={input} isStreaming={isStreaming} />
                </PromptInputFooter>
              </PromptInput>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

/* ─────────── Page ─────────── */

export default function AgentChatPage({
  params,
}: {
  params: Promise<{ orgSlug: string; agentSlug: string }>;
}) {
  const { orgSlug, agentSlug } = use(params);

  const { data: agent, isLoading } = useSWR<AgentRow>(
    `/api/agents/by-slug?org=${orgSlug}&agent=${agentSlug}`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (!agent || !agent.id) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-svh items-center justify-center">
          <Spinner className="size-6" />
        </div>
      }
    >
      <AgentChatContent agent={agent} orgSlug={orgSlug} />
    </Suspense>
  );
}
