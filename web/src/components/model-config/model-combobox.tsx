"use client";

import { useMemo, useState } from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ModelSelectorLogo } from "@/components/ai-elements/model-selector";
import { useModels } from "@/lib/models/hooks";

interface ModelComboboxProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabledProviders?: string[];
}

export function ModelCombobox({ value, onChange, className, disabledProviders }: ModelComboboxProps) {
  const disabledSet = useMemo(
    () => new Set(disabledProviders ?? []),
    [disabledProviders]
  );
  const [open, setOpen] = useState(false);
  const { models } = useModels();

  const grouped = useMemo(() => {
    const map = new Map<string, typeof models>();
    for (const m of models) {
      const list = map.get(m.provider) ?? [];
      list.push(m);
      map.set(m.provider, list);
    }
    return map;
  }, [models]);

  const selected = models.find((m) => m.modelId === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("h-8 w-full justify-between text-sm font-normal", className)}
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <ModelSelectorLogo provider={selected.provider} />
              {selected.name}
            </span>
          ) : (
            <span className="text-muted-foreground">Select model...</span>
          )}
          <ChevronsUpDownIcon className="ml-auto size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command
          filter={(value, search) => {
            const model = models.find((m) => m.modelId === value);
            if (!model) return 0;
            const haystack = `${model.modelId} ${model.name} ${model.provider}`.toLowerCase();
            return haystack.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Search models..." />
          <CommandList>
            <CommandEmpty>No models found.</CommandEmpty>
            {Array.from(grouped.entries()).map(([provider, items]) => {
              const isProviderDisabled = disabledSet.has(provider);
              return (
                <CommandGroup
                  key={provider}
                  heading={
                    isProviderDisabled
                      ? `${provider} (请先配置 API Key)`
                      : provider
                  }
                >
                  {items.map((m) => (
                    <CommandItem
                      key={m.modelId}
                      value={m.modelId}
                      disabled={isProviderDisabled}
                      onSelect={(v) => {
                        if (isProviderDisabled) return;
                        onChange(v);
                        setOpen(false);
                      }}
                      className={isProviderDisabled ? "opacity-50" : ""}
                    >
                      <ModelSelectorLogo provider={m.provider} />
                      <span className="truncate">{m.name}</span>
                      {value === m.modelId && !isProviderDisabled && (
                        <CheckIcon className="ml-auto size-3.5" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
