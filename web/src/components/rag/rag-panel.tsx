"use client";

import { useCallback, useState } from "react";
import { SearchIcon, PowerIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { GuideDialog } from "@/components/ui/guide-dialog";
import ragGuide from "../../../guide/rag.md";
import {
  useRagConfig,
  updateRagConfig,
  useRagDocuments,
  uploadRagDocument,
  deleteRagDocument,
} from "@/lib/rag/hooks";
import { RagConfigDetail } from "./rag-config-detail";
import { RagDocumentList } from "./rag-document-list";

interface RagPanelProps {
  agentId: string;
  ragEnabled: boolean;
  onToggleFeature: (enabled: boolean) => Promise<void>;
}

export function RagPanel({ agentId, ragEnabled, onToggleFeature }: RagPanelProps) {
  const [enabling, setEnabling] = useState(false);

  const { config, isLoading: configLoading, mutate: mutateConfig } = useRagConfig(agentId);
  const { documents, mutate: mutateDocuments } = useRagDocuments(agentId);

  // Wrap toggle to also refresh ragConfig cache (config may be auto-created)
  const handleToggle = useCallback(
    async (enabled: boolean) => {
      await onToggleFeature(enabled);
      mutateConfig();
    },
    [onToggleFeature, mutateConfig]
  );

  const handleSaveConfig = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      await updateRagConfig(id, data, mutateConfig);
    },
    [mutateConfig]
  );

  const handleUpload = useCallback(
    async (file: File) => {
      return uploadRagDocument(agentId, file, mutateDocuments);
    },
    [agentId, mutateDocuments]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      return deleteRagDocument(id, mutateDocuments);
    },
    [mutateDocuments]
  );

  const handleEnable = useCallback(async () => {
    setEnabling(true);
    await handleToggle(true);
    setEnabling(false);
  }, [handleToggle]);

  // First-time ceremony: only show when disabled AND no config data
  if (!ragEnabled && config === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
        <SearchIcon className="size-12 opacity-30" />
        <p className="text-sm">RAG 功能未启用</p>
        <Button variant="outline" size="sm" onClick={handleEnable} disabled={enabling}>
          {enabling ? <Spinner className="mr-1.5 size-4" /> : <PowerIcon className="mr-1.5 size-4" />}
          启用
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="documents" className="flex h-full flex-col gap-0">
        <div className="flex items-center gap-2 border-b px-3 py-1.5">
          <span className="text-sm font-semibold">RAG</span>
          <Switch
            checked={ragEnabled}
            onCheckedChange={handleToggle}
            className="scale-75"
          />
          <GuideDialog title="RAG 模块" content={ragGuide} />
          <div className="flex-1" />
          <TabsList className="h-7">
            <TabsTrigger value="documents" className="text-xs">
              Documents
            </TabsTrigger>
            <TabsTrigger value="config" className="text-xs">
              Config
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="documents" className="flex-1 min-h-0 mt-0">
          <RagDocumentList
            documents={documents}
            onUpload={handleUpload}
            onDelete={handleDelete}
          />
        </TabsContent>

        <TabsContent value="config" className="flex-1 min-h-0 mt-0">
          <RagConfigDetail
            config={config}
            isLoading={configLoading}
            onSave={handleSaveConfig}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
