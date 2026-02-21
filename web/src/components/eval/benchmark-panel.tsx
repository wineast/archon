"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BenchmarkTrends } from "./benchmark-trends";
import { BenchmarkCompare } from "./benchmark-compare";
import { BenchmarkModels } from "./benchmark-models";

interface BenchmarkPanelProps {
  agentId: string;
}

export function BenchmarkPanel({ agentId }: BenchmarkPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <span className="text-sm font-semibold">Benchmark</span>
      </div>
      <Tabs defaultValue="trends" className="flex flex-1 flex-col min-h-0">
        <div className="border-b px-3">
          <TabsList variant="line">
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="compare">Compare</TabsTrigger>
            <TabsTrigger value="models">Models</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="trends" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full min-h-0">
            <div className="p-4">
              <BenchmarkTrends agentId={agentId} />
            </div>
          </ScrollArea>
        </TabsContent>
        <TabsContent value="compare" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full min-h-0">
            <div className="p-4">
              <BenchmarkCompare agentId={agentId} />
            </div>
          </ScrollArea>
        </TabsContent>
        <TabsContent value="models" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full min-h-0">
            <div className="p-4">
              <BenchmarkModels agentId={agentId} />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
