"use client";

import { createContext, useContext, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import type { EvalBatchRow } from "@/db/schema";
import type { KeyedMutator } from "swr";
import { toast } from "sonner";
import { cancelEvalBatch } from "./hooks";

interface EvalBatchState {
  isRunning: boolean;
  activeBatch: EvalBatchRow | null;
  progress: number;
  cancelBatch: () => Promise<void>;
}

const EvalBatchContext = createContext<EvalBatchState | null>(null);

interface EvalBatchProviderProps {
  batches: EvalBatchRow[];
  mutateBatches: KeyedMutator<EvalBatchRow[]>;
  children: ReactNode;
}

export function EvalBatchProvider({ batches, mutateBatches, children }: EvalBatchProviderProps) {
  const activeBatch = useMemo(
    () => batches.find((b) => b.status === "running") ?? null,
    [batches]
  );

  const isRunning = activeBatch !== null;

  const progress = useMemo(() => {
    if (!activeBatch || activeBatch.totalRuns === 0) return 0;
    return (activeBatch.completedRuns / activeBatch.totalRuns) * 100;
  }, [activeBatch]);

  const cancelBatchFn = useCallback(async () => {
    if (!activeBatch) return;
    await cancelEvalBatch(activeBatch.id, () => mutateBatches());
  }, [activeBatch, mutateBatches]);

  return (
    <EvalBatchContext value={{
      isRunning,
      activeBatch,
      progress,
      cancelBatch: cancelBatchFn,
    }}>
      {children}
    </EvalBatchContext>
  );
}

export function useEvalBatch(): EvalBatchState {
  const ctx = useContext(EvalBatchContext);
  if (!ctx) {
    throw new Error("useEvalBatch must be used within <EvalBatchProvider>");
  }
  return ctx;
}

// Keep backward-compatible alias
/** @deprecated Use useEvalBatch instead */
export const useEvalRun = useEvalBatch;
