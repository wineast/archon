"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Assertion, AssertionType } from "@/lib/eval/types";
import { Trash2Icon } from "lucide-react";

const TEXT_ASSERTION_TYPES: { value: AssertionType; label: string }[] = [
  { value: "contains", label: "Contains" },
  { value: "not-contains", label: "Not Contains" },
  { value: "regex", label: "Regex" },
  { value: "length-min", label: "Min Length" },
  { value: "length-max", label: "Max Length" },
  { value: "json-valid", label: "JSON Valid" },
];

const TOOL_ASSERTION_TYPES: { value: AssertionType; label: string }[] = [
  { value: "tool-called", label: "Tool Called" },
  { value: "tool-not-called", label: "Tool Not Called" },
  { value: "tool-called-with-contains", label: "Tool Args Contains" },
  { value: "tool-called-with-exact", label: "Tool Args Exact" },
];

function getPlaceholder(type: AssertionType): string {
  switch (type) {
    case "regex":
      return "e.g. \\d+";
    case "length-min":
    case "length-max":
      return "e.g. 100";
    case "tool-called":
    case "tool-not-called":
      return "e.g. getWeather";
    case "tool-called-with-contains":
    case "tool-called-with-exact":
      return '{"tool": "name", "args": {...}}';
    default:
      return "value...";
  }
}

interface AssertionRowProps {
  assertion: Assertion;
  onChange: (updated: Assertion) => void;
  onDelete: () => void;
}

export function AssertionRow({ assertion, onChange, onDelete }: AssertionRowProps) {
  const hideValue = assertion.type === "json-valid";

  return (
    <div className="flex items-center gap-2">
      <Select
        value={assertion.type}
        onValueChange={(value: AssertionType) =>
          onChange({ ...assertion, type: value })
        }
      >
        <SelectTrigger className="w-[160px]" size="sm" data-testid="select-assertion-type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Text</SelectLabel>
            {TEXT_ASSERTION_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Tool</SelectLabel>
            {TOOL_ASSERTION_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {!hideValue && (
        <Input
          className="h-8 flex-1 text-sm"
          value={assertion.value}
          onChange={(e) => onChange({ ...assertion, value: e.target.value })}
          placeholder={getPlaceholder(assertion.type)}
          data-testid="input-assertion-value"
        />
      )}
      {hideValue && <div className="flex-1" />}
      <Button variant="ghost" size="sm" onClick={onDelete} className="size-8 p-0">
        <Trash2Icon className="size-3.5" />
      </Button>
    </div>
  );
}
