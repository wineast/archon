"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";

interface EvalRunState {
  isRunning: boolean;
  runningCaseId: string | null;
  progress: number;
  setRunning: (running: boolean) => void;
  setRunningCaseId: (id: string | null) => void;
  setProgress: (progress: number) => void;
}

const EvalRunContext = createContext<EvalRunState | null>(null);

export function EvalRunProvider({ children }: { children: ReactNode }) {
  const [isRunning, setIsRunning] = useState(false);
  const [runningCaseId, setRunningCaseIdState] = useState<string | null>(null);
  const [progress, setProgressState] = useState(0);

  const setRunning = useCallback((running: boolean) => {
    setIsRunning(running);
  }, []);

  const setRunningCaseId = useCallback((id: string | null) => {
    setRunningCaseIdState(id);
  }, []);

  const setProgress = useCallback((p: number) => {
    setProgressState(p);
  }, []);

  return (
    <EvalRunContext value={{
      isRunning,
      runningCaseId,
      progress,
      setRunning,
      setRunningCaseId,
      setProgress,
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
