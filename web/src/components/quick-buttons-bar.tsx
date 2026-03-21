"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import type { QuickButton, WelcomeIconKey } from "@/lib/config/types";
import { WELCOME_ICON_OPTIONS } from "@/components/chat-welcome";

const ICON_MAP = Object.fromEntries(
  WELCOME_ICON_OPTIONS.map((o) => [o.key, o.icon]),
) as Record<string, React.ComponentType<{ className?: string }>>;

export interface QuickButtonsBarProps {
  buttons: QuickButton[];
  onQuickButton: (message: string) => void;
  className?: string;
}

export function QuickButtonsBar({
  buttons,
  onQuickButton,
  className,
}: QuickButtonsBarProps) {
  if (buttons.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {buttons.map((btn, index) => (
        <QuickButtonItem
          key={`${btn.label}-${index}`}
          button={btn}
          onClick={onQuickButton}
        />
      ))}
    </div>
  );
}

function QuickButtonItem({
  button,
  onClick,
}: {
  button: QuickButton;
  onClick: (message: string) => void;
}) {
  const handleClick = useCallback(() => {
    onClick(button.message);
  }, [onClick, button.message]);

  const IconComponent = button.icon ? ICON_MAP[button.icon] : null;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-border bg-background px-2 py-1 text-xs",
        "cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {IconComponent && <IconComponent className="size-3" />}
      {button.label}
    </button>
  );
}
