"use client";

import {
  ArrowRightIcon,
  BotIcon,
  BrainIcon,
  LightbulbIcon,
  MessageSquareIcon,
  RocketIcon,
  SparklesIcon,
  WandSparklesIcon,
  ZapIcon,
} from "lucide-react";
import { useCallback } from "react";
import { cn } from "@/lib/utils";
import type { WelcomeIconKey } from "@/lib/config/types";

export interface ChatWelcomeProps {
  className?: string;
  title?: string;
  subtitle?: string;
  iconKey?: WelcomeIconKey;
  quickActions?: string[];
  onQuickAction?: (action: string) => void;
}

export const WELCOME_ICON_OPTIONS: {
  key: WelcomeIconKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "sparkles", label: "Sparkles", icon: SparklesIcon },
  { key: "bot", label: "Bot", icon: BotIcon },
  { key: "brain", label: "Brain", icon: BrainIcon },
  { key: "message-square", label: "Message", icon: MessageSquareIcon },
  { key: "wand", label: "Wand", icon: WandSparklesIcon },
  { key: "zap", label: "Zap", icon: ZapIcon },
  { key: "lightbulb", label: "Lightbulb", icon: LightbulbIcon },
  { key: "rocket", label: "Rocket", icon: RocketIcon },
];

const ICON_MAP = Object.fromEntries(
  WELCOME_ICON_OPTIONS.map((o) => [o.key, o.icon])
) as Record<string, React.ComponentType<{ className?: string }>>;

export function ChatWelcome({
  className,
  title,
  subtitle,
  iconKey,
  quickActions = [],
  onQuickAction,
}: ChatWelcomeProps) {
  const IconComponent = iconKey ? ICON_MAP[iconKey] : null;

  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-8 p-8",
        className
      )}
    >
      {/* Icon */}
      {IconComponent && (
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconComponent className="size-6" />
        </div>
      )}

      {/* Title & subtitle */}
      <div className="space-y-2 text-center">
        {title && (
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        )}
        {subtitle && (
          <p className="text-muted-foreground text-sm">{subtitle}</p>
        )}
      </div>

      {/* Quick action buttons - click to send directly */}
      {quickActions.length > 0 && onQuickAction && (
        <div className="flex max-w-lg flex-wrap items-center justify-center gap-2">
          {quickActions.map((action) => (
            <QuickActionButton
              key={action}
              action={action}
              onClick={onQuickAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuickActionButton({
  action,
  onClick,
}: {
  action: string;
  onClick: (action: string) => void;
}) {
  const handleClick = useCallback(() => {
    onClick(action);
  }, [onClick, action]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center whitespace-nowrap cursor-pointer rounded-full border border-border bg-background px-4 py-2 text-sm",
        "transition-colors hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      {action}
      <ArrowRightIcon className="ml-1.5 size-3" />
    </button>
  );
}
