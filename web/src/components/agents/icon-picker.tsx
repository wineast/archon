"use client";

import {
  BotIcon,
  BrainIcon,
  SparklesIcon,
  ZapIcon,
  RocketIcon,
  CodeIcon,
  BookOpenIcon,
  MessageSquareIcon,
  WandSparklesIcon,
  ShieldIcon,
  SearchIcon,
  PenToolIcon,
  GlobeIcon,
  HeartIcon,
  MusicIcon,
  ImageIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const AGENT_ICON_OPTIONS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "bot", label: "Bot", icon: BotIcon },
  { key: "brain", label: "Brain", icon: BrainIcon },
  { key: "sparkles", label: "Sparkles", icon: SparklesIcon },
  { key: "zap", label: "Zap", icon: ZapIcon },
  { key: "rocket", label: "Rocket", icon: RocketIcon },
  { key: "code", label: "Code", icon: CodeIcon },
  { key: "book-open", label: "Book", icon: BookOpenIcon },
  { key: "message-square", label: "Message", icon: MessageSquareIcon },
  { key: "wand", label: "Wand", icon: WandSparklesIcon },
  { key: "shield", label: "Shield", icon: ShieldIcon },
  { key: "search", label: "Search", icon: SearchIcon },
  { key: "pen-tool", label: "Pen", icon: PenToolIcon },
  { key: "globe", label: "Globe", icon: GlobeIcon },
  { key: "heart", label: "Heart", icon: HeartIcon },
  { key: "music", label: "Music", icon: MusicIcon },
  { key: "image", label: "Image", icon: ImageIcon },
];

export const AGENT_ICON_MAP = Object.fromEntries(
  AGENT_ICON_OPTIONS.map((o) => [o.key, o.icon])
) as Record<string, LucideIcon>;

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {AGENT_ICON_OPTIONS.map(({ key, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            "flex size-9 items-center justify-center rounded-md border transition-colors",
            value === key
              ? "border-primary bg-primary/10 text-primary"
              : "border-transparent hover:bg-accent"
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
