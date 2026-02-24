"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvalResult } from "@/lib/eval/types";
import { CheckCircle2Icon, XCircleIcon, AlertCircleIcon, WrenchIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function scoreColor(score: number): string {
  if (score >= 8) return "text-green-600";
  if (score >= 5) return "text-yellow-600";
  return "text-red-600";
}

interface ResultCardProps {
  result: EvalResult;
}

export function ResultCard({ result }: ResultCardProps) {
  const isMultiTurn = result.mode !== "single" && result.chatMessages.length > 0;

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4 py-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{result.caseName}</CardTitle>
          <div className="flex items-center gap-2">
            {result.mode !== "single" && (
              <Badge variant="outline" className="text-[10px]">
                {result.mode}
              </Badge>
            )}
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

        {isMultiTurn ? (
          /* Multi-turn: chat bubble display */
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Conversation</p>
            {result.chatMessages.map((msg, i) => {
              // Find the turnResult for the user turn that triggered this assistant response
              // Simpler approach: show turnResults after each assistant message
              // by matching the count of user messages before this point
              const userCountBefore = result.chatMessages
                .slice(0, i + 1)
                .filter((m) => m.role === "user").length;

              const matchingTurnResults = msg.role === "assistant"
                ? result.turnResults.filter((tr) => {
                    // Count user turns in original turns up to turnIndex
                    const userTurnsUpTo = result.turns
                      .slice(0, tr.turnIndex + 1)
                      .filter((t) => t.role === "user").length;
                    return userTurnsUpTo === userCountBefore;
                  })
                : [];

              return (
                <div key={i}>
                  <div
                    className={cn(
                      "rounded-lg p-2 text-xs whitespace-pre-wrap max-h-[120px] overflow-y-auto",
                      msg.role === "user"
                        ? "ml-8 bg-blue-50 text-blue-900"
                        : "mr-8 bg-muted",
                      msg.injected && "border border-dashed opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {msg.role === "user" ? "User" : "Assistant"}
                      </span>
                      {msg.injected && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1">
                          injected
                        </Badge>
                      )}
                    </div>
                    {msg.content}
                    {/* Tool calls display */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mt-1.5 space-y-1 border-t pt-1.5">
                        {msg.toolCalls.map((tc, tcIdx) => (
                          <div
                            key={tcIdx}
                            className="flex items-start gap-1 text-[10px] text-muted-foreground"
                          >
                            <WrenchIcon className="mt-0.5 size-2.5 shrink-0" />
                            <span>
                              <span className="font-medium">{tc.name}</span>
                              ({Object.keys(tc.args).length > 0
                                ? Object.entries(tc.args)
                                    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                                    .join(", ")
                                : ""})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Per-turn assertion/judge results */}
                  {matchingTurnResults.map((tr, trIdx) => (
                    <div key={trIdx} className="mt-1 ml-4 space-y-1">
                      {tr.assertionResults && tr.assertionResults.length > 0 && (
                        <div className="space-y-0.5">
                          {tr.assertionResults.map((ar, arIdx) => (
                            <div key={arIdx} className="flex items-start gap-1 text-[10px]">
                              {ar.passed ? (
                                <CheckCircle2Icon className="mt-0.5 size-2.5 shrink-0 text-green-600" />
                              ) : (
                                <XCircleIcon className="mt-0.5 size-2.5 shrink-0 text-red-600" />
                              )}
                              <span>{ar.message}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {tr.judgeResult && (
                        <div className="text-[10px] text-muted-foreground">
                          Turn judge: <span className={scoreColor(tr.judgeResult.overallScore)}>
                            {tr.judgeResult.overallScore}/10
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          /* Single turn: traditional display */
          <>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Input</p>
              <p className="mt-0.5 text-xs bg-muted rounded p-2 whitespace-pre-wrap">
                {result.turns[0]?.content ?? ""}
              </p>
            </div>

            {result.chatResponse && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Response</p>
                <div className="mt-0.5 text-xs bg-muted rounded p-2 max-h-[120px] overflow-y-auto whitespace-pre-wrap">
                  {result.chatResponse}
                  {/* Tool calls in single mode */}
                  {result.chatMessages[1]?.toolCalls && result.chatMessages[1].toolCalls.length > 0 && (
                    <div className="mt-1.5 space-y-1 border-t pt-1.5">
                      {result.chatMessages[1].toolCalls.map((tc, tcIdx) => (
                        <div
                          key={tcIdx}
                          className="flex items-start gap-1 text-[10px] text-muted-foreground"
                        >
                          <WrenchIcon className="mt-0.5 size-2.5 shrink-0" />
                          <span>
                            <span className="font-medium">{tc.name}</span>
                            ({Object.keys(tc.args).length > 0
                              ? Object.entries(tc.args)
                                  .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                                  .join(", ")
                              : ""})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
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
