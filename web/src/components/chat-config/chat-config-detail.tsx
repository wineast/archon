"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PlusIcon,
  RotateCcwIcon,
  SaveIcon,
  TrashIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { WELCOME_ICON_OPTIONS } from "@/components/chat-welcome";
import { cn } from "@/lib/utils";
import type { WelcomeIconKey } from "@/lib/config/types";
import type { ChatConfigRow } from "@/db/schema";

interface ChatConfigDetailProps {
  config: ChatConfigRow;
  onSave: (id: string, data: Record<string, unknown>) => Promise<void>;
}

export function ChatConfigDetail({
  config,
  onSave,
}: ChatConfigDetailProps) {
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(config.title);
  const [welcomeTitle, setWelcomeTitle] = useState(config.welcomeTitle);
  const [welcomeIcon, setWelcomeIcon] = useState<WelcomeIconKey>(
    config.welcomeIcon as WelcomeIconKey
  );
  const [quickActions, setQuickActions] = useState<string[]>(config.quickActions);
  const [placeholder, setPlaceholder] = useState(config.placeholder);
  const [suggestions, setSuggestions] = useState<string[]>(config.suggestions);

  // Reset draft when config changes
  useEffect(() => {
    setTitle(config.title);
    setWelcomeTitle(config.welcomeTitle);
    setWelcomeIcon(config.welcomeIcon as WelcomeIconKey);
    setQuickActions(config.quickActions);
    setPlaceholder(config.placeholder);
    setSuggestions(config.suggestions);
  }, [config]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(config.id, {
        title,
        welcomeTitle,
        welcomeIcon,
        quickActions: quickActions.filter((s) => s.trim() !== ""),
        placeholder,
        suggestions: suggestions.filter((s) => s.trim() !== ""),
      });
    } finally {
      setSaving(false);
    }
  }, [config.id, onSave, title, welcomeTitle, welcomeIcon, quickActions, placeholder, suggestions]);

  const dirty =
    title !== config.title ||
    welcomeTitle !== config.welcomeTitle ||
    welcomeIcon !== config.welcomeIcon ||
    JSON.stringify(quickActions) !== JSON.stringify(config.quickActions) ||
    placeholder !== config.placeholder ||
    JSON.stringify(suggestions) !== JSON.stringify(config.suggestions);

  const handleReset = useCallback(() => {
    setTitle(config.title);
    setWelcomeTitle(config.welcomeTitle);
    setWelcomeIcon(config.welcomeIcon as WelcomeIconKey);
    setQuickActions([...config.quickActions]);
    setPlaceholder(config.placeholder);
    setSuggestions([...config.suggestions]);
  }, [config]);

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-4 p-4">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter title..."
            />
          </div>

          {/* Welcome Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Welcome Title</label>
            <Input
              value={welcomeTitle}
              onChange={(e) => setWelcomeTitle(e.target.value)}
              placeholder="Enter welcome title..."
            />
          </div>

          {/* Welcome Icon */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Welcome Icon</label>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setWelcomeIcon("")}
                className={cn(
                  "flex size-9 items-center justify-center rounded-md border text-xs text-muted-foreground transition-colors",
                  welcomeIcon === ""
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-accent"
                )}
              >
                None
              </button>
              {WELCOME_ICON_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    title={opt.label}
                    onClick={() => setWelcomeIcon(opt.key)}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-md border transition-colors",
                      welcomeIcon === opt.key
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-accent"
                    )}
                  >
                    <Icon className="size-4" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Quick Actions</label>
            <p className="text-muted-foreground text-xs">Click to send directly</p>
            <div className="space-y-2">
              {quickActions.map((action, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={action}
                    onChange={(e) =>
                      setQuickActions((prev) =>
                        prev.map((item, i) => (i === index ? e.target.value : item))
                      )
                    }
                    placeholder="Enter quick action..."
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() =>
                      setQuickActions((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickActions((prev) => [...prev, ""])}
            >
              <PlusIcon className="mr-1 size-3" />
              Add Action
            </Button>
          </div>

          {/* Input Placeholder */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Input Placeholder</label>
            <Input
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value)}
              placeholder="Enter placeholder text..."
            />
          </div>

          {/* Suggestions */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Suggestion Questions</label>
            <p className="text-muted-foreground text-xs">Click to fill input</p>
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={suggestion}
                    onChange={(e) =>
                      setSuggestions((prev) =>
                        prev.map((item, i) => (i === index ? e.target.value : item))
                      )
                    }
                    placeholder="Enter suggestion..."
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() =>
                      setSuggestions((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSuggestions((prev) => [...prev, ""])}
            >
              <PlusIcon className="mr-1 size-3" />
              Add Suggestion
            </Button>
          </div>
        </div>
      </ScrollArea>

      {/* Bottom bar */}
      <div className="flex items-center gap-2 border-t px-4 py-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !dirty}
        >
          {saving ? (
            <Spinner className="mr-1 size-3" />
          ) : (
            <SaveIcon className="mr-1 size-3" />
          )}
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={saving || !dirty}
        >
          <RotateCcwIcon className="mr-1 size-3" />
          Reset
        </Button>
      </div>
    </div>
  );
}
