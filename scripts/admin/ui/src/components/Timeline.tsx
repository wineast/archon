import { useState } from "react";
import { Spinner } from "./Spinner";

export interface TimelineAction {
  label: string;
  help?: string;
  onClick: () => void;
  loading?: boolean;
  variant?: string;
}

export interface TimelineStep {
  label: string;
  status: "done" | "current" | "pending";
  help?: string;
  action?: TimelineAction;
  secondaryAction?: TimelineAction;
}

interface TimelineProps {
  steps: TimelineStep[];
}

const ICON_HELP = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
);

function ActionButton({
  action,
  className,
  helpOpen,
  onToggleHelp,
}: {
  action: TimelineAction;
  className: string;
  helpOpen: boolean;
  onToggleHelp: () => void;
}) {
  return (
    <span className="timeline-action-wrap">
      <button
        className={className}
        disabled={action.loading}
        onClick={action.onClick}
      >
        {action.loading && <Spinner />}
        <span>{action.label}</span>
      </button>
      {action.help && (
        <button
          className="timeline-help-btn"
          onClick={(e) => { e.stopPropagation(); onToggleHelp(); }}
        >
          {ICON_HELP}
        </button>
      )}
      {action.help && helpOpen && (
        <div className="timeline-help-popover">{action.help}</div>
      )}
    </span>
  );
}

export function Timeline({ steps }: TimelineProps) {
  const [openHelp, setOpenHelp] = useState<string | null>(null);

  const toggleHelp = (key: string) => setOpenHelp((prev) => (prev === key ? null : key));

  return (
    <div className="timeline">
      {steps.map((step, i) => (
        <div key={step.label} className="timeline-item">
          {/* Connector line */}
          {i > 0 && (
            <div
              className={`timeline-line ${
                step.status === "done" || step.status === "current"
                  ? "timeline-line-done"
                  : "timeline-line-pending"
              }`}
            />
          )}

          {/* Node */}
          <div
            className={`timeline-node ${
              step.status === "done"
                ? "timeline-node-done"
                : step.status === "current"
                  ? "timeline-node-current"
                  : "timeline-node-pending"
            }`}
          >
            {step.status === "done" && (
              <span className="timeline-check">&#x2713;</span>
            )}
          </div>

          {/* Label + actions */}
          <div className="timeline-label-area">
            <span
              className={`timeline-label ${
                step.status === "done"
                  ? "timeline-label-done"
                  : step.status === "current"
                    ? "timeline-label-current"
                    : "timeline-label-pending"
              }`}
            >
              {step.label}
            </span>
            {step.status === "current" && step.action && (
              <ActionButton
                action={step.action}
                className="btn btn-sm btn-timeline"
                helpOpen={openHelp === `${i}-primary`}
                onToggleHelp={() => toggleHelp(`${i}-primary`)}
              />
            )}
            {step.status === "current" && step.secondaryAction && (
              <ActionButton
                action={step.secondaryAction}
                className={`btn btn-sm ${step.secondaryAction.variant || "btn-danger"}`}
                helpOpen={openHelp === `${i}-secondary`}
                onToggleHelp={() => toggleHelp(`${i}-secondary`)}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
