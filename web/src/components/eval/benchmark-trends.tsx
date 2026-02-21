"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useBenchmarkTrends } from "@/lib/eval/benchmark-hooks";

interface BenchmarkTrendsProps {
  agentId: string;
}

export function BenchmarkTrends({ agentId }: BenchmarkTrendsProps) {
  const { trends, isLoading } = useBenchmarkTrends(agentId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (trends.length < 2) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        至少需要 2 次评测运行才能查看趋势
      </p>
    );
  }

  const baseline = trends.find((t) => t.isBaseline);

  const chartData = trends.map((t) => ({
    date: new Date(t.createdAt).toLocaleDateString("en", {
      month: "2-digit",
      day: "2-digit",
    }),
    score: t.averageScore,
    passRate: t.passRate,
    latency: t.averageLatencyMs,
    model: t.chatModel.split("/").pop(),
  }));

  return (
    <div className="space-y-4">
      {/* Score Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Score Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) => [
                  value != null ? `${Number(value).toFixed(1)}/10` : "N/A",
                  "Score",
                ]}
              />
              {baseline?.averageScore != null && (
                <ReferenceLine
                  y={baseline.averageScore}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  label={{
                    value: "Baseline",
                    fontSize: 10,
                    fill: "hsl(var(--muted-foreground))",
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey="score"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Pass Rate Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Pass Rate Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                formatter={(value) => [
                  `${Number(value).toFixed(1)}%`,
                  "Pass Rate",
                ]}
              />
              {baseline && (
                <ReferenceLine
                  y={baseline.passRate}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  label={{
                    value: "Baseline",
                    fontSize: 10,
                    fill: "hsl(var(--muted-foreground))",
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey="passRate"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Latency Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Latency Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}s`}
              />
              <Tooltip
                formatter={(value) => [
                  value != null ? `${Number(value).toLocaleString()}ms` : "N/A",
                  "Latency",
                ]}
              />
              {baseline?.averageLatencyMs != null && (
                <ReferenceLine
                  y={baseline.averageLatencyMs}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  label={{
                    value: "Baseline",
                    fontSize: 10,
                    fill: "hsl(var(--muted-foreground))",
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey="latency"
                stroke="hsl(var(--chart-3))"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
