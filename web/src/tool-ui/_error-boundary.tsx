"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackToolName?: string;
}

interface State {
  error: Error | null;
}

export class DynamicComponentErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[DynamicComponent]", this.props.fallbackToolName, error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm">
          <AlertCircle className="size-4 shrink-0" />
          <span>
            Component error{this.props.fallbackToolName ? ` (${this.props.fallbackToolName})` : ""}:{" "}
            {this.state.error.message}
          </span>
        </div>
      );
    }
    return this.props.children;
  }
}
