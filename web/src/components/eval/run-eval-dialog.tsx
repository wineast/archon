"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { SlotAgentSelect } from "@/components/slots/slot-agent-select";
import { useResolvedEvaluator } from "@/lib/eval/use-resolved-evaluator";
import { useAgentOrgId } from "@/lib/agents/hooks";
import type { AssertionFailConfig } from "@/lib/eval/types";

interface RunEvalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  mode: "all" | "single";
  caseCount: number;
  onConfirm: (params: {
    judgeAgentId?: string;
    assertionFailConfig: AssertionFailConfig;
    concurrency: number;
    repeatCount: number;
    runConcurrency: number;
  }) => void;
  confirming?: boolean;
}

export function RunEvalDialog({
  open,
  onOpenChange,
  agentId,
  mode,
  caseCount,
  onConfirm,
  confirming = false,
}: RunEvalDialogProps) {
  const { evaluator, mutate: mutateEvaluator } = useResolvedEvaluator(agentId);
  const judgeAgentId = evaluator?.judgeAgentId ?? undefined;
  const orgId = useAgentOrgId(agentId);

  const [assertionFailConfig, setAssertionFailConfig] =
    useState<AssertionFailConfig>({});
  const [concurrency, setConcurrency] = useState(3);
  const [repeatCount, setRepeatCount] = useState(1);
  const [runConcurrency, setRunConcurrency] = useState(1);

  const canConfirm = !confirming;

  const handleConfirm = () => {
    onConfirm({
      judgeAgentId,
      assertionFailConfig: Object.values(assertionFailConfig).some(Boolean)
        ? assertionFailConfig
        : {},
      concurrency,
      repeatCount,
      runConcurrency,
    });
  };

  const buttonLabel =
    mode === "all"
      ? repeatCount > 1
        ? `Run All (${caseCount}) x${repeatCount}`
        : `Run All (${caseCount})`
      : repeatCount > 1
        ? `Run x${repeatCount}`
        : "Run";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>运行评估</DialogTitle>
          <DialogDescription>
            {mode === "all"
              ? `将对 ${caseCount} 个案例执行评估，使用各 Agent 的 Active 配置。`
              : "将对当前案例执行评估，使用各 Agent 的 Active 配置。"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Judge Agent */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Judge Agent
            </label>
            {orgId && (
              <div className="mt-1">
                <SlotAgentSelect
                  agentId={agentId}
                  orgId={orgId}
                  slotKey="evaluator"
                  onChanged={mutateEvaluator}
                />
              </div>
            )}
            {!judgeAgentId && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                未配置 Judge Agent：本次将跳过 Judge 评分，仅运行断言。
              </p>
            )}
          </div>

          {/* Case Concurrency */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              用例并发数
            </label>
            <Input
              type="number"
              min={1}
              max={5}
              value={concurrency}
              onChange={(e) =>
                setConcurrency(
                  Math.max(1, Math.min(5, Number(e.target.value) || 3)),
                )
              }
              className="mt-1 w-20"
              data-testid="input-concurrency"
            />
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              同时执行的用例数（1-5）
            </p>
          </div>

          {/* Repeat Count */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              重复次数
            </label>
            <Input
              type="number"
              min={1}
              max={10}
              value={repeatCount}
              onChange={(e) =>
                setRepeatCount(
                  Math.max(1, Math.min(10, Number(e.target.value) || 1)),
                )
              }
              className="mt-1 w-20"
              data-testid="input-repeat-count"
            />
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              同一组用例重复执行次数（1-10），用于评估稳定性
            </p>
          </div>

          {/* Run Concurrency — only show when repeatCount > 1 */}
          {repeatCount > 1 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Run 并发数
              </label>
              <Input
                type="number"
                min={1}
                max={5}
                value={runConcurrency}
                onChange={(e) =>
                  setRunConcurrency(
                    Math.max(1, Math.min(5, Number(e.target.value) || 1)),
                  )
                }
                className="mt-1 w-20"
                data-testid="input-run-concurrency"
              />
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                同时执行的 Run 数（1-5）
              </p>
            </div>
          )}

          {/* Assertion Settings */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              断言设置
            </label>
            <div className="flex items-center gap-2">
              <Switch
                id="dialog-judgeOnFail"
                checked={!!assertionFailConfig.judgeOnFail}
                onCheckedChange={(v) =>
                  setAssertionFailConfig((prev) => ({
                    ...prev,
                    judgeOnFail: v,
                  }))
                }
                disabled={!judgeAgentId}
              />
              <Label htmlFor="dialog-judgeOnFail" className="text-xs">
                断言失败仍执行评估
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="dialog-judgeTurnOnFail"
                checked={!!assertionFailConfig.judgeTurnOnFail}
                onCheckedChange={(v) =>
                  setAssertionFailConfig((prev) => ({
                    ...prev,
                    judgeTurnOnFail: v,
                  }))
                }
                disabled={!judgeAgentId}
              />
              <Label htmlFor="dialog-judgeTurnOnFail" className="text-xs">
                单轮断言失败仍评估该轮
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="dialog-stopOnTurnFail"
                checked={!!assertionFailConfig.stopOnTurnFail}
                onCheckedChange={(v) =>
                  setAssertionFailConfig((prev) => ({
                    ...prev,
                    stopOnTurnFail: v,
                  }))
                }
              />
              <Label htmlFor="dialog-stopOnTurnFail" className="text-xs">
                单轮断言失败停止后续轮
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            data-testid="btn-confirm-run"
          >
            {confirming && <Spinner className="mr-1.5 size-3" />}
            {buttonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
