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
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { MessageParts } from "@/components/message-parts";
import { ChatWelcome } from "@/components/chat-welcome";
import { Spinner } from "@/components/ui/spinner";
import { executeClientTool } from "@/lib/tools/client-executor";
import { registerDynamicToolSource } from "@/tool-ui";
import type { WelcomeIconKey } from "@/lib/config/types";

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
      if (source) registerDynamicToolSource(t.name, source);
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
          return { sessionId: sessionIdRef.current };
        },
      }),
    [agentId, token]
  );

  const { messages, sendMessage, status, addToolOutput } = useChat({
    transport,
    onToolCall: ({ toolCall }) => {
      if (!config) return;
      // Build minimal tool-like rows for client executor
      const toolRows = config.tools.map((t) => ({
        ...t,
        id: "",
        agentId,
        key: t.name,
        description: "",
        parametersSchemaId: null,
        returnParametersSchemaId: null,
        output: null,
        handler: null,
        component: t.component,
        componentSource: t.componentSource,
        enabled: true,
        executionTarget: t.executionTarget as "server" | "client",
        createdAt: new Date(),
        updatedAt: new Date(),
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

  const onPromptSubmit = useCallback(() => {
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput("");
  }, [input, sendMessage]);

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
                    <MessageContent>
                      <MessageResponse>
                        {message.parts
                          ?.filter(isTextUIPart)
                          .map((p) => p.text)
                          .join("")}
                      </MessageResponse>
                    </MessageContent>
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
            <PromptInput onSubmit={onPromptSubmit}>
              <PromptInputBody>
                <PromptInputTextarea
                  onChange={handleTextChange}
                  placeholder={placeholder}
                  value={input}
                />
              </PromptInputBody>
              <PromptInputFooter>
                <div className="flex-1" />
                <PromptInputSubmit
                  disabled={!input.trim() || isStreaming}
                  status={isStreaming ? "streaming" : "ready"}
                />
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
