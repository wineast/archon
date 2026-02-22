"use client";

import { useCallback, useState } from "react";
import { KeyIcon, Trash2Icon, CheckIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useOrgApiKeys,
  saveOrgApiKey,
  deleteOrgApiKey,
} from "@/lib/orgs/api-keys-hooks";
import { BYOK_PROVIDERS } from "@/db/schema";
import type { ByokProvider } from "@/db/schema";

const PROVIDER_LABELS: Record<ByokProvider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  xai: "xAI",
  deepseek: "DeepSeek",
  mistral: "Mistral",
  cohere: "Cohere",
  perplexity: "Perplexity",
  alibaba: "阿里云百炼",
  moonshot: "Moonshot (Kimi)",
  zhipu: "智谱 AI",
  minimax: "MiniMax",
  bytedance: "火山引擎",
};

interface OrgApiKeysPanelProps {
  orgId: string;
}

export function OrgApiKeysPanel({ orgId }: OrgApiKeysPanelProps) {
  const { keys, isLoading, mutate } = useOrgApiKeys(orgId);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="mx-auto max-w-lg space-y-1 p-6">
        <p className="text-xs text-muted-foreground mb-4">
          配置各 AI Provider 的 API Key。已配置的 Provider 将优先使用你的 Key，未配置的将使用平台额度。
        </p>
        {BYOK_PROVIDERS.map((provider) => {
          const existing = keys.find((k) => k.provider === provider);
          return (
            <ProviderRow
              key={provider}
              orgId={orgId}
              provider={provider}
              label={PROVIDER_LABELS[provider]}
              existingKey={existing ?? null}
              mutate={mutate}
            />
          );
        })}
      </div>
    </ScrollArea>
  );
}

interface ProviderRowProps {
  orgId: string;
  provider: ByokProvider;
  label: string;
  existingKey: { id: string; maskedKey: string } | null;
  mutate: ReturnType<typeof useOrgApiKeys>["mutate"];
}

function ProviderRow({ orgId, provider, label, existingKey, mutate }: ProviderRowProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleSave = useCallback(async () => {
    if (!value.trim()) return;
    setBusy(true);
    const ok = await saveOrgApiKey(orgId, provider, value.trim(), mutate);
    setBusy(false);
    if (ok) {
      setEditing(false);
      setValue("");
    }
  }, [orgId, provider, value, mutate]);

  const handleDelete = useCallback(async () => {
    if (!existingKey) return;
    setBusy(true);
    await deleteOrgApiKey(orgId, existingKey.id, mutate);
    setBusy(false);
  }, [orgId, existingKey, mutate]);

  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-2.5">
      <KeyIcon className="size-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {editing ? (
          <div className="flex items-center gap-2 mt-1">
            <Input
              className="h-7 text-xs"
              type="password"
              placeholder={`输入 ${label} API Key`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
            <Button
              size="sm"
              className="h-7 shrink-0"
              disabled={busy || !value.trim()}
              onClick={handleSave}
            >
              {busy ? <Spinner className="size-3" /> : <CheckIcon className="size-3" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 shrink-0"
              onClick={() => { setEditing(false); setValue(""); }}
              disabled={busy}
            >
              取消
            </Button>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            {existingKey ? existingKey.maskedKey : "未配置"}
          </div>
        )}
      </div>
      {!editing && (
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setEditing(true)}
          >
            {existingKey ? "更换" : <><PlusIcon className="size-3 mr-1" />配置</>}
          </Button>
          {existingKey && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={() => setConfirmOpen(true)}
                disabled={busy}
              >
                {busy ? <Spinner className="size-3" /> : <Trash2Icon className="size-3" />}
              </Button>
              <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="删除 API Key"
                description={`确定删除 ${label} 的 API Key 吗？删除后将使用平台额度。`}
                onConfirm={handleDelete}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
