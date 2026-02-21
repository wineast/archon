"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { useBenchmarkModels } from "@/lib/eval/benchmark-hooks";

interface BenchmarkModelsProps {
  agentId: string;
}

export function BenchmarkModels({ agentId }: BenchmarkModelsProps) {
  const { models, isLoading } = useBenchmarkModels(agentId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        暂无模型数据，运行评测后查看
      </p>
    );
  }

  const bestModelIdx =
    models.length > 0
      ? models.reduce(
          (best, m, i) =>
            m.avgScore != null &&
            (best === -1 || m.avgScore > (models[best].avgScore ?? -1))
              ? i
              : best,
          -1
        )
      : -1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Model Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Model</TableHead>
              <TableHead className="text-right">Runs</TableHead>
              <TableHead className="text-right">Avg Score</TableHead>
              <TableHead className="text-right">Avg Pass Rate</TableHead>
              <TableHead className="text-right">Avg Latency</TableHead>
              <TableHead className="text-right">Last Run</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.map((m, i) => (
              <TableRow
                key={m.chatModel}
                className={i === bestModelIdx ? "bg-green-50 dark:bg-green-950/20" : ""}
              >
                <TableCell className="font-mono text-xs">
                  {m.chatModel.split("/").pop()}
                </TableCell>
                <TableCell className="text-right text-xs">
                  {m.runCount}
                </TableCell>
                <TableCell className="text-right text-xs font-medium">
                  {m.avgScore?.toFixed(1) ?? "-"}
                </TableCell>
                <TableCell className="text-right text-xs">
                  {m.avgPassRate.toFixed(1)}%
                </TableCell>
                <TableCell className="text-right text-xs">
                  {m.avgLatencyMs != null
                    ? `${(m.avgLatencyMs / 1000).toFixed(1)}s`
                    : "-"}
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {new Date(m.lastRunAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
