"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { useEvalRuns } from "@/lib/eval/hooks";
import { useBenchmarkCompare } from "@/lib/eval/benchmark-hooks";

interface BenchmarkCompareProps {
  agentId: string;
}

function DeltaCell({ value, unit, inverse }: { value: number | null; unit?: string; inverse?: boolean }) {
  if (value == null) return <span className="text-muted-foreground">-</span>;
  const isPositive = inverse ? value < 0 : value > 0;
  const isNegative = inverse ? value > 0 : value < 0;
  const color = isPositive
    ? "text-green-600"
    : isNegative
      ? "text-red-600"
      : "text-muted-foreground";
  const sign = value > 0 ? "+" : "";
  return (
    <span className={color}>
      {sign}
      {typeof value === "number" ? value.toFixed(1) : value}
      {unit}
    </span>
  );
}

export function BenchmarkCompare({ agentId }: BenchmarkCompareProps) {
  const { runs } = useEvalRuns(agentId);
  const [runAId, setRunAId] = useState<string>();
  const [runBId, setRunBId] = useState<string>();

  const { comparison, isLoading } = useBenchmarkCompare(runAId, runBId);

  if (runs.length < 2) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        至少需要 2 次评测运行才能进行对比
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Run selectors */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Run A (Baseline)
          </label>
          <Select value={runAId} onValueChange={setRunAId}>
            <SelectTrigger className="mt-1 h-8 text-xs">
              <SelectValue placeholder="Select Run A..." />
            </SelectTrigger>
            <SelectContent>
              {runs.map((r) => (
                <SelectItem key={r.id} value={r.id} className="text-xs">
                  {new Date(r.createdAt).toLocaleDateString()} -{" "}
                  {r.chatModel.split("/").pop()}
                  {r.isBaseline ? " (Baseline)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Run B (Compare)
          </label>
          <Select value={runBId} onValueChange={setRunBId}>
            <SelectTrigger className="mt-1 h-8 text-xs">
              <SelectValue placeholder="Select Run B..." />
            </SelectTrigger>
            <SelectContent>
              {runs.map((r) => (
                <SelectItem key={r.id} value={r.id} className="text-xs">
                  {new Date(r.createdAt).toLocaleDateString()} -{" "}
                  {r.chatModel.split("/").pop()}
                  {r.isBaseline ? " (Baseline)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Spinner className="size-6" />
        </div>
      )}

      {comparison && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Avg Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold">
                    {comparison.summary.scoreAvgA ?? "-"}
                  </span>
                  <span className="text-muted-foreground">vs</span>
                  <span className="text-lg font-bold">
                    {comparison.summary.scoreAvgB ?? "-"}
                  </span>
                </div>
                {comparison.summary.scoreAvgA != null &&
                  comparison.summary.scoreAvgB != null && (
                    <DeltaCell
                      value={
                        comparison.summary.scoreAvgB -
                        comparison.summary.scoreAvgA
                      }
                    />
                  )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Pass Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold">
                    {comparison.summary.passRateA}%
                  </span>
                  <span className="text-muted-foreground">vs</span>
                  <span className="text-lg font-bold">
                    {comparison.summary.passRateB}%
                  </span>
                </div>
                <DeltaCell
                  value={
                    comparison.summary.passRateB -
                    comparison.summary.passRateA
                  }
                  unit="%"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Avg Latency
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold">
                    {comparison.summary.latencyAvgA != null
                      ? `${(comparison.summary.latencyAvgA / 1000).toFixed(1)}s`
                      : "-"}
                  </span>
                  <span className="text-muted-foreground">vs</span>
                  <span className="text-lg font-bold">
                    {comparison.summary.latencyAvgB != null
                      ? `${(comparison.summary.latencyAvgB / 1000).toFixed(1)}s`
                      : "-"}
                  </span>
                </div>
                {comparison.summary.latencyAvgA != null &&
                  comparison.summary.latencyAvgB != null && (
                    <DeltaCell
                      value={
                        comparison.summary.latencyAvgB -
                        comparison.summary.latencyAvgA
                      }
                      unit="ms"
                      inverse
                    />
                  )}
              </CardContent>
            </Card>
          </div>

          {/* Case-by-case table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Case Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case</TableHead>
                    <TableHead className="text-right">Score A</TableHead>
                    <TableHead className="text-right">Score B</TableHead>
                    <TableHead className="text-right">Delta</TableHead>
                    <TableHead className="text-center">Pass A</TableHead>
                    <TableHead className="text-center">Pass B</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparison.cases.map((c) => (
                    <TableRow
                      key={c.caseId}
                      className={c.passedChanged ? "bg-muted/50" : ""}
                    >
                      <TableCell className="text-xs font-medium">
                        {c.caseName}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {c.resultA?.score?.toFixed(1) ?? "-"}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {c.resultB?.score?.toFixed(1) ?? "-"}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        <DeltaCell value={c.scoreDelta} />
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {c.resultA
                          ? c.resultA.passed
                            ? "Pass"
                            : "Fail"
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {c.resultB
                          ? c.resultB.passed
                            ? "Pass"
                            : "Fail"
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
