"use client";

import { useCallback, useEffect, useState } from "react";
import deepEqual from "fast-deep-equal";
import { PlusIcon, RotateCcwIcon, SaveIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { WELCOME_ICON_OPTIONS } from "@/components/chat-welcome";
import { cn } from "@/lib/utils";
import type { WelcomeIconKey, QuickButton } from "@/lib/config/types";
import type { ChatConfigRow } from "@/db/schema";

interface ChatConfigDetailProps {
  config: ChatConfigRow;
  onSave: (id: string, data: Record<string, unknown>) => Promise<void>;
}

export function ChatConfigDetail({ config, onSave }: ChatConfigDetailProps) {
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(config.title);
  const [welcomeTitle, setWelcomeTitle] = useState(config.welcomeTitle);
  const [welcomeSubtitle, setWelcomeSubtitle] = useState(
    config.welcomeSubtitle,
  );
  const [welcomeIcon, setWelcomeIcon] = useState<WelcomeIconKey>(
    config.welcomeIcon as WelcomeIconKey,
  );
  const [quickActions, setQuickActions] = useState<string[]>(
    config.quickActions ?? [],
  );
  const [quickButtons, setQuickButtons] = useState<QuickButton[]>(
    config.quickButtons ?? [],
  );
  const [placeholder, setPlaceholder] = useState(config.placeholder);
  const [suggestions, setSuggestions] = useState<string[]>(
    config.suggestions ?? [],
  );
  const [enableVoice, setEnableVoice] = useState(config.enableVoice);
  const [enableAttachment, setEnableAttachment] = useState(
    config.enableAttachment,
  );

  // Reset draft when config changes
  useEffect(() => {
    setTitle(config.title);
    setWelcomeTitle(config.welcomeTitle);
    setWelcomeSubtitle(config.welcomeSubtitle);
    setWelcomeIcon(config.welcomeIcon as WelcomeIconKey);
    setQuickActions(config.quickActions ?? []);
    setQuickButtons(config.quickButtons ?? []);
    setPlaceholder(config.placeholder);
    setSuggestions(config.suggestions ?? []);
    setEnableVoice(config.enableVoice);
    setEnableAttachment(config.enableAttachment);
  }, [config]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(config.id, {
        title,
        welcomeTitle,
        welcomeSubtitle,
        welcomeIcon,
        quickActions: quickActions.filter((s) => s.trim() !== ""),
        quickButtons: quickButtons.filter(
          (b) => b.label.trim() !== "" || b.message.trim() !== "",
        ),
        placeholder,
        suggestions: suggestions.filter((s) => s.trim() !== ""),
        enableVoice,
        enableAttachment,
      });
    } finally {
      setSaving(false);
    }
  }, [
    config.id,
    onSave,
    title,
    welcomeTitle,
    welcomeSubtitle,
    welcomeIcon,
    quickActions,
    quickButtons,
    placeholder,
    suggestions,
    enableVoice,
    enableAttachment,
  ]);

  const dirty =
    title !== config.title ||
    welcomeTitle !== config.welcomeTitle ||
    welcomeSubtitle !== config.welcomeSubtitle ||
    welcomeIcon !== config.welcomeIcon ||
    !deepEqual(quickActions, config.quickActions) ||
    !deepEqual(quickButtons, config.quickButtons) ||
    placeholder !== config.placeholder ||
    !deepEqual(suggestions, config.suggestions) ||
    enableVoice !== config.enableVoice ||
    enableAttachment !== config.enableAttachment;

  const handleReset = useCallback(() => {
    setTitle(config.title);
    setWelcomeTitle(config.welcomeTitle);
    setWelcomeSubtitle(config.welcomeSubtitle);
    setWelcomeIcon(config.welcomeIcon as WelcomeIconKey);
    setQuickActions([...config.quickActions]);
    setQuickButtons(config.quickButtons.map((b) => ({ ...b })));
    setPlaceholder(config.placeholder);
    setSuggestions([...config.suggestions]);
    setEnableVoice(config.enableVoice);
    setEnableAttachment(config.enableAttachment);
  }, [config]);

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-4 p-4">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter title..."
            />
          </div>

          {/* Welcome Title */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Welcome Title
            </label>
            <Input
              value={welcomeTitle}
              onChange={(e) => setWelcomeTitle(e.target.value)}
              placeholder="Enter welcome title..."
            />
          </div>

          {/* Welcome Subtitle */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Welcome Subtitle
            </label>
            <Input
              value={welcomeSubtitle}
              onChange={(e) => setWelcomeSubtitle(e.target.value)}
              placeholder="Enter welcome subtitle..."
            />
          </div>

          {/* Welcome Icon */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Welcome Icon
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setWelcomeIcon("")}
                className={cn(
                  "flex size-9 items-center justify-center rounded-md border text-xs text-muted-foreground transition-colors",
                  welcomeIcon === ""
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-accent",
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
                        : "border-border text-muted-foreground hover:bg-accent",
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
            <label className="text-xs font-medium text-muted-foreground">
              Quick Actions
            </label>
            <p className="text-muted-foreground text-xs">
              Click to send directly
            </p>
            <div className="space-y-2">
              {quickActions.map((action, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={action}
                    onChange={(e) =>
                      setQuickActions((prev) =>
                        prev.map((item, i) =>
                          i === index ? e.target.value : item,
                        ),
                      )
                    }
                    placeholder="Enter quick action..."
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() =>
                      setQuickActions((prev) =>
                        prev.filter((_, i) => i !== index),
                      )
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

          {/* Quick Buttons */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Quick Buttons
            </label>
            <p className="text-muted-foreground text-xs">
              Buttons shown next to send, click to send message
            </p>
            <div className="space-y-3">
              {quickButtons.map((btn, index) => (
                <div key={index} className="space-y-1.5 rounded-md border p-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={btn.label}
                      onChange={(e) =>
                        setQuickButtons((prev) =>
                          prev.map((item, i) =>
                            i === index
                              ? { ...item, label: e.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="Button label..."
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() =>
                        setQuickButtons((prev) =>
                          prev.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <TrashIcon className="size-4" />
                    </Button>
                  </div>
                  <Input
                    value={btn.message}
                    onChange={(e) =>
                      setQuickButtons((prev) =>
                        prev.map((item, i) =>
                          i === index
                            ? { ...item, message: e.target.value }
                            : item,
                        ),
                      )
                    }
                    placeholder="Message to send..."
                  />
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setQuickButtons((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, icon: "" as const } : item,
                          ),
                        )
                      }
                      className={cn(
                        "flex size-7 items-center justify-center rounded border text-[10px] text-muted-foreground transition-colors",
                        btn.icon === ""
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-accent",
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
                          onClick={() =>
                            setQuickButtons((prev) =>
                              prev.map((item, i) =>
                                i === index ? { ...item, icon: opt.key } : item,
                              ),
                            )
                          }
                          className={cn(
                            "flex size-7 items-center justify-center rounded border transition-colors",
                            btn.icon === opt.key
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:bg-accent",
                          )}
                        >
                          <Icon className="size-3" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setQuickButtons((prev) => [
                  ...prev,
                  { label: "", icon: "", message: "" },
                ])
              }
            >
              <PlusIcon className="mr-1 size-3" />
              Add Button
            </Button>
          </div>

          {/* Input Placeholder */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Input Placeholder
            </label>
            <Input
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value)}
              placeholder="Enter placeholder text..."
            />
          </div>

          {/* Suggestions */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Suggestion Questions
            </label>
            <p className="text-muted-foreground text-xs">Click to fill input</p>
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={suggestion}
                    onChange={(e) =>
                      setSuggestions((prev) =>
                        prev.map((item, i) =>
                          i === index ? e.target.value : item,
                        ),
                      )
                    }
                    placeholder="Enter suggestion..."
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() =>
                      setSuggestions((prev) =>
                        prev.filter((_, i) => i !== index),
                      )
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

          {/* Enable Voice */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              Voice Input
            </label>
            <Switch checked={enableVoice} onCheckedChange={setEnableVoice} />
          </div>

          {/* Enable Attachment */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              Attachment Upload
            </label>
            <Switch
              checked={enableAttachment}
              onCheckedChange={setEnableAttachment}
            />
          </div>
        </div>
      </ScrollArea>

      {/* Bottom bar */}
      <div className="flex items-center gap-2 border-t px-4 py-2">
        <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
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
