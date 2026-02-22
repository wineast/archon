"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { ChatWelcome } from "@/components/chat-welcome";
import { Spinner } from "@/components/ui/spinner";
import { executeClientTool } from "@/lib/tools/client-executor";
import { registerDynamicComponentSource } from "@/tool-ui";
import type { WelcomeIconKey } from "@/lib/config/types";
import { PaperclipIcon } from "lucide-react";

/* ─── Types ─── */

interface EmbedConfig {
  agent: { id: string; name: string; icon: string };
  chatConfig: {
    title: string;
    welcomeTitle: string;
    welcomeIcon: string;
    quickActions: string[];
    placeholder: string;
    suggestions: string[];
    enableVoice: boolean;
    enableAttachment: boolean;
  } | null;
  tools: Array<{
    name: string;
    component: string | null;
    componentSource: string | null;
    executionTarget: string;
  }>;
  components: Array<{
    key: string;
    componentSource: string;
    generatedCss: string;
  }>;
}

/* ─── Helpers ─── */

function getSessionStorageKey(agentId: string) {
  return `archon_embed_session_${agentId}`;
}

function getPersistedSessionId(agentId: string): string | null {
  try {
    return localStorage.getItem(getSessionStorageKey(agentId));
  } catch {
    return null;
  }
}

function persistSessionId(agentId: string, sessionId: string) {
  try {
    localStorage.setItem(getSessionStorageKey(agentId), sessionId);
  } catch {}
}

/* ─── Suggestion item ─── */

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

/* ─── Prompt sub-components (need PromptInput context) ─── */

