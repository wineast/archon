"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvalResult } from "@/lib/eval/types";
import { CheckCircle2Icon, XCircleIcon, AlertCircleIcon } from "lucide-react";

function scoreColor(score: number): string {
  if (score >= 8) return "text-green-600";
  if (score >= 5) return "text-yellow-600";
  return "text-red-600";
}

interface ResultCardProps {
  result: EvalResult;
}

export function ResultCard({ result }: ResultCardProps) {
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4 py-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{result.caseName}</CardTitle>
          <div className="flex items-center gap-2">
            {result.error ? (
              <Badge variant="destructive">Error</Badge>
            ) : result.allAssertionsPassed ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Passed
              </Badge>
            ) : (
              <Badge variant="destructive">Failed</Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {result.durationMs}ms
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-4 py-0">
        {result.error && (
          <div className="rounded bg-destructive/10 p-2 text-xs text-destructive">
            {result.error}
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-muted-foreground">Input</p>
          <p className="mt-0.5 text-xs bg-muted rounded p-2 whitespace-pre-wrap">
            {result.input}
          </p>
        </div>

        {result.chatResponse && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Response</p>
            <p className="mt-0.5 text-xs bg-muted rounded p-2 max-h-[120px] overflow-y-auto whitespace-pre-wrap">
              {result.chatResponse}
            </p>
          </div>
        )}

        {result.assertionResults.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Assertions
            </p>
            <div className="mt-1 space-y-1">
              {result.assertionResults.map((ar, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs">
                  {ar.passed ? (
                    <CheckCircle2Icon className="mt-0.5 size-3 shrink-0 text-green-600" />
                  ) : (
                    <XCircleIcon className="mt-0.5 size-3 shrink-0 text-red-600" />
                  )}
                  <span>{ar.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.judgeResult && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Judge Score
            </p>
            <div className="mt-1 space-y-1.5">
              {Object.entries(result.judgeResult.scores).map(([key, entry]) => (
                <div key={key} className="flex items-start gap-2">
                  <AlertCircleIcon className="mt-0.5 size-3 shrink-0" />
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {key}:{" "}
                    </span>
                    <span
                      className={`text-sm font-bold ${scoreColor(entry.score)}`}
                    >
                      {entry.score}/10
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {entry.reason}
                    </p>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1 border-t">
                <span className="text-xs font-medium">Overall:</span>
                <span
                  className={`text-sm font-bold ${scoreColor(result.judgeResult.overallScore)}`}
                >
                  {result.judgeResult.overallScore}/10
                </span>
              </div>
            </div>
          </div>
        )}

        {!result.judgeResult && !result.error && !result.allAssertionsPassed && (
          <p className="text-xs text-muted-foreground italic">
            Judge skipped (assertions failed)
          </p>
        )}
      </CardContent>
    </Card>
  );
}
