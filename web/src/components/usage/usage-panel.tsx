"use client";

import { useMemo, useState } from "react";
import { GuideDialog } from "@/components/ui/guide-dialog";
import usageGuide from "../../../guide/usage-metering.md";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useUsageSummary,
  useUsageDaily,
  useUsageRecords,
  useUsageStorage,
} from "@/lib/usage/hooks";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";

function formatCost(cost: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(cost);
}

function formatTokens(tokens: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact" }).format(tokens);
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

type DateRange = "7d" | "30d" | "all";

function getDateRange(range: DateRange): { from?: string; to?: string } {
  if (range === "all") return {};
  const now = new Date();
  const days = range === "7d" ? 7 : 30;
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString() };
}

export function UsagePanel({ agentId }: { agentId: string }) {
  const [range, setRange] = useState<DateRange>("30d");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { from, to } = useMemo(() => getDateRange(range), [range]);

  const { data: summary, isLoading: summaryLoading } = useUsageSummary(agentId, from, to);
  const { data: daily, isLoading: dailyLoading } = useUsageDaily(agentId, from, to);
  const { data: recordsData, isLoading: recordsLoading } = useUsageRecords(agentId, page, pageSize, { from, to });
  const { data: storage } = useUsageStorage(agentId);

  const totalPages = recordsData ? Math.ceil(recordsData.total / pageSize) : 1;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <span className="text-sm font-semibold">Usage</span>
        <GuideDialog title="用量统计" content={usageGuide} />
        <div className="flex-1" />
      </div>
      <ScrollArea className="flex-1 min-h-0">
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        {/* Date Range Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Period:</span>
          {(["7d", "30d", "all"] as const).map((r) => (
            <Button
              key={r}
              variant={range === r ? "default" : "outline"}
              size="sm"
              onClick={() => { setRange(r); setPage(1); }}
            >
              {r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "All"}
            </Button>
          ))}
        </div>

        {/* Overview Cards */}
        {summaryLoading ? (
          <div className="flex justify-center py-8">
            <Spinner className="size-6" />
          </div>
        ) : summary ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Cost</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCost(summary.total.totalCost)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.total.recordCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Input Tokens</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatTokens(summary.total.totalInputTokens)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Output Tokens</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatTokens(summary.total.totalOutputTokens)}</div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Daily Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Daily Cost Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Spinner className="size-6" />
              </div>
            ) : daily && daily.length > 0 ? (
              <ResponsiveContainer width="100%" height={256}>
                <AreaChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                  />
                  <Tooltip
                    formatter={(value) => [formatCost(Number(value)), "Cost"]}
                    labelFormatter={(label) => String(label)}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalCost"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.1}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                No data for selected period
              </div>
            )}
          </CardContent>
        </Card>

        {/* Model Breakdown */}
        {summary && summary.byModel.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Cost by Model</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Input</TableHead>
                    <TableHead className="text-right">Output</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.byModel.map((row) => (
                    <TableRow key={row.modelId}>
                      <TableCell className="font-mono text-xs">{row.modelId}</TableCell>
                      <TableCell className="text-right">{formatCost(row.totalCost)}</TableCell>
                      <TableCell className="text-right">{formatTokens(row.totalInputTokens)}</TableCell>
                      <TableCell className="text-right">{formatTokens(row.totalOutputTokens)}</TableCell>
                      <TableCell className="text-right">{row.recordCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Source Breakdown */}
        {summary && summary.bySource.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Cost by Source</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Input</TableHead>
                    <TableHead className="text-right">Output</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.bySource.map((row) => (
                    <TableRow key={row.source}>
                      <TableCell>{row.source}</TableCell>
                      <TableCell className="text-right">{formatCost(row.totalCost)}</TableCell>
                      <TableCell className="text-right">{formatTokens(row.totalInputTokens)}</TableCell>
                      <TableCell className="text-right">{formatTokens(row.totalOutputTokens)}</TableCell>
                      <TableCell className="text-right">{row.recordCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Storage Stats */}
        {storage && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Storage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-8">
                <div>
                  <div className="text-sm text-muted-foreground">Files</div>
                  <div className="text-xl font-bold">{storage.fileCount}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total Size</div>
                  <div className="text-xl font-bold">{formatBytes(storage.totalSize)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Records */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Records</CardTitle>
          </CardHeader>
          <CardContent>
            {recordsLoading ? (
              <div className="flex justify-center py-8">
                <Spinner className="size-6" />
              </div>
            ) : recordsData && recordsData.records.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Input</TableHead>
                      <TableHead className="text-right">Output</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recordsData.records.map((rec) => (
                      <TableRow key={rec.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(rec.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{rec.modelId}</TableCell>
                        <TableCell>{rec.source}</TableCell>
                        <TableCell className="text-right">{formatTokens(rec.inputTokens)}</TableCell>
                        <TableCell className="text-right">{formatTokens(rec.outputTokens)}</TableCell>
                        <TableCell className="text-right">{formatCost(rec.costUSD)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {/* Pagination */}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {recordsData.total} records total
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeftIcon className="size-4" />
                    </Button>
                    <span className="text-sm">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRightIcon className="size-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No usage records yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </ScrollArea>
    </div>
  );
}