function EmbedAttachmentPreviewBar() {
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

function EmbedAttachmentButton() {
  const { openFileDialog } = usePromptInputAttachments();
  return (
    <PromptInputButton onClick={openFileDialog} tooltip="添加附件">
      <PaperclipIcon className="size-4" />
    </PromptInputButton>
  );
}

function EmbedInputSubmit({ input, isStreaming }: { input: string; isStreaming: boolean }) {
  const { files } = usePromptInputAttachments();
  return (
    <PromptInputSubmit
      disabled={(!input.trim() && files.length === 0) || isStreaming}
      status={isStreaming ? "streaming" : "ready"}
    />
  );
}

/* ─── Main embed chat ─── */

function EmbedChat({
  agentId,
  token,
}: {
  agentId: string;
  token: string;
}) {
  const [config, setConfig] = useState<EmbedConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const sessionIdRef = useRef<string | null>(getPersistedSessionId(agentId));

  // Host communication state
  const hostContextRef = useRef<Record<string, unknown>>({});
  const registeredHostToolsRef = useRef<string[]>([]);
  const pendingHostCallsRef = useRef<
    Map<
      string,
      {
        resolve: (value: unknown) => void;
        reject: (reason: unknown) => void;
        timeoutId: ReturnType<typeof setTimeout>;
      }
    >
  >(new Map());

  // postMessage listener for host ↔ iframe communication
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data.type !== "string") return;

      switch (data.type) {
        case "archon:context":
          hostContextRef.current = data.payload ?? {};
          break;
        case "archon:tools-register":
          registeredHostToolsRef.current = data.payload ?? [];
          break;
        case "archon:tool-result": {
          const { callId, result } = data.payload ?? {};
          const pending = pendingHostCallsRef.current.get(callId);
          if (pending) {
            clearTimeout(pending.timeoutId);
            pendingHostCallsRef.current.delete(callId);
            pending.resolve(result);
          }
          break;
        }
        case "archon:tool-error": {
          const { callId, error } = data.payload ?? {};
          const pending = pendingHostCallsRef.current.get(callId);
          if (pending) {
            clearTimeout(pending.timeoutId);
            pendingHostCallsRef.current.delete(callId);
            pending.reject(new Error(error ?? "Host tool error"));
          }
          break;
        }
      }
    }

    window.addEventListener("message", handleMessage);

    // Signal to host that iframe is ready
    if (window.parent !== window) {
      window.parent.postMessage({ type: "archon:ready" }, "*");
    }

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Fetch embed config
  useEffect(() => {
    fetch("/api/embed/config", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(setConfig)
      .catch((e) => setConfigError(e.message));
  }, [token]);

  // Register dynamic tool components + inject CSS
  useMemo(() => {
    if (!config) return;
    const componentMap = new Map(
      config.components.map((c) => [c.key, c.componentSource])
    );
    for (const t of config.tools) {
      const source =
        (t.component && componentMap.get(t.component)) || t.componentSource;
      if (source) registerDynamicComponentSource(t.name, source);
    }
  }, [config]);

  useEffect(() => {
    if (!config) return;
    const cssBlocks: string[] = [];
    for (const c of config.components) {
      if (c.generatedCss) cssBlocks.push(c.generatedCss);
    }
    if (cssBlocks.length === 0) return;
    const style = document.createElement("style");
    style.setAttribute("data-dynamic-components", "true");
    style.textContent = cssBlocks.join("\n");
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, [config]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/embed/chat",
        headers: { Authorization: `Bearer ${token}` },
        body: () => {
          if (!sessionIdRef.current) {
            sessionIdRef.current = crypto.randomUUID();
            persistSessionId(agentId, sessionIdRef.current);
          }
          return {
            sessionId: sessionIdRef.current,
            hostContext: hostContextRef.current,
            registeredHostTools: registeredHostToolsRef.current,
          };
        },
      }),
    [agentId, token]
  );

  const { messages, sendMessage, status, addToolOutput } = useChat({
    transport,
    onToolCall: async ({ toolCall }) => {
      if (!config) return;

      // Find the tool definition to check executionTarget
      const toolDef = config.tools.find((t) => t.name === toolCall.toolName);
      const target = toolDef?.executionTarget ?? "server";

      if (target === "host") {
        // Host tool: delegate to host page via postMessage
        if (window.parent === window) {
          addToolOutput({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            output: JSON.stringify({ error: "Not running in iframe" }),
          });
          return;
        }

        try {
          const result = await new Promise<unknown>((resolve, reject) => {
            const callId = crypto.randomUUID();
            const timeoutId = setTimeout(() => {
              pendingHostCallsRef.current.delete(callId);
              reject(new Error(`Host tool "${toolCall.toolName}" timed out (30s)`));
            }, 30000);

            pendingHostCallsRef.current.set(callId, { resolve, reject, timeoutId });

            window.parent.postMessage(
              {
                type: "archon:tool-call",
                payload: {
                  callId,
                  toolName: toolCall.toolName,
                  args: toolCall.input,
                },
              },
              "*"
            );
          });

          addToolOutput({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            output: JSON.stringify(result ?? {}),
          });
        } catch (err) {
          addToolOutput({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            output: JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
            }),
          });
        }
        return;
      }

      // Client tool: use existing executor
      const toolRows = config.tools.map((t) => ({
        ...t,
        id: "",
        agentId,
        key: t.name,
        description: "",
        parametersSchema: null,
        returnParametersSchema: null,
        output: null,
        handler: null,
        url: null,
        componentId: null,
        isSystem: false,
        enabled: true,
        executionTarget: t.executionTarget as "server" | "client" | "host",
        sandboxMode: "light" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      }));
      executeClientTool(toolCall, addToolOutput, toolRows);
    },
  });

  const isStreaming = status === "streaming" || status === "submitted";

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
  }, [sendMessage]);

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
    },
    [sendMessage]
  );

  const handleSuggestionFill = useCallback((suggestion: string) => {
    setInput(suggestion);
  }, []);

  if (configError) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-destructive">
        {configError === "401"
          ? "Invalid token"
          : configError === "403"
            ? "Origin not allowed"
            : "Failed to load chat"}
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  const chatConfig = config.chatConfig;
  const title = chatConfig?.title || config.agent.name;
  const welcomeTitle = chatConfig?.welcomeTitle ?? "";
  const welcomeIcon = (chatConfig?.welcomeIcon ?? "") as WelcomeIconKey;
  const quickActions = chatConfig?.quickActions ?? [];
  const suggestions = chatConfig?.suggestions ?? [];
  const placeholder = chatConfig?.placeholder ?? "";
  const enableVoice = chatConfig?.enableVoice ?? false;
  const enableAttachment = chatConfig?.enableAttachment ?? false;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <span className="text-sm font-medium">{title}</span>
      </header>

      {/* Chat */}
      <div className="relative flex min-h-0 flex-1 flex-col divide-y overflow-hidden">
        {messages.length === 0 ? (
          <ChatWelcome
            title={welcomeTitle}
            iconKey={welcomeIcon}
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
                {enableAttachment && <EmbedAttachmentPreviewBar />}
                <PromptInputTextarea
                  onChange={handleTextChange}
                  placeholder={placeholder}
                  value={input}
                />
              </PromptInputBody>
              <PromptInputFooter>
                {enableAttachment && <EmbedAttachmentButton />}
                {enableVoice && speechSupported && (
                  <SpeechInput
                    size="icon-sm"
                    onTranscriptionChange={handleTranscription}
                    lang="zh-CN"
                  />
                )}
                <div className="flex-1" />
                <EmbedInputSubmit input={input} isStreaming={isStreaming} />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ─── */

export default function EmbedChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ agentId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { agentId } = use(params);
  const { token } = use(searchParams);

  if (!token) {
    return (
      <div className="flex h-svh items-center justify-center p-4 text-sm text-destructive">
        Missing token parameter
      </div>
    );
  }

  return (
    <div className="h-svh">
      <EmbedChat agentId={agentId} token={token} />
    </div>
  );
}
