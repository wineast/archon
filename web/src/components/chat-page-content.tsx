"use client";

import { UserMenu } from "@/components/auth/user-menu";
import { DefaultChatTransport, isTextUIPart, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
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
  registerUiHiddenTool,
  AgentIdProvider,
  type ComponentRecord,
} from "@/tool-ui";
import { SessionHistory } from "@/components/session-history";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useSessions, deleteSession, renameSession } from "@/lib/session/hooks";
import { useAgentRole } from "@/lib/auth/hooks";
import {
  DownloadIcon,
  EllipsisVerticalIcon,
  PaperclipIcon,
  SearchCodeIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { AgentRow } from "@/db/schema";
import { useSessionParam } from "@/lib/session/use-session-param";
import type { VersionMode } from "@/lib/versions/mode";

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
  const t = useTranslations("chat");
  return (
    <PromptInputButton onClick={openFileDialog} tooltip={t("attachmentTooltip")}>
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

/* ─────────── ChatPageContent props ─────────── */

export interface ChatPageContentProps {
  agent: AgentRow;
  orgSlug: string;
  /** Version mode: undefined=editing, "published", { versionId } */
  versionMode?: VersionMode;
  /** Extra fields merged into transport body */
  transportBodyExtras?: Record<string, unknown>;
  /** Session isolation source */
  sessionSource?: string;
  /** Banner rendered above the header */
  banner?: React.ReactNode;
  /** Feature toggles */
  features?: {
    share?: boolean;
    importExport?: boolean;
    userSettings?: boolean;
  };
  /** Role check: "editor" blocks non-editors, default "viewer" (no check) */
  requiredRole?: "viewer" | "editor";
}

/* ─────────── ChatPageContent ─────────── */

export function ChatPageContent({
  agent,
  versionMode,
  transportBodyExtras,
  sessionSource,
  banner,
  features = {},
  requiredRole = "viewer",
}: ChatPageContentProps) {
  const t = useTranslations("chat");
  const [input, setInput] = useState("");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [userSettingsOpen, setUserSettingsOpen] = useState(false);

  const { canEdit, canViewAllSessions, isLoading: roleLoading } = useAgentRole(agent.id);
  const [showAllSessions, setShowAllSessions] = useState(false);

  // Resolve hooks mode: undefined → editing, "published" → published, { versionId } → version
  const hooksMode = versionMode;
  const { activeConfig } = useActiveModelConfig(agent.id, hooksMode);
  const { tools: toolsList } = useTools(agent.id, hooksMode);
  const { components: componentsList } = useComponents(agent.id, hooksMode);

  // Register dynamic component sources with composition support
  useMemo(() => {
    clearCompiledRegistry();
    const idToKey = new Map(componentsList.map((c) => [c.id, c.key]));
    const records: ComponentRecord[] = componentsList
      .filter((c) => c.componentSource.trim())
      .map((c) => ({ key: c.key, source: c.componentSource }));

    let compiled: ReturnType<typeof compileComponentGraph> = new Map();
    try {
      compiled = compileComponentGraph(records);
    } catch (e) {
      console.error("[component-composition]", e);
    }

    for (const t of toolsList) {
      if (t.uiHidden) {
        registerUiHiddenTool(t.name);
        continue;
      }
      const compKey = t.componentId ? idToKey.get(t.componentId) : undefined;
      const compiledComp = compKey ? compiled.get(compKey) : undefined;
      if (compiledComp) {
        registerCompiledComponent(t.name, compiledComp);
      } else if (compKey) {
        const comp = componentsList.find((c) => c.key === compKey);
        if (comp?.componentSource) registerDynamicComponentSource(t.name, comp.componentSource);
      } else {
        const defaultComp = compiled.get("tool-call-default");
        if (defaultComp) registerCompiledComponent(t.name, defaultComp);
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
    // Wrap in @layer components — lower priority than global @layer utilities,
    // so duplicate standard utilities are harmless while component-specific
    // classes (e.g. arbitrary values) still work.
    style.textContent = `@layer components {\n${cssBlocks.join("\n")}\n}`;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, [componentsList]);

  const sessionIdRef = useRef<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const { sessions, mutate: mutateSessions } = useSessions(agent.id, showAllSessions, sessionSource);
  const isFirstMessageRef = useRef(true);
  const { sessionId: urlSessionId, setSessionParam, isInternalNavRef } = useSessionParam();

  const { config: chatConfig } = useChatConfig(agent.id, hooksMode);
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
            ...transportBodyExtras,
          };
        },
      }),
    [agent.id, transportBodyExtras]
  );

  const { messages, setMessages, sendMessage, status, addToolOutput } = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: ({ toolCall }) => {
      // Only handle client-side tools; server/host tools are already executed server-side
      const isClientTool = toolsList.some(
        (t) => t.name === toolCall.toolName && t.executionTarget === "client"
      );
      if (isClientTool) {
        executeClientTool(toolCall, addToolOutput, toolsList);
      }
    },
    onError: (error) => {
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.error === "not_published") {
          toast.error(t("notPublished"));
          return;
        }
        if (parsed.error === "no_model_config") {
          toast.error(t("noModelConfig"));
          return;
        }
        if (parsed.error === "quota_exceeded") {
          toast.error(parsed.message || t("quotaExceeded"));
          return;
        }
      } catch {
        // not JSON
      }
      toast.error(error.message || t("chatError"));
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

  const handleRenameSession = useCallback(
    async (id: string, title: string) => {
      await renameSession(id, title, mutateSessions);
    },
    [mutateSessions]
  );

  /* ── URL ↔ state sync ── */

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
          toast.error(t("sessionNotFound"));
          return;
        }
        const session = await res.json();
        if (session.agentId && session.agentId !== agent.id) {
          setSessionParam(null, { replace: true });
          toast.error(t("sessionAgentMismatch"));
          return;
        }
        await loadSessionMessages(urlSessionId);
      } catch {
        setSessionParam(null, { replace: true });
        toast.error(t("sessionLoadError"));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prevUrlSessionIdRef = useRef(urlSessionId);
  useEffect(() => {
    if (prevUrlSessionIdRef.current === urlSessionId) return;
    prevUrlSessionIdRef.current = urlSessionId;

    if (isInternalNavRef.current) {
      isInternalNavRef.current = false;
      return;
    }

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
      setTimeout(() => mutateSessions(), 500);
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
        setTimeout(() => mutateSessions(), 500);
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
        toast.error(t("exportFetchError"));
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
  }, [activeSessionId, t]);

  const handleImportChat = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.version !== 1 || !data.session || !Array.isArray(data.messages)) {
        toast.error(t("importInvalidFormat"));
        return;
      }

      const res = await fetch(`/api/sessions/import?agentId=${agent.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("importError"));
        return;
      }

      const { sessionId: newId } = await res.json();
      await loadSessionMessages(newId);
      mutateSessions();
      setSessionParam(newId);
      toast.success(t("importSuccess"));
    } catch {
      toast.error(t("importFormatError"));
    }
  }, [agent.id, loadSessionMessages, mutateSessions, setSessionParam, t]);

  const isStreaming = status === "streaming" || status === "submitted";
  const title = configTitle || agent.name;

  /* ── Role check for editor-only pages ── */

  if (requiredRole === "editor") {
    if (roleLoading) {
      return (
        <div className="flex h-svh items-center justify-center">
          <Spinner className="size-6" />
        </div>
      );
    }
    if (!canEdit) {
      // Cannot use notFound() in a component, render a placeholder instead
      return (
        <div className="flex h-svh items-center justify-center">
          <p className="text-muted-foreground">Not found</p>
        </div>
      );
    }
  }

  /* ─────────── Render ─────────── */

  return (
    <AgentIdProvider agentId={agent.id}>
    <SidebarProvider className="h-svh">
      <SessionHistory
        sessions={sessions}
        activeSessionId={activeSessionId}
        onLoadSession={handleLoadSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
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
        {features.userSettings && (
          <UserSettingsModal open={userSettingsOpen} onOpenChange={setUserSettingsOpen} />
        )}

        {/* ── Banner ── */}
        {banner}

        {/* ── Layout header ── */}
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <span className="text-sm font-medium">{title}</span>
          <div className="ml-auto flex items-center gap-2">
            {features.share && messages.length > 0 && (
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
                      {t("clear")}
                    </DropdownMenuItem>
                    {features.importExport && (
                      <DropdownMenuItem onClick={handleExportChat}>
                        <DownloadIcon className="size-4" />
                        {t("export")}
                      </DropdownMenuItem>
                    )}
                  </>
                )}
                {features.importExport && (
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                    <UploadIcon className="size-4" />
                    {t("import")}
                  </DropdownMenuItem>
                )}
                {canEdit && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setInspectorOpen(true)}>
                      <SearchCodeIcon className="size-4" />
                      {t("inspect")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <UserMenu />
          </div>
        </header>

        {features.importExport && (
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
        )}

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
    </AgentIdProvider>
  );
}
