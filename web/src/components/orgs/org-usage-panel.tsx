"use client";

import { useMemo, useState } from "react";
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
  useOrgUsageSummary,
  useOrgUsageDaily,
  useOrgUsageByAgent,
} from "@/lib/orgs/usage-hooks";
import { useOrgCredits } from "@/lib/orgs/credits-hooks";
import { AlertTriangleIcon, XCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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

type DateRange = "7d" | "30d" | "all";

function getDateRange(range: DateRange): { from?: string; to?: string } {
  if (range === "all") return {};
  const now = new Date();
  const days = range === "7d" ? 7 : 30;
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString() };
}

export function OrgUsagePanel({ orgId }: { orgId: string }) {
  const [range, setRange] = useState<DateRange>("30d");

  const { from, to } = useMemo(() => getDateRange(range), [range]);

  const { data: summary, isLoading: summaryLoading } = useOrgUsageSummary(orgId, from, to);
  const { data: daily, isLoading: dailyLoading } = useOrgUsageDaily(orgId, from, to);
  const { data: byAgent, isLoading: byAgentLoading } = useOrgUsageByAgent(orgId, from, to);

  const { balance, isLoading: creditsLoading } = useOrgCredits(orgId);

  // Compute consumed from summary data
  const totalConsumed = summary?.total?.totalCost ?? 0;
  const totalCredits = balance + totalConsumed;
  const consumedPercent = totalCredits > 0 ? (totalConsumed / totalCredits) * 100 : 0;

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        {/* Credit Balance Card */}
        {!creditsLoading && (
          <Card
            className={cn(
              balance <= 0 && "border-red-500/50",
              balance > 0 && balance <= 5 && "border-yellow-500/50"
            )}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                额度
                {balance <= 0 && (
                  <span className="flex items-center gap-1 text-xs text-red-500">
                    <XCircleIcon className="size-3.5" />
                    额度已用完
                  </span>
                )}
                {balance > 0 && balance <= 5 && (
                  <span className="flex items-center gap-1 text-xs text-yellow-600">
                    <AlertTriangleIcon className="size-3.5" />
                    额度即将用完
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline gap-4">
                <div>
                  <div className="text-2xl font-bold">{formatCost(balance)}</div>
                  <div className="text-xs text-muted-foreground">剩余额度</div>
                </div>
                <div>
                  <div className="text-lg font-medium text-muted-foreground">{formatCost(totalConsumed)}</div>
                  <div className="text-xs text-muted-foreground">已消耗</div>
                </div>
              </div>
              {totalCredits > 0 && (
                <div className="space-y-1">
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        consumedPercent >= 95 ? "bg-red-500" : consumedPercent >= 75 ? "bg-yellow-500" : "bg-primary"
                      )}
                      style={{ width: `${Math.min(consumedPercent, 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    {consumedPercent.toFixed(1)}% 已使用
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Date Range Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Period:</span>
          {(["7d", "30d", "all"] as const).map((r) => (
            <Button
              key={r}
              variant={range === r ? "default" : "outline"}
              size="sm"
              onClick={() => setRange(r)}
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

        {/* By Agent Breakdown */}
        {byAgentLoading ? (
          <div className="flex justify-center py-8">
            <Spinner className="size-6" />
          </div>
        ) : byAgent && byAgent.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Cost by Agent</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Input</TableHead>
                    <TableHead className="text-right">Output</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byAgent.map((row) => (
                    <TableRow key={row.agentId}>
                      <TableCell>{row.agentName || "(deleted)"}</TableCell>
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
        ) : null}

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
      </div>
    </ScrollArea>
  );
}
