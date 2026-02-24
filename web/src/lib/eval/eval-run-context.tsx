"use client";

import { createContext, useContext, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import type { EvalRunRow } from "@/db/schema";
import type { KeyedMutator } from "swr";
import { toast } from "sonner";

interface EvalRunState {
  isRunning: boolean;
  activeRun: EvalRunRow | null;
  progress: number;
  cancelRun: () => Promise<void>;
}

const EvalRunContext = createContext<EvalRunState | null>(null);

interface EvalRunProviderProps {
  runs: EvalRunRow[];
  mutateRuns: KeyedMutator<EvalRunRow[]>;
  children: ReactNode;
}

export function EvalRunProvider({ runs, mutateRuns, children }: EvalRunProviderProps) {
  const activeRun = useMemo(
    () => runs.find((r) => r.status === "running") ?? null,
    [runs]
  );

  const isRunning = activeRun !== null;

  const progress = useMemo(() => {
    if (!activeRun || activeRun.totalCases === 0) return 0;
    return (activeRun.completedCases / activeRun.totalCases) * 100;
  }, [activeRun]);

  const cancelRun = useCallback(async () => {
    if (!activeRun) return;
    try {
      const res = await fetch(`/api/eval/run/${activeRun.id}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      mutateRuns();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }, [activeRun, mutateRuns]);

  return (
    <EvalRunContext value={{
      isRunning,
      activeRun,
      progress,
      cancelRun,
    }}>
      {children}
    </EvalRunContext>
  );
}

export function useEvalRun(): EvalRunState {
  const ctx = useContext(EvalRunContext);
  if (!ctx) {
    throw new Error("useEvalRun must be used within <EvalRunProvider>");
  }
  return ctx;
}
